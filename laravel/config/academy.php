<?php

return [
    'semester_start' => env('TEACHING_SEMESTER_START', '2027-01-11'),
    'submission_deadline' => env('TEACHING_SUBMISSION_DEADLINE', '2027-01-04'),
    'semester_configured' => env('TEACHING_SEMESTER_START') && env('TEACHING_SUBMISSION_DEADLINE'),
    'canva_template' => env('TEACHING_CANVA_TEMPLATE', ''),
    'backup_key' => env('BACKUP_KEY'),
];
