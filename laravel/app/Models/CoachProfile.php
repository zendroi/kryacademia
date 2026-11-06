<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CoachProfile extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'specialty',
        'level',
        'image',
        'email',
        'portal_email',
        'bio',
        'sort_order',
        'revision',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'sort_order' => 'integer',
            'revision' => 'integer',
        ];
    }
}
