<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AcademicPeriod extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'institution_id',
        'name',
        'start_date',
        'end_date',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }
}
