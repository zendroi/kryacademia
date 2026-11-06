<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TeachingFile extends Model
{
    use HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'record_id',
        'name',
        'mime',
        'path',
        'position',
        'size',
    ];

    public function record()
    {
        return $this->belongsTo(TeachingRecord::class, 'record_id', 'id');
    }
}
