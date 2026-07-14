-- Migration: Security, Logging & Missing Tables
-- Run in Supabase SQL Editor

-- ===== 1. TRANSACTIONS TABLE =====
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    gateway VARCHAR(50) NOT NULL DEFAULT 'paymob',
    type VARCHAR(50) NOT NULL DEFAULT 'payment',
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EGP',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    gateway_response JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_id ON transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ===== 2. WEBHOOK LOGS TABLE =====
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    gateway VARCHAR(50) NOT NULL,
    event_type VARCHAR(100),
    payload JSONB NOT NULL,
    headers JSONB,
    signature_verified BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'received',
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_gateway ON webhook_logs(gateway);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);

-- ===== 3. PAYMENT ATTEMPTS TABLE =====
CREATE TABLE IF NOT EXISTS payment_attempts (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gateway VARCHAR(50) NOT NULL DEFAULT 'paymob',
    attempt_number INTEGER NOT NULL DEFAULT 1,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EGP',
    gateway_order_id VARCHAR(255),
    gateway_payment_key VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    gateway_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id ON payment_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);

-- ===== 4. DEVICE REGISTRATIONS TABLE =====
CREATE TABLE IF NOT EXISTS device_registrations (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_device_registrations_user_id ON device_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_device_registrations_device_id ON device_registrations(device_id);

-- ===== 5. LOGIN LOGS TABLE =====
CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(20),
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    fail_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_action ON login_logs(action);

-- ===== 6. ADD TRANSACTION_ID TO PAYMENTS =====
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255) UNIQUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_key VARCHAR(500);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS error_log TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ===== 7. ADD COURSE ACCESS COLUMNS =====
ALTER TABLE course_purchases ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE course_purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE course_purchases ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE course_purchases ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- ===== 8. DISABLE RLS ON NEW TABLES =====
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs DISABLE ROW LEVEL SECURITY;

-- ===== 9. STORED PROCEDURES =====

-- Log login/lougout
CREATE OR REPLACE FUNCTION log_user_action(
    p_user_id UUID,
    p_phone VARCHAR,
    p_action VARCHAR,
    p_ip VARCHAR,
    p_user_agent TEXT,
    p_device_id VARCHAR,
    p_status VARCHAR,
    p_fail_reason TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO login_logs (user_id, phone, action, ip_address, user_agent, device_id, status, fail_reason)
    VALUES (p_user_id, p_phone, p_action, p_ip, p_user_agent, p_device_id, p_status, p_fail_reason)
    RETURNING id INTO log_id;
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Check if device is allowed
CREATE OR REPLACE FUNCTION check_device_allowed(
    p_user_id UUID,
    p_device_id VARCHAR
) RETURNS TABLE(allowed BOOLEAN, message TEXT) AS $$
DECLARE
    registered_device VARCHAR;
BEGIN
    SELECT device_id INTO registered_device
    FROM device_registrations
    WHERE user_id = p_user_id AND is_active = true;

    IF registered_device IS NULL THEN
        -- First login - register device
        RETURN QUERY SELECT true::BOOLEAN, 'registered'::TEXT;
    ELSIF registered_device = p_device_id THEN
        -- Same device
        RETURN QUERY SELECT true::BOOLEAN, 'allowed'::TEXT;
    ELSE
        -- Different device
        RETURN QUERY SELECT false::BOOLEAN, 'This account is already active on another device.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Expire old subscriptions
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE subscriptions
    SET status = 'expired'
    WHERE end_date < NOW() AND status = 'active';
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ===== Success message =====
SELECT 'Security and logging tables created successfully!' AS status;
