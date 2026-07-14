-- Migration: Device Registration & Login Logs Tables
-- شغّل هذا الملف في Supabase SQL Editor

-- ===== 1. DEVICE REGISTRATIONS TABLE =====
CREATE TABLE IF NOT EXISTS device_registrations (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_device_registrations_user_id ON device_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_device_registrations_device_id ON device_registrations(device_id);

-- ===== 2. LOGIN LOGS TABLE =====
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

-- ===== 3. DISABLE RLS (لأن Edge Function تستخدم Service Role Key) =====
ALTER TABLE device_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs DISABLE ROW LEVEL SECURITY;

-- ===== رسالة نجاح =====
SELECT 'device_registrations و login_logs تم إنشاؤها بنجاح' AS status;
