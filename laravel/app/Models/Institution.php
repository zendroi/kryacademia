<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Institution extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'city',
        'country',
        'logo',
        'about',
        'address',
        'contact_name',
        'email',
        'phone',
        'website',
        'sort_order',
        'revision',
        'active',
        'reported_students',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'sort_order' => 'integer',
            'revision' => 'integer',
            'reported_students' => 'integer',
        ];
    }

    public function students()
    {
        return $this->hasMany(StudentProfile::class, 'institution_id', 'id');
    }

    public function classGroups()
    {
        return $this->hasMany(ClassGroup::class, 'institution_id', 'id');
    }
}
