# Supabase Database Schema for Al-Basit Platform

## Tables Overview

### 1. users
Stores user information including students and teachers.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    division VARCHAR(50), -- 'علمي' or 'أدبي'
    grade_id INTEGER REFERENCES grades(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_grade_id ON users(grade_id);
```

### 2. grades
Stores available grades/classes.

```sql
CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    order_num INTEGER DEFAULT 0,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_grades_visible ON grades(visible);
CREATE INDEX idx_grades_order ON grades(order_num);
```

### 3. months
Stores months for each grade.

```sql
CREATE TABLE months (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    order_num INTEGER DEFAULT 0,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_months_grade_id ON months(grade_id);
CREATE INDEX idx_months_visible ON months(visible);
CREATE INDEX idx_months_order ON months(order_num);
```

### 4. videos
Stores video content.

```sql
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(500) NOT NULL,
    thumbnail VARCHAR(500),
    duration INTEGER, -- in seconds
    is_free BOOLEAN DEFAULT false,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_videos_grade_id ON videos(grade_id);
CREATE INDEX idx_videos_month_id ON videos(month_id);
CREATE INDEX idx_videos_is_free ON videos(is_free);
CREATE INDEX idx_videos_order ON videos(order_num);
```

### 5. products
Stores digital products (PDFs, Audio, etc.).

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'pdf', 'audio', 'other'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR(500) NOT NULL,
    thumbnail VARCHAR(500),
    price DECIMAL(10, 2) DEFAULT 0,
    is_free BOOLEAN DEFAULT false,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_grade_id ON products(grade_id);
CREATE INDEX idx_products_month_id ON products(month_id);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_is_free ON products(is_free);
```

### 6. exams
Stores exam information.

```sql
CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER, -- in minutes
    total_marks INTEGER DEFAULT 100,
    passing_marks INTEGER DEFAULT 50,
    is_free BOOLEAN DEFAULT false,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_exams_grade_id ON exams(grade_id);
CREATE INDEX idx_exams_month_id ON exams(month_id);
CREATE INDEX idx_exams_is_free ON exams(is_free);
```

### 7. exam_questions
Stores exam questions.

```sql
CREATE TABLE exam_questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'mcq', 'true_false', 'essay'
    options JSONB, -- For MCQ: ["option1", "option2", "option3", "option4"]
    correct_answer TEXT NOT NULL,
    marks INTEGER DEFAULT 1,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_exam_questions_exam_id ON exam_questions(exam_id);
CREATE INDEX idx_exam_questions_type ON exam_questions(question_type);
```

### 8. exam_results
Stores exam results.

```sql
CREATE TABLE exam_results (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score INTEGER NOT NULL,
    total_marks INTEGER NOT NULL,
    percentage DECIMAL(5, 2),
    passed BOOLEAN,
    time_taken INTEGER, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_exam_results_exam_id ON exam_results(exam_id);
CREATE INDEX idx_exam_results_user_id ON exam_results(user_id);
```

### 9. subscriptions
Stores user subscriptions.

```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month_id INTEGER REFERENCES months(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_id INTEGER REFERENCES payments(id),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_month_id ON subscriptions(month_id);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### 10. subscription_codes
Stores subscription activation codes.

```sql
CREATE TABLE subscription_codes (
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

-- Indexes
CREATE INDEX idx_subscription_codes_code ON subscription_codes(code);
CREATE INDEX idx_subscription_codes_used ON subscription_codes(used);
CREATE INDEX idx_subscription_codes_expires_at ON subscription_codes(expires_at);
```

### 11. payments
Stores payment information.

```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    months INTEGER NOT NULL,
    payment_method VARCHAR(50), -- 'visa', 'mastercard', 'vodafone_cash', 'instapay'
    payment_id VARCHAR(255), -- Paymob payment ID
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'success', 'failed', 'refunded'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
```

### 12. teacher_settings
Stores teacher/admin settings.

```sql
CREATE TABLE teacher_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_teacher_settings_key ON teacher_settings(setting_key);
```

## Row Level Security (RLS) Policies

### Enable RLS on all tables
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE months ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;
```

### Users Table Policies
```sql
-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can insert their own data
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);
```

### Public Tables Policies (grades, months)
```sql
-- Everyone can read grades
CREATE POLICY "Public can read grades" ON grades
    FOR SELECT USING (true);

-- Everyone can read visible months
CREATE POLICY "Public can read visible months" ON months
    FOR SELECT USING (visible = true);
```

### Content Tables Policies (videos, products, exams)
```sql
-- Everyone can read free content
CREATE POLICY "Public can read free videos" ON videos
    FOR SELECT USING (is_free = true);

CREATE POLICY "Public can read free products" ON products
    FOR SELECT USING (is_free = true);

CREATE POLICY "Public can read free exams" ON exams
    FOR SELECT USING (is_free = true);

-- Subscribed users can read paid content
CREATE POLICY "Subscribed users can read videos" ON videos
    FOR SELECT USING (
        is_free = true OR
        EXISTS (
            SELECT 1 FROM subscriptions
            WHERE subscriptions.user_id = auth.uid()
            AND subscriptions.month_id = videos.month_id
            AND subscriptions.end_date > NOW()
            AND subscriptions.status = 'active'
        )
    );
```

### Subscription Tables Policies
```sql
-- Users can read their own subscriptions
CREATE POLICY "Users can read own subscriptions" ON subscriptions
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can read their own payments
CREATE POLICY "Users can read own payments" ON payments
    FOR SELECT USING (user_id = auth.uid());

-- Users can read their own exam results
CREATE POLICY "Users can read own exam results" ON exam_results
    FOR SELECT USING (user_id = auth.uid());
```

## Functions

### Function to check subscription status
```sql
CREATE OR REPLACE FUNCTION check_subscription_status(user_id UUID, month_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM subscriptions
        WHERE subscriptions.user_id = user_id
        AND subscriptions.month_id = month_id
        AND subscriptions.end_date > NOW()
        AND subscriptions.status = 'active'
    );
END;
$$ LANGUAGE plpgsql;
```

### Function to expire old subscriptions
```sql
CREATE OR REPLACE FUNCTION expire_old_subscriptions()
RETURNS VOID AS $$
BEGIN
    UPDATE subscriptions
    SET status = 'expired'
    WHERE end_date < NOW()
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;
```

### Trigger to auto-update updated_at
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_months_updated_at BEFORE UPDATE ON months
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Initial Data

### Insert default grades
```sql
INSERT INTO grades (name, order_num) VALUES
    ('الأول الإعدادي', 1),
    ('الثاني الإعدادي', 2),
    ('الثالث الإعدادي', 3),
    ('الأول الثانوي', 4),
    ('الثاني الثانوي', 5),
    ('الثالث الثانوي', 6);
```

### Insert teacher settings
```sql
INSERT INTO teacher_settings (setting_key, setting_value, description) VALUES
    ('teacher_phone', 'YOUR_TEACHER_PHONE', 'Teacher phone number for admin login'),
    ('teacher_password', 'YOUR_TEACHER_PASSWORD', 'Teacher password for admin login'),
    ('monthly_price', '100', 'Monthly subscription price in EGP'),
    ('subscription_duration', '30', 'Subscription duration in days');
```

## Setup Instructions

1. Create a new Supabase project
2. Go to the SQL Editor in Supabase Dashboard
3. Copy and execute the SQL commands above in order:
   - Create tables
   - Create indexes
   - Enable RLS
   - Create policies
   - Create functions
   - Create triggers
   - Insert initial data
4. Update the config.js file with your Supabase credentials
5. Set up storage buckets for videos, images, and documents if using Supabase Storage
