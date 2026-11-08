<?php

declare(strict_types=1);

require_once __DIR__ . '/../../core/bootstrap.php';
require_once __DIR__ . '/../../core/access-helpers.php';
require_once __DIR__ . '/../../config/database.php';

header('Cache-Control: private, no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse([
        'success' => false,
        'message' => 'طريقة الطلب غير مسموحة.'
    ], 405);
}

$before = null;
if (isset($_GET['before'])) {
    $before = filter_var($_GET['before'], FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1]
    ]);
    if ($before === false) {
        jsonResponse([
            'success' => false,
            'message' => 'صفحة التنبيهات غير صحيحة.'
        ], 422);
    }
}

try {
    $pdo = (new Database())->connect();
    $user = requireActiveUser($pdo);
    $userId = (int)$user['id'];

    $count = $pdo->prepare(
        'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0'
    );
    $count->execute([$userId]);

    $createdAt = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql'
        ? 'CAST(EXTRACT(EPOCH FROM created_at) AS BIGINT)'
        : 'UNIX_TIMESTAMP(created_at)';

    $sql = "SELECT id, title, message, reference_type, reference_id, is_read,
                   {$createdAt} AS created_at
            FROM notifications WHERE user_id = ?";
    $params = [$userId];
    if ($before !== null) {
        $sql .= ' AND id < ?';
        $params[] = $before;
    }
    $sql .= ' ORDER BY id DESC LIMIT 31';

    $query = $pdo->prepare($sql);
    $query->execute($params);
    $rows = $query->fetchAll();
    $hasMore = count($rows) > 30;
    if ($hasMore) {
        array_pop($rows);
    }

    $notifications = array_map(static function (array $row): array {
        return [
            'id' => (int)$row['id'],
            'title' => $row['title'],
            'message' => $row['message'],
            'referenceType' => $row['reference_type'],
            'referenceId' => $row['reference_id'] === null ? null : (int)$row['reference_id'],
            'isRead' => (bool)$row['is_read'],
            'createdAt' => (int)$row['created_at']
        ];
    }, $rows);

    jsonResponse([
        'success' => true,
        'unreadCount' => (int)$count->fetchColumn(),
        'notifications' => $notifications,
        'nextBefore' => $hasMore ? (int)end($rows)['id'] : null
    ]);
} catch (PDOException $error) {
    error_log('Unable to load notifications: ' . $error->getMessage());
    jsonResponse([
        'success' => false,
        'message' => 'تعذر تحميل التنبيهات. حاول مرة أخرى.'
    ], 500);
}
