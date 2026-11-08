<?php

declare(strict_types=1);

require_once __DIR__ . '/../../core/bootstrap.php';
require_once __DIR__ . '/../../core/report-helpers.php';
require_once __DIR__ . '/../../core/ai-helpers.php';


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    aiFail('طريقة الطلب غير مسموحة.', 405);
}

requireAuthenticatedUser();
aiRequireEnabled();

$file = $_FILES['image'] ?? null;

if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    aiFail('ارفع صورة واضحة للغرض.', 422);
}

if ($file['size'] > 5 * 1024 * 1024) {
    aiFail('حجم الصورة كبير جداً.', 422);
}

$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);

if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    aiFail('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.', 422);
}

aiRateLimit('identify');

$isFound = ($_POST['reportType'] ?? '') === 'found';
$catalog = aiCatalog($isFound);
$colors = aiColors();

$catalogLines = [];

foreach ($catalog as $category => $types) {
    $catalogLines[] = $category . ': ' . implode(',', $types);
}

$system =
    "Identify the main item in the photo for a " . ($isFound ? 'found' : 'lost') . " item report (Saudi Arabia).\n" .
    "Reply with JSON only:\n" .
    '{"category":"","itemType":"","brand":null,"model":null,"primaryColor":null,"secondaryColor":null,' .
    '"description":"","privateMarks":null,"confidence":0}' . "\n" .
    "category/itemType must be from this list (use other if unsure):\n" .
    implode("\n", $catalogLines) . "\n" .
    'Colors must be one of: ' . implode('،', $colors) . "\n" .
    "Rules:\n" .
    "- brand/model only when clearly identifiable (logo, design), else null. model e.g. \"iPhone 15 Pro\".\n" .
    "- description: Arabic, 1-2 sentences, max 40 words, general visible features useful for matching.\n" .
    "- privateMarks: Arabic, unique marks (scratches, stickers, engravings, cases) or null.\n" .
    "- Never transcribe names, ID/card/plate numbers or other personal data; just say it exists.\n" .
    "- confidence: 0..1. If no clear item, category other and confidence 0.";

$imageUrl = ['url' => 'data:' . $mime . ';base64,' . base64_encode((string)file_get_contents($file['tmp_name']))];

if (!empty(aiConfig()['image_detail'])) {
    $imageUrl['detail'] = aiConfig()['image_detail'];
}

try {
    $reply = aiChat([
        ['role' => 'system', 'content' => $system],
        ['role' => 'user', 'content' => [
            ['type' => 'text', 'text' => 'Identify this item.'],
            ['type' => 'image_url', 'image_url' => $imageUrl],
        ]],
    ], 700, true);

    $data = aiParseJson($reply);
} catch (RuntimeException $error) {
    aiFail($error->getMessage(), 502);
}

$category = is_string($data['category'] ?? null) && isset($catalog[$data['category']])
    ? $data['category']
    : 'other';

$itemType = is_string($data['itemType'] ?? null) && in_array($data['itemType'], $catalog[$category], true)
    ? $data['itemType']
    : 'other';

$pickColor = static function (mixed $value) use ($colors): ?string {
    $value = aiCleanText($value, 20);

    return $value !== null && in_array($value, $colors, true) ? $value : null;
};

$confidence = is_numeric($data['confidence'] ?? null)
    ? max(0.0, min(1.0, (float)$data['confidence']))
    : 0.5;

jsonResponse([
    'success' => true,
    'result' => [
        'category' => $category,
        'itemType' => $itemType,
        'brand' => aiCleanText($data['brand'] ?? null, 60),
        'model' => aiCleanText($data['model'] ?? null, 80),
        'primaryColor' => $pickColor($data['primaryColor'] ?? null),
        'secondaryColor' => $pickColor($data['secondaryColor'] ?? null),
        'description' => aiCleanText($data['description'] ?? null, 600),
        'privateMarks' => aiCleanText($data['privateMarks'] ?? null, 400),
        'confidence' => round($confidence, 2),
    ],
]);
