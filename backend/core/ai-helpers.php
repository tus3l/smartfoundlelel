<?php

declare(strict_types=1);


function aiConfig(): array
{
    static $config = null;

    if ($config === null) {
        $config = require __DIR__ . '/../config/ai.php';
    }

    return $config;
}


function aiFail(string $message, int $status): void
{
    jsonResponse([
        'success' => false,
        'message' => $message
    ], $status);
}


function aiRequireEnabled(): void
{
    $key = trim((string)(aiConfig()['api_key'] ?? ''));

    if ($key === '' || $key === 'PUT-YOUR-API-KEY-HERE') {
        aiFail('ميزة الذكاء الاصطناعي غير مفعّلة حالياً.', 503);
    }
}


function aiRateLimit(string $action): void
{
    $limit = (int)(aiConfig()['limits'][$action] ?? 20);
    $now = time();

    $hits = array_values(array_filter(
        $_SESSION['ai_hits'][$action] ?? [],
        static fn ($time) => is_int($time) && $time > $now - 3600
    ));

    if (count($hits) >= $limit) {
        aiFail('وصلت للحد المسموح من طلبات الذكاء الاصطناعي، حاول بعد قليل.', 429);
    }

    $hits[] = $now;
    $_SESSION['ai_hits'][$action] = $hits;

    // Release the session lock so other requests are not blocked while the AI responds.
    session_write_close();
}


function aiCleanText(mixed $value, int $maxLength): ?string
{
    if (!is_string($value) && !is_numeric($value)) {
        return null;
    }

    $value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string)$value) ?? '';
    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');

    if ($value === '' || in_array(mb_strtolower($value), ['null', 'none', 'unknown', 'غير معروف'], true)) {
        return null;
    }

    return mb_substr($value, 0, $maxLength);
}


/**
 * Sends a chat request to the configured OpenAI-compatible API and returns the reply text.
 */
function aiChat(array $messages, int $maxTokens, bool $jsonOutput = false): string
{
    $config = aiConfig();

    $payload = [
        'model' => $config['model'],
        'messages' => $messages,
        'max_tokens' => $maxTokens,
        'temperature' => 0.2,
    ];

    if (!empty($config['reasoning_effort'])) {
        $payload['reasoning_effort'] = $config['reasoning_effort'];
    }

    if ($jsonOutput) {
        $payload['response_format'] = ['type' => 'json_object'];
    }

    $curl = curl_init(rtrim((string)$config['base_url'], '/') . '/chat/completions');

    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => (int)$config['timeout'],
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . trim((string)$config['api_key']),
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $raw = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($raw === false) {
        error_log('AI request failed: ' . $curlError);
        throw new RuntimeException('تعذر الاتصال بخدمة الذكاء الاصطناعي.');
    }

    $data = json_decode((string)$raw, true);

    if ($status < 200 || $status >= 300 || !is_array($data)) {
        error_log('AI provider error ' . $status . ': ' . mb_substr((string)$raw, 0, 500));

        throw new RuntimeException(
            $status === 429
                ? 'خدمة الذكاء الاصطناعي مشغولة حالياً، حاول بعد قليل.'
                : 'خدمة الذكاء الاصطناعي لم تستجب بشكل صحيح.'
        );
    }

    $content = $data['choices'][0]['message']['content'] ?? '';

    if (is_array($content)) {
        $content = implode('', array_map(
            static fn ($part) => is_array($part) ? (string)($part['text'] ?? '') : (string)$part,
            $content
        ));
    }

    $content = trim((string)$content);

    if ($content === '') {
        throw new RuntimeException('لم يرجع الذكاء الاصطناعي أي نتيجة، حاول مرة أخرى.');
    }

    return $content;
}


function aiParseJson(string $text): array
{
    $text = trim(preg_replace('/^```(?:json)?|```$/m', '', $text) ?? $text);
    $data = json_decode($text, true);

    if (!is_array($data) && preg_match('/\{.*\}/s', $text, $match)) {
        $data = json_decode($match[0], true);
    }

    if (!is_array($data)) {
        throw new RuntimeException('تعذر فهم نتيجة الذكاء الاصطناعي، حاول مرة أخرى.');
    }

    return $data;
}


/**
 * Must stay in sync with itemTypes in js/lost-report.js and js/found-report.js.
 */
function aiCatalog(bool $isFound): array
{
    if ($isFound) {
        return [
            'animal' => ['bird', 'cat', 'dog', 'rabbit', 'turtle', 'fish', 'goat', 'sheep', 'horse', 'camel', 'cow', 'other'],
            'electronics' => ['phone', 'tablet', 'laptop', 'headphones', 'smartwatch', 'camera', 'gaming', 'charger', 'power_bank', 'router', 'remote', 'screen', 'other'],
            'wallets' => ['wallet', 'card_holder', 'handbag', 'backpack', 'school_bag', 'laptop_bag', 'travel', 'other'],
            'keys' => ['car', 'car_remote', 'house', 'office', 'multiple', 'other'],
            'documents' => ['id', 'residency', 'license', 'bank_card', 'work_card', 'student_card', 'passport', 'certificate', 'other'],
            'jewelry' => ['watch', 'ring', 'bracelet', 'necklace', 'earring', 'anklet', 'brooch', 'other'],
            'clothes' => ['shirt', 'jacket', 'abaya', 'headwear', 'shoes', 'sandal', 'cap', 'other'],
            'personal' => ['glasses', 'umbrella', 'bottle', 'book', 'notebook', 'prayer_beads', 'hearing_aid', 'other'],
            'sports' => ['ball', 'racket', 'sports_bag', 'sports_shoes', 'fitness_equipment', 'other'],
            'toys' => ['toy', 'doll', 'electronic_toy', 'educational_toy', 'toy_car', 'building_blocks', 'other'],
            'other' => ['other'],
        ];
    }

    return [
        'animal' => ['bird', 'cat', 'dog', 'rabbit', 'turtle', 'goat', 'sheep', 'horse', 'other'],
        'electronics' => ['phone', 'tablet', 'laptop', 'headphones', 'smartwatch', 'camera', 'gaming', 'charger', 'other'],
        'wallets' => ['wallet', 'handbag', 'backpack', 'travel', 'other'],
        'keys' => ['car', 'house', 'multiple', 'other'],
        'documents' => ['id', 'license', 'bank_card', 'passport', 'certificate', 'other'],
        'jewelry' => ['watch', 'ring', 'bracelet', 'necklace', 'earring', 'other'],
        'clothes' => ['shirt', 'jacket', 'shoes', 'cap', 'other'],
        'personal' => ['glasses', 'umbrella', 'bottle', 'book', 'other'],
        'sports' => ['ball', 'racket', 'sports_bag', 'other'],
        'toys' => ['toy', 'doll', 'electronic_toy', 'other'],
        'other' => ['other'],
    ];
}


function aiColors(): array
{
    return ['أسود', 'أبيض', 'أزرق', 'أحمر', 'أخضر', 'أصفر', 'بني', 'بنفسجي', 'وردي', 'رمادي', 'برتقالي', 'ذهبي', 'فضي', 'متعدد'];
}
