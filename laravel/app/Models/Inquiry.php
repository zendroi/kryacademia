<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Inquiry extends Model
{
    use HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'submission_hash',
        'name',
        'email',
        'phone',
        'place',
        'type',
        'affiliation',
        'institution',
        'message',
        'language',
        'details',
        'consent_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'consent_at' => 'datetime',
        ];
    }
}
