<?php

declare(strict_types=1);

/*
 * Database connection.
 *
 * Supabase (Postgres) is used when backend/config/database.local.php exists
 * (see database.local.example.php) or the DATABASE_URL environment variable
 * is set. Otherwise the local XAMPP MySQL database is used.
 */
final class Database
{
    private static ?array $settings = null;


    public static function settings(): array
    {
        if (self::$settings !== null) {
            return self::$settings;
        }

        $settings = [
            'driver' => 'mysql',
            'host' => '127.0.0.1',
            'port' => 3306,
            'database' => 'smart_lost_found',
            'username' => 'root',
            'password' => '',
            'sslmode' => 'require',
        ];

        $localFile = __DIR__ . '/database.local.php';
        $local = is_file($localFile) ? require $localFile : [];
        $local = is_array($local) ? $local : [];

        $url = $local['url'] ?? (getenv('DATABASE_URL') ?: null);

        // A connection string still holding the password placeholder isn't ready yet; keep using MySQL.
        if (is_string($url) && $url !== '' && stripos($url, 'YOUR-PASSWORD') === false) {
            $settings = array_replace($settings, self::parseUrl($url));
        }

        unset($local['url']);

        return self::$settings = array_replace($settings, $local);
    }


    public static function driver(): string
    {
        return self::settings()['driver'];
    }


    private static function parseUrl(string $url): array
    {
        $parts = parse_url($url);

        if (!is_array($parts) || empty($parts['host'])) {
            throw new RuntimeException('DATABASE_URL is not a valid connection string.');
        }

        $scheme = strtolower($parts['scheme'] ?? 'postgresql');

        return [
            'driver' => in_array($scheme, ['postgres', 'postgresql', 'pgsql'], true) ? 'pgsql' : 'mysql',
            'host' => $parts['host'],
            'port' => (int)($parts['port'] ?? 5432),
            'database' => ltrim(rawurldecode($parts['path'] ?? '/postgres'), '/') ?: 'postgres',
            'username' => rawurldecode($parts['user'] ?? 'postgres'),
            'password' => rawurldecode($parts['pass'] ?? ''),
        ];
    }


    public function connect(): PDO
    {
        $config = self::settings();

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        if ($config['driver'] === 'pgsql') {
            $dsn = sprintf(
                'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s;connect_timeout=10',
                $config['host'],
                $config['port'],
                $config['database'],
                $config['sslmode']
            );

            // Supabase's transaction pooler (port 6543) does not support server-side
            // prepared statements; emulation keeps every pooler mode working.
            $options[PDO::ATTR_EMULATE_PREPARES] = true;
        } else {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $config['host'],
                $config['port'],
                $config['database']
            );
        }

        return new PDO($dsn, $config['username'], $config['password'], $options);
    }
}
