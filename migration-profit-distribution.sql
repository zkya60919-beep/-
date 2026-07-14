-- Migration for Profit Distribution Settings
-- This migration adds settings for distributing payment profits

-- Insert profit distribution settings if they don't exist
INSERT INTO teacher_settings (setting_key, setting_value, description) 
VALUES 
    ('teacher_profit_percentage', '70', 'نسبة أرباح المدرس من كل دفع (70%)'),
    ('investor_profit_percentage', '20', 'نسبة أرباح المستثمر من كل دفع (20%)'),
    ('platform_profit_percentage', '10', 'نسبة أرباح المنصة من كل دفع (10%)'),
    ('teacher_user_id', '', 'معرف المستخدم الخاص بالمدرس في جدول users'),
    ('investor_user_id', '', 'معرف المستخدم الخاص بالمستثمر في جدول users (اختياري)')
ON CONFLICT (setting_key) 
DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Add comments to document the settings
COMMENT ON COLUMN teacher_settings.setting_value IS 'قيمة الإعداد - يمكن أن تكون نصية أو رقمية';
COMMENT ON COLUMN teacher_settings.description IS 'وصف الإعداد باللغة العربية';

-- Create a function to validate profit distribution percentages
CREATE OR REPLACE FUNCTION validate_profit_distribution()
RETURNS BOOLEAN AS $$
DECLARE
    teacher_percent DECIMAL;
    investor_percent DECIMAL;
    platform_percent DECIMAL;
    total_percent DECIMAL;
BEGIN
    -- Get current percentages
    SELECT setting_value::DECIMAL INTO teacher_percent
    FROM teacher_settings
    WHERE setting_key = 'teacher_profit_percentage';
    
    SELECT setting_value::DECIMAL INTO investor_percent
    FROM teacher_settings
    WHERE setting_key = 'investor_profit_percentage';
    
    SELECT setting_value::DECIMAL INTO platform_percent
    FROM teacher_settings
    WHERE setting_key = 'platform_profit_percentage';
    
    -- Calculate total
    total_percent := COALESCE(teacher_percent, 0) + COALESCE(investor_percent, 0) + COALESCE(platform_percent, 0);
    
    -- Validate that total equals 100
    RETURN total_percent = 100;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to validate profit distribution before updating settings
CREATE OR REPLACE FUNCTION validate_profit_distribution_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.setting_key IN ('teacher_profit_percentage', 'investor_profit_percentage', 'platform_profit_percentage') THEN
        IF NOT validate_profit_distribution() THEN
            RAISE EXCEPTION 'مجموع نسب توزيع الأرباح يجب أن يساوي 100%';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger
DROP TRIGGER IF EXISTS validate_profit_distribution_trigger ON teacher_settings;
CREATE TRIGGER validate_profit_distribution_trigger
    BEFORE UPDATE ON teacher_settings
    FOR EACH ROW
    EXECUTE FUNCTION validate_profit_distribution_trigger();

-- Create a view for payment statistics
CREATE OR REPLACE VIEW payment_statistics AS
SELECT 
    COUNT(*) as total_payments,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_payments,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
    COUNT(CASE WHEN payment_gateway = 'bemob' THEN 1 END) as bemob_payments,
    COUNT(CASE WHEN payment_gateway = 'paymob' THEN 1 END) as paymob_payments,
    COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_revenue,
    COALESCE(SUM(CASE WHEN status = 'success' THEN teacher_share ELSE 0 END), 0) as total_teacher_share,
    COALESCE(SUM(CASE WHEN status = 'success' THEN investor_share ELSE 0 END), 0) as total_investor_share,
    COALESCE(SUM(CASE WHEN status = 'success' THEN platform_share ELSE 0 END), 0) as total_platform_share
FROM payments;

COMMENT ON VIEW payment_statistics IS 'إحصائيات الدفع وتوزيع الأرباح';
