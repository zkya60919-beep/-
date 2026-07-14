# إعداد Cloudinary لمنصة الباسط

## 1. إنشاء حساب
https://cloudinary.com — الخطة المجانية للتجربة، Pro للفيديوهات الطويلة.

## 2. Upload Preset (مهم جداً)

1. **Settings → Upload → Upload presets → Add**
2. **Signing mode:** Unsigned
3. **Resource type:** Video (أو Auto)
4. **Folder:** `albasit/videos`
5. **Access mode:** Public (أو Signed حسب احتياجك)
6. **Eager transformations** (اضغط Add):
   - `sp_hd` / format `m3u8` — لتوليد HLS و720p تلقائياً بعد الرفع
7. **Chunk size:** فعّل Large/Chunked uploads إن وُجد
8. احفظ اسم الـ **Preset** و **Cloud name** من Dashboard

## 3. في المنصة

افتح **إضافة فيديو** → **إعدادات Cloudinary** → أدخل:
- Cloud Name
- Upload Preset

يُحفظان على جهازك تلقائياً.

## 4. نفّذ SQL

شغّل `migration-video-cloudinary.sql` في Supabase.

## 5. طريقة الرفع

```
الجهاز (هاتف/لابتوب)
    ↓ أجزاء 6MB
Cloudinary (ضغط 720p + HLS على السحابة)
    ↓ روابط فقط
Supabase (عنوان، وصف، صف، شهر، روابط)
```

**لا يُرفع الفيديو داخل Supabase Database.**

## 6. للفيديوهات 4–10 ساعات

- اتصال Wi-Fi مستقر
- اترك الصفحة مفتوحة حتى 100%
- استخدم **إيقاف مؤقت / استئناف** عند انقطاع النت
- الحد يعتمد على خطة Cloudinary (حجم التخزين والتحويل)
