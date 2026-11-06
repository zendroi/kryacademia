<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TeacherNotification extends Model
{
    use HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'teacher_email',
        'record_id',
        'title',
        'message',
        'read',
        'source_job_id',
    ];

    protected function casts(): array
    {
        return [
            'read' => 'boolean',
        ];
    }
}
