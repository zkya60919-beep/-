-- Run in Supabase SQL Editor (adds missing tables + 9 months support)

CREATE TABLE IF NOT EXISTS subscription_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    month_id INTEGER REFERENCES months(id),
    payment_id INTEGER REFERENCES payments(id),
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'mcq',
    options JSONB,
    correct_answer TEXT NOT NULL,
    marks INTEGER DEFAULT 1,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_results (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score INTEGER NOT NULL,
    total_marks INTEGER NOT NULL,
    percentage DECIMAL(5, 2),
    passed BOOLEAN,
    time_taken INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subscription_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results DISABLE ROW LEVEL SECURITY;

-- Storage buckets (create manually in Supabase Dashboard if upload fails):
-- videos, thumbnails, notes, audio — all public read
