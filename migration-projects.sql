-- Projects and Project Submissions tables
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS projects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    grade_id BIGINT REFERENCES grades(id) ON DELETE CASCADE,
    month_id BIGINT REFERENCES months(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deadline DATE,
    max_grade INTEGER DEFAULT 20,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_submissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_url TEXT,
    notes TEXT,
    grade INTEGER,
    max_grade INTEGER DEFAULT 20,
    feedback TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_submissions ENABLE ROW LEVEL SECURITY;

-- Allow all access (simple setup for admin-controlled platform)
DROP POLICY IF EXISTS "Allow all on projects" ON projects;
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on project_submissions" ON project_submissions;
CREATE POLICY "Allow all on project_submissions" ON project_submissions FOR ALL USING (true);
