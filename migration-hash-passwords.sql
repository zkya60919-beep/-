-- =============================================================
-- تشفير كلمات المرور الموجودة (نص → SHA-256)
-- شغّل هذا الملف في Supabase SQL Editor بعد تحديث الكود
-- =============================================================

-- 1. تحديث كلمة سر المدرس في teacher_settings
UPDATE teacher_settings
SET setting_value = encode(
    sha256(
        convert_to(
            coalesce(
                (SELECT setting_value FROM teacher_settings WHERE setting_key = 'teacher_password' LIMIT 1),
                'AlBasit@2024'
            ),
            'UTF8'
        )
    ),
    'hex'
)
WHERE setting_key = 'teacher_password';

-- 2. تشفير كل كلمات مرور المستخدمين
UPDATE users
SET password = encode(sha256(convert_to(password, 'UTF8')), 'hex')
WHERE password !~ '^[a-f0-9]{64}$';
