<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    protected function password(): Attribute
    {
        return Attribute::make(get: fn (?string $hash) => preg_replace('/\A\$2[ab]\$/', '\$2y\$', $hash ?? ''));
    }

    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'revision',
        'review_note',
        'ktp_number',
        'bank_name',
        'bank_account',
        'account_holder',
        'phone',
        'identity_path',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isTeacher(): bool
    {
        return $this->role === 'teacher';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function teachingRecords()
    {
        return $this->hasMany(TeachingRecord::class, 'teacher_email', 'email');
    }

    public function notifications()
    {
        return $this->hasMany(TeacherNotification::class, 'teacher_email', 'email');
    }
}
