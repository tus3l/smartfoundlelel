<?php

declare(strict_types=1);

require_once
    __DIR__ .
    '/../../core/bootstrap.php';

require_once
    __DIR__ .
    '/../../core/report-helpers.php';

require_once
    __DIR__ .
    '/../../config/database.php';


if (
    $_SERVER['REQUEST_METHOD'] !==
    'POST'
) {
    jsonResponse([
        'success' => false,
        'message' => 'طريقة الطلب غير مسموحة.'
    ], 405);
}


$userId =
    requireAuthenticatedUser();


$category =
    nullableString(
        $_POST['category'] ?? null
    );


$itemType =
    nullableString(
        $_POST['itemType'] ?? null
    );


$itemTypeName =
    nullableString(
        $_POST['itemTypeName'] ?? null
    );


$brand =
    nullableString(
        $_POST['brand'] ?? null
    );


$customBrand =
    nullableString(
        $_POST['customBrand'] ?? null
    );


$model =
    nullableString(
        $_POST['model'] ?? null
    );


$primaryColor =
    nullableString(
        $_POST['primaryColor'] ?? null
    );


$secondaryColor =
    nullableString(
        $_POST['secondaryColor'] ?? null
    );


$description =
    nullableString(
        $_POST['description'] ?? null
    );


$distinctiveMarks =
    nullableString(
        $_POST['distinctiveMarks'] ?? null
    );


$regionName =
    nullableString(
        $_POST['regionName'] ?? null
    );


$neighborhood =
    nullableString(
        $_POST['neighborhood'] ?? null
    );


$locationDescription =
    nullableString(
        $_POST['locationDescription'] ?? null
    );


$latitude =
    nullableFloat(
        $_POST['latitude'] ?? null
    );


$longitude =
    nullableFloat(
        $_POST['longitude'] ?? null
    );


$accuracy =
    nullableFloat(
        $_POST['accuracy'] ?? null
    );


$foundDate =
    nullableString(
        $_POST['foundDate'] ?? null
    );


$foundTime =
    nullableString(
        $_POST['foundTime'] ?? null
    );


$breed =
    nullableString(
        $_POST['breed'] ?? null
    );


$customBreed =
    nullableString(
        $_POST['customBreed'] ?? null
    );


/* =========================================
   VALIDATION
========================================= */

if (!$category) {
    jsonResponse([
        'success' => false,
        'message' => 'التصنيف مطلوب.'
    ], 422);
}


if (!$primaryColor) {
    jsonResponse([
        'success' => false,
        'message' => 'اللون الأساسي مطلوب.'
    ], 422);
}


if (!$foundDate) {
    jsonResponse([
        'success' => false,
        'message' => 'تاريخ العثور مطلوب.'
    ], 422);
}


$actualBrand =
    $customBrand ?:
    $brand;


$actualBreed =
    $customBreed ?:
    $breed;


$extraAttributes = [
    'breed' =>
        $actualBreed,

    'frontend_item_type' =>
        $itemType
];


$extraAttributes =
    array_filter(
        $extraAttributes,
        fn($value) =>
            $value !== null &&
            $value !== ''
    );


try {

    $pdo =
        (new Database())
            ->connect();


    $pdo->beginTransaction();


    $categoryId =
        getCategoryId(
            $pdo,
            $category
        );


    $title =
        buildItemTitle(
            $itemTypeName,
            $actualBrand,
            'غرض معثور عليه'
        );


    $insert =
        $pdo->prepare(
            '
            INSERT INTO found_items
            (
                user_id,
                category_id,
                item_type,
                title,
                description,
                brand,
                model,
                color,
                secondary_color,
                distinctive_marks,
                found_date,
                found_time,
                location_details,
                latitude,
                longitude,
                location_accuracy,
                region_name,
                neighborhood_text,
                extra_attributes,
                status,
                visibility
            )
            VALUES
            (
                :user_id,
                :category_id,
                :item_type,
                :title,
                :description,
                :brand,
                :model,
                :color,
                :secondary_color,
                :distinctive_marks,
                :found_date,
                :found_time,
                :location_details,
                :latitude,
                :longitude,
                :location_accuracy,
                :region_name,
                :neighborhood_text,
                :extra_attributes,
                \'available\',
                \'public\'
            )
            '
        );


    $insert->execute([
        ':user_id' =>
            $userId,

        ':category_id' =>
            $categoryId,

        ':item_type' =>
            $itemTypeName,

        ':title' =>
            $title,

        ':description' =>
            $description ?: 'بدون وصف',

        ':brand' =>
            $actualBrand,

        ':model' =>
            $model,

        ':color' =>
            $primaryColor,

        ':secondary_color' =>
            $secondaryColor,

        ':distinctive_marks' =>
            $distinctiveMarks,

        ':found_date' =>
            $foundDate,

        ':found_time' =>
            $foundTime,

        ':location_details' =>
            $locationDescription,

        ':latitude' =>
            $latitude,

        ':longitude' =>
            $longitude,

        ':location_accuracy' =>
            $accuracy,

        ':region_name' =>
            $regionName,

        ':neighborhood_text' =>
            $neighborhood,

        ':extra_attributes' =>
            json_encode(
                $extraAttributes,
                JSON_UNESCAPED_UNICODE
            )
    ]);


    $foundItemId =
        (int)$pdo->lastInsertId();


    if (
        isset($_FILES['image'])
    ) {

        $imagePath =
            uploadItemImage(
                $_FILES['image']
            );


        if ($imagePath) {

            $imageInsert =
                $pdo->prepare(
                    '
                    INSERT INTO item_images
                    (
                        lost_item_id,
                        found_item_id,
                        image_url,
                        is_primary,
                        sort_order
                    )
                    VALUES
                    (
                        NULL,
                        ?,
                        ?,
                        1,
                        0
                    )
                    '
                );


            $imageInsert->execute([
                $foundItemId,
                $imagePath
            ]);
        }
    }


    $pdo->commit();


    jsonResponse([
        'success' => true,

        'message' =>
            'تم إرسال بلاغ المعثور للإدارة بنجاح.',

        'report' => [
            'id' =>
                $foundItemId,

            'type' =>
                'found'
        ]
    ], 201);


} catch (
    Throwable $error
) {

    if (
        isset($pdo) &&
        $pdo->inTransaction()
    ) {
        $pdo->rollBack();
    }


    error_log(
        $error->getMessage()
    );


    jsonResponse([
        'success' => false,
        'message' =>
            'حدث خطأ أثناء حفظ بلاغ المعثور.'
    ], 500);
}