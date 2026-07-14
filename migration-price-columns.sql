-- إضافة عمود السعر (price) لجداول المذكرات والصوتيات والامتحانات
-- وإضافة المفتاح الخارجي المفقود لجدول users
-- إنشاء جدول رموز استعادة كلمة المرور
-- نفّذ في Supabase SQL Editor

ALTER TABLE notes ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE audio ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;

-- إضافة المفتاح الخارجي بين users.grade_id و grades.id
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_grade_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL;

-- إنشاء جدول رموز استعادة كلمة المرور
CREATE TABLE IF NOT EXISTS reset_codes (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_reset_codes_user ON reset_codes(user_id, code);
