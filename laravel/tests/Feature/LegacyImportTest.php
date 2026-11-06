<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\PrivateFiles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class LegacyImportTest extends TestCase
{
    use RefreshDatabase;

    private string $key;

    private string $directory;

    private string $objectId;

    private string $imageBytes;

    private string $passwordHash;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->key = bin2hex(random_bytes(32));
        config(['academy.backup_key' => $this->key]);
        $this->directory = Storage::disk('local')->path('export');
        mkdir($this->directory);
        $this->objectId = (string) Str::uuid();
        $image = imagecreatetruecolor(2, 2);
        ob_start();
        imagewebp($image);
        $this->imageBytes = ob_get_clean();
        imagedestroy($image);
        $this->passwordHash = str_replace('$2y$', '$2a$', Hash::make('LegacyPrivatePassword2027!'));
        $this->exportFixture();
    }

    private function encrypt(string $bytes, string $path): void
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($bytes, 'aes-256-gcm', hex2bin($this->key), OPENSSL_RAW_DATA, $iv, $tag);
        file_put_contents($this->directory.'/'.$path, $iv.$tag.$cipher);
    }

    private function exportFixture(): void
    {
        $schema = json_decode(file_get_contents(database_path('schema/legacy.json')), true);
        $stamp = '2026-11-03 01:02:03.123456+00';
        $record = 'b824cdd6-bd10-49a5-9127-e3cd3b515a01';
        $file = 'b824cdd6-bd10-49a5-9127-e3cd3b515a02';
        $rows = [
            'portal_users' => [['id' => '21', 'email' => 'legacy@example.test', 'password_hash' => $this->passwordHash, 'display_name' => 'Review Legacy', 'role' => 'teacher', 'status' => 'active', 'created_at' => $stamp, 'bank_account' => '0011223344']],
            'institutions' => [['id' => 'archived-school', 'name' => 'Review School 🧬', 'city' => 'Surabaya', 'country' => 'Indonesia', 'active' => 'false', 'created_at' => $stamp, 'updated_at' => $stamp]],
            'klass_types' => [['id' => 'archived-type', 'title' => 'Archived Coding', 'category' => 'Technology', 'active' => 'false', 'created_at' => $stamp, 'updated_at' => $stamp]],
            'class_groups' => [['id' => 'archived-group', 'klass_type_id' => 'archived-type', 'institution_id' => 'archived-school', 'mode' => 'Onsite', 'active' => 'false', 'created_at' => $stamp, 'updated_at' => $stamp]],
            'portal_file_objects' => [['id' => $this->objectId, 'pathname' => 'portal/'.$this->objectId, 'provider' => 'blob', 'ready' => 'true', 'size' => (string) strlen($this->imageBytes), 'sha256' => hash('sha256', $this->imageBytes), 'created_at' => $stamp]],
            'teacher_onboarding' => [['email' => 'legacy@example.test', 'invitation_hash' => hash('sha256', 'review'), 'expires_at' => '2027-01-01 00:00:00+00', 'completed_at' => $stamp, 'identity_object_id' => $this->objectId, 'bank_name' => 'Review Bank', 'bank_account' => '0011223344', 'account_holder' => 'Review Legacy']],
            'teaching_records' => [['id' => $record, 'teacher_email' => 'legacy@example.test', 'kind' => 'meeting', 'class_id' => 'archived-group', 'meeting_date' => '2026-11-02', 'title' => 'Archived journal', 'content' => '{"notes":"Original history 🧬"}', 'files' => '[]', 'status' => 'Approved', 'revision' => '7', 'updated_at' => $stamp]],
            'teaching_files' => [['id' => $file, 'record_id' => $record, 'name' => 'Original documentation.webp', 'mime' => 'image/webp', 'object_id' => $this->objectId, 'size' => (string) strlen($this->imageBytes)]],
            'teaching_events' => [['id' => 'b824cdd6-bd10-49a5-9127-e3cd3b515a03', 'record_id' => $record, 'actor_email' => 'admin@example.test', 'action' => 'review', 'before_data' => '{"status":"Submitted"}', 'after_data' => '{"status":"Approved"}', 'created_at' => $stamp]],
        ];
        $manifest = ['version' => 1, 'createdAt' => '2026-11-03T01:02:03Z', 'ddlHash' => hash_file('sha256', database_path('schema/legacy-mysql.sql')), 'tables' => [], 'files' => [['id' => $this->objectId, 'pathname' => 'portal/'.$this->objectId, 'size' => strlen($this->imageBytes), 'sha256' => hash('sha256', $this->imageBytes)]]];
        foreach ($schema as $name => $definition) {
            $columns = [];
            $values = [];
            foreach ($definition['columns'] as $column => $field) {
                $type = match ($field['type']) {
                    'BIGINT' => 'int8', 'INT' => 'int4', 'BOOLEAN' => 'bool', 'JSON' => 'jsonb', 'DATETIME' => 'timestamptz', 'DATE' => 'date', 'TIME' => 'time', 'MEDIUMBLOB' => 'bytea', 'DECIMAL' => 'numeric', default => 'text'
                };
                $columns[] = ['name' => $column, 'type' => $type];
                $values[$column] = $field['nullable'] ? null : match ($type) {
                    'int4', 'int8', 'numeric' => '0', 'bool' => 'false', 'jsonb' => '{}', 'timestamptz' => $stamp, default => ''
                };
            }
            $payload = json_encode(['columns' => $columns, 'rows' => array_map(fn ($row) => array_intersect_key([...$values, ...$row], $values), $rows[$name] ?? [])], JSON_THROW_ON_ERROR);
            $manifest['tables'][$name] = ['count' => count($rows[$name] ?? []), 'sha256' => hash('sha256', $payload)];
            $this->encrypt($payload, $name.'.enc');
        }
        $this->encrypt($this->imageBytes, $this->objectId.'.enc');
        $this->encrypt(json_encode($manifest), 'manifest.enc');
    }

    public function test_import_preserves_accounts_archives_history_timestamps_and_private_files(): void
    {
        $code = Artisan::call('academy:import-legacy', ['directory' => $this->directory]);
        self::assertSame(0, $code, Artisan::output());
        $this->assertDatabaseCount('users', 0);
        $code = Artisan::call('academy:import-legacy', ['directory' => $this->directory, '--apply' => true]);
        self::assertSame(0, $code, Artisan::output());
        self::assertSame($this->passwordHash, DB::table('portal_users')->where('id', 21)->value('password_hash'));
        self::assertSame('0011223344', DB::table('teacher_onboarding')->value('bank_account'));
        self::assertSame('2026-11-03 01:02:03.123456', DB::table('teaching_records')->value('updated_at'));
        self::assertFalse((bool) DB::table('class_groups')->value('active'));
        $this->assertDatabaseCount('teaching_events', 1);
        $object = DB::table('portal_file_objects')->where('id', $this->objectId)->first();
        self::assertSame($this->imageBytes, app(PrivateFiles::class)->read($object));
        $this->post('/login', ['email' => 'legacy@example.test', 'password' => 'LegacyPrivatePassword2027!'])->assertRedirect('/teacher');
        $this->getJson('/workspace/teacher')->assertOk()->assertJsonCount(0, 'catalog.klasses')->assertJsonPath('records.0.status', 'Approved')->assertJsonPath('records.0.content.notes', 'Original history 🧬');
        DB::table('users')->where('id', 21)->update(['name' => 'Admin updated after import']);
        $this->artisan('academy:import-legacy', ['directory' => $this->directory, '--apply' => true])->assertSuccessful();
        self::assertSame('Admin updated after import', DB::table('users')->where('id', 21)->value('name'));
    }

    public function test_wrong_key_and_modified_export_are_rejected_without_writes(): void
    {
        config(['academy.backup_key' => str_repeat('0', 64)]);
        $this->artisan('academy:import-legacy', ['directory' => $this->directory, '--apply' => true])->assertFailed();
        config(['academy.backup_key' => $this->key]);
        $path = $this->directory.'/teaching_events.enc';
        $bytes = file_get_contents($path);
        $bytes[40] = chr(ord($bytes[40]) ^ 1);
        file_put_contents($path, $bytes);
        $this->artisan('academy:import-legacy', ['directory' => $this->directory, '--apply' => true])->assertFailed();
        $this->assertDatabaseCount('portal_users', 0);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('legacy_imports', 0);
    }

    public function test_import_refuses_to_replace_existing_laravel_accounts(): void
    {
        $user = User::factory()->create(['name' => 'Existing account']);
        $this->artisan('academy:import-legacy', ['directory' => $this->directory, '--apply' => true])->assertFailed();
        self::assertSame('Existing account', $user->fresh()->name);
        $this->assertDatabaseCount('portal_users', 0);
    }

    public function test_schema_checksums_accept_windows_and_linux_line_endings_but_reject_file_metadata_mismatches(): void
    {
        $bytes = file_get_contents($this->directory.'/manifest.enc');
        $manifest = json_decode(openssl_decrypt(substr($bytes, 28), 'aes-256-gcm', hex2bin($this->key), OPENSSL_RAW_DATA, substr($bytes, 0, 12), substr($bytes, 12, 16)), true, flags: JSON_THROW_ON_ERROR);
        $ddl = str_replace("\r\n", "\n", file_get_contents(database_path('schema/legacy-mysql.sql')));
        foreach ([$ddl, str_replace("\n", "\r\n", $ddl)] as $variant) {
            $manifest['ddlHash'] = hash('sha256', $variant);
            $this->encrypt(json_encode($manifest), 'manifest.enc');
            $this->artisan('academy:import-legacy', ['directory' => $this->directory])->assertSuccessful();
        }
        $manifest['files'][0]['pathname'] = 'different-original-path';
        $this->encrypt(json_encode($manifest), 'manifest.enc');
        $this->artisan('academy:import-legacy', ['directory' => $this->directory, '--apply' => true])->assertFailed();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('portal_file_objects', 0);
    }
}
