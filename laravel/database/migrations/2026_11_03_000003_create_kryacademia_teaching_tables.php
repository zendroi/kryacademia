<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teaching_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('teacher_email', 254)->index();
            $table->string('kind', 32)->index();
            $table->string('class_id', 160)->index();
            $table->date('meeting_date')->index();
            $table->text('title');
            $table->json('content')->nullable();
            $table->json('files')->nullable();
            $table->string('status', 32)->default('Draft')->index();
            $table->text('reviewer_note')->nullable();
            $table->integer('revision')->default(0);
            $table->timestamps();

            $table->unique(['teacher_email', 'kind', 'class_id', 'meeting_date']);
        });

        Schema::create('teaching_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('record_id');
            $table->text('name');
            $table->string('mime', 100);
            $table->string('path')->nullable();
            $table->integer('position')->default(0);
            $table->integer('size')->nullable();
            $table->timestamps();

            $table->foreign('record_id')->references('id')->on('teaching_records')->onDelete('cascade');
        });

        Schema::create('class_meetings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('class_group_id', 160);
            $table->date('meeting_date');
            $table->boolean('configured')->default(false);
            $table->text('canva_url')->nullable();
            $table->text('worksheet_url')->nullable();
            $table->timestamps();

            $table->unique(['class_group_id', 'meeting_date']);
            $table->foreign('class_group_id')->references('id')->on('class_groups')->onDelete('cascade');
        });

        Schema::create('teaching_documents', function (Blueprint $table) {
            $table->uuid('record_id')->primary();
            $table->integer('workflow_version')->default(2);
            $table->uuid('syllabus_id')->nullable();
            $table->integer('meeting_number')->nullable();
            $table->text('main_coach')->nullable();
            $table->text('assistant_coach')->nullable();
            $table->text('room')->nullable();
            $table->text('notes')->nullable();
            $table->text('objectives')->nullable();
            $table->text('worksheet_url')->nullable();
            $table->timestamps();

            $table->foreign('record_id')->references('id')->on('teaching_records')->onDelete('cascade');
            $table->foreign('syllabus_id')->references('id')->on('teaching_records')->onDelete('set null');
        });

        Schema::create('teaching_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('record_id');
            $table->string('actor_email', 254);
            $table->string('action', 32);
            $table->json('before_data')->nullable();
            $table->json('after_data')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('record_id')->references('id')->on('teaching_records')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teaching_events');
        Schema::dropIfExists('teaching_documents');
        Schema::dropIfExists('class_meetings');
        Schema::dropIfExists('teaching_files');
        Schema::dropIfExists('teaching_records');
    }
};
