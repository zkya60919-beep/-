-- =============================================================
-- تفعيل RLS على الجداول الأساسية (بعد نقل نظام التوثيق لـ Supabase Auth)
-- تحذير: لا تشغّل هذا الملف إلا بعد ترحيل نظام تسجيل الدخول
-- =============================================================

-- ---- 1. users ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- يرى المستخدم بياناته فقط
DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_select ON users FOR SELECT USING (phone = current_user);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (phone = current_user);
CREATE POLICY users_update ON users FOR UPDATE USING (phone = current_user);

-- ---- 2. payments ----
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select ON payments FOR SELECT USING (user_id IN (SELECT id FROM users WHERE phone = current_user));
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE phone = current_user));

-- ---- 3. subscriptions ----
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_select ON subscriptions FOR SELECT USING (user_id IN (SELECT id FROM users WHERE phone = current_user));

-- ---- 4. payment_requests ----
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_select ON payment_requests FOR SELECT USING (user_id IN (SELECT id FROM users WHERE phone = current_user));
CREATE POLICY pr_insert ON payment_requests FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE phone = current_user));

-- ---- 5. login_logs ----
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ll_select ON login_logs FOR SELECT USING (phone = current_user);
CREATE POLICY ll_insert ON login_logs FOR INSERT WITH CHECK (phone = current_user);

-- ---- 6. reset_codes ----
ALTER TABLE reset_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_select ON reset_codes FOR SELECT USING (user_id IN (SELECT id FROM users WHERE phone = current_user));
CREATE POLICY rc_insert ON reset_codes FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE phone = current_user));
CREATE POLICY rc_delete ON reset_codes FOR DELETE USING (user_id IN (SELECT id FROM users WHERE phone = current_user));

-- ---- 7. device_registrations ----
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dr_select ON device_registrations FOR SELECT USING (user_id IN (SELECT id FROM users WHERE phone = current_user));
CREATE POLICY dr_insert ON device_registrations FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE phone = current_user));

-- ---- 8. tables العامة (تبقى للجميع) ----
-- grades, months, videos, notes, audio, exams, courses, etc.
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY videos_select ON videos FOR SELECT USING (true);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_select ON notes FOR SELECT USING (true);

ALTER TABLE audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY audio_select ON audio FOR SELECT USING (true);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY exams_select ON exams FOR SELECT USING (true);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY courses_select ON courses FOR SELECT USING (true);

ALTER TABLE course_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cv_select ON course_videos FOR SELECT USING (true);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY grades_select ON grades FOR SELECT USING (true);

ALTER TABLE months ENABLE ROW LEVEL SECURITY;
CREATE POLICY months_select ON months FOR SELECT USING (true);

ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_select ON teacher_settings FOR SELECT USING (true);
