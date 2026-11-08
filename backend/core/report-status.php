<?php

declare(strict_types=1);


function reportStatusLabels(): array
{
    return [
        'new' => 'جديد',
        'review' => 'قيد المراجعة',
        'strong-match' => 'تطابق قوي',
        'contact' => 'بانتظار التواصل',
        'verification' => 'جاري التحقق',
        'completed' => 'تم التسليم',
        'rejected' => 'مرفوض'
    ];
}


function reportTable(string $type): ?string
{
    $tables = [
        'lost' => 'lost_items',
        'found' => 'found_items'
    ];

    return $tables[$type] ?? null;
}


function updateReportStatus(
    PDO $pdo,
    string $type,
    int $reportId,
    string $status
): ?array {
    $table = reportTable($type);
    $labels = reportStatusLabels();

    if (!$table || !isset($labels[$status]) || $reportId < 1) {
        throw new InvalidArgumentException('Invalid report status update.');
    }
    if (!$pdo->inTransaction()) {
        throw new LogicException('A report status update requires a transaction.');
    }

    $query = $pdo->prepare(
        "SELECT user_id, admin_status FROM {$table} WHERE id = ? FOR UPDATE"
    );
    $query->execute([$reportId]);
    $report = $query->fetch();

    if (!$report) {
        return null;
    }
    if ($report['admin_status'] === $status) {
        return ['status' => $status, 'changed' => false];
    }

    $update = $pdo->prepare(
        "UPDATE {$table} SET admin_status = ? WHERE id = ?"
    );
    $update->execute([$status, $reportId]);

    $itemName = $type === 'lost' ? 'المفقود' : 'المعثور';
    $referenceType = $type === 'lost' ? 'lost_item' : 'found_item';
    $notification = $pdo->prepare(
        'INSERT INTO notifications
            (user_id, type, title, message, reference_type, reference_id)
         VALUES (?, \'system\', ?, ?, ?, ?)'
    );
    $notification->execute([
        (int)$report['user_id'],
        'تحديث حالة البلاغ',
        "تغيّرت حالة بلاغ {$itemName} رقم #{$reportId} إلى: {$labels[$status]}.",
        $referenceType,
        $reportId
    ]);

    return ['status' => $status, 'changed' => true];
}
