<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

#[Signature('academy:import-legacy {directory} {--apply : Import only into an empty migrated target database}')]
#[Description('Verify and import the encrypted 37-table legacy export without changing its source')]
class ImportLegacyAcademy extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        try {
            $key = config('academy.backup_key');
            if (! is_string($key) || ! preg_match('/\A[a-f0-9]{64}\z/i', $key)) {
                throw new \RuntimeException('Set BACKUP_KEY locally to the key used by the encrypted export.');
            }
            $key = hex2bin($key);
            $root = realpath($this->argument('directory'));
            if (! $root || ! is_dir($root) || str_starts_with(strtolower($root), strtolower(public_path()))) {
                throw new \RuntimeException('Choose an existing private export directory outside the public root.');
            }
            $manifestBytes = $this->decrypt($root.DIRECTORY_SEPARATOR.'manifest.enc', $key, 1048576);
            $manifest = json_decode($manifestBytes, true, flags: JSON_THROW_ON_ERROR);
            $schema = json_decode(file_get_contents(database_path('schema/legacy.json')), true, flags: JSON_THROW_ON_ERROR);
            $names = array_keys($schema);
            $actual = array_keys($manifest['tables'] ?? []);
            sort($names);
            sort($actual);
            $ddl = str_replace("\r\n", "\n", file_get_contents(database_path('schema/legacy-mysql.sql')));
            $schemaHashes = [hash('sha256', $ddl), hash('sha256', str_replace("\n", "\r\n", $ddl))];
            if (($manifest['version'] ?? null) !== 1 || $names !== $actual || ! in_array($manifest['ddlHash'] ?? '', $schemaHashes, true)) {
                throw new \RuntimeException('The export schema differs from the supported legacy schema. Do not edit the manifest.');
            }
            $data = [];
            $total = 0;
            foreach ($schema as $table => $definition) {
                $bytes = $this->decrypt($root.DIRECTORY_SEPARATOR.$table.'.enc', $key, 134217728);
                $total += strlen($bytes);
                if ($total > 268435456 || ! hash_equals($manifest['tables'][$table]['sha256'], hash('sha256', $bytes))) {
                    throw new \RuntimeException('Export is too large or a table checksum does not match: '.$table);
                }
                $payload = json_decode($bytes, true, flags: JSON_THROW_ON_ERROR);
                $columns = array_column($payload['columns'] ?? [], 'name');
                $expected = array_keys($definition['columns']);
                $checkColumns = $columns;
                sort($expected);
                sort($checkColumns);
                if ($expected !== $checkColumns || count($columns) !== count(array_unique($columns)) || count($payload['rows'] ?? []) !== $manifest['tables'][$table]['count']) {
                    throw new \RuntimeException('Invalid table columns or row count: '.$table);
                }
                foreach ($payload['rows'] as $row) {
                    $rowColumns = array_keys($row);
                    sort($rowColumns);
                    if ($rowColumns !== $expected) {
                        throw new \RuntimeException('Invalid row columns: '.$table);
                    }
                }
                $data[$table] = $payload;
            }
            $objects = [];
            $metadata = array_column($data['portal_file_objects']['rows'], null, 'id');
            foreach ($manifest['files'] ?? [] as $file) {
                if (! is_string($file['id'] ?? null) || ! Str::isUuid($file['id']) || isset($objects[$file['id']])) {
                    throw new \RuntimeException('Invalid file ID in export.');
                }
                $object = $metadata[$file['id']] ?? null;
                if (! $object || ! in_array($object['ready'], [true, 'true', 't', '1', 1], true) || (int) $object['size'] !== $file['size'] || $object['sha256'] !== $file['sha256'] || $object['pathname'] !== $file['pathname']) {
                    throw new \RuntimeException('Private file manifest differs from its original metadata.');
                }
                $bytes = $this->decrypt($root.DIRECTORY_SEPARATOR.$file['id'].'.enc', $key, 1048576);
                if (strlen($bytes) !== $file['size'] || ! hash_equals($file['sha256'], hash('sha256', $bytes))) {
                    throw new \RuntimeException('Private file checksum does not match.');
                }
                $objects[$file['id']] = $bytes;
            }
            foreach ($data['portal_file_objects']['rows'] as $object) {
                if (in_array($object['ready'], [true, 'true', 't', '1', 1], true) && ! isset($objects[$object['id']])) {
                    throw new \RuntimeException('A ready private file is missing from the export.');
                }
            }
            $rows = array_sum(array_map(fn ($payload) => count($payload['rows']), $data));
            $this->info('Verified 37 tables, '.$rows.' rows, '.count($objects).' private files. Source files are read-only.');
            if (! $this->option('apply')) {
                $this->info('Preview only. Use --apply with a separate empty migrated target.');

                return self::SUCCESS;
            }
            $id = hash('sha256', $manifestBytes);
            if (Schema::hasTable('legacy_imports') && DB::table('legacy_imports')->where('id', $id)->exists()) {
                $this->info('This snapshot was already imported. No data changed.');

                return self::SUCCESS;
            }
            foreach (array_keys($schema) as $table) {
                if (! Schema::hasTable($table) || DB::table($table)->exists()) {
                    throw new \RuntimeException('Target must contain the migrated empty schema. Refusing to replace existing data in '.$table.'.');
                }
            }
            if (DB::table('users')->exists()) {
                throw new \RuntimeException('Target already has Laravel users. Use a separate empty database; no accounts were replaced.');
            }
            $archive = 'imports/'.$id;
            $encrypted = array_merge(['manifest.enc'], array_map(fn ($name) => $name.'.enc', array_keys($schema)), array_map(fn ($fileId) => $fileId.'.enc', array_keys($objects)));
            foreach ($encrypted as $name) {
                $bytes = file_get_contents($root.DIRECTORY_SEPARATOR.$name);
                if (Storage::disk('local')->exists($archive.'/'.$name) && hash('sha256', Storage::disk('local')->get($archive.'/'.$name)) !== hash('sha256', $bytes)) {
                    throw new \RuntimeException('Existing private backup differs.');
                }
                Storage::disk('local')->put($archive.'/'.$name, $bytes);
            }
            DB::transaction(function () use ($data, $schema, $objects, $id, $manifest): void {
                foreach ($data as $table => $payload) {
                    foreach ($payload['rows'] as $row) {
                        $converted = [];
                        foreach ($payload['columns'] as $column) {
                            $converted[$column['name']] = $this->convert($row[$column['name']], $column['type']);
                        }
                        DB::table($table)->insert($converted);
                    }
                    if ($table === 'portal_users') {
                        foreach ($payload['rows'] as $row) {
                            DB::table('users')->insert(['id' => $row['id'], 'email' => $row['email'], 'name' => $row['display_name'], 'password' => $row['password_hash'], 'role' => $row['role'], 'status' => $row['status'], 'revision' => $row['revision'], 'review_note' => $row['review_note'], 'ktp_number' => $row['ktp_number'], 'bank_name' => $row['bank_name'], 'bank_account' => $row['bank_account'], 'phone' => $row['phone'], 'created_at' => $this->convert($row['created_at'], 'timestamptz'), 'updated_at' => $this->convert($row['created_at'], 'timestamptz')]);
                        }
                    }
                    $actual = DB::table($table)->select(array_keys($schema[$table]['columns']))->get()->map(fn ($row) => (array) $row)->all();
                    if ($this->digest($payload['rows'], $payload['columns']) !== $this->digest($actual, $payload['columns'])) {
                        throw new \RuntimeException('Target row checksum differs in '.$table.'. The import was rolled back.');
                    }
                }
                foreach ($objects as $fileId => $bytes) {
                    $path = 'objects/'.$fileId;
                    if (Storage::disk('local')->exists($path) && ! hash_equals(hash('sha256', Storage::disk('local')->get($path)), hash('sha256', $bytes))) {
                        throw new \RuntimeException('Existing private object differs.');
                    }
                    Storage::disk('local')->put($path, $bytes);
                    DB::table('portal_file_objects')->where('id', $fileId)->update(['local_path' => $path]);
                }
                DB::table('legacy_imports')->insert(['id' => $id, 'manifest' => json_encode($manifest), 'created_at' => now()]);
            });
            $this->info('Imported and matched every original column in all 37 tables. IDs, account hashes, archives and history are preserved. Encrypted snapshot retained at '.$archive.'.');

