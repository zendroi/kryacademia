<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TeachingService
{
    public function records(?string $teacher = null): array
    {
        $query = DB::table('teaching_records')->orderByDesc('updated_at');
        if ($teacher !== null) {
            $query->where('teacher_email', $teacher);
        }

        return $query->get()->map(fn ($record) => $this->record($record))->all();
    }

    public function record(object $row): array
    {
        $content = json_decode($row->content ?: '{}', true, flags: JSON_THROW_ON_ERROR);
        $document = DB::table('teaching_documents')->where('record_id', $row->id)->first();
        if ($document) {
            $map = ['workflow_version' => 'workflowVersion', 'syllabus_id' => 'syllabusId', 'meeting_number' => 'meetingNumber', 'main_coach' => 'mainCoach', 'assistant_coach' => 'assistantCoach', 'room' => 'room', 'notes' => 'notes', 'objectives' => 'objectives', 'worksheet_url' => 'worksheetUrl'];
            foreach ($map as $column => $field) {
                if ($document->$column !== null) {
                    $content[$field] = in_array($field, ['workflowVersion', 'meetingNumber'], true) ? (int) $document->$column : $document->$column;
                }
            }
            $table = ['syllabus' => 'teaching_syllabuses', 'lesson-plan' => 'teaching_lesson_plans', 'meeting' => 'teaching_meeting_journals', 'slides' => 'teaching_materials', 'request' => 'class_requests'][$row->kind];
            $detail = DB::table($table)->where('record_id', $row->id)->first();
            $map = ['academic_year' => 'academicYear', 'semester' => 'semester', 'deadline' => 'deadline', 'description' => 'description', 'learning_values' => 'values', 'projects' => 'projects', 'project_description' => 'projectDescription', 'outline' => 'outline', 'activities' => 'activities', 'resources' => 'resources', 'assessment' => 'assessment', 'teacher_attendance' => 'teacherAttendance', 'reflection' => 'reflection', 'canva_url' => 'canvaUrl', 'items' => 'items', 'reason' => 'reason', 'timing' => 'timing'];
            foreach ($map as $column => $field) {
                if ($detail && isset($detail->$column)) {
                    $content[$field] = $detail->$column;
                }
            }
            if ($row->kind === 'syllabus') {
                $content['sessions'] = DB::table('syllabus_meetings')->where('syllabus_id', $row->id)->orderBy('position')->get()->map(fn ($session) => ['date' => $session->meeting_date, 'time' => substr($session->start_time, 0, 5), 'topic' => $session->topic, 'phase' => $session->phase])->all();
            } elseif ($row->kind === 'lesson-plan') {
                $content['steps'] = DB::table('lesson_plan_steps')->where('record_id', $row->id)->orderBy('position')->get()->map(fn ($step) => ['title' => $step->title, 'phase' => $step->phase, 'minutes' => $step->minutes === null ? '' : (string) $step->minutes, 'purpose' => $step->purpose, 'teacherActivity' => $step->teacher_activity, 'studentActivity' => $step->student_activity])->all();
            } elseif ($row->kind === 'meeting') {
                $content['students'] = DB::table('student_meeting_feedback')->where('record_id', $row->id)->orderBy('position')->get()->map(function ($student): array {
                    $value = ['id' => $student->student_id, 'name' => $student->student_name ?? '', 'attendance' => $student->attendance, 'score' => $student->score === null ? '' : (string) $student->score, 'feedback' => $student->feedback];
                    if ($student->has_ratings) {
                        $value['ratings'] = ['affective' => $student->affective === null ? '' : (string) $student->affective, 'problemSolving' => $student->problem_solving === null ? '' : (string) $student->problem_solving, 'storytelling' => $student->storytelling === null ? '' : (string) $student->storytelling, 'performance' => $student->performance === null ? '' : (string) $student->performance];
                    }

                    return $value;
                })->all();
            } elseif ($row->kind === 'request') {
                $content['requestLines'] = DB::table('class_request_items')->where('record_id', $row->id)->orderBy('position')->get()->map(fn ($line) => ['id' => $line->id, 'name' => $line->name, 'quantity' => $line->quantity, 'adminNote' => $line->admin_note])->all();
            }
        }
        $files = DB::table('teaching_files')->where('record_id', $row->id)->where('active', true)->orderBy('position')->get()->map(fn ($file) => ['id' => $file->id, 'name' => $file->name, 'mime' => $file->mime, 'size' => (int) ($file->size ?? strlen($file->bytes ?? ''))])->all();

        return ['id' => $row->id, 'teacherEmail' => $row->teacher_email, 'kind' => $row->kind, 'classId' => $row->class_id, 'date' => substr($row->meeting_date, 0, 10), 'title' => $row->title, 'content' => $content, 'files' => $files, 'status' => $row->status, 'reviewerNote' => $row->reviewer_note ?? '', 'updatedAt' => $row->updated_at, 'revision' => (int) $row->revision];
    }

    public function save(array $input, User $user, AcademyService $academy, PrivateFiles $files): array
    {
        Validator::make($input, ['id' => 'nullable|uuid', 'revision' => 'nullable|integer|min:0', 'kind' => 'required|in:meeting,lesson-plan,syllabus,slides,request', 'classId' => 'required|string|max:160', 'date' => 'required|date_format:Y-m-d', 'title' => 'required|string|max:140', 'content' => 'required|array', 'files' => 'present|array|max:8', 'submit' => 'required|boolean'])->validate();
        $this->check(strlen(json_encode($input['content'])) <= 120000, 'The content is too large.');
        try {
            $result = DB::transaction(function () use ($input, $user, $academy, $files): array {
                $account = DB::table('users')->where('id', $user->id)->lockForUpdate()->first();
                $this->check($account && $account->role === 'teacher' && $account->status === 'active' && (int) $account->revision === (int) $user->revision, 'Your account changed. Sign in again.');
                DB::table('class_groups')->where('id', $input['classId'])->lockForUpdate()->first();
                $catalog = $academy->catalog($user->email);
                $klass = collect($catalog['klasses'])->firstWhere('id', $input['classId']);
                $this->check((bool) $klass, 'This Klass is not assigned to your teacher account.');
                $query = DB::table('teaching_records')->where('teacher_email', $user->email)->where('kind', $input['kind'])->where('class_id', $input['classId'])->where('meeting_date', $input['date']);
                $before = $query->lockForUpdate()->first();
                $this->check(empty($input['id']) || ($before && $before->id === $input['id']), 'This teaching record changed. Refresh the workspace.');
                $this->check(! $before || (array_key_exists('revision', $input) && (int) $before->revision === $input['revision']), 'This record changed in another tab or review. Refresh before saving.');
                $this->check(! $before || ! in_array($before->status, ['Approved', 'Fulfilled'], true), 'Approved or fulfilled records cannot be changed.');
                $previous = $before ? $this->record($before) : null;
                $content = $input['content'];
                $this->validateContent($input, $content, $catalog, $klass, $academy);
                if ($input['kind'] === 'request') {
                    $lines = $content['requestLines'] ?? [];
                    foreach ($lines as &$line) {
                        $line['adminNote'] = collect($previous['content']['requestLines'] ?? [])->firstWhere('id', $line['id'])['adminNote'] ?? '';
                    }
                    unset($line);
                    if (isset($content['requestLines'])) {
                        $content['requestLines'] = $lines;
                    }
                }
                $id = $before->id ?? (string) Str::uuid();
                $revision = (int) ($before->revision ?? -1) + 1;
                $metadata = [];
                foreach ($input['files'] as $file) {
                    $this->check(is_array($file), 'Invalid attachment.');
                    if (isset($file['data'])) {
                        $upload = $files->fromData($file);
                        $fileId = (string) Str::uuid();
                        $metadata[] = ['id' => $fileId, 'name' => $upload['name'], 'mime' => $upload['mime'], 'size' => $upload['size'], 'object_id' => $upload['id']];
                    } else {
                        $stored = $before ? DB::table('teaching_files')->where('id', $file['id'] ?? '')->where('record_id', $id)->where('active', true)->first() : null;
                        $this->check((bool) $stored, 'This attachment is not part of your record.');
                        $metadata[] = ['id' => $stored->id, 'name' => $stored->name, 'mime' => $stored->mime, 'size' => $stored->size, 'object_id' => $stored->object_id];
                    }
                }
                $this->check(count(array_unique(array_column($metadata, 'id'))) === count($metadata) && array_sum(array_column($metadata, 'size')) <= 8388608, 'Attachments are duplicated or too large.');
                $this->check(count(array_filter($metadata, fn ($file) => str_starts_with($file['mime'], 'image/'))) <= 3 && count(array_filter($metadata, fn ($file) => $file['mime'] === 'application/pdf')) <= 1, 'Attach up to three photos and one PDF.');
                if ($input['kind'] === 'slides' && $input['submit'] && empty($content['canvaUrl'])) {
                    $this->check(in_array('application/pdf', array_column($metadata, 'mime'), true), 'Add a Canva link or slides PDF.');
                }
                $row = ['teacher_email' => $user->email, 'kind' => $input['kind'], 'class_id' => $input['classId'], 'meeting_date' => $input['date'], 'title' => trim($input['title']), 'content' => json_encode($content), 'files' => json_encode(array_map(fn ($file) => array_intersect_key($file, array_flip(['id', 'name', 'mime', 'size'])), $metadata)), 'status' => $input['submit'] ? 'Submitted' : 'Draft', 'reviewer_note' => '', 'revision' => $revision, 'updated_at' => now()->format('Y-m-d H:i:s.u')];
                if (! $before) {
                    $row['created_at'] = now();
                }
                DB::table('teaching_records')->updateOrInsert(['id' => $id], $row);
                DB::table('teaching_files')->where('record_id', $id)->whereNotIn('id', array_column($metadata, 'id'))->update(['active' => false]);
                foreach ($metadata as $position => $file) {
                    DB::table('teaching_files')->updateOrInsert(['id' => $file['id']], ['record_id' => $id, 'name' => $file['name'], 'mime' => $file['mime'], 'size' => $file['size'], 'object_id' => $file['object_id'], 'position' => $position, 'active' => true]);
                }
                $this->writeWorkflow($id, $input['classId'], $input['date'], $input['kind'], $content);
                $after = $this->record(DB::table('teaching_records')->where('id', $id)->first());
                $this->event($id, $user->email, $input['submit'] ? 'submit' : 'save', $previous, $after);
                if ($input['submit']) {
                    $this->notify('submit:'.$id.':'.$revision, $user->email, $id, $input['title'].' submitted', 'Your submission is waiting for admin review.');
                }

                return ['ok' => true, 'record' => $after, 'records' => $this->records($user->email)];
            });
            $files->commit();

            return $result;
        } catch (\Throwable $error) {
            $files->rollback();
            throw $error;
        }
    }

    private function validateContent(array $input, array &$content, array $catalog, array $klass, AcademyService $academy): void
    {
        $kind = $input['kind'];
        $submit = (bool) $input['submit'];
        $v2 = ($content['workflowVersion'] ?? null) === 2;
        $this->check(! isset($content['workflowVersion']) || $v2, 'Invalid workflow version.');
        foreach ($content as $key => $value) {
            if (! in_array($key, ['students', 'steps', 'sessions', 'requestLines', 'workflowVersion', 'meetingNumber'], true)) {
                $this->check(is_string($value) && mb_strlen($value) <= 6000, 'Invalid or oversized text field.');
            }
        }
        foreach (['students' => 'meeting', 'steps' => 'lesson-plan', 'sessions' => 'syllabus', 'requestLines' => 'request'] as $key => $type) {
            $this->check(! isset($content[$key]) || $kind === $type, 'This field belongs to another document type.');
        }
        foreach (['canvaUrl', 'worksheetUrl'] as $key) {
            $academy->canva($content[$key] ?? '');
        }
        $text = function (string $key, bool $required = true) use ($content, $submit): void {
            $this->check(! $required || ! $submit || (is_string($content[$key] ?? null) && trim($content[$key]) !== ''), 'Complete '.$key.' before submitting.');
        };
        if ($v2 && in_array($kind, ['meeting', 'lesson-plan', 'slides'], true)) {
            Validator::make($content, ['syllabusId' => 'required|uuid', 'meetingNumber' => 'required|integer|between:1,36'])->validate();
            $source = DB::table('teaching_records')->where('id', $content['syllabusId'])->where('teacher_email', auth()->user()->email)->where('class_id', $input['classId'])->where('kind', 'syllabus')->whereIn('status', ['Submitted', 'Approved'])->first();
            $this->check((bool) $source, 'Choose your submitted or approved syllabus.');
            $syllabus = $this->record($source);
            $session = $syllabus['content']['sessions'][$content['meetingNumber'] - 1] ?? null;
            $this->check($session && $session['date'] === $input['date'], 'The meeting date must match the selected syllabus meeting.');
            $assigned = collect($klass['deadlines']['meetings'])->firstWhere('date', $input['date']);
            foreach (['canvaUrl', 'worksheetUrl'] as $key) {
                if (! empty($assigned[$key])) {
                    $content[$key] = $assigned[$key];
                }
            }
            $text('mainCoach');
        }
        if ($kind === 'meeting') {
            $this->check(in_array($content['teacherAttendance'] ?? '', ['Present', 'Late', 'Excused', 'Absent'], true), 'Select teacher attendance.');
            $roster = array_values(array_filter($catalog['students'], fn ($student) => in_array($input['classId'], $student['classIds'], true)));
            $entries = $content['students'] ?? null;
            $this->check(is_array($entries) && count($entries) === count($roster) && count(array_unique(array_column($entries, 'id'))) === count($roster), 'Complete the student attendance list.');
            foreach ($entries as &$entry) {
                $student = collect($roster)->firstWhere('id', $entry['id'] ?? '');
                $this->check($student && in_array($entry['attendance'] ?? '', ['Present', 'Late', 'Excused', 'Absent'], true), 'Invalid student attendance.');
                $entry['name'] = $student['name'];
                $this->check(is_string($entry['feedback'] ?? null) && mb_strlen($entry['feedback']) <= 2000 && is_string($entry['score'] ?? null), 'Invalid student feedback.');
                $this->check($entry['score'] === '' || (is_numeric($entry['score']) && (float) $entry['score'] >= 0 && (float) $entry['score'] <= 100), 'Student scores must be between 0 and 100.');
                if (! in_array($entry['attendance'], ['Present', 'Late'], true)) {
                    $entry['score'] = '';
                    $entry['feedback'] = '';
                    if (isset($entry['ratings'])) {
                        $entry['ratings'] = array_fill_keys(['affective', 'problemSolving', 'storytelling', 'performance'], '');
                    }

                    continue;
                }
                if (isset($entry['ratings'])) {
                    foreach (['affective', 'problemSolving', 'storytelling', 'performance'] as $aspect) {
                        $rating = $entry['ratings'][$aspect] ?? null;
                        $this->check(is_string($rating) && ($rating === '' || preg_match('/\A[1-4]\z/', $rating)), 'Rubric scores must be whole numbers from 1 to 4.');
                    }
                }
                if ($submit) {
                    $this->check(trim($entry['feedback']) !== '', 'Add feedback for every attending student.');
                    $this->check($v2 ? isset($entry['ratings']) && count(array_filter($entry['ratings'], fn ($rating) => (bool) preg_match('/\A[1-4]\z/', $rating))) === 4 : $entry['score'] !== '', 'Complete the scores for attending students.');
                }
            }
            unset($entry);
            $content['students'] = $entries;
            $text('reflection');
        } elseif ($kind === 'lesson-plan') {
            $text('objectives');
            $text('resources', $v2);
            $text('activities', ! $v2);
            if ($v2 || isset($content['steps'])) {
                $text('assessment');
                Validator::make($content, ['steps' => 'required|array|min:1|max:12', 'steps.*.phase' => 'required|in:Inspiring,Creating,Dedicating,Exploring,Applying', 'steps.*.minutes' => ($submit ? 'required' : 'nullable').'|integer|between:1,240'])->validate();
                foreach ($content['steps'] as $step) {
                    foreach (['title', 'purpose', 'teacherActivity', 'studentActivity'] as $key) {
                        $this->check(is_string($step[$key] ?? null) && mb_strlen($step[$key]) <= 2000 && (! $submit || trim($step[$key]) !== ''), 'Complete every lesson activity.');
                    }
                }
            }
        } elseif ($kind === 'syllabus') {
            $text('objectives');
            $text('outline', ! $v2);
            if ($v2 || isset($content['sessions'])) {
                foreach (['academicYear', 'semester', 'description', 'values', 'projects', 'projectDescription', 'mainCoach'] as $key) {
                    $text($key);
                }
                Validator::make($content, ['sessions' => 'required|array|min:1|max:36', 'sessions.*.date' => 'required|date_format:Y-m-d|distinct', 'sessions.*.time' => 'required|date_format:H:i', 'sessions.*.topic' => ($submit ? 'required' : 'present').'|string|max:2000', 'sessions.*.phase' => 'required|in:Inspiring,Creating,Dedicating'])->validate();
                $previousDate = '';
                foreach ($content['sessions'] as $session) {
                    $this->check($session['date'] >= $input['date'] && $session['date'] > $previousDate, 'Meeting dates must be chronological and on or after the semester start.');
                    $previousDate = $session['date'];
                }
            }
            if (! empty($klass['deadlines']['semesterStart'])) {
                $this->check($input['date'] === $klass['deadlines']['semesterStart'], 'Use the semester start configured by admin.');
            }
            if (! empty($klass['plannedMeetings']) && $submit) {
                $this->check(count($content['sessions'] ?? []) === (int) $klass['plannedMeetings'], 'Match the planned number of meetings configured by admin.');
            }
            if (! empty($klass['deadlines']['syllabus'])) {
                $content['deadline'] = $klass['deadlines']['syllabus'];
            }
        } elseif ($kind === 'slides') {
            if ($v2) {
                $text('notes');
            }
            $this->check(! $submit || ! empty($content['canvaUrl']) || collect($input['files'])->contains(fn ($file) => ($file['mime'] ?? '') === 'application/pdf'), 'Add a Canva link or slides PDF.');
        } else {
            $text('reason');
            $this->check(in_array($content['timing'] ?? '', ['Before class', 'Before semester'], true), 'Select a request timeframe.');
            if ($content['timing'] === 'Before semester' && empty($content['syllabusId'])) {
                $this->check($input['date'] === ($klass['deadlines']['semesterStart'] ?: config('academy.semester_start')), 'Use the configured semester start date.');
            }
            if (isset($content['requestLines'])) {
                Validator::make($content, ['requestLines' => 'required|array|min:1|max:60', 'requestLines.*.id' => 'required|uuid|distinct', 'requestLines.*.name' => ($submit ? 'required' : 'present').'|string|max:200', 'requestLines.*.quantity' => ($submit ? 'required' : 'present').'|string|max:80'])->validate();
            } else {
                $text('items');
            }
        }
    }

    public function writeWorkflow(string $id, string $class, string $date, string $kind, array $content): void
    {
        $fields = [];
        foreach (['workflowVersion' => 'workflow_version', 'syllabusId' => 'syllabus_id', 'meetingNumber' => 'meeting_number', 'mainCoach' => 'main_coach', 'assistantCoach' => 'assistant_coach', 'room' => 'room', 'notes' => 'notes', 'objectives' => 'objectives', 'worksheetUrl' => 'worksheet_url'] as $field => $column) {
            $fields[$column] = $content[$field] ?? null;
        }
        DB::table('teaching_documents')->updateOrInsert(['record_id' => $id], $fields);
        if ($kind === 'syllabus') {
            $fields = [];
            foreach (['academicYear' => 'academic_year', 'semester' => 'semester', 'deadline' => 'deadline', 'description' => 'description', 'values' => 'learning_values', 'projects' => 'projects', 'projectDescription' => 'project_description', 'outline' => 'outline'] as $field => $column) {
                $fields[$column] = ($content[$field] ?? '') === '' ? null : $content[$field];
            }
            DB::table('teaching_syllabuses')->updateOrInsert(['record_id' => $id], $fields);
            DB::table('syllabus_meetings')->where('syllabus_id', $id)->delete();
            foreach ($content['sessions'] ?? [] as $position => $session) {
                DB::table('syllabus_meetings')->insert(['syllabus_id' => $id, 'position' => $position + 1, 'meeting_date' => $session['date'], 'start_time' => $session['time'], 'topic' => $session['topic'], 'phase' => $session['phase']]);
            }
        } elseif ($kind === 'lesson-plan') {
            DB::table('teaching_lesson_plans')->updateOrInsert(['record_id' => $id], ['activities' => $content['activities'] ?? null, 'resources' => $content['resources'] ?? null, 'assessment' => $content['assessment'] ?? null]);
            DB::table('lesson_plan_steps')->where('record_id', $id)->delete();
            foreach ($content['steps'] ?? [] as $position => $step) {
                DB::table('lesson_plan_steps')->insert(['record_id' => $id, 'position' => $position + 1, 'title' => $step['title'], 'phase' => $step['phase'], 'minutes' => $step['minutes'] === '' ? null : (int) $step['minutes'], 'purpose' => $step['purpose'], 'teacher_activity' => $step['teacherActivity'], 'student_activity' => $step['studentActivity']]);
            }
        } elseif ($kind === 'meeting') {
            $meeting = DB::table('class_meetings')->where('class_group_id', $class)->where('meeting_date', $date)->first();
            $meetingId = $meeting->id ?? (string) Str::uuid();
            if (! $meeting) {
                DB::table('class_meetings')->insert(['id' => $meetingId, 'class_group_id' => $class, 'meeting_date' => $date, 'configured' => false, 'canva_url' => '', 'worksheet_url' => '']);
            }
            DB::table('teaching_meeting_journals')->updateOrInsert(['record_id' => $id], ['meeting_id' => $meetingId, 'teacher_attendance' => $content['teacherAttendance'] ?? null, 'reflection' => $content['reflection'] ?? null]);
            DB::table('student_meeting_feedback')->where('record_id', $id)->delete();
            foreach ($content['students'] ?? [] as $position => $student) {
                $ratings = $student['ratings'] ?? [];
                DB::table('student_meeting_feedback')->insert(['record_id' => $id, 'student_id' => $student['id'], 'student_profile_id' => DB::table('student_profiles')->where('id', $student['id'])->exists() ? $student['id'] : null, 'student_name' => $student['name'] ?? '', 'position' => $position, 'attendance' => $student['attendance'], 'score' => $student['score'] === '' ? null : $student['score'], 'feedback' => $student['feedback'], 'has_ratings' => isset($student['ratings']), 'affective' => ($ratings['affective'] ?? '') ?: null, 'problem_solving' => ($ratings['problemSolving'] ?? '') ?: null, 'storytelling' => ($ratings['storytelling'] ?? '') ?: null, 'performance' => ($ratings['performance'] ?? '') ?: null]);
            }
        } elseif ($kind === 'slides') {
            DB::table('teaching_materials')->updateOrInsert(['record_id' => $id], ['canva_url' => $content['canvaUrl'] ?? null]);
        } else {
            DB::table('class_requests')->updateOrInsert(['record_id' => $id], ['items' => $content['items'] ?? null, 'reason' => $content['reason'] ?? null, 'timing' => $content['timing'] ?? null]);
            DB::table('class_request_items')->where('record_id', $id)->delete();
            foreach ($content['requestLines'] ?? [] as $position => $line) {
                DB::table('class_request_items')->insert(['record_id' => $id, 'id' => $line['id'], 'position' => $position, 'name' => trim($line['name']), 'quantity' => trim($line['quantity']), 'admin_note' => $line['adminNote'] ?? '']);
            }
        }
    }

    public function review(array $input, User $admin): array
    {
        Validator::make($input, ['id' => 'required|uuid', 'revision' => 'required|integer|min:0', 'status' => 'required|in:Approved,Needs revision,Rejected,Fulfilled', 'note' => 'present|string|max:2000', 'remarks' => 'nullable|array|max:60', 'remarks.*.id' => 'required|uuid|distinct', 'remarks.*.adminNote' => 'present|string|max:1000'])->validate();

        return DB::transaction(function () use ($input, $admin): array {
            $row = DB::table('teaching_records')->where('id', $input['id'])->lockForUpdate()->first();
            $this->check($row && (int) $row->revision === $input['revision'], 'This record changed. Refresh the review queue.');
            $this->check($row->status !== 'Draft', 'Drafts are not ready for review.');
            $this->check(! in_array($input['status'], ['Rejected', 'Needs revision'], true) || trim($input['note']) !== '', 'Add a review note.');
            $this->check($input['status'] !== 'Fulfilled' || ($row->kind === 'request' && in_array($row->status, ['Approved', 'Fulfilled'], true)), 'Approve the class request before marking it fulfilled.');
            $before = $this->record($row);
            foreach ($input['remarks'] ?? [] as $remark) {
                $this->check($row->kind === 'request' && DB::table('class_request_items')->where('record_id', $row->id)->where('id', $remark['id'])->exists(), 'Invalid request item.');
                DB::table('class_request_items')->where('record_id', $row->id)->where('id', $remark['id'])->update(['admin_note' => $remark['adminNote']]);
            }
            DB::table('teaching_records')->where('id', $row->id)->update(['status' => $input['status'], 'reviewer_note' => trim($input['note']), 'revision' => $row->revision + 1, 'updated_at' => now()->format('Y-m-d H:i:s.u')]);
            $after = $this->record(DB::table('teaching_records')->where('id', $row->id)->first());
            $this->event($row->id, $admin->email, 'review', $before, $after);
            $this->notify('review:'.$row->id.':'.$after['revision'], $row->teacher_email, $row->id, $row->title.': '.$input['status'], trim($input['note']) ?: 'Admin reviewed your submission.');

            return ['ok' => true, 'record' => $after, 'records' => $this->records()];
        });
    }

    public function notify(string $key, string $email, ?string $record, string $title, string $message): void
    {
        if (DB::table('notification_jobs')->where('dedupe_key', $key)->exists()) {
            return;
        }
        DB::table('notification_jobs')->insertOrIgnore(['id' => (string) Str::uuid(), 'dedupe_key' => $key, 'teacher_email' => $email, 'record_id' => $record, 'title' => $title, 'message' => $message, 'status' => 'pending', 'attempts' => 0, 'available_at' => now(), 'last_error' => '', 'created_at' => now(), 'updated_at' => now()]);
    }

    private function event(string $id, string $email, string $action, ?array $before, array $after): void
    {
        DB::table('teaching_events')->insert(['id' => (string) Str::uuid(), 'record_id' => $id, 'actor_email' => $email, 'action' => $action, 'before_data' => json_encode($before ?? (object) []), 'after_data' => json_encode($after), 'created_at' => now()]);
    }

    private function check(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['record' => $message]);
        }
    }
}
