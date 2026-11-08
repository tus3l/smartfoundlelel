<?php

declare(strict_types=1);

/*
 * AI provider settings (any OpenAI-compatible Chat Completions API).
 *
 * Put the API key in backend/config/ai.local.php (git-ignored, see
 * ai.local.example.php) or in the AI_API_KEY environment variable.
 * Never put the key in this file or in front-end code.
 */

$config = [
    'api_key' => getenv('AI_API_KEY') ?: '',

    // Default: Google Gemini (OpenAI-compatible endpoint).
    // OpenAI example: base_url https://api.openai.com/v1/ , model gpt-4o-mini
    'base_url' => getenv('AI_BASE_URL') ?: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    'model' => getenv('AI_MODEL') ?: 'gemini-3.8-flash',

    // Keeps hidden "thinking" tokens to a minimum. Set to null for models
    // that do not support reasoning_effort.
    'reasoning_effort' => 'minimal',

    // OpenAI vision detail ("low" = cheapest). Leave null for Gemini.
    'image_detail' => null,

    'timeout' => 40,

    // Max requests per hour for each signed-in session.
    'limits' => [
        'describe' => 30,
        'identify' => 15,
    ],
];

$localFile = __DIR__ . '/ai.local.php';

if (is_file($localFile)) {
    $local = require $localFile;

    if (is_array($local)) {
        $config = array_replace($config, $local);
    }
}

return $config;
