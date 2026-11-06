<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KlassType extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'title',
        'category',
        'description',
        'image',
        'sort_order',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function classGroups()
    {
        return $this->hasMany(ClassGroup::class, 'klass_type_id', 'id');
    }
}
