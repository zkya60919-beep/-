-- Fix RLS on course_purchases: Disable RLS (the platform uses custom auth, not Supabase Auth)
-- This allows the admin to insert course_purchases on behalf of students when approving payments.
ALTER TABLE course_purchases DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own course purchases" ON course_purchases;
DROP POLICY IF EXISTS "Users can read own course purchases" ON course_purchases;
DROP POLICY IF EXISTS "Admin can read all course purchases" ON course_purchases;

-- Also disable RLS on any other tables that may have been enabled by migration-courses.sql
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_videos DISABLE ROW LEVEL SECURITY;
