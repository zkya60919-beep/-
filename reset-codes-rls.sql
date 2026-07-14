-- تعطيل RLS على reset_codes (لأن المشروع يستخدم anon key)
ALTER TABLE reset_codes DISABLE ROW LEVEL SECURITY;