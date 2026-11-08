<?php

// Copy this file to database.local.php (git-ignored) to use Supabase.
//
// Supabase Dashboard → Connect → "Session pooler" connection string
// (works on IPv4 home networks). Replace [YOUR-PASSWORD] with the database
// password; percent-encode special characters such as @ # / ? : in it.

return [
    'url' => 'postgresql://postgres.YOUR-PROJECT-REF:YOUR-PASSWORD@aws-0-YOUR-REGION.pooler.supabase.com:5432/postgres',
];
