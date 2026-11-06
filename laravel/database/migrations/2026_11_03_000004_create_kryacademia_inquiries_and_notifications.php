<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inquiries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('submission_hash', 64);
            $table->string('name', 120);
            $table->string('email', 254)->index();
            $table->string('phone', 30);
            $table->string('place', 120);
            $table->string('type', 32);
            $table->string('affiliation', 20);
            $table->string('institution', 180)->default('');
            $table->text('message');
            $table->string('language', 8)->default('en');
            $table->json('details')->nullable();
            $table->timestamp('consent_at')->useCurrent();
            $table->string('status', 16)->default('New')->index();
            $table->timestamps();
        });

        Schema::create('notification_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('dedupe_key', 255)->unique();
            $table->string('teacher_email', 254)->index();
            $table->uuid('record_id')->nullable();
            $table->string('class_id', 160)->nullable();
            $table->string('deadline_id', 260)->nullable();
            $table->date('due_date')->nullable();
            $table->string('stage', 16)->nullable();
            $table->string('title');
            $table->text('message');
            $table->string('status', 16)->default('pending')->index();
            $table->integer('attempts')->default(0);
            $table->timestamp('available_at')->useCurrent();
            $table->timestamp('delivered_at')->nullable();
            $table->text('last_error')->nullable();
            $table->string('retried_by', 254)->nullable();
            $table->timestamp('retried_at')->nullable();
            $table->timestamps();
        });

        Schema::create('teacher_notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('teacher_email', 254)->index();
            $table->uuid('record_id')->nullable();
            $table->text('title');
            $table->text('message');
            $table->boolean('read')->default(false);
            $table->uuid('source_job_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_notifications');
        Schema::dropIfExists('notification_jobs');
        Schema::dropIfExists('inquiries');
    }
};
