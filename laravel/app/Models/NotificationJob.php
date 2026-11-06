<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class NotificationJob extends Model
{
    use HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'dedupe_key',
        'teacher_email',
        'record_id',
        'class_id',
        'deadline_id',
        'due_date',
        'stage',
        'title',
        'message',
        'status',
        'attempts',
        'available_at',
        'delivered_at',
        'last_error',
        'retried_by',
        'retried_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'available_at' => 'datetime',
            'delivered_at' => 'datetime',
            'retried_at' => 'datetime',
        ];
    }
}
