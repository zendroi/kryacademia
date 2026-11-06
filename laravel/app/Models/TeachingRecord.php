<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TeachingRecord extends Model
{
    use HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'teacher_email',
        'kind',
        'class_id',
        'meeting_date',
        'title',
        'content',
        'files',
        'status',
        'reviewer_note',
        'revision',
    ];

    protected function casts(): array
    {
        return [
            'content' => 'array',
            'files' => 'array',
            'meeting_date' => 'date',
            'revision' => 'integer',
        ];
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_email', 'email');
    }

    public function attachedFiles()
    {
        return $this->hasMany(TeachingFile::class, 'record_id', 'id');
    }
}
