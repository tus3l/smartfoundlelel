<?php

declare(strict_types=1);

require_once __DIR__ . '/report-helpers.php';


function requireActiveUser(PDO $pdo): array
{
    $userId = requireAuthenticatedUser();

    $query = $pdo->prepare(
        'SELECT id, role FROM users WHERE id = ? AND status = \'active\' LIMIT 1'
    );
    $query->execute([$userId]);
    $user = $query->fetch();

    if (!$user) {
        jsonResponse([
            'success' => false,
            'message' => 'يجب تسجيل الدخول بحساب نشط.'
        ], 401);
    }

    return $user;
}


function requireStaffUser(PDO $pdo): array
{
    $user = requireActiveUser($pdo);

    if (!in_array($user['role'], ['admin', 'moderator'], true)) {
        jsonResponse([
            'success' => false,
            'message' => 'ليس لديك صلاحية إدارة البلاغات.'
        ], 403);
    }

    return $user;
}


function requireJsonPost(): array
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse([
            'success' => false,
            'message' => 'طريقة الطلب غير مسموحة.'
        ], 405);
    }

    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($contentType !== 'application/json') {
        jsonResponse([
            'success' => false,
            'message' => 'يجب إرسال البيانات بصيغة JSON.'
        ], 415);
    }

    return getJsonBody();
}
