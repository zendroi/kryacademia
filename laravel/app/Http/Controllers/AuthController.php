<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\PrivateFiles;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AuthController extends Controller
{
    public function showLogin()
    {
        if (Auth::check()) {
            return redirect(Auth::user()->role === 'admin' ? '/admin' : '/teacher');
        }

        return Inertia::render('Auth/Login');
    }

    public function login(Request $request)
    {
        $email = $request->input('email');
        if (is_string($email)) {
            $request->merge(['email' => strtolower(trim($email))]);
        }
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email', 'max:254'],
            'password' => ['required', 'string'],
        ]);

        if (Auth::attempt($credentials, $request->boolean('remember'))) {
            $user = Auth::user();

            if ($user->status === 'pending') {
                Auth::logout();

                return back()->withErrors(['email' => 'Akun Anda sedang dalam proses verifikasi admin.']);
            }

            if ($user->status === 'suspended' || $user->status === 'rejected') {
                Auth::logout();

                return back()->withErrors(['email' => 'Akun Anda telah dinonaktifkan atau ditolak.']);
            }

            $request->session()->regenerate();
            $request->session()->put('account_revision', (int) $user->revision);

            return redirect()->intended($user->role === 'admin' ? '/admin' : '/teacher');
        }

        return back()->withErrors([
            'email' => 'Email atau password tidak sesuai.',
        ]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }

    public function showRegister(Request $request)
    {
        return Inertia::render('Auth/Register', [
            'invitation' => $request->query('invitation', ''),
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'invitation' => ['required', 'string', 'size:64'],
            'name' => ['required', 'string', 'max:120'],
            'bank' => ['required', 'string', 'max:100'],
            'account' => ['required', 'string', 'max:50'],
            'holder' => ['required', 'string', 'max:120'],
            'identity' => ['required', 'file', 'mimes:jpeg,png,webp,jpg', 'max:2048'],
        ]);

        $hash = hash('sha256', $validated['invitation']);

        $onboarding = DB::table('teacher_onboarding')
            ->where('invitation_hash', $hash)
            ->where('expires_at', '>', now())
            ->whereNull('completed_at')
            ->first();

        if (! $onboarding) {
            return back()->withErrors(['invitation' => 'Undangan registrasi tidak valid atau sudah kadaluarsa. Hubungi admin.']);
        }

        $files = app(PrivateFiles::class);
        try {
            DB::transaction(function () use ($onboarding, $validated, $request, $files, $hash): void {
                $user = User::where('email', $onboarding->email)->lockForUpdate()->firstOrFail();
                $invitation = DB::table('teacher_onboarding')->where('email', $user->email)->lockForUpdate()->first();
                if ($user->role !== 'teacher' || $user->status !== 'pending' || ! $invitation || $invitation->completed_at || ! hash_equals($invitation->invitation_hash, $hash) || now()->greaterThanOrEqualTo($invitation->expires_at)) {
                    throw ValidationException::withMessages(['invitation' => 'This invitation has expired or already been used.']);
                }
                $photo = $files->store($request->file('identity'), imageOnly: true);
                DB::table('teacher_onboarding')->where('email', $user->email)->update(['bank_name' => $validated['bank'], 'bank_account' => $validated['account'], 'account_holder' => $validated['holder'], 'identity_path' => null, 'identity_object_id' => $photo['id'], 'completed_at' => now(), 'updated_at' => now()]);
                $user->update(['name' => $validated['name'], 'bank_name' => $validated['bank'], 'bank_account' => $validated['account'], 'account_holder' => $validated['holder'], 'identity_path' => null, 'revision' => $user->revision + 1]);
                app(WorkspaceController::class)->syncAccount($user);
                DB::table('portal_account_events')->insert(['id' => (string) Str::uuid(), 'actor_email' => $user->email, 'target_email' => $user->email, 'action' => 'register', 'note' => 'Private identity and bank details submitted', 'created_at' => now()]);
            });
            $files->commit();
        } catch (\Throwable $error) {
            $files->rollback();
            throw $error;
        }

        return redirect()->route('login')->with('success', 'Profil Anda berhasil didaftarkan! Menunggu persetujuan admin.');
    }
}
