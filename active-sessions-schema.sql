-- ============================================================
-- جدول جلسات المشاهدة النشطة - نظام منع مشاركة الاشتراك
-- منصة الباسط للعلوم الشرعية
-- ============================================================

-- إنشاء الجدول
CREATE TABLE IF NOT EXISTS active_video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,              -- رقم هاتف المستخدم (المعرف الرئيسي)
  video_id TEXT NOT NULL,             -- معرف الفيديو
  session_token TEXT NOT NULL UNIQUE, -- token فريد لكل جلسة/جهاز
  device_info TEXT,                   -- معلومات الجهاز (browser + OS)
  ip_address TEXT,                    -- عنوان IP (اختياري)
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  ended_at TIMESTAMPTZ
);

-- Index للبحث السريع بالمستخدم والفيديو
CREATE INDEX IF NOT EXISTS idx_sessions_user_video 
  ON active_video_sessions(user_id, video_id);

-- Index للجلسات النشطة فقط
CREATE INDEX IF NOT EXISTS idx_sessions_active 
  ON active_video_sessions(user_id, is_active) 
  WHERE is_active = TRUE;

-- Index لتنظيف الجلسات القديمة
CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat 
  ON active_video_sessions(last_heartbeat);

-- ============================================================
-- RLS Policies (Row Level Security)
-- ============================================================

-- تفعيل RLS
ALTER TABLE active_video_sessions ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بالقراءة (للتحقق من الجلسات)
CREATE POLICY "allow_read_sessions" ON active_video_sessions
  FOR SELECT USING (true);

-- السماح للجميع بالإنشاء
CREATE POLICY "allow_insert_sessions" ON active_video_sessions
  FOR INSERT WITH CHECK (true);

-- السماح للجميع بالتحديث (للـ heartbeat)
CREATE POLICY "allow_update_sessions" ON active_video_sessions
  FOR UPDATE USING (true);

-- السماح للجميع بالحذف (لإنهاء الجلسة)
CREATE POLICY "allow_delete_sessions" ON active_video_sessions
  FOR DELETE USING (true);

-- ============================================================
-- دالة تنظيف الجلسات المنتهية تلقائياً (اختياري)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
  -- إنهاء الجلسات التي لم يصلها heartbeat منذ أكثر من 60 ثانية
  UPDATE active_video_sessions
  SET is_active = FALSE, ended_at = NOW()
  WHERE is_active = TRUE
    AND last_heartbeat < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- تعليق: كيفية الاستخدام
-- ============================================================
-- 1. شغّل هذا الملف في Supabase SQL Editor
-- 2. سيتم إنشاء الجدول والـ policies تلقائياً
-- 3. نظام الـ Session Guard في session-guard.js سيتعامل مع الجدول
