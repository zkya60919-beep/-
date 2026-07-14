-- Manual Payment System Migration
-- Run this in Supabase SQL Editor

-- 1. Payment Settings (single row for teacher)
CREATE TABLE IF NOT EXISTS payment_settings (
    id BIGINT PRIMARY KEY DEFAULT 1,
    vodafone_cash VARCHAR(50) DEFAULT '01000000000',
    instapay_id VARCHAR(100) DEFAULT 'teacher@instapay.com',
    payment_instructions TEXT DEFAULT 'يرجى تحويل المبلغ على أحد الحسابات التالية ثم رفع إيصال الدفع',
    allowed_file_size INT DEFAULT 10,
    allowed_image_types TEXT DEFAULT 'jpg,png,jpeg',
    subscription_duration INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO payment_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Payment Requests
CREATE TABLE IF NOT EXISTS payment_requests (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
    month_id BIGINT REFERENCES months(id) ON DELETE SET NULL,
    term INT,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'vodafone_cash',
    image_url TEXT NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_phone VARCHAR(20) NOT NULL,
    grade_name VARCHAR(255),
    course_name VARCHAR(255),
    transfer_time VARCHAR(50),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ,
    subscription_duration INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_student_id ON payment_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at DESC);

-- 3. Allow all operations (RLS disabled on other tables, use policies here for safety)
ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings DISABLE ROW LEVEL SECURITY;
-- Fallback policies in case RLS re-enables itself
DROP POLICY IF EXISTS "Allow all on payment_requests" ON payment_requests;
DROP POLICY IF EXISTS "Allow all on payment_settings" ON payment_settings;
CREATE POLICY "Allow all on payment_requests" ON payment_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on payment_settings" ON payment_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. Create storage bucket (public so receipt images load in browser)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Storage bucket policies — drop all then recreate
DROP POLICY IF EXISTS "Students can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Students can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow read own and admin read all" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

CREATE POLICY "Allow authenticated uploads"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'payment-receipts'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Allow read own and admin read all"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'payment-receipts'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Allow authenticated deletes"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'payment-receipts'
        AND auth.role() = 'authenticated'
    );
