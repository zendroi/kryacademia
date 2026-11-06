<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassGroup extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'klass_type_id',
        'institution_id',
        'academic_period_id',
        'mode',
        'sort_order',
        'revision',
        'active',
        'group_name',
        'planned_meetings',
        'reported_students',
        'canva_url',
        'target_meetings',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'sort_order' => 'integer',
            'revision' => 'integer',
            'planned_meetings' => 'integer',
            'reported_students' => 'integer',
            'target_meetings' => 'integer',
        ];
    }

    public function klassType()
    {
        return $this->belongsTo(KlassType::class, 'klass_type_id', 'id');
    }

    public function institution()
    {
        return $this->belongsTo(Institution::class, 'institution_id', 'id');
    }

    public function academicPeriod()
    {
        return $this->belongsTo(AcademicPeriod::class, 'academic_period_id', 'id');
    }

    public function coaches()
    {
        return $this->belongsToMany(CoachProfile::class, 'coach_assignments', 'class_group_id', 'coach_id');
    }

    public function students()
    {
        return $this->belongsToMany(StudentProfile::class, 'enrollments', 'class_group_id', 'student_id')
            ->withPivot('status', 'enrolled_at');
    }
}
