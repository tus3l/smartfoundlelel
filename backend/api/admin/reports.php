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

try {
    $pdo = (new Database())->connect();
    requireStaffUser($pdo);

    $reports = [];
    foreach (['lost' => 'lost_items', 'found' => 'found_items'] as $type => $table) {
        $dateColumn = $type === 'lost' ? 'lost_date' : 'found_date';
        $timeColumn = $type === 'lost' ? 'lost_time' : 'found_time';
        $query = $pdo->query(
            "SELECT i.id, i.title, i.item_type, i.brand, i.model, i.color,
                    i.secondary_color, i.description, i.distinctive_marks,
                    i.region_name, i.neighborhood_text, i.latitude, i.longitude,
                    i.location_accuracy, i.location_details, i.{$dateColumn} AS event_date,
                    i.{$timeColumn} AS event_time, i.admin_status, i.admin_note,
                    c.name_ar AS category_name, u.full_name, u.phone, u.email
             FROM {$table} i
             JOIN categories c ON c.id = i.category_id
             JOIN users u ON u.id = i.user_id"
        );

        foreach ($query as $row) {
            $id = (int)$row['id'];
            $key = $type . '-' . $id;
            $reports[$key] = [
                'id' => $id,
                'key' => $key,
                'type' => $type,
                'userName' => $row['full_name'],
                'phone' => $row['phone'] ?? '',
                'email' => $row['email'] ?? '',
                'category' => $row['category_name'],
                'itemType' => $row['item_type'] ?: $row['title'],
                'brand' => $row['brand'] ?? '',
                'model' => $row['model'] ?? '',
                'primaryColor' => $row['color'] ?? '',
                'secondaryColor' => $row['secondary_color'] ?? '',
                'description' => $row['description'],
                'distinctiveMarks' => $row['distinctive_marks'] ?? '',
                'region' => $row['region_name'] ?? '',
                'neighborhood' => $row['neighborhood_text'] ?? '',
                'latitude' => $row['latitude'] === null ? null : (float)$row['latitude'],
                'longitude' => $row['longitude'] === null ? null : (float)$row['longitude'],
                'accuracy' => $row['location_accuracy'] === null ? null : (float)$row['location_accuracy'],
                'locationDescription' => $row['location_details'] ?? '',
                'date' => $row['event_date'],
                'time' => $row['event_time'] ?? '',
                'status' => $row['admin_status'],
                'adminNote' => $row['admin_note'] ?? '',
                'bestMatch' => 0,
                'matches' => []
            ];
        }
    }

    $matches = $pdo->query(
        'SELECT lost_item_id, found_item_id, overall_score, category_score,
                description_score, location_score, date_score, color_score,
                brand_score, image_score
         FROM matches
         WHERE status <> \'rejected\'
         ORDER BY overall_score DESC, id DESC'
    );

    foreach ($matches as $match) {
        $lostKey = 'lost-' . (int)$match['lost_item_id'];
        $foundKey = 'found-' . (int)$match['found_item_id'];
        if (!isset($reports[$lostKey], $reports[$foundKey])) {
            continue;
        }

        $score = (float)$match['overall_score'];
        $analysis = [
            'category' => (float)$match['category_score'],
            'type' => null,
            'brand' => (float)$match['brand_score'],
            'color' => (float)$match['color_score'],
            'location' => (float)$match['location_score'],
            'date' => (float)$match['date_score'],
            'description' => (float)$match['description_score'],
            'image' => (float)$match['image_score']
        ];

        foreach ([[$lostKey, $foundKey], [$foundKey, $lostKey]] as [$sourceKey, $targetKey]) {
            $target = $reports[$targetKey];
            $reports[$sourceKey]['bestMatch'] = max($reports[$sourceKey]['bestMatch'], $score);
            $reports[$sourceKey]['matches'][] = [
                'reportId' => $target['id'],
                'reportKey' => $targetKey,
                'name' => $target['userName'],
                'title' => trim($target['itemType'] . ' ' . $target['brand']),
                'region' => trim($target['region'] . ' ' . $target['neighborhood']),
                'score' => $score,
                'analysis' => $analysis
            ];
        }
    }

    jsonResponse([
        'success' => true,
        'reports' => array_values($reports)
    ]);
} catch (PDOException $error) {
    error_log('Unable to load admin reports: ' . $error->getMessage());
    jsonResponse([
        'success' => false,
        'message' => 'تعذر تحميل البلاغات. حاول مرة أخرى.'
    ], 500);
}
