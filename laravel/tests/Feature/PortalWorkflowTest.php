<?php

namespace Tests\Feature;

use App\Http\Controllers\WorkspaceController;
use App\Models\User;
use App\Services\PrivateFiles;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PortalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Storage::fake('local');
    }

    private function account(string $role = 'teacher', array $attributes = []): User
    {
        $user = User::factory()->create(['role' => $role, 'status' => 'active', 'revision' => 0, 'review_note' => '', ...$attributes]);
        app(WorkspaceController::class)->syncAccount($user);

        return $user;
    }

    private function signIn(User $user): void
    {
        $this->actingAs($user)->withSession(['account_revision' => (int) $user->revision]);
    }

    private function classroom(User $teacher): void
    {
        DB::table('institutions')->insert(['id' => 'review-school', 'name' => 'Review School', 'city' => 'Surabaya', 'country' => 'Indonesia', 'active' => true]);
        DB::table('klass_types')->insert(['id' => 'review-coding', 'title' => 'Review Coding', 'category' => 'Technology', 'active' => true]);
        DB::table('class_groups')->insert(['id' => 'review-group', 'klass_type_id' => 'review-coding', 'institution_id' => 'review-school', 'group_name' => 'Grade 5', 'active' => true, 'mode' => 'Onsite']);
        DB::table('coach_profiles')->insert(['id' => 'review-coach', 'name' => 'Review Coach', 'specialty' => 'Coding', 'portal_email' => $teacher->email, 'active' => true]);
        DB::table('coach_assignments')->insert(['class_group_id' => 'review-group', 'coach_id' => 'review-coach']);
        foreach (['present', 'absent'] as $id) {
            DB::table('student_profiles')->insert(['id' => $id, 'name' => 'Review '.$id, 'institution_id' => 'review-school', 'grade' => '5', 'active' => true]);
            DB::table('enrollments')->insert(['class_group_id' => 'review-group', 'student_id' => $id, 'status' => 'active']);
        }
    }

    private function journal(): array
    {
        return ['kind' => 'meeting', 'classId' => 'review-group', 'date' => '2027-01-12', 'title' => 'Review Journal', 'content' => ['teacherAttendance' => 'Present', 'reflection' => 'Students completed their project.', 'students' => [['id' => 'present', 'attendance' => 'Present', 'score' => '92', 'feedback' => 'Clear explanation.'], ['id' => 'absent', 'attendance' => 'Absent', 'score' => '', 'feedback' => '']]], 'files' => [], 'submit' => true];
    }

    public function test_journal_review_and_historical_read_access_are_preserved(): void
    {
        $teacher = $this->account();
        $admin = $this->account('admin');
        $this->classroom($teacher);
        $this->signIn($teacher);
        $input = $this->journal();
        $image = UploadedFile::fake()->image('review.png', 20, 20);
        $input['files'] = [['id' => (string) Str::uuid(), 'name' => 'review.png', 'mime' => 'image/png', 'size' => $image->getSize(), 'data' => 'data:image/png;base64,'.base64_encode(file_get_contents($image->getRealPath()))]];
        $saved = $this->postJson('/workspace/records', $input)->assertOk()->assertJsonPath('ok', true)->json('record');
        self::assertSame('', $saved['content']['students'][1]['feedback']);
        $file = $saved['files'][0]['id'];
        $this->get('/api/teaching-files/'.$file)->assertOk();
        $this->signIn($admin);
        $this->postJson('/workspace/records/review', ['id' => $saved['id'], 'revision' => $saved['revision'], 'status' => 'Approved', 'note' => '', 'remarks' => []])->assertOk()->assertJsonPath('record.status', 'Approved');
        $this->assertDatabaseCount('teaching_events', 2);
        $this->signIn($teacher);
        $this->postJson('/workspace/records', [...$input, 'id' => $saved['id'], 'revision' => 1])->assertUnprocessable();
        DB::table('coach_assignments')->delete();
        $this->getJson('/workspace/teacher')->assertOk()->assertJsonCount(0, 'catalog.klasses')->assertJsonCount(0, 'catalog.students')->assertJsonCount(1, 'records');
        $this->get('/api/teaching-files/'.$file)->assertOk();
        $this->postJson('/workspace/records', [...$input, 'id' => $saved['id'], 'revision' => 1])->assertUnprocessable();
        $this->signIn($this->account());
        $this->get('/api/teaching-files/'.$file)->assertNotFound();
        $this->postJson('/workspace/records', $input)->assertUnprocessable();
        $this->getJson('/admin')->assertForbidden();
        $this->getJson('/workspace/accounts')->assertForbidden();
    }

    public function test_teacher_onboarding_is_private_and_required_for_approval(): void
    {
        $admin = $this->account('admin');
        $this->signIn($admin);
        $this->postJson('/workspace/accounts', ['name' => 'Review Invalid', 'email' => ['invalid@example.test'], 'password' => 'PrivateTemporaryPassword2027!'])->assertUnprocessable();
        $response = $this->postJson('/workspace/accounts', ['name' => 'Review Invited', 'email' => 'invited@example.test', 'password' => 'PrivateTemporaryPassword2027!'])->assertOk();
        $user = User::where('email', 'invited@example.test')->firstOrFail();
        $this->postJson('/workspace/accounts/review', ['id' => (string) $user->id, 'revision' => 0, 'action' => 'approve', 'note' => ''])->assertUnprocessable();
        parse_str(parse_url($response->json('invitation'), PHP_URL_QUERY), $query);
        $this->post('/register', ['invitation' => $query['invitation'], 'name' => 'Review Invited', 'bank' => 'Review Bank', 'account' => '00112233', 'holder' => 'Review Invited', 'identity' => UploadedFile::fake()->image('identity.png', 20, 20)])->assertRedirect('/login');
        $identity = DB::table('teacher_onboarding')->where('email', $user->email)->first();
        self::assertNotNull($identity->identity_object_id);
        self::assertNull($user->fresh()->identity_path);
        self::assertSame('00112233', $identity->bank_account);
        $this->signIn($admin);
        $this->get('/api/teacher-identities/'.$identity->identity_object_id)->assertOk();
        $this->postJson('/workspace/accounts/review', ['id' => (string) $user->id, 'revision' => 1, 'action' => 'approve', 'note' => 'Verified privately'])->assertOk()->assertJsonPath('account.status', 'active');
        $this->signIn($user->fresh());
        $this->get('/api/teacher-identities/'.$identity->identity_object_id)->assertNotFound();
        DB::table('users')->where('id', $user->id)->increment('revision');
        $this->getJson('/workspace/teacher')->assertUnauthorized();
    }

    public function test_stale_drafts_are_rejected_and_admin_request_notes_are_preserved(): void
    {
        $teacher = $this->account();
        $admin = $this->account('admin');
        $this->classroom($teacher);
        $this->signIn($teacher);
        $id = (string) Str::uuid();
        $draft = ['kind' => 'request', 'classId' => 'review-group', 'date' => '2027-01-12', 'title' => 'Review materials', 'content' => ['reason' => 'For the project', 'timing' => 'Before class', 'requestLines' => [['id' => $id, 'name' => 'Paper', 'quantity' => '10 sheets', 'adminNote' => 'Teacher must not set this']]], 'files' => [], 'submit' => true];
        $saved = $this->postJson('/workspace/records', $draft)->assertOk()->assertJsonPath('record.content.requestLines.0.adminNote', '')->json('record');
        $this->signIn($admin);
        $reviewed = $this->postJson('/workspace/records/review', ['id' => $saved['id'], 'revision' => 0, 'status' => 'Needs revision', 'note' => 'Clarify quantity', 'remarks' => [['id' => $id, 'adminNote' => 'Admin will prepare it']]])->assertOk()->json('record');
        $this->signIn($teacher);
        $this->postJson('/workspace/records', [...$draft, 'id' => $saved['id'], 'revision' => 0])->assertUnprocessable();
        $this->postJson('/workspace/records', [...$draft, 'id' => $saved['id'], 'revision' => $reviewed['revision']])->assertOk()->assertJsonPath('record.content.requestLines.0.adminNote', 'Admin will prepare it');
        $this->assertDatabaseCount('teaching_records', 1);
        $this->assertDatabaseCount('teaching_events', 3);
    }

    public function test_catalog_edits_feed_the_public_page_and_detect_stale_revisions(): void
    {
        $this->signIn($this->account('admin'));
        $input = ['kind' => 'klasses', 'id' => null, 'revision' => 0, 'input' => ['title' => 'Review New Klass', 'category' => 'Technology', 'schedule' => 'Monday 15:00 - 16:00', 'mode' => 'Onsite', 'coachIds' => [], 'studentIds' => [], 'deadlines' => ['semesterStart' => '', 'syllabus' => '', 'meetings' => []]]];
        $saved = $this->postJson('/workspace/catalog', $input)->assertOk()->json('catalog.klasses.0');
        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('publicCatalog.klasses.0.0', 'Review New Klass')->etc());
        $input['id'] = $saved['id'];
        $input['input']['title'] = 'Review Edited Klass';
        $this->postJson('/workspace/catalog', $input)->assertUnprocessable();
        $input['revision'] = $saved['revision'];
        $this->postJson('/workspace/catalog', $input)->assertOk();
        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('publicCatalog.klasses.0.0', 'Review Edited Klass')->etc());
    }

    public function test_notifications_deduplicate_and_follow_jakarta_deadlines(): void
    {
        $teacher = $this->account();
        $this->classroom($teacher);
        DB::table('submission_deadlines')->insert(['id' => 'review-deadline', 'class_group_id' => 'review-group', 'kind' => 'meeting', 'meeting_date' => '2027-01-12', 'due_date' => '2027-01-12']);
        foreach (['2027-01-09', '2027-01-11', '2027-01-13'] as $index => $day) {
            $this->travelTo(CarbonImmutable::parse($day.' 09:00:00', 'Asia/Jakarta'));
            $this->artisan('academy:notifications')->assertSuccessful();
            $this->artisan('academy:notifications')->assertSuccessful();
            $this->assertDatabaseCount('teacher_notifications', $index + 1);
        }
        self::assertNotEmpty(app(Schedule::class)->events());
    }

    public function test_syllabus_lesson_journal_and_canva_material_workflow(): void
    {
        $teacher = $this->account();
        $admin = $this->account('admin');
        $this->classroom($teacher);
        $this->signIn($teacher);
        $syllabus = ['kind' => 'syllabus', 'classId' => 'review-group', 'date' => '2027-01-11', 'title' => 'Review semester syllabus', 'content' => ['workflowVersion' => 2, 'academicYear' => '2026 - 2027', 'semester' => '2', 'description' => 'Coding projects', 'objectives' => 'Build and explain a program.', 'values' => 'Curiosity and teamwork', 'projects' => 'Interactive story', 'projectDescription' => 'A student-created game.', 'mainCoach' => 'Review Coach', 'sessions' => [['date' => '2027-01-12', 'time' => '15:00', 'topic' => 'Sequences', 'phase' => 'Creating']]], 'files' => [], 'submit' => true];
        $saved = $this->postJson('/workspace/records', $syllabus)->assertOk()->json('record');
        $this->signIn($admin);
        $this->postJson('/workspace/records/review', ['id' => $saved['id'], 'revision' => 0, 'status' => 'Approved', 'note' => 'Ready', 'remarks' => []])->assertOk();
        DB::table('class_meetings')->insert(['id' => (string) Str::uuid(), 'class_group_id' => 'review-group', 'meeting_date' => '2027-01-12', 'configured' => true, 'canva_url' => 'https://canva.link/tf9z5tip7qyaou8', 'worksheet_url' => 'https://canva.link/8fjc4y6njxplyrs']);
        $this->signIn($teacher);
        $common = ['workflowVersion' => 2, 'syllabusId' => $saved['id'], 'meetingNumber' => 1, 'mainCoach' => 'Review Coach'];
        $plan = ['kind' => 'lesson-plan', 'classId' => 'review-group', 'date' => '2027-01-12', 'title' => 'Review lesson', 'content' => [...$common, 'objectives' => 'Sequence actions.', 'resources' => 'Computers', 'assessment' => 'Explain the project.', 'steps' => [['title' => 'Build', 'phase' => 'Creating', 'minutes' => '30', 'purpose' => 'Practice sequences', 'teacherActivity' => 'Model one example', 'studentActivity' => 'Create a story']]], 'files' => [], 'submit' => true];
        $this->postJson('/workspace/records', $plan)->assertOk()->assertJsonPath('record.content.canvaUrl', 'https://canva.link/tf9z5tip7qyaou8');
        $wrong = $plan;
        $wrong['date'] = '2027-01-13';
        $this->postJson('/workspace/records', $wrong)->assertUnprocessable();
        $journal = $this->journal();
        $journal['content'] = [...$journal['content'], ...$common];
        $journal['content']['students'][0]['score'] = '';
        $journal['content']['students'][0]['ratings'] = ['affective' => '3', 'problemSolving' => '4', 'storytelling' => '3', 'performance' => '4'];
        $this->postJson('/workspace/records', $journal)->assertOk()->assertJsonPath('record.content.students.0.ratings.problemSolving', '4');
        $slides = ['kind' => 'slides', 'classId' => 'review-group', 'date' => '2027-01-12', 'title' => 'Review material recap', 'content' => [...$common, 'notes' => 'Slides updated after the lesson.', 'canvaUrl' => 'https://canva.link/teacher-cannot-replace-assigned'], 'files' => [], 'submit' => true];
        $this->postJson('/workspace/records', $slides)->assertOk()->assertJsonPath('record.content.canvaUrl', 'https://canva.link/tf9z5tip7qyaou8');
        $this->assertDatabaseCount('teaching_records', 4);
        $this->assertDatabaseCount('lesson_plan_steps', 1);
        $this->assertDatabaseCount('syllabus_meetings', 1);
    }

    public function test_unsafe_files_are_rejected_and_images_are_reencoded(): void
    {
        $files = app(PrivateFiles::class);
        $stored = $files->store(UploadedFile::fake()->image('fake.php', 20, 20), imageOnly: true);
        self::assertSame('image/webp', $stored['mime']);
        self::assertStringEndsWith('.webp', $stored['name']);
        $object = DB::table('portal_file_objects')->where('id', $stored['id'])->first();
        self::assertSame('image/webp', (new \finfo(FILEINFO_MIME_TYPE))->buffer($files->read($object)));
        $this->expectException(ValidationException::class);
        $files->store("%PDF-1.7\n1 0 obj << /OpenAction << /J#53 (inert-test) >> >> endobj\n%%EOF", 'unsafe.pdf');
    }

    public function test_demo_seeding_does_not_reset_passwords_or_revive_archives(): void
    {
        $this->seed();
        $admin = User::where('email', 'admin@krya.global')->firstOrFail();
        $admin->update(['password' => 'MyChangedPrivatePassword2027!']);
        DB::table('institutions')->where('id', 'elyon')->update(['active' => false]);
        $this->seed();
        self::assertTrue(Hash::check('MyChangedPrivatePassword2027!', $admin->fresh()->password));
        self::assertFalse((bool) DB::table('institutions')->where('id', 'elyon')->value('active'));
    }

    public function test_inquiry_requires_consent_and_appears_in_admin_inbox(): void
    {
        $input = ['name' => 'Review Parent', 'email' => 'parent@example.test', 'phone' => '08123456789', 'place' => 'Surabaya', 'type' => 'Klass', 'affiliation' => 'Parent', 'institution' => '', 'message' => 'Please share the schedule.', 'language' => 'id', 'details' => ['klass' => 'Coding', 'mode' => 'Online']];
        $this->postJson('/inquiry', $input)->assertUnprocessable();
        $this->postJson('/inquiry', [...$input, 'consent' => true, 'details' => []])->assertUnprocessable();
        $this->postJson('/inquiry', [...$input, 'consent' => true, 'phone' => 'invalid'])->assertUnprocessable();
        $this->post('/inquiry', [...$input, 'consent' => true])->assertRedirect();
        $this->post('/inquiry', [...$input, 'consent' => true])->assertRedirect();
        $this->signIn($this->account('admin'));
        $inquiry = $this->getJson('/workspace/inquiries')->assertOk()->assertJsonCount(1, 'records')->assertJsonPath('records.0.name', 'Review Parent')->assertJsonPath('records.0.details.klass', 'Coding')->assertJsonPath('records.0.details.mode', 'Online')->json('records.0');
        $this->postJson('/workspace/inquiries/status', ['id' => $inquiry['id'], 'status' => 'Contacted'])->assertOk()->assertJsonPath('record.status', 'Contacted');
    }

    public function test_login_accepts_legacy_bcrypt_and_throttles_repeated_attempts(): void
    {
        $this->postJson('/login', ['email' => ['invalid@example.test'], 'password' => 'InvalidPassword2027!'])->assertUnprocessable();
        $user = $this->account('admin', ['email' => 'admin-legacy@example.test']);
        DB::table('users')->where('id', $user->id)->update(['password' => str_replace('$2y$', '$2a$', Hash::make('LegacyPrivatePassword2027!'))]);
        $this->post('/login', ['email' => $user->email, 'password' => 'LegacyPrivatePassword2027!'])->assertRedirect('/admin');
        $this->get('/admin')->assertOk();
        $this->post('/logout')->assertRedirect('/login');
        for ($i = 0; $i < 5; $i++) {
            $this->post('/login', ['email' => 'unknown@example.test', 'password' => 'wrong'])->assertRedirect();
        }
        $this->post('/login', ['email' => 'unknown@example.test', 'password' => 'wrong'])->assertTooManyRequests();
    }
}
