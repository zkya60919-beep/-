-- Migration for BeMob Payment Integration
-- This migration adds fields to support BeMob payment gateway

-- Add BeMob-specific fields to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'paymob', -- 'paymob', 'bemob'
ADD COLUMN IF NOT EXISTS bemob_transaction_id VARCHAR(255) UNIQUE, -- BeMob transaction ID
ADD COLUMN IF NOT EXISTS bemob_order_id VARCHAR(255), -- BeMob order ID
ADD COLUMN IF NOT EXISTS bemob_signature VARCHAR(255), -- BeMob signature for verification
ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMP WITH TIME ZONE, -- When webhook was received
ADD COLUMN IF NOT EXISTS webhook_processed BOOLEAN DEFAULT false, -- Whether webhook was processed
ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0, -- Number of processing attempts
ADD COLUMN IF NOT EXISTS last_error TEXT, -- Last error during processing
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES users(id), -- Explicit student reference
ADD COLUMN IF NOT EXISTS course_id INTEGER, -- Reference to course/month
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES users(id), -- Teacher who receives payment
ADD COLUMN IF NOT EXISTS investor_id UUID REFERENCES users(id), -- Investor who receives payment
ADD COLUMN IF NOT EXISTS teacher_share DECIMAL(10, 2) DEFAULT 0, -- Teacher's share amount
ADD COLUMN IF NOT EXISTS investor_share DECIMAL(10, 2) DEFAULT 0, -- Investor's share amount
ADD COLUMN IF NOT EXISTS platform_share DECIMAL(10, 2) DEFAULT 0; -- Platform's share amount

-- Create index for BeMob transaction ID
CREATE INDEX IF NOT EXISTS idx_payments_bemob_transaction_id ON payments(bemob_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_gateway ON payments(payment_gateway);
CREATE INDEX IF NOT EXISTS idx_payments_webhook_processed ON payments(webhook_processed);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_teacher_id ON payments(teacher_id);

-- Add comment to document the new fields
COMMENT ON COLUMN payments.payment_gateway IS 'Payment gateway used: paymob or bemob';
COMMENT ON COLUMN payments.bemob_transaction_id IS 'Unique transaction ID from BeMob';
COMMENT ON COLUMN payments.bemob_order_id IS 'Order ID from BeMob';
COMMENT ON COLUMN payments.bemob_signature IS 'Signature from BeMob for webhook verification';
COMMENT ON COLUMN payments.webhook_received_at IS 'Timestamp when BeMob webhook was received';
COMMENT ON COLUMN payments.webhook_processed IS 'Whether the webhook has been processed';
COMMENT ON COLUMN payments.processing_attempts IS 'Number of times webhook processing was attempted';
COMMENT ON COLUMN payments.last_error IS 'Last error message if webhook processing failed';
COMMENT ON COLUMN payments.student_id IS 'Reference to the student who made the payment';
COMMENT ON COLUMN payments.course_id IS 'Reference to the course/month purchased';
COMMENT ON COLUMN payments.teacher_id IS 'Reference to the teacher receiving the payment';
COMMENT ON COLUMN payments.investor_id IS 'Reference to the investor receiving the payment';
COMMENT ON COLUMN payments.teacher_share IS 'Amount allocated to the teacher';
COMMENT ON COLUMN payments.investor_share IS 'Amount allocated to the investor';
COMMENT ON COLUMN payments.platform_share IS 'Amount allocated to the platform';

-- Create a table for payment distribution logs (for audit trail)
CREATE TABLE IF NOT EXISTS payment_distributions (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(50) NOT NULL, -- 'teacher', 'investor', 'platform'
    amount DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL, -- Percentage of total payment
    distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payment_distributions
CREATE INDEX IF NOT EXISTS idx_payment_distributions_payment_id ON payment_distributions(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_distributions_recipient_id ON payment_distributions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_payment_distributions_recipient_type ON payment_distributions(recipient_type);

-- Add comments for payment_distributions
COMMENT ON TABLE payment_distributions IS 'Audit log of payment distributions to teachers, investors, and platform';
COMMENT ON COLUMN payment_distributions.recipient_type IS 'Type of recipient: teacher, investor, or platform';
COMMENT ON COLUMN payment_distributions.percentage IS 'Percentage of the total payment amount';

-- Enable RLS on payment_distributions
ALTER TABLE payment_distributions ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_distributions
CREATE POLICY "Teachers can read distributions for their payments" ON payment_distributions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM payments
            WHERE payments.id = payment_distributions.payment_id
            AND payments.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Admin can read all distributions" ON payment_distributions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.phone = (SELECT setting_value FROM teacher_settings WHERE setting_key = 'teacher_phone')
        )
    );
