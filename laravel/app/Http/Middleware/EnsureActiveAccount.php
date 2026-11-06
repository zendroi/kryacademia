<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAccount
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user) {
            $user->refresh();
        }
        if (! $user || $user->status !== 'active' || (int) $request->session()->get('account_revision', -1) !== (int) $user->revision) {
            auth()->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            if ($request->expectsJson()) {
                return response()->json(['ok' => false, 'message' => 'Your session changed. Sign in again.'], 401);
            }

            return redirect()->route('login')->with('error', 'Your session changed. Sign in again.');
        }

        return $next($request);
    }
}
