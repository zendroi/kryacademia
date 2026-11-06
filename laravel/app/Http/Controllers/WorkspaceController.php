<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AcademyService;
use App\Services\PrivateFiles;
use App\Services\TeachingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceController extends Controller
{
    public function __construct(private AcademyService $academy, private TeachingService $teaching, private PrivateFiles $files) {}

    public function admin(Request $request): Response
    {
        return Inertia::render('Admin/Dashboard', ['email' => $request->user()->email, 'initialCatalog' => $this->academy->catalog(), 'initialSubmissions' => $this->teaching->records(), 'initialInquiries' => $this->inquiryRows(), 'initialAccounts' => $this->accountRows()]);
    }

    public function teacher(Request $request): Response
    {
        return Inertia::render('Teacher/Dashboard', ['email' => $request->user()->email, 'initialCatalog' => $this->academy->catalog($request->user()->email), 'initialRecords' => $this->teaching->records($request->user()->email), 'initialNotifications' => $this->notificationRows($request->user()->email), 'config' => ['semesterStart' => config('academy.semester_start'), 'deadline' => config('academy.submission_deadline'), 'sample' => ! config('academy.semester_configured'), 'canvaTemplate' => config('academy.canva_template')]]);
    }

    public function teacherData(Request $request): JsonResponse
    {
        return response()->json(['ok' => true, 'catalog' => $this->academy->catalog($request->user()->email), 'records' => $this->teaching->records($request->user()->email), 'notifications' => $this->notificationRows($request->user()->email)]);
    }

    public function catalog(Request $request): JsonResponse
    {
        $input = $request->validate(['kind' => 'required|in:klasses,institutions,coaches,students', 'id' => 'nullable|string|max:160', 'revision' => 'required|integer|min:0', 'input' => 'required|array']);

        return response()->json(['ok' => true, 'catalog' => $this->academy->save($input['kind'], $input['id'] ?? null, $input['revision'], $input['input'], $request->user()->email, $this->files)]);
    }

    public function saveRecord(Request $request): JsonResponse
    {
        return response()->json($this->teaching->save($request->all(), $request->user(), $this->academy, $this->files));
    }

    public function reviewRecord(Request $request): JsonResponse
    {
        return response()->json($this->teaching->review($request->all(), $request->user()));
    }

    public function accounts(): JsonResponse
    {
        return response()->json(['ok' => true, 'accounts' => $this->accountRows()]);
    }

    public function accountRows(): array
    {
        return DB::table('users as u')->leftJoin('teacher_onboarding as o', 'o.email', '=', 'u.email')->where('u.role', 'teacher')->orderByDesc('u.created_at')->select('u.*', 'o.completed_at', 'o.identity_object_id', 'o.bank_name as onboarding_bank', 'o.bank_account as onboarding_account', 'o.account_holder as onboarding_holder')->get()->map(fn ($row) => ['id' => (string) $row->id, 'name' => $row->name, 'email' => $row->email, 'status' => $row->status, 'revision' => (int) $row->revision, 'note' => $row->review_note ?? '', 'createdAt' => $row->created_at, 'onboardingComplete' => (bool) $row->completed_at && (bool) $row->identity_object_id, 'bankName' => $row->onboarding_bank ?? '', 'bankAccount' => $row->onboarding_account ?? '', 'accountHolder' => $row->onboarding_holder ?? '', 'identityId' => $row->identity_object_id ?? ''])->all();
    }

    public function provision(Request $request): JsonResponse
    {
        $email = $request->input('email');
        if (is_string($email)) {
            $request->merge(['email' => strtolower(trim($email))]);
        }
        $input = $request->validate(['email' => 'required|email|max:254|unique:users,email', 'name' => 'required|string|max:120', 'password' => 'required|string|min:15']);
        $this->check(strlen($input['password']) <= 72, 'Password must be at most 72 UTF-8 bytes.');
        $token = bin2hex(random_bytes(32));
        DB::transaction(function () use ($input, $token, $request): void {
            $user = User::create(['email' => $input['email'], 'name' => trim($input['name']), 'password' => $input['password'], 'role' => 'teacher', 'status' => 'pending', 'revision' => 0]);
            $this->syncAccount($user);
            DB::table('teacher_onboarding')->insert(['email' => $user->email, 'invitation_hash' => hash('sha256', $token), 'expires_at' => now()->addHours(48), 'created_at' => now(), 'updated_at' => now()]);
            $this->accountEvent($request->user()->email, $user->email, 'create', '');
        });

        return response()->json(['ok' => true, 'email' => $input['email'], 'invitation' => '/register?invitation='.$token]);
    }

    public function invitation(Request $request): JsonResponse
    {
        $input = $request->validate(['id' => 'required|integer', 'revision' => 'required|integer|min:0']);
        $token = bin2hex(random_bytes(32));
        DB::transaction(function () use ($input, $token, $request): void {
            $user = User::where('id', $input['id'])->where('role', 'teacher')->lockForUpdate()->first();
            $this->check($user && $user->status === 'pending' && (int) $user->revision === $input['revision'], 'This account changed. Refresh accounts.');
            $onboarding = DB::table('teacher_onboarding')->where('email', $user->email)->lockForUpdate()->first();
            $this->check(! $onboarding || ! $onboarding->completed_at, 'Registration is already complete.');
            DB::table('teacher_onboarding')->updateOrInsert(['email' => $user->email], ['invitation_hash' => hash('sha256', $token), 'expires_at' => now()->addHours(48), 'updated_at' => now()]);
            $user->update(['revision' => $user->revision + 1]);
            $this->syncAccount($user);
            $this->accountEvent($request->user()->email, $user->email, 'invite', '');
        });

        return response()->json(['ok' => true, 'invitation' => '/register?invitation='.$token]);
    }

    public function reviewAccount(Request $request): JsonResponse
    {
        $input = $request->validate(['id' => 'required|integer', 'revision' => 'required|integer|min:0', 'action' => 'required|in:approve,reject,suspend,reactivate,revoke', 'note' => 'present|string|max:500']);
        $email = DB::transaction(function () use ($request, $input): string {
            $user = User::where('id', $input['id'])->where('role', 'teacher')->lockForUpdate()->first();
            $this->check($user && (int) $user->revision === $input['revision'], 'This account changed. Refresh accounts.');
            $allowed = ['pending' => ['approve', 'reject', 'revoke'], 'active' => ['suspend', 'revoke'], 'suspended' => ['reactivate', 'revoke'], 'rejected' => ['revoke']];
            $this->check(in_array($input['action'], $allowed[$user->status] ?? [], true), 'This status transition is not allowed.');
            if (in_array($input['action'], ['approve', 'reactivate'], true)) {
                $onboarding = DB::table('teacher_onboarding')->where('email', $user->email)->lockForUpdate()->first();
                $this->check($onboarding && $onboarding->completed_at && $onboarding->identity_object_id && $onboarding->bank_name && $onboarding->bank_account && $onboarding->account_holder, 'Teacher must complete the KTP and bank details before approval.');
            }
            $status = ['approve' => 'active', 'reactivate' => 'active', 'reject' => 'rejected', 'suspend' => 'suspended', 'revoke' => $user->status][$input['action']];
            $user->update(['status' => $status, 'review_note' => $input['note'], 'revision' => $user->revision + 1, 'remember_token' => null]);
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $this->syncAccount($user);
            $this->accountEvent($request->user()->email, $user->email, $input['action'], $input['note']);

            return $user->email;
        });

        return response()->json(['ok' => true, 'account' => collect($this->accountRows())->firstWhere('email', $email)]);
    }

    public function syncAccount(User $user): void
    {
        $before = DB::table('portal_users')->where('email', $user->email)->first();
        $data = ['password_hash' => $user->password, 'display_name' => $user->name, 'role' => $user->role, 'status' => $user->status, 'revision' => $user->revision, 'review_note' => $user->review_note ?? ''];
        if (! $before) {
            $data += ['id' => $user->id, 'created_at' => $user->created_at, 'ktp_number' => '', 'bank_name' => '', 'bank_account' => '', 'phone' => '', 'temp_password' => ''];
        }
        DB::table('portal_users')->updateOrInsert(['email' => $user->email], $data);
    }

    private function accountEvent(string $actor, string $target, string $action, string $note): void
    {
        DB::table('portal_account_events')->insert(['id' => (string) Str::uuid(), 'actor_email' => $actor, 'target_email' => $target, 'action' => $action, 'note' => $note, 'created_at' => now()]);
    }

    public function inquiryRows(): array
    {
        return DB::table('inquiries')->orderByDesc('created_at')->get()->map(fn ($row) => ['id' => $row->id, 'name' => $row->name, 'email' => $row->email, 'phone' => $row->phone, 'place' => $row->place, 'type' => $row->type, 'affiliation' => $row->affiliation, 'institution' => $row->institution, 'message' => $row->message, 'language' => $row->language, 'details' => json_decode($row->details ?: '{}', true), 'status' => $row->status, 'date' => $row->created_at, 'updatedAt' => $row->updated_at])->all();
    }

    public function inquiries(): JsonResponse
    {
        return response()->json(['ok' => true, 'records' => $this->inquiryRows()]);
    }

    public function inquiryStatus(Request $request): JsonResponse
    {
        $input = $request->validate(['id' => 'required|uuid', 'status' => 'required|in:New,Contacted,Resolved']);
        abort_unless(DB::table('inquiries')->where('id', $input['id'])->exists(), 404);
        DB::table('inquiries')->where('id', $input['id'])->update(['status' => $input['status'], 'updated_at' => now()]);

        return response()->json(['ok' => true, 'record' => collect($this->inquiryRows())->firstWhere('id', $input['id'])]);
    }

    public function notificationRows(string $email): array
    {
        return DB::table('teacher_notifications')->where('teacher_email', $email)->orderByDesc('created_at')->get()->map(fn ($row) => ['id' => $row->id, 'recordId' => $row->record_id ?? '', 'title' => $row->title, 'message' => $row->message, 'read' => (bool) $row->read, 'createdAt' => $row->created_at])->all();
    }

    public function markRead(Request $request): JsonResponse
    {
        DB::table('teacher_notifications')->where('teacher_email', $request->user()->email)->update(['read' => true]);

        return response()->json(['ok' => true]);
    }

    public function jobs(): JsonResponse
    {
        $jobs = DB::table('notification_jobs')->orderByDesc('created_at')->limit(200)->get()->map(fn ($job) => ['id' => $job->id, 'teacherEmail' => $job->teacher_email, 'title' => $job->title, 'status' => $job->status, 'attempts' => (int) $job->attempts, 'createdAt' => $job->created_at, 'availableAt' => $job->available_at, 'lastError' => $job->last_error ?? '']);

        return response()->json(['ok' => true, 'jobs' => $jobs]);
    }

    public function retryJob(Request $request): JsonResponse
    {
        $input = $request->validate(['id' => 'required|uuid']);
        $changed = DB::table('notification_jobs')->where('id', $input['id'])->where('status', 'failed')->update(['status' => 'pending', 'attempts' => 0, 'available_at' => now(), 'last_error' => '', 'retried_by' => $request->user()->email, 'retried_at' => now()]);
        $this->check($changed === 1, 'This job changed or is not failed.');

        return $this->jobs();
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function file(Request $request, string $id, string $kind = 'teaching'): \Symfony\Component\HttpFoundation\Response
    {
        abort_unless(Str::isUuid($id), 404);
        if ($kind === 'identity') {
            abort_unless($request->user()?->role === 'admin', 404);
            $entry = DB::table('teacher_onboarding')->where('identity_object_id', $id)->first();
            abort_unless($entry, 404);
            $object = DB::table('portal_file_objects')->where('id', $id)->first();
            abort_unless($object, 404);
            $bytes = $this->files->read($object);
            $mime = 'image/webp';
            $name = 'identity.webp';
        } elseif ($kind === 'image') {
            $entry = DB::table('academy_images')->where('id', $id)->first();
            abort_unless($entry, 404);
            $bytes = $entry->bytes;
            if ($entry->object_id) {
                $bytes = $this->files->read(DB::table('portal_file_objects')->where('id', $entry->object_id)->firstOrFail());
            }
            $mime = $entry->mime;
            $name = $entry->name;
        } else {
            $entry = DB::table('teaching_files as f')->join('teaching_records as r', 'r.id', '=', 'f.record_id')->where('f.id', $id)->select('f.*', 'r.teacher_email')->first();
            abort_unless($entry && ($request->user()?->role === 'admin' || $entry->teacher_email === $request->user()?->email), 404);
            $bytes = $entry->bytes;
            if ($entry->object_id) {
                $bytes = $this->files->read(DB::table('portal_file_objects')->where('id', $entry->object_id)->firstOrFail());
            }
            $mime = $entry->mime;
            $name = $entry->name;
        }
        abort_unless(is_string($bytes), 404);
        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $name);

        return response($bytes)->header('Content-Type', $mime)->header('Content-Disposition', 'inline; filename="'.$safe.'"')->header('Cache-Control', $kind === 'image' ? 'public, max-age=3600' : 'private, no-store')->header('X-Content-Type-Options', 'nosniff')->header('Content-Security-Policy', "sandbox; default-src 'none'");
    }

    private function check(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['workspace' => $message]);
        }
    }
}
