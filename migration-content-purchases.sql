-- جدول لتتبع الدفع الفردي للمحتوى (فيديوهات، مذكرات، صوتيات، امتحانات)
-- نفّذ في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS content_purchases (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL, -- 'video', 'note', 'audio', 'exam'
    content_id INTEGER NOT NULL, -- معرف المحتوى
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'refunded'
    amount DECIMAL(10, 2) NOT NULL,
    UNIQUE(user_id, content_type, content_id)
);

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_content_purchases_user ON content_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_content ON content_purchases(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_payment ON content_purchases(payment_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_status ON content_purchases(status);

-- تعطيل RLS على الجدول الجديد
ALTER TABLE content_purchases DISABLE ROW LEVEL SECURITY;

-- رسالة نجاح
SELECT 'تم إنشاء جدول content_purchases بنجاح!' AS status;
