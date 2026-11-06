<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AcademyService
{
    public function catalog(?string $teacher = null): array
    {
        $institutions = DB::table('institutions')->where('active', true)->orderBy('sort_order')->get()->map(fn ($row) => ['id' => $row->id, 'name' => $row->name, 'city' => $row->city, 'country' => $row->country, 'logo' => $row->logo ?? '', 'about' => $row->about ?? '', 'address' => $row->address ?? '', 'contactName' => $row->contact_name ?? '', 'email' => $row->email ?? '', 'phone' => $row->phone ?? '', 'website' => $row->website ?? '', 'reportedStudents' => $row->reported_students, 'revision' => (int) $row->revision])->all();
        $coaches = DB::table('coach_profiles')->where('active', true)->orderBy('sort_order')->get()->map(fn ($row) => ['id' => $row->id, 'name' => $row->name, 'specialty' => $row->specialty, 'level' => $row->level, 'image' => $row->image ?? '', 'email' => $row->email ?? '', 'portalEmail' => $row->portal_email ?? '', 'bio' => $row->bio ?? '', 'revision' => (int) $row->revision])->all();
        $assignments = DB::table('coach_assignments')->get();
        $enrollments = DB::table('enrollments')->where('status', 'active')->get();
        $deadlines = DB::table('submission_deadlines')->orderBy('meeting_date')->get();
        $meetings = DB::table('class_meetings')->where('configured', true)->orderBy('meeting_date')->get();
        $groups = DB::table('class_groups as g')->join('klass_types as t', 't.id', '=', 'g.klass_type_id')->leftJoin('class_schedules as s', 's.class_group_id', '=', 'g.id')->leftJoin('academic_periods as p', 'p.id', '=', 'g.academic_period_id')->where('g.active', true)->where('t.active', true)->orderBy('g.sort_order')->select('g.*', 't.title', 't.category', 't.description', 't.image', 's.schedule_text', 'p.start_date')->get();
        $klasses = [];
        foreach ($groups as $group) {
            $team = $assignments->where('class_group_id', $group->id)->pluck('coach_id')->all();
            $school = collect($institutions)->firstWhere('id', $group->institution_id);
            $classDeadlines = $deadlines->where('class_group_id', $group->id);
            $meetingRows = [];
            foreach ($meetings->where('class_group_id', $group->id) as $meeting) {
                $due = $classDeadlines->where('meeting_date', $meeting->meeting_date);
                $meetingRows[] = ['date' => $meeting->meeting_date, 'lessonPlan' => $due->firstWhere('kind', 'lesson-plan')->due_date ?? '', 'feedback' => $due->firstWhere('kind', 'meeting')->due_date ?? '', 'request' => $due->where('kind', 'request')->firstWhere('request_timing', 'Before class')->due_date ?? '', 'canvaUrl' => $meeting->canva_url ?? '', 'worksheetUrl' => $meeting->worksheet_url ?? ''];
            }
            $klasses[] = ['id' => $group->id, 'klassTypeId' => $group->klass_type_id, 'institutionId' => $group->institution_id ?? '', 'title' => $group->title, 'category' => $group->category, 'description' => $group->description ?? '', 'image' => $group->image ?? '', 'mode' => $group->mode, 'groupName' => $group->group_name, 'plannedMeetings' => $group->planned_meetings, 'reportedStudents' => $group->reported_students, 'revision' => (int) $group->revision, 'schedule' => $group->schedule_text ?? '', 'school' => $school['name'] ?? 'KRYAcademia', 'coachIds' => $team, 'coaches' => array_values(array_column(array_filter($coaches, fn ($coach) => in_array($coach['id'], $team, true)), 'name')), 'students' => $enrollments->where('class_group_id', $group->id)->count(), 'deadlines' => ['semesterStart' => $group->start_date ?? '', 'syllabus' => $classDeadlines->firstWhere('kind', 'syllabus')->due_date ?? '', 'semesterRequest' => $classDeadlines->where('kind', 'request')->firstWhere('request_timing', 'Before semester')->due_date ?? '', 'meetings' => $meetingRows]];
        }
        $students = DB::table('student_profiles')->where('active', true)->orderBy('sort_order')->get()->map(function ($row) use ($enrollments, $institutions, $klasses): array {
            $ids = $enrollments->where('student_id', $row->id)->pluck('class_group_id')->all();

            return ['id' => $row->id, 'name' => $row->name, 'grade' => $row->grade ?? '', 'institutionId' => $row->institution_id ?? '', 'score' => (int) $row->score, 'attendance' => (int) $row->attendance, 'revision' => (int) $row->revision, 'classIds' => $ids, 'school' => collect($institutions)->firstWhere('id', $row->institution_id)['name'] ?? '', 'klass' => implode(', ', array_column(array_filter($klasses, fn ($klass) => in_array($klass['id'], $ids, true)), 'title'))];
        })->all();
        foreach ($coaches as &$coach) {
            $ids = array_column(array_filter($klasses, fn ($klass) => in_array($coach['id'], $klass['coachIds'], true)), 'id');
            $coach['classes'] = count($ids);
            $coach['students'] = $enrollments->whereIn('class_group_id', $ids)->pluck('student_id')->unique()->count();
        }
        unset($coach);
        foreach ($institutions as &$institution) {
            $ids = array_column(array_filter($klasses, fn ($klass) => $klass['institutionId'] === $institution['id']), 'id');
            $institution['classes'] = count($ids);
            $institution['students'] = $enrollments->whereIn('class_group_id', $ids)->pluck('student_id')->unique()->count();
        }
        unset($institution);
        if ($teacher !== null) {
            $coachIds = array_column(array_filter($coaches, fn ($coach) => strtolower($coach['portalEmail']) === strtolower($teacher)), 'id');
            $klasses = array_values(array_filter($klasses, fn ($klass) => (bool) array_intersect($klass['coachIds'], $coachIds)));
            $ids = array_column($klasses, 'id');
            $students = array_values(array_filter($students, fn ($student) => (bool) array_intersect($student['classIds'], $ids)));
            foreach ($students as &$student) {
                $student['classIds'] = array_values(array_intersect($student['classIds'], $ids));
            }

            return ['klasses' => $klasses, 'students' => $students];
        }

        return compact('klasses', 'institutions', 'coaches', 'students');
    }

    public function save(string $kind, ?string $id, int $revision, array $input, string $actor, PrivateFiles $files): array
    {
        $tables = ['klasses' => 'class_groups', 'institutions' => 'institutions', 'coaches' => 'coach_profiles', 'students' => 'student_profiles'];
        abort_unless(isset($tables[$kind]), 422);
        try {
            $result = DB::transaction(function () use ($tables, $kind, $id, $revision, $input, $actor, $files): array {
                $table = $tables[$kind];
                $before = $id ? DB::table($table)->where('id', $id)->lockForUpdate()->first() : null;
                $this->check(! $id || ($before && $before->active && (int) $before->revision === $revision), 'This record changed. Refresh the catalog before editing.');
                $id ??= $input['createId'] ?? (string) Str::uuid();
                $this->check(is_string($id) && preg_match('/\A[a-zA-Z0-9:_.-]{1,160}\z/', $id), 'Invalid catalog ID.');
                $this->check($before || ! DB::table($table)->where('id', $id)->exists(), 'This record already exists. Refresh the catalog.');
                $required = $kind === 'klasses' ? ['title', 'category', 'schedule'] : ($kind === 'institutions' ? ['name', 'country'] : ($kind === 'coaches' ? ['name', 'specialty', 'level'] : ['name', 'grade']));
                foreach ($required as $key) {
                    $this->check(is_string($input[$key] ?? null) && trim($input[$key]) !== '' && mb_strlen($input[$key]) <= 180, 'Complete '.$key.'.');
                }
                foreach ($input as $key => $value) {
                    if (is_string($value)) {
                        $this->check(strlen($value) <= 6000, 'Text is too long.');
                    }
                }
                Validator::make($input, ['email' => 'nullable|email|max:254', 'website' => 'nullable|url:http,https|max:1000'])->validate();
                $data = ['active' => true, 'revision' => ($before->revision ?? 0) + 1, 'updated_at' => now()];
                if (! $before) {
                    $data += ['sort_order' => DB::table($table)->count(), 'created_at' => now()];
                }
                $imageKey = $kind === 'institutions' ? 'logo' : ($kind === 'coaches' || $kind === 'klasses' ? 'image' : null);
                $image = $imageKey ? ($input[$imageKey] ?? '') : '';
                if ($imageKey && isset($input[$imageKey.'Upload'])) {
                    $upload = $files->fromData($input[$imageKey.'Upload'], true);
                    DB::table('academy_images')->insert(['id' => $upload['id'], 'name' => $upload['name'], 'mime' => $upload['mime'], 'object_id' => $upload['id'], 'created_at' => now()]);
                    $image = '/api/academy-images/'.$upload['id'];
                }
                $this->check($image === '' || (is_string($image) && str_starts_with($image, '/') && ! str_starts_with($image, '//') && ! str_contains($image, '..')), 'Use an uploaded image.');
                $institution = $input['institutionId'] ?? null;
                $institution = $institution ?: null;
                $this->check(! $institution || DB::table('institutions')->where('id', $institution)->where('active', true)->exists(), 'Choose an active institution.');
                if ($kind === 'klasses') {
                    $this->check(in_array($input['mode'] ?? '', ['Online', 'Onsite', 'Hybrid'], true), 'Choose Online, Onsite or Hybrid.');
                    $type = $before->klass_type_id ?? (($input['klassTypeId'] ?? '') ?: $id);
                    $typeData = ['title' => trim($input['title']), 'category' => trim($input['category']), 'description' => $input['description'] ?? '', 'image' => $image, 'active' => true, 'updated_at' => now()];
                    $existingType = DB::table('klass_types')->where('id', $type)->first();
                    if (! $existingType) {
                        $typeData += ['created_at' => now(), 'sort_order' => DB::table('klass_types')->count()];
                    }
                    DB::table('klass_types')->updateOrInsert(['id' => $type], $typeData);
                    if ($existingType && array_intersect_key((array) $existingType, $typeData) != $typeData) {
                        DB::table('class_groups')->where('klass_type_id', $type)->where('id', '!=', $id)->increment('revision');
                    }
                    $data += ['klass_type_id' => $type, 'institution_id' => $institution, 'mode' => $input['mode'], 'group_name' => $input['groupName'] ?? '', 'planned_meetings' => $this->number($input['plannedMeetings'] ?? null, 72), 'reported_students' => $this->number($input['reportedStudents'] ?? null, 10000)];
                    $this->check($data['planned_meetings'] === null || $data['planned_meetings'] > 0, 'Planned meetings must be between 1 and 72.');
                    $deadlines = $input['deadlines'] ?? ['semesterStart' => '', 'syllabus' => '', 'meetings' => []];
                    Validator::make($deadlines, ['semesterStart' => 'nullable|date_format:Y-m-d', 'syllabus' => 'nullable|date_format:Y-m-d', 'semesterRequest' => 'nullable|date_format:Y-m-d', 'meetings' => 'array|max:72', 'meetings.*.date' => 'required|date_format:Y-m-d|distinct', 'meetings.*.lessonPlan' => 'nullable|date_format:Y-m-d', 'meetings.*.feedback' => 'nullable|date_format:Y-m-d', 'meetings.*.request' => 'nullable|date_format:Y-m-d'])->validate();
                    if (! empty($deadlines['semesterStart'])) {
                        $period = 'period:'.$id.':'.$deadlines['semesterStart'];
                        DB::table('academic_periods')->updateOrInsert(['id' => $period], ['institution_id' => $institution, 'name' => 'Semester starting '.$deadlines['semesterStart'], 'start_date' => $deadlines['semesterStart'], 'active' => true, 'updated_at' => now()]);
                        $data['academic_period_id'] = $period;
                    } else {
                        $data['academic_period_id'] = null;
                    }
                    DB::table($table)->updateOrInsert(['id' => $id], $data);
                    DB::table('class_schedules')->updateOrInsert(['class_group_id' => $id], ['schedule_text' => $input['schedule']]);
                    $coaches = $this->ids($input['coachIds'] ?? [], 'coach_profiles');
                    DB::table('coach_assignments')->where('class_group_id', $id)->whereNotIn('coach_id', $coaches)->delete();
                    foreach ($coaches as $coach) {
                        DB::table('coach_assignments')->updateOrInsert(['class_group_id' => $id, 'coach_id' => $coach], ['assigned_at' => now()]);
                    }
                    $students = $this->ids($input['studentIds'] ?? [], 'student_profiles');
                    $previous = DB::table('enrollments')->where('class_group_id', $id)->where('status', 'active')->pluck('student_id')->all();
                    DB::table('enrollments')->where('class_group_id', $id)->update(['status' => 'withdrawn']);
                    foreach ($students as $student) {
                        DB::table('enrollments')->updateOrInsert(['class_group_id' => $id, 'student_id' => $student], ['status' => 'active', 'enrolled_at' => now()]);
                    }
                    DB::table('student_profiles')->whereIn('id', array_unique(array_merge(array_diff($students, $previous), array_diff($previous, $students))))->increment('revision');
                    $this->deadlines($id, $data['academic_period_id'], $deadlines);
                } elseif ($kind === 'institutions') {
                    $data += ['name' => $input['name'], 'city' => $input['city'] ?? '', 'country' => $input['country'], 'logo' => $image, 'about' => $input['about'] ?? '', 'address' => $input['address'] ?? '', 'contact_name' => $input['contactName'] ?? '', 'email' => $input['email'] ?? '', 'phone' => $input['phone'] ?? '', 'website' => $input['website'] ?? '', 'reported_students' => $this->number($input['reportedStudents'] ?? null, 100000)];
                } elseif ($kind === 'coaches') {
                    $this->check(in_array($input['level'], ['Coach', 'Lead Coach'], true), 'Choose a coach level.');
                    $email = strtolower(trim($input['portalEmail'] ?? ''));
                    $this->check(! $email || $email === ($before->portal_email ?? '') || DB::table('users')->where('email', $email)->where('role', 'teacher')->where('status', 'active')->exists(), 'Link an approved teacher account.');
                    $data += ['name' => $input['name'], 'specialty' => $input['specialty'], 'level' => $input['level'], 'image' => $image, 'email' => $input['email'] ?? '', 'portal_email' => $email, 'bio' => $input['bio'] ?? ''];
                } else {
                    $data += ['name' => $input['name'], 'institution_id' => $institution, 'grade' => $input['grade']];
                }
                if ($kind !== 'klasses') {
                    DB::table($table)->updateOrInsert(['id' => $id], $data);
                }
                if ($kind === 'students') {
                    $groups = $this->ids($input['classIds'] ?? [], 'class_groups');
                    $previous = DB::table('enrollments')->where('student_id', $id)->where('status', 'active')->pluck('class_group_id')->all();
                    DB::table('enrollments')->where('student_id', $id)->update(['status' => 'withdrawn']);
                    foreach ($groups as $group) {
                        DB::table('enrollments')->updateOrInsert(['class_group_id' => $group, 'student_id' => $id], ['status' => 'active', 'enrolled_at' => now()]);
                    }
                    DB::table('class_groups')->whereIn('id', array_unique(array_merge(array_diff($groups, $previous), array_diff($previous, $groups))))->increment('revision');
                }
                DB::table('academy_events')->insert(['id' => (string) Str::uuid(), 'actor_email' => $actor, 'entity_kind' => $kind, 'entity_id' => $id, 'action' => $before ? 'update' : 'create', 'before_data' => json_encode($before ?? (object) []), 'after_data' => json_encode($data), 'created_at' => now()]);

                return $this->catalog();
            });
            $files->commit();

            return $result;
        } catch (\Throwable $error) {
            $files->rollback();
            throw $error;
        }
    }

    private function deadlines(string $id, ?string $period, array $deadlines): void
    {
        DB::table('submission_deadlines')->where('class_group_id', $id)->where(fn ($query) => $query->where('kind', '!=', 'request')->orWhere('request_timing', '!=', ''))->delete();
        DB::table('class_meetings')->where('class_group_id', $id)->update(['configured' => false]);
        $add = function (string $kind, string $date, string $due, string $timing = '') use ($id, $period): void {
            if ($due === '') {
                return;
            }
            $this->check($date !== '', 'Set the semester start before its deadlines.');
            DB::table('submission_deadlines')->insert(['id' => 'deadline:'.$id.':'.$kind.':'.$timing.':'.$date, 'class_group_id' => $id, 'academic_period_id' => $period, 'kind' => $kind, 'meeting_date' => $date, 'due_date' => $due, 'request_timing' => $timing]);
        };
        $add('syllabus', $deadlines['semesterStart'] ?? '', $deadlines['syllabus'] ?? '');
        $add('request', $deadlines['semesterStart'] ?? '', $deadlines['semesterRequest'] ?? '', 'Before semester');
        foreach ($deadlines['meetings'] ?? [] as $meeting) {
            foreach (['canvaUrl', 'worksheetUrl'] as $key) {
                $this->canva($meeting[$key] ?? '');
            }
            $before = DB::table('class_meetings')->where('class_group_id', $id)->where('meeting_date', $meeting['date'])->first();
            DB::table('class_meetings')->updateOrInsert(['class_group_id' => $id, 'meeting_date' => $meeting['date']], ['id' => $before->id ?? (string) Str::uuid(), 'configured' => true, 'canva_url' => $meeting['canvaUrl'] ?? '', 'worksheet_url' => $meeting['worksheetUrl'] ?? '']);
            $add('lesson-plan', $meeting['date'], $meeting['lessonPlan'] ?? '');
            $add('meeting', $meeting['date'], $meeting['feedback'] ?? '');
            $add('request', $meeting['date'], $meeting['request'] ?? '', 'Before class');
        }
    }

    public function canva(string $url): void
    {
        if ($url === '') {
            return;
        }
        $parts = parse_url($url);
        $this->check(strlen($url) <= 1000 && $parts && ($parts['scheme'] ?? '') === 'https' && in_array(strtolower($parts['host'] ?? ''), ['canva.com', 'www.canva.com', 'canva.link'], true) && ! isset($parts['user']) && ! isset($parts['pass']) && ! isset($parts['port']), 'Use a secure Canva design link.');
    }

    private function ids(array $ids, string $table): array
    {
        $this->check(count($ids) <= 1000 && count($ids) === count(array_unique($ids, SORT_REGULAR)), 'Invalid selections.');
        foreach ($ids as $id) {
            $this->check(is_string($id), 'Invalid selection.');
        }
        $this->check(DB::table($table)->where('active', true)->whereIn('id', $ids)->count() === count($ids), 'Choose active records.');

        return $ids;
    }

    private function number(mixed $value, int $max): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $this->check(is_scalar($value) && ctype_digit((string) $value) && (int) $value <= $max, 'Enter a valid count.');

        return (int) $value;
    }

    private function check(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['catalog' => $message]);
        }
    }
}
