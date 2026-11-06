<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $schema = json_decode(file_get_contents(database_path('schema/legacy.json')), true, flags: JSON_THROW_ON_ERROR);
        foreach ($schema as $name => $definition) {
            $exists = Schema::hasTable($name);
            $missing = array_diff(array_keys($definition['columns']), $exists ? Schema::getColumnListing($name) : []);
            $build = function (Blueprint $table) use ($definition, $missing, $exists): void {
                foreach ($missing as $name) {
                    $field = $definition['columns'][$name];
                    $column = match ($field['type']) {
                        'BIGINT' => ! empty($field['auto']) ? $table->bigIncrements($name) : $table->bigInteger($name),
                        'INT' => $table->integer($name),
                        'DECIMAL' => $table->decimal($name, $field['size'], $field['scale']),
                        'BOOLEAN' => $table->boolean($name),
                        'JSON' => $table->json($name),
                        'DATETIME' => $table->dateTime($name, 6),
                        'DATE' => $table->date($name),
                        'TIME' => $table->time($name, 6),
                        'CHAR', 'VARCHAR' => $table->string($name, $field['size']),
                        'MEDIUMBLOB' => $table->binary($name),
                        default => $table->text($name),
                    };
                    if ($exists || $field['nullable']) {
                        $column->nullable();
                    }
                    if (array_key_exists('default', $field) && ! str_starts_with($field['default'], 'CURRENT_TIMESTAMP')) {
                        $default = $field['default'];
                        $column->default(match ($default) {
                            'FALSE' => false, 'TRUE' => true, default => trim($default, "'")
                        });
                    } elseif (isset($field['default'])) {
                        $column->useCurrent();
                    }
                }
                if (! $exists) {
                    $auto = array_filter($definition['columns'], fn (array $column) => ! empty($column['auto']));
                    if ($definition['primary'] && ! $auto) {
                        $table->primary($definition['primary']);
                    }
                    foreach ($definition['unique'] as $columns) {
                        $table->unique($columns);
                    }
                    foreach ($definition['foreign'] as $foreign) {
                        $key = $table->foreign($foreign['column'])->references($foreign['references'])->on($foreign['table']);
                        if ($foreign['cascade']) {
                            $key->cascadeOnDelete();
                        }
                    }
                }
            };
            if (! $exists) {
                Schema::create($name, $build);
            } elseif ($missing) {
                Schema::table($name, $build);
            }
            if (DB::getDriverName() === 'mysql') {
                foreach ($definition['columns'] as $column => $field) {
                    if ($field['type'] === 'MEDIUMBLOB') {
                        DB::statement("ALTER TABLE `$name` MODIFY `$column` MEDIUMBLOB NULL");
                    }
                    if ($field['type'] === 'DATETIME' && $exists) {
                        DB::statement("ALTER TABLE `$name` MODIFY `$column` DATETIME(6) NULL");
                    }
                }
            }
        }
        Schema::create('legacy_imports', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->json('manifest');
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::table('teaching_files', function (Blueprint $table): void {
            $table->boolean('active')->default(true);
        });
        Schema::table('teacher_notifications', function (Blueprint $table): void {
            $table->unique('source_job_id');
        });
        Schema::table('portal_file_objects', function (Blueprint $table): void {
            $table->string('local_path')->nullable();
        });
        Schema::table('teaching_documents', function (Blueprint $table): void {
            $table->integer('workflow_version')->nullable()->default(null)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        throw new RuntimeException('This migration preserves company history. Restore a verified backup instead of dropping legacy tables.');
    }
};
