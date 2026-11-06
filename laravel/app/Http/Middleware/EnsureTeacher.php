<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTeacher
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! auth()->check()) {
            return redirect()->route('login');
        }

        if (auth()->user()->role !== 'teacher') {
            abort(403, 'Unauthorized. Teacher access required.');
        }

        if (auth()->user()->status !== 'active') {
            auth()->logout();

            return redirect()->route('login')->with('error', 'Your account is pending review or suspended.');
        }

        return $next($request);
    }
}
