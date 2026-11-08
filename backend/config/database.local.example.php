<?php

// Copy this file to database.local.php (git-ignored) to use Supabase.
//
// Supabase project: vvawmnllsfmttdndkpsc (Tokyo, ap-northeast-1)
// Replace YOUR-PASSWORD with the database password (Project Settings → Database).
// Percent-encode special characters in it: @ → %40, # → %23, / → %2F, ? → %3F, : → %3A
// While the placeholder is still there, the site keeps using local MySQL.

return [
    'url' => 'postgresql://postgres.vvawmnllsfmttdndkpsc:YOUR-PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',

    // Public Data API settings (safe to share; not used by the PHP backend).
    'supabase_url' => 'https://vvawmnllsfmttdndkpsc.supabase.co',
    'publishable_key' => 'sb_publishable_Ho5vgNK-J4f1VOP9HjAo0g_a27Ak9nU',
];
