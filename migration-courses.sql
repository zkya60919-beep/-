-- Migration: Courses and Course Videos Tables
-- This migration adds the course management system to the Al-Basit platform

-- Create Courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail VARCHAR(500),
    price DECIMAL(10, 2) DEFAULT 0,
    videos_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft', -- 'published', 'draft'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Course Videos table
CREATE TABLE IF NOT EXISTS course_videos (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    video_url VARCHAR(500) NOT NULL,
    duration INTEGER, -- in seconds
    order_number INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Course Purchases table (for student course purchases)
CREATE TABLE IF NOT EXISTS course_purchases (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    payment_id INTEGER REFERENCES payments(id),
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'refunded'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_grade_id ON courses(grade_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at);

CREATE INDEX IF NOT EXISTS idx_course_videos_course_id ON course_videos(course_id);
CREATE INDEX IF NOT EXISTS idx_course_videos_order_number ON course_videos(order_number);

CREATE INDEX IF NOT EXISTS idx_course_purchases_user_id ON course_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_course_id ON course_purchases(course_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_status ON course_purchases(status);

-- Enable Row Level Security
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Courses
-- Public can read published courses
CREATE POLICY "Public can read published courses" ON courses
    FOR SELECT USING (status = 'published');

-- Teachers can manage their own courses
CREATE POLICY "Teachers can manage own courses" ON courses
    FOR ALL USING (
        auth.uid() = teacher_id OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.division = 'admin'
        )
    );

-- RLS Policies for Course Videos
-- Public can read videos from published courses
CREATE POLICY "Public can read videos from published courses" ON course_videos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_videos.course_id
            AND courses.status = 'published'
        )
    );

-- Teachers can manage videos for their courses
CREATE POLICY "Teachers can manage own course videos" ON course_videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_videos.course_id
            AND (courses.teacher_id = auth.uid() OR
                 EXISTS (
                     SELECT 1 FROM users
                     WHERE users.id = auth.uid()
                     AND users.division = 'admin'
                 ))
        )
    );

-- RLS Policies for Course Purchases
-- Users can read their own purchases
CREATE POLICY "Users can read own course purchases" ON course_purchases
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own purchases
CREATE POLICY "Users can insert own course purchases" ON course_purchases
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin can read all purchases
CREATE POLICY "Admin can read all course purchases" ON course_purchases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.division = 'admin'
        )
    );

-- Create trigger for updated_at on courses
CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add a function to check if a user has purchased a course
CREATE OR REPLACE FUNCTION has_purchased_course(user_id UUID, course_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM course_purchases
        WHERE course_purchases.user_id = user_id
        AND course_purchases.course_id = course_id
        AND course_purchases.status = 'active'
    );
END;
$$ LANGUAGE plpgsql;

-- Insert default teacher settings for course-related settings
INSERT INTO teacher_settings (setting_key, setting_value, description)
VALUES 
    ('max_videos_per_course', '20', 'Maximum number of videos allowed per course'),
    ('course_upload_max_size_mb', '500', 'Maximum file size for course video uploads in MB')
ON CONFLICT (setting_key) DO NOTHING;