            return self::SUCCESS;
        } catch (\Throwable $error) {
            $this->error($error instanceof QueryException ? 'Database import failed and was rolled back. Inspect the private target; source data was not changed.' : $error->getMessage());

            return self::FAILURE;
        }
    }

    private function decrypt(string $path, string $key, int $limit): string
    {
        if (! is_file($path) || is_link($path) || filesize($path) > $limit + 28 || filesize($path) < 28) {
            throw new \RuntimeException('Missing, invalid or oversized encrypted export file.');
        }
        $bytes = file_get_contents($path);
        $decoded = openssl_decrypt(substr($bytes, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($bytes, 0, 12), substr($bytes, 12, 16));
        if ($decoded === false) {
            throw new \RuntimeException('The export key is incorrect or an encrypted file was modified.');
        }

        return $decoded;
    }

    private function convert(mixed $value, string $type): mixed
    {
        if ($value === null) {
            return null;
        }

        return match ($type) {
            'bytea' => preg_match('/\A\\\\x(?:[a-f0-9]{2})*\z/i', (string) $value) ? hex2bin(substr($value, 2)) : throw new \RuntimeException('Invalid binary data.'),
            'timestamptz' => (new \DateTimeImmutable($value, new \DateTimeZone('UTC')))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u'),
            'bool' => in_array($value, [true, 'true', 't', '1', 1], true),
            'int4', 'int8' => (int) $value,
            'numeric', 'date', 'time', 'text', 'varchar', 'uuid', 'jsonb' => $value,
            default => throw new \RuntimeException('Unsupported legacy column type.'),
        };
    }

    private function digest(array $rows, array $columns): string
    {
        $hashes = [];
        foreach ($rows as $row) {
            $values = [];
            foreach ($columns as $column) {
                $value = $row[$column['name']];
                if (is_resource($value)) {
                    $value = stream_get_contents($value);
                }
                if ($value === null) {
                    $values[$column['name']] = null;

                    continue;
                }
                $values[$column['name']] = match ($column['type']) {
                    'bytea' => '\\x'.bin2hex(preg_match('/\A\\\\x(?:[a-f0-9]{2})*\z/i', (string) $value) ? hex2bin(substr($value, 2)) : $value),
                    'jsonb' => $this->sortJson(json_decode($value, false, 512, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING)),
                    'bool' => in_array($value, [true, 'true', 't', '1', 1], true),
                    'timestamptz' => $this->convert($value, 'timestamptz'),
                    'int4', 'int8' => (string) (int) $value,
                    'numeric' => str_contains((string) $value, '.') ? rtrim(rtrim((string) $value, '0'), '.') : (string) $value,
                    'time' => (new \DateTimeImmutable($value))->format('H:i:s.u'),
                    default => (string) $value,
                };
            }
            ksort($values);
            $hashes[] = hash('sha256', json_encode($values, JSON_THROW_ON_ERROR));
        }
        sort($hashes);

        return hash('sha256', implode('', $hashes));
    }

    private function sortJson(mixed $value): mixed
    {
        if (is_object($value)) {
            $fields = get_object_vars($value);
            ksort($fields);

            return (object) array_map(fn ($entry) => $this->sortJson($entry), $fields);
        }
        if (! is_array($value)) {
            return $value;
        }
        if (! array_is_list($value)) {
            ksort($value);
        }

        return array_map(fn ($entry) => $this->sortJson($entry), $value);
    }
}
