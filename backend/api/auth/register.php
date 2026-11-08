<?php

declare(strict_types=1);

require_once
    __DIR__ .
    '/../../core/bootstrap.php';

require_once
    __DIR__ .
    '/../../config/database.php';


if (
    $_SERVER['REQUEST_METHOD']
    !==
    'POST'
) {

    jsonResponse(
        [
            'success' => false,
            'message' =>
                'طريقة الطلب غير مسموحة.'
        ],
        405
    );
}


$data =
    getJsonBody();


$fullName =
    trim(
        (string)(
            $data['name'] ?? ''
        )
    );


$identifier =
    trim(
        (string)(
            $data['identifier'] ?? ''
        )
    );


$password =
    (string)(
        $data['password'] ?? ''
    );


/* ================================
   VALIDATION
================================ */

if (
    mb_strlen($fullName) < 2 ||
    mb_strlen($fullName) > 150
) {

    jsonResponse(
        [
            'success' => false,
            'message' =>
                'يرجى كتابة الاسم بشكل صحيح.'
        ],
        422
    );
}


$normalized =
    normalizeIdentifier(
        $identifier
    );


if (
    !$normalized['type']
) {

    jsonResponse(
        [
            'success' => false,
            'message' =>
                'أدخل بريد إلكتروني أو رقم جوال سعودي صحيح.'
        ],
        422
    );
}


if (
    strlen($password) < 6
) {

    jsonResponse(
        [
            'success' => false,
            'message' =>
                'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'
        ],
        422
    );
}


/* ================================
   DATABASE
================================ */

try {

    $pdo =
        (new Database())
            ->connect();


    $email =
        null;


    $phone =
        null;


    if (
        $normalized['type']
        ===
        'email'
    ) {

        $email =
            $normalized['value'];

    } else {

        $phone =
            $normalized['value'];

    }


    /*
     * التأكد أن الحساب غير موجود.
     */

    if ($email) {

        $check =
            $pdo->prepare(
                '
                SELECT id
                FROM users
                WHERE email = ?
                LIMIT 1
                '
            );


        $check->execute([
            $email
        ]);

    } else {

        $check =
            $pdo->prepare(
                '
                SELECT id
                FROM users
                WHERE phone = ?
                LIMIT 1
                '
            );


        $check->execute([
            $phone
        ]);

    }


    if (
        $check->fetch()
    ) {

        jsonResponse(
            [
                'success' => false,
                'message' =>
                    'يوجد حساب مسجل بهذه البيانات مسبقاً.'
            ],
            409
        );
    }


    /*
     * تشفير كلمة المرور.
     */

    $passwordHash =
        password_hash(
            $password,
            PASSWORD_DEFAULT
        );


    /*
     * إنشاء الحساب.
     */

    $insert =
        $pdo->prepare(
            '
            INSERT INTO users
            (
                full_name,
                email,
                phone,
                password_hash,
                role,
                status
            )
            VALUES
            (
                :full_name,
                :email,
                :phone,
                :password_hash,
                \'user\',
                \'active\'
            )
            '
        );


    $insert->execute([
        ':full_name' =>
            $fullName,

        ':email' =>
            $email,

        ':phone' =>
            $phone,

        ':password_hash' =>
            $passwordHash
    ]);


    $userId =
        (int)$pdo->lastInsertId();


    /*
     * تسجيل دخول مباشر.
     */

    session_regenerate_id(
        true
    );


    $_SESSION['user_id'] =
        $userId;


    $_SESSION['role'] =
        'user';


    jsonResponse(
        [
            'success' => true,

            'message' =>
                'تم إنشاء الحساب بنجاح.',

            'user' => [
                'id' =>
                    $userId,

                'name' =>
                    $fullName,

                'email' =>
                    $email,

                'phone' =>
                    $phone,

                'role' =>
                    'user'
            ]
        ],
        201
    );


} catch (PDOException $error) {

    jsonResponse(
        [
            'success' => false,
            'message' =>
                'حدث خطأ أثناء إنشاء الحساب.'
        ],
        500
    );
}