-- حقول Cloudinary لجدول الفيديوهات (نفّذ في Supabase SQL Editor)

ALTER TABLE videos ADD COLUMN IF NOT EXISTS hls_url TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS playback_url TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration INTEGER;

COMMENT ON COLUMN videos.video_url IS 'رابط MP4 من Cloudinary';
COMMENT ON COLUMN videos.hls_url IS 'رابط HLS للبث التكيفي';
COMMENT ON COLUMN videos.playback_url IS 'رابط التشغيل المفضل للطالب';
COMMENT ON COLUMN videos.cloudinary_public_id IS 'معرف Cloudinary';
