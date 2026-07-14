-- =====================================================================
-- تحديث أسماء الصفوف الدراسية في منصة الباسط
-- =====================================================================
-- 📌 الخطوات:
-- 1. افتح Supabase Dashboard
-- 2. اذهب إلى SQL Editor
-- 3. انسخ هذا الكود كاملاً والصقه وشغّله
-- =====================================================================

-- خطوة 1: تحديث الأسماء القديمة إلى الأسماء الجديدة
UPDATE grades SET name = 'الأول الإعدادي',  "order" = 1, visible = true
  WHERE name IN ('أولى إعدادي', 'اول اعدادي', 'أول إعدادي', 'الاول الاعدادي');

UPDATE grades SET name = 'الثاني الإعدادي', "order" = 2, visible = true
  WHERE name IN ('ثانية إعدادي', 'ثانى اعدادي', 'ثاني إعدادي', 'الثاني الاعدادي');

UPDATE grades SET name = 'الثالث الإعدادي', "order" = 3, visible = true
  WHERE name IN ('ثالثة إعدادي', 'ثالث اعدادي', 'ثالث إعدادي', 'الثالث الاعدادي');

UPDATE grades SET name = 'الأول الثانوي',   "order" = 4, visible = true
  WHERE name IN ('أولى ثانوي', 'اول ثانوى', 'أول ثانوي', 'الاول الثانوي');

UPDATE grades SET name = 'الثاني الثانوي',  "order" = 5, visible = true
  WHERE name IN ('ثانية ثانوي', 'ثانى ثانوى', 'ثاني ثانوي', 'الثاني الثانوي');

UPDATE grades SET name = 'الثالث الثانوي',  "order" = 6, visible = true
  WHERE name IN ('ثالثة ثانوي', 'ثالث ثانوى', 'ثالث ثانوي', 'الثالث الثانوي');

-- خطوة 2: إضافة أي صف ناقص (في حالة لم يكن موجوداً)
INSERT INTO grades (name, "order", visible)
SELECT 'الأول الإعدادي', 1, true
WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'الأول الإعدادي');

INSERT INTO grades (name, "order", visible)
SELECT 'الثاني الإعدادي', 2, true
WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'الثاني الإعدادي');

INSERT INTO grades (name, "order", visible)
SELECT 'الثالث الإعدادي', 3, true
WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'الثالث الإعدادي');

INSERT INTO grades (name, "order", visible)
SELECT 'الأول الثانوي', 4, true
WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'الأول الثانوي');

INSERT INTO grades (name, "order", visible)
SELECT 'الثاني الثانوي', 5, true
WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'الثاني الثانوي');

INSERT INTO grades (name, "order", visible)
SELECT 'الثالث الثانوي', 6, true
WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'الثالث الثانوي');

-- خطوة 3: التأكد من ظهور جميع الصفوف للطلاب
UPDATE grades SET visible = true;

-- خطوة 4: عرض النتيجة النهائية للتحقق ✅
SELECT id, name, "order", visible
FROM grades
ORDER BY "order";
