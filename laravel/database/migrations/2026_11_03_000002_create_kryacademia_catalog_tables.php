<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academy_catalog', function (Blueprint $table) {
            $table->unsignedInteger('id')->primary();
            $table->json('content');
            $table->timestamp('updated_at')->useCurrent();
        });

        Schema::create('institutions', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->string('name');
            $table->string('city');
            $table->string('country');
            $table->text('logo')->nullable();
            $table->text('about')->nullable();
            $table->text('address')->nullable();
            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('website')->nullable();
            $table->integer('sort_order')->default(0);
            $table->integer('revision')->default(0);
            $table->boolean('active')->default(true);
            $table->integer('reported_students')->nullable();
            $table->timestamps();
        });

        Schema::create('klass_types', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->string('title');
            $table->string('category');
            $table->text('description')->nullable();
            $table->text('image')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('coach_profiles', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->string('name');
            $table->string('specialty');
            $table->string('level', 32)->default('Coach');
            $table->text('image')->nullable();
            $table->string('email')->nullable();
            $table->string('portal_email', 254)->nullable();
            $table->text('bio')->nullable();
            $table->integer('sort_order')->default(0);
            $table->integer('revision')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('student_profiles', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->string('institution_id', 160)->nullable();
            $table->string('name');
            $table->string('grade')->nullable();
            $table->integer('score')->default(0);
            $table->integer('attendance')->default(0);
            $table->integer('sort_order')->default(0);
            $table->integer('revision')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('institution_id')->references('id')->on('institutions')->onDelete('set null');
        });

        Schema::create('academic_periods', function (Blueprint $table) {
            $table->string('id', 220)->primary();
            $table->string('institution_id', 160)->nullable();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('institution_id')->references('id')->on('institutions')->onDelete('cascade');
        });

        Schema::create('class_groups', function (Blueprint $table) {
            $table->string('id', 160)->primary();
            $table->string('klass_type_id', 160);
            $table->string('institution_id', 160)->nullable();
            $table->string('academic_period_id', 220)->nullable();
            $table->string('mode', 16)->default('Online');
            $table->integer('sort_order')->default(0);
            $table->integer('revision')->default(0);
            $table->boolean('active')->default(true);
            $table->string('group_name', 140)->default('');
            $table->integer('planned_meetings')->nullable();
            $table->integer('reported_students')->nullable();
            $table->text('canva_url')->nullable();
            $table->integer('target_meetings')->default(0);
            $table->timestamps();

            $table->foreign('klass_type_id')->references('id')->on('klass_types')->onDelete('cascade');
            $table->foreign('institution_id')->references('id')->on('institutions')->onDelete('set null');
            $table->foreign('academic_period_id')->references('id')->on('academic_periods')->onDelete('set null');
        });

        Schema::create('class_schedules', function (Blueprint $table) {
            $table->string('class_group_id', 160)->primary();
            $table->text('schedule_text');
            $table->timestamps();

            $table->foreign('class_group_id')->references('id')->on('class_groups')->onDelete('cascade');
        });

        Schema::create('coach_assignments', function (Blueprint $table) {
            $table->string('class_group_id', 160);
            $table->string('coach_id', 160);
            $table->timestamp('assigned_at')->useCurrent();
            $table->primary(['class_group_id', 'coach_id']);

            $table->foreign('class_group_id')->references('id')->on('class_groups')->onDelete('cascade');
            $table->foreign('coach_id')->references('id')->on('coach_profiles')->onDelete('cascade');
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $table->string('class_group_id', 160);
            $table->string('student_id', 160);
            $table->string('status', 16)->default('active');
            $table->timestamp('enrolled_at')->useCurrent();
            $table->primary(['class_group_id', 'student_id']);

            $table->foreign('class_group_id')->references('id')->on('class_groups')->onDelete('cascade');
            $table->foreign('student_id')->references('id')->on('student_profiles')->onDelete('cascade');
        });

        Schema::create('submission_deadlines', function (Blueprint $table) {
            $table->string('id', 260)->primary();
            $table->string('class_group_id', 160);
            $table->string('academic_period_id', 220)->nullable();
            $table->string('kind', 32);
            $table->date('meeting_date');
            $table->date('due_date');
            $table->string('request_timing', 32)->default('');
            $table->timestamps();

            $table->foreign('class_group_id')->references('id')->on('class_groups')->onDelete('cascade');
            $table->foreign('academic_period_id')->references('id')->on('academic_periods')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_deadlines');
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('coach_assignments');
        Schema::dropIfExists('class_schedules');
        Schema::dropIfExists('class_groups');
        Schema::dropIfExists('academic_periods');
        Schema::dropIfExists('student_profiles');
        Schema::dropIfExists('coach_profiles');
        Schema::dropIfExists('klass_types');
        Schema::dropIfExists('institutions');
        Schema::dropIfExists('academy_catalog');
    }
};
