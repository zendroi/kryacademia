<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', fn (Request $request) => [Limit::perMinute(30)->by('login-ip:'.$request->ip()), Limit::perMinute(5)->by('login-account:'.hash('sha256', strtolower(is_string($request->input('email')) ? $request->input('email') : 'invalid-email')))]);
        RateLimiter::for('inquiry', fn (Request $request) => Limit::perHour(10)->by('inquiry:'.$request->ip()));
        RateLimiter::for('registration', fn (Request $request) => Limit::perHour(20)->by('registration:'.$request->ip()));
        RateLimiter::for('workspace', fn (Request $request) => Limit::perMinute(120)->by('workspace:'.$request->user()?->id));
        RateLimiter::for('accounts', fn (Request $request) => Limit::perHour(20)->by('accounts:'.$request->user()?->id));
    }
}
