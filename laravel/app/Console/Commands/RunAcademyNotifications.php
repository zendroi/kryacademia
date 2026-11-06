<?php

namespace App\Console\Commands;

use App\Services\TeachingService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

#[Signature('academy:notifications')]
#[Description('Queue Jakarta deadline reminders and deliver dashboard notifications without sending external messages')]
class RunAcademyNotifications extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $today = CarbonImmutable::today('Asia/Jakarta');
        $service = app(TeachingService::class);
        $deadlines = DB::table('submission_deadlines as d')->join('class_groups as g', 'g.id', '=', 'd.class_group_id')->where('g.active', true)->select('d.*')->get();
        foreach ($deadlines as $deadline) {
            $days = (int) $today->diffInDays(CarbonImmutable::parse($deadline->due_date, 'Asia/Jakarta'), false);
            $stage = $days === 3 ? 'h3' : ($days === 1 ? 'h1' : ($days < 0 ? 'overdue' : null));
            if ($stage === null) {
                continue;
            }
            $teachers = DB::table('coach_assignments as a')->join('coach_profiles as c', 'c.id', '=', 'a.coach_id')->join('users as u', 'u.email', '=', 'c.portal_email')->where('a.class_group_id', $deadline->class_group_id)->where('c.active', true)->where('u.role', 'teacher')->where('u.status', 'active')->distinct()->pluck('u.email');
            foreach ($teachers as $email) {
                if ($this->completed($deadline, $email)) {
                    continue;
                }
                $key = 'deadline:'.hash('sha256', $deadline->id.':'.$deadline->due_date.':'.$email.':'.$stage);
                DB::transaction(function () use ($key, $email, $deadline, $stage, $service): void {
                    $service->notify($key, $email, null, ucfirst($deadline->kind).' '.($stage === 'overdue' ? 'overdue' : 'due '.$deadline->due_date), 'Complete your '.$deadline->kind.' for '.$deadline->class_group_id.' meeting '.$deadline->meeting_date.'. Deadline: '.$deadline->due_date.' (Asia/Jakarta).');
                    DB::table('notification_jobs')->where('dedupe_key', $key)->update(['class_id' => $deadline->class_group_id, 'deadline_id' => $deadline->id, 'due_date' => $deadline->due_date, 'stage' => $stage]);
                });
            }
        }
        $pending = DB::table('notification_jobs')->where('status', 'pending')->where('available_at', '<=', now())->orderBy('available_at')->limit(200)->pluck('id');
        $delivered = 0;
        foreach ($pending as $id) {
            DB::transaction(function () use ($id, &$delivered): void {
                $job = DB::table('notification_jobs')->where('id', $id)->where('status', 'pending')->lockForUpdate()->first();
                if (! $job) {
                    return;
                }
                $active = DB::table('users')->where('email', $job->teacher_email)->where('role', 'teacher')->where('status', 'active')->exists();
                $cancel = ! $active;
                if ($job->deadline_id) {
                    $deadline = DB::table('submission_deadlines')->where('id', $job->deadline_id)->first();
                    $assigned = DB::table('coach_assignments as a')->join('coach_profiles as c', 'c.id', '=', 'a.coach_id')->join('class_groups as g', 'g.id', '=', 'a.class_group_id')->where('a.class_group_id', $job->class_id)->where('c.portal_email', $job->teacher_email)->where('c.active', true)->where('g.active', true)->exists();
                    $cancel = $cancel || ! $deadline || ! $assigned || $deadline->due_date !== $job->due_date || $this->completed($deadline, $job->teacher_email);
                }
                if ($cancel) {
                    DB::table('notification_jobs')->where('id', $id)->update(['status' => 'cancelled', 'updated_at' => now()]);

                    return;
                }
                if (! DB::table('teacher_notifications')->where('source_job_id', $id)->exists()) {
                    DB::table('teacher_notifications')->insert(['id' => (string) Str::uuid(), 'teacher_email' => $job->teacher_email, 'record_id' => $job->record_id, 'title' => $job->title, 'message' => $job->message, 'read' => false, 'source_job_id' => $id, 'created_at' => now(), 'updated_at' => now()]);
                }
                DB::table('notification_jobs')->where('id', $id)->update(['status' => 'delivered', 'delivered_at' => now(), 'attempts' => $job->attempts + 1, 'updated_at' => now()]);
                $delivered++;
            });
        }
        $this->info('Delivered '.$delivered.' dashboard notifications. Email/WhatsApp providers are not configured.');

        return self::SUCCESS;
    }

    private function completed(object $deadline, string $email): bool
    {
        $query = DB::table('teaching_records')->where('teacher_email', $email)->where('class_id', $deadline->class_group_id)->where('kind', $deadline->kind)->where('meeting_date', $deadline->meeting_date)->whereIn('status', ['Submitted', 'Approved', 'Fulfilled']);
        if ($deadline->kind === 'request' && $deadline->request_timing) {
            $query->whereIn('id', DB::table('class_requests')->where('timing', $deadline->request_timing)->select('record_id'));
        }

        return $query->exists();
    }
}
