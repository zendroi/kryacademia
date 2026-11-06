<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 16)->default('teacher')->index();
            $table->string('status', 16)->default('active')->index();
            $table->integer('revision')->default(0);
            $table->text('review_note')->nullable();
            $table->string('ktp_number')->nullable();
            $table->string('bank_name', 100)->nullable();
            $table->string('bank_account', 50)->nullable();
            $table->string('account_holder', 120)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('identity_path')->nullable();
        });

        Schema::create('teacher_onboarding', function (Blueprint $table) {
            $table->string('email', 254)->primary();
            $table->string('invitation_hash', 64)->unique();
            $table->dateTime('expires_at');
            $table->dateTime('completed_at')->nullable();
            $table->string('bank_name', 100)->default('');
            $table->string('bank_account', 50)->default('');
            $table->string('account_holder', 120)->default('');
            $table->string('identity_path')->nullable();
            $table->timestamps();

            $table->foreign('email')->references('email')->on('users')->onDelete('cascade');
        });

        Schema::create('portal_account_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('actor_email', 254);
            $table->string('target_email', 254);
            $table->string('action', 32);
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_account_events');
        Schema::dropIfExists('teacher_onboarding');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'role', 'status', 'revision', 'review_note',
                'ktp_number', 'bank_name', 'bank_account',
                'account_holder', 'phone', 'identity_path',
            ]);
        });
    }
};
