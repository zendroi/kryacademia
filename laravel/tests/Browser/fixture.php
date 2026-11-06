<?php

use App\Http\Controllers\WorkspaceController;
use App\Models\User;
use App\Services\AcademyService;
use App\Services\PrivateFiles;
use App\Services\TeachingService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$database = config('database.connections.sqlite.database');
$root = realpath(storage_path('framework/testing'));
if (! app()->environment('testing') || config('database.default') !== 'sqlite' || ! $root || realpath(dirname($database)) !== $root || ! str_starts_with(basename($database), 'ui-check-') || filesize($database) !== 0) {
    throw new RuntimeException('Browser fixtures require a new dedicated SQLite file inside storage/framework/testing.');
}
$password = getenv('KRYA_UI_PASSWORD');
if (! $password || strlen($password) < 15) {
    throw new RuntimeException('Set an ephemeral browser-test password.');
}
Artisan::call('migrate', ['--force' => true]);
$admin = User::factory()->create(['name' => 'Review Admin', 'email' => 'ui-admin@example.test', 'password' => $password, 'role' => 'admin', 'status' => 'active', 'revision' => 0]);
$teacher = User::factory()->create(['name' => 'Review Teacher', 'email' => 'ui-teacher@example.test', 'password' => $password, 'role' => 'teacher', 'status' => 'active', 'revision' => 0]);
$workspace = app(WorkspaceController::class);
$workspace->syncAccount($admin);
$workspace->syncAccount($teacher);
$academy = app(AcademyService::class);
$save = fn (string $kind, array $input) => $academy->save($kind, null, 0, $input, $admin->email, app(PrivateFiles::class));
$catalog = $save('institutions', ['name' => 'Review Partner School', 'country' => 'Indonesia', 'city' => 'Surabaya', 'logo' => '']);
$institution = $catalog['institutions'][0]['id'];
$catalog = $save('coaches', ['name' => 'Review Teacher', 'specialty' => 'Coding', 'level' => 'Coach', 'image' => '', 'portalEmail' => $teacher->email]);
$coach = $catalog['coaches'][0]['id'];
$catalog = $save('klasses', ['title' => 'Review Coding', 'category' => 'Technology', 'schedule' => 'Tuesday 15:00 - 16:00', 'description' => 'Learn programming through projects.', 'image' => '/klass/digitechnology-coding.webp', 'mode' => 'Onsite', 'institutionId' => $institution, 'coachIds' => [$coach], 'studentIds' => [], 'plannedMeetings' => '1', 'deadlines' => ['semesterStart' => '2027-01-11', 'syllabus' => '2027-01-04', 'meetings' => [['date' => '2027-01-12', 'lessonPlan' => '2027-01-11', 'feedback' => '2027-01-13', 'canvaUrl' => 'https://canva.link/tf9z5tip7qyaou8']]]]);
$class = $catalog['klasses'][0]['id'];
foreach (['Review Student One', 'Review Student Two'] as $name) {
    $save('students', ['name' => $name, 'grade' => '5', 'institutionId' => $institution, 'classIds' => [$class]]);
}
Auth::setUser($teacher);
$service = app(TeachingService::class);
$syllabus = $service->save(['kind' => 'syllabus', 'classId' => $class, 'date' => '2027-01-11', 'title' => 'Review Semester Syllabus', 'content' => ['workflowVersion' => 2, 'academicYear' => '2026 - 2027', 'semester' => '2', 'mainCoach' => 'Review Teacher', 'description' => 'Coding projects', 'objectives' => 'Create and explain a program', 'values' => 'Teamwork', 'projects' => 'Interactive story', 'projectDescription' => 'Create an original story', 'sessions' => [['date' => '2027-01-12', 'time' => '15:00', 'topic' => 'Sequences', 'phase' => 'Creating']]], 'files' => [], 'submit' => true], $teacher, $academy, app(PrivateFiles::class));
$service->review(['id' => $syllabus['record']['id'], 'revision' => 0, 'status' => 'Approved', 'note' => 'Ready', 'remarks' => []], $admin);
$imagePath = storage_path('framework/testing/ui-check-photo.png');
$image = imagecreatetruecolor(20, 20);
imagepng($image, $imagePath);
imagedestroy($image);
echo json_encode(['admin' => $admin->email, 'teacher' => $teacher->email, 'classId' => $class, 'image' => $imagePath], JSON_THROW_ON_ERROR);
