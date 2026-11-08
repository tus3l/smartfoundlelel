<?php

declare(strict_types=1);

/*
 * Moves the database from local MySQL (XAMPP) to Supabase Postgres.
 *
 *   php backend/migrations/supabase/migrate.php            schema + data
 *   php backend/migrations/supabase/migrate.php --schema   schema only
 *   php backend/migrations/supabase/migrate.php --force    replace data already in Supabase
 *
 * Target: backend/config/database.local.php (or DATABASE_URL).
 * Source: MySQL settings below (override with MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../../config/database.php';

$schemaOnly = in_array('--schema', $argv, true);
$force = in_array('--force', $argv, true);

// Parents before children so foreign keys are always satisfied.
$tables = [
    'users', 'categories', 'neighborhoods', 'lost_items', 'found_items', 'matches',
    'claim_requests', 'conversations', 'chat_messages', 'item_images', 'notifications',
    'otp_verifications', 'feedbacks', 'system_logs',
];

function out(string $message): void
{
    fwrite(STDOUT, $message . PHP_EOL);
}

try {
    if (Database::driver() !== 'pgsql') {
        throw new RuntimeException(
            'Supabase is not configured. Copy backend/config/database.local.example.php to database.local.php first.'
        );
    }

    $target = (new Database())->connect();
    out('Connected to Postgres: ' . $target->query('select version()')->fetchColumn());

    $target->exec((string)file_get_contents(__DIR__ . '/001_schema.sql'));
    out('Schema is ready.');

    if ($schemaOnly) {
        exit(0);
    }

    $source = new PDO(
        sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            getenv('MYSQL_HOST') ?: '127.0.0.1',
            (int)(getenv('MYSQL_PORT') ?: 3306),
            getenv('MYSQL_DB') ?: 'smart_lost_found'
        ),
        getenv('MYSQL_USER') ?: 'root',
        getenv('MYSQL_PASSWORD') ?: '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    // MySQL returns TIMESTAMP/DATETIME values in the server's local time without an offset.
    $offset = (string)$source->query("SELECT TIME_FORMAT(TIMEDIFF(NOW(), UTC_TIMESTAMP()), '%H:%i')")->fetchColumn();
    $offset = str_starts_with($offset, '-') ? $offset : '+' . $offset;
    out("MySQL time zone offset: {$offset}");

    $existing = 0;

    foreach ($tables as $table) {
        $existing += (int)$target->query("select count(*) from public.{$table}")->fetchColumn();
    }

    if ($existing > 0 && !$force) {
        throw new RuntimeException(
            "Supabase already has {$existing} rows. Run again with --force to replace them."
        );
    }

    $target->beginTransaction();

    if ($existing > 0) {
        $target->exec('truncate table ' . implode(', ', array_map(
            static fn ($table) => "public.{$table}",
            $tables
        )) . ' restart identity cascade');
        out('Cleared existing Supabase data.');
    }

    $targetColumns = $target->prepare(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = ?"
    );

    foreach ($tables as $table) {
        $types = [];

        foreach ($source->query(
            "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = " . $source->quote($table)
        ) as $column) {
            $types[$column['COLUMN_NAME']] = $column['DATA_TYPE'];
        }

        $targetColumns->execute([$table]);
        $columns = array_values(array_intersect(array_keys($types), $targetColumns->fetchAll(PDO::FETCH_COLUMN)));

        if (count($columns) === 0) {
            throw new RuntimeException("Table {$table} has no matching columns.");
        }

        $insert = $target->prepare(sprintf(
            'insert into public.%s (%s) values (%s)',
            $table,
            implode(', ', $columns),
            implode(', ', array_fill(0, count($columns), '?'))
        ));

        $copied = 0;

        foreach ($source->query("SELECT `" . implode('`, `', $columns) . "` FROM `{$table}` ORDER BY id") as $row) {
            $values = [];

            foreach ($columns as $column) {
                $value = $row[$column];

                if ($value !== null && in_array($types[$column], ['timestamp', 'datetime'], true)) {
                    $value = str_starts_with((string)$value, '0000-00-00') ? null : $value . $offset;
                }

                $values[] = $value;
            }

            $insert->execute($values);
            $copied++;
        }

        $target->query(
            "select setval(pg_get_serial_sequence('public.{$table}', 'id'),
                           coalesce((select max(id) from public.{$table}), 1),
                           (select max(id) from public.{$table}) is not null)"
        );

        $sourceCount = (int)$source->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();

        if ($copied !== $sourceCount) {
            throw new RuntimeException("Row count mismatch in {$table}: {$copied} vs {$sourceCount}.");
        }

        out(str_pad($table, 20) . " {$copied} rows");
    }

    $target->commit();
    out('Done. Your data is now in Supabase.');
} catch (Throwable $error) {
    if (isset($target) && $target->inTransaction()) {
        $target->rollBack();
    }

    fwrite(STDERR, 'Migration failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
