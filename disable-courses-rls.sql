-- Disable RLS on courses tables OR add proper policies
-- Run this in Supabase SQL Editor

-- Option 1: Disable RLS completely (simpler for development)
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_purchases DISABLE ROW LEVEL SECURITY;

-- Option 2: Keep RLS but add public read policies (recommended for production)
-- Uncomment the following lines if you want to keep RLS enabled:

-- -- Allow public to read published courses
-- DROP POLICY IF EXISTS "Public can read published courses" ON courses;
-- CREATE POLICY "Public can read published courses" ON courses
--     FOR SELECT USING (status = 'published')
--     WITH CHECK (status = 'published');

-- -- Allow public to read videos from published courses
-- DROP POLICY IF EXISTS "Public can read videos from published courses" ON course_videos;
-- CREATE POLICY "Public can read videos from published courses" ON course_videos
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM courses
--             WHERE courses.id = course_videos.course_id
--             AND courses.status = 'published'
--         )
--     );

-- -- Allow public to read grades (needed for course display)
-- DROP POLICY IF EXISTS "Public can read grades" ON grades;
-- CREATE POLICY "Public can read grades" ON grades
--     FOR SELECT USING (true);

-- Success message
SELECT 'Courses RLS disabled successfully!' AS status;
