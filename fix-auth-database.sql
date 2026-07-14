-- إصلاح قاعدة البيانات لحل مشاكل تسجيل الدخول
-- نفّذ هذا الملف في Supabase SQL Editor

-- ===== 1. إنشاء جدول login_logs (إذا لم يكن موجوداً) =====
CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(20),
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    fail_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_action ON login_logs(action);

-- ===== 2. إنشاء جدول reset_codes (إذا لم يكن موجوداً) =====
CREATE TABLE IF NOT EXISTS reset_codes (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_codes_user ON reset_codes(user_id, code);

-- ===== 3. إنشاء جدول active_video_sessions (لمنع مشاركة الاشتراك) =====
CREATE TABLE IF NOT EXISTS active_video_sessions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    video_id VARCHAR(50) NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    device_info VARCHAR(255),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_video_sessions(user_id, video_id, is_active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_video_sessions(session_token);

-- ===== 4. تعطيل RLS على جميع الجداول =====
-- الجداول الأساسية
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE months DISABLE ROW LEVEL SECURITY;
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE audio DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_settings DISABLE ROW LEVEL SECURITY;

-- جداول الكورسات
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_purchases DISABLE ROW LEVEL SECURITY;

-- جداول المراجعات النهائية
ALTER TABLE final_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE final_review_content DISABLE ROW LEVEL SECURITY;
ALTER TABLE final_review_purchases DISABLE ROW LEVEL SECURITY;

-- جداول الدفع اليدوي
ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings DISABLE ROW LEVEL SECURITY;

-- جداول المصادقة والأمان
ALTER TABLE login_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE reset_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE active_video_sessions DISABLE ROW LEVEL SECURITY;

-- جداول إضافية (إن وجدت)
ALTER TABLE exam_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_codes DISABLE ROW LEVEL SECURITY;

-- ===== 4. التأكد من وجود الأعمدة المطلوبة =====
-- إضافة عمود grade_id إلى users (إذا لم يكن موجوداً)
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_id INTEGER REFERENCES grades(id) ON DELETE SET NULL;

-- إضافة عمود used إلى reset_codes (إذا لم يكن موجوداً)
ALTER TABLE reset_codes ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE;

-- ===== 5. إنشاء دالة مساعدة لتسجيل الدخول =====
CREATE OR REPLACE FUNCTION log_user_action(
    p_user_id UUID,
    p_phone VARCHAR,
    p_action VARCHAR,
    p_ip VARCHAR,
    p_user_agent TEXT,
    p_device_id VARCHAR,
    p_status VARCHAR,
    p_fail_reason TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO login_logs (user_id, phone, action, ip_address, user_agent, device_id, status, fail_reason)
    VALUES (p_user_id, p_phone, p_action, p_ip, p_user_agent, p_device_id, p_status, p_fail_reason)
    RETURNING id INTO log_id;
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- ===== رسالة نجاح =====
SELECT 'تم إصلاح قاعدة البيانات بنجاح! يمكنك الآن تسجيل الدخول.' AS status;
