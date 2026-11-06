<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\InquiryController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');
Route::post('/inquiry', [InquiryController::class, 'store'])->middleware('throttle:inquiry')->name('inquiry.store');
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:registration');
Route::get('/admin', [WorkspaceController::class, 'admin'])->middleware(['auth', 'active', 'admin'])->name('admin.dashboard');
Route::get('/teacher', [WorkspaceController::class, 'teacher'])->middleware(['auth', 'active', 'teacher'])->name('teacher.dashboard');
Route::get('/api/academy-images/{id}', [WorkspaceController::class, 'file'])->defaults('kind', 'image');
Route::middleware(['auth', 'active'])->group(function (): void {
    Route::get('/api/teaching-files/{id}', [WorkspaceController::class, 'file']);
    Route::get('/api/teacher-identities/{id}', [WorkspaceController::class, 'file'])->defaults('kind', 'identity');
});
Route::middleware(['auth', 'active', 'throttle:workspace'])->prefix('workspace')->group(function (): void {
    Route::post('/logout', [WorkspaceController::class, 'logout']);
    Route::middleware('teacher')->group(function (): void {
        Route::get('/teacher', [WorkspaceController::class, 'teacherData']);
        Route::post('/records', [WorkspaceController::class, 'saveRecord']);
        Route::post('/notifications/read', [WorkspaceController::class, 'markRead']);
    });
    Route::middleware('admin')->group(function (): void {
        Route::post('/catalog', [WorkspaceController::class, 'catalog']);
        Route::get('/accounts', [WorkspaceController::class, 'accounts']);
        Route::post('/accounts', [WorkspaceController::class, 'provision'])->middleware('throttle:accounts');
        Route::post('/accounts/invitation', [WorkspaceController::class, 'invitation'])->middleware('throttle:accounts');
        Route::post('/accounts/review', [WorkspaceController::class, 'reviewAccount']);
        Route::post('/records/review', [WorkspaceController::class, 'reviewRecord']);
        Route::get('/inquiries', [WorkspaceController::class, 'inquiries']);
        Route::post('/inquiries/status', [WorkspaceController::class, 'inquiryStatus']);
        Route::get('/jobs', [WorkspaceController::class, 'jobs']);
        Route::post('/jobs/retry', [WorkspaceController::class, 'retryJob']);
    });
});
