<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication(): Application
    {
        $app = parent::createApplication();
        $driver = config('database.default');
        $database = config('database.connections.'.$driver.'.database');
        $safe = $driver === 'sqlite' && $database === ':memory:';
        $safe = $safe || ($driver === 'mysql' && str_starts_with((string) $database, 'krya_laravel_test_') && in_array(config('database.connections.mysql.host'), ['localhost', '127.0.0.1'], true));
        if (! $safe) {
            throw new \RuntimeException('Refusing to run destructive test resets outside the in-memory or dedicated loopback test database.');
        }

        return $app;
    }
}
