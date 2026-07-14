-- Setup Script for Al-Basit Platform Database
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    division VARCHAR(50),
    grade_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS months (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(500) NOT NULL,
    thumbnail VARCHAR(500),
    duration INTEGER,
    is_free BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR(500) NOT NULL,
    thumbnail VARCHAR(500),
    is_free BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    audio_url VARCHAR(500) NOT NULL,
    thumbnail VARCHAR(500),
    duration INTEGER,
    is_free BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER,
    is_free BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    months INTEGER NOT NULL,
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for now (will enable later with proper policies)
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

-- Insert default grades
INSERT INTO grades (name, "order", visible) VALUES
    ('الأول الإعدادي', 1, true),
    ('الثاني الإعدادي', 2, true),
    ('الثالث الإعدادي', 3, true),
    ('الأول الثانوي', 4, true),
    ('الثاني الثانوي', 5, true),
    ('الثالث الثانوي', 6, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default months
INSERT INTO months (grade_id, name, "order", visible) VALUES
    (1, 'الشهر الأول', 1, true),
    (1, 'الشهر الثاني', 2, true),
    (1, 'الشهر الثالث', 3, true),
    (2, 'الشهر الأول', 1, true),
    (2, 'الشهر الثاني', 2, true),
    (2, 'الشهر الثالث', 3, true),
    (3, 'الشهر الأول', 1, true),
    (3, 'الشهر الثاني', 2, true),
    (3, 'الشهر الثالث', 3, true),
    (4, 'الشهر الأول', 1, true),
    (4, 'الشهر الثاني', 2, true),
    (4, 'الشهر الثالث', 3, true),
    (5, 'الشهر الأول', 1, true),
    (5, 'الشهر الثاني', 2, true),
    (5, 'الشهر الثالث', 3, true),
    (6, 'الشهر الأول', 1, true),
    (6, 'الشهر الثاني', 2, true),
    (6, 'الشهر الثالث', 3, true)
ON CONFLICT DO NOTHING;

-- Insert teacher settings
INSERT INTO teacher_settings (setting_key, setting_value, description) VALUES
    ('teacher_phone', '01127025715', 'Teacher phone number for admin login'),
    ('teacher_password', 'AlBasit@2024', 'Teacher password for admin login'),
    ('monthly_price', '100', 'Monthly subscription price in EGP'),
    ('subscription_duration', '30', 'Subscription duration in days')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert teacher admin account
INSERT INTO users (name, phone, password, division, grade_id) VALUES
    ('أ / محمد عبد الباسط', '01127025715', 'AlBasit@2024', 'admin', NULL)
ON CONFLICT (phone) DO NOTHING;

-- Success message
SELECT 'Database setup completed successfully!' AS status;
