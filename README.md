# الباسط - منصة تعليمية احترافية

منصة تعليمية احترافية وسريعة للطلاب، توفر دروساً وفيديوهات ومذكرات وامتحانات لجميع الصفوف الدراسية.

## المميزات

- 🎓 نظام صفوف دراسية كامل (إعدادي وثانوي)
- 📚 محتوى تعليمي غني (فيديوهات، مذكرات PDF، صوتيات، امتحانات)
- 💳 نظام اشتراكات شهري مرن
- 🔐 حماية المحتوى المدفوع
- 📱 تصميم متجاوب يعمل على جميع الأجهزة
- 🎨 واجهة مستخدم حديثة وسهلة الاستخدام
- 📊 لوحة تحكم احترافية للمدرس
- 💰 تكامل مع Paymob للدفع الإلكتروني
- 🗄️ قاعدة بيانات Supabase قوية

## التقنيات المستخدمة

### Frontend
- HTML5
- CSS3
- JavaScript Vanilla

### Backend
- Supabase (Database, Auth, Storage)

### Payment
- Paymob API

### Hosting
- Vercel

## التثبيت والإعداد

### 1. استنساخ المشروع

```bash
git clone <repository-url>
cd منصه_الباسط
```

### 2. إعداد Supabase

1. أنشئ حساباً جديداً على [Supabase](https://supabase.com)
2. أنشئ مشروعاً جديداً
3. اذهب إلى SQL Editor في لوحة تحكم Supabase
4. انسخ ونفّذ الأوامر SQL من ملف `DATABASE_SCHEMA.md`
5. احصل على:
   - Supabase URL
   - Supabase Anon Key

### 3. إعداد Paymob (اختياري)

1. أنشئ حساباً على [Paymob](https://paymob.com)
2. احصل على:
   - API Key
   - Integration ID
   - Iframe ID
   - HMAC Secret

### 4. تكوين المشروع

1. افتح ملف `js/config.js`
2. حدّث الإعدادات التالية:

```javascript
const CONFIG = {
    SUPABASE: {
        URL: 'YOUR_SUPABASE_URL',
        ANON_KEY: 'YOUR_SUPABASE_ANON_KEY'
    },
    PAYMOB: {
        API_KEY: 'YOUR_PAYMOB_API_KEY',
        INTEGRATION_ID: 'YOUR_PAYMOB_INTEGRATION_ID',
        IFRAME_ID: 'YOUR_PAYMOB_IFRAME_ID',
        HMAC_SECRET: 'YOUR_PAYMOB_HMAC_SECRET'
    },
    // ... other settings
};
```

### 5. التشغيل المحلي

استخدم أي خادم محلي لتشغيل المشروع:

```bash
# باستخدام Python
python -m http.server 8000

# أو باستخدام Node.js
npx serve

# أو باستخدام PHP
php -S localhost:8000
```

ثم افتح المتصفح على: `http://localhost:8000`

## النشر على Vercel

### 1. إعداد Vercel

1. أنشئ حساباً على [Vercel](https://vercel.com)
2. ثبّت Vercel CLI:

```bash
npm install -g vercel
```

### 2. النشر

```bash
vercel
```

اتبع التعليمات على الشاشة لإكمال النشر.

### 3. إعدادات البيئة

في Vercel Dashboard، أضف المتغيرات البيئية التالية:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID=your_paymob_integration_id
PAYMOB_IFRAME_ID=your_paymob_iframe_id
PAYMOB_HMAC_SECRET=your_paymob_hmac_secret
```

## هيكل المشروع

```
منصه_الباسط/
├── index.html              # الصفحة الرئيسية
├── about.html              # صفحة نبذة عنا
├── dashboard.html          # لوحة الطالب
├── admin.html              # لوحة التحكم
├── select-grade.html       # اختيار الصف
├── video.html              # مشغل الفيديو
├── payment.html            # صفحة الدفع
├── exam.html               # صفحة الامتحان
├── css/
│   ├── style.css           # الأنماط الرئيسية
│   ├── about.css           # أنماط صفحة نبذة عنا
│   ├── dashboard.css       # أنماط لوحة الطالب
│   ├── admin.css           # أنماط لوحة التحكم
│   ├── video.css           # أنماط مشغل الفيديو
│   ├── payment.css         # أنماط صفحة الدفع
│   └── exam.css            # أنماط صفحة الامتحان
├── js/
│   ├── config.js           # ملف التكوين
│   ├── supabase-client.js  # عميل Supabase
│   ├── auth.js             # نظام المصادقة
│   ├── grades.js           # إدارة الصفوف
│   ├── main.js             # الوظائف الرئيسية
│   ├── select-grade.js     # اختيار الصف
│   ├── dashboard.js        # لوحة الطالب
│   ├── admin.js            # لوحة التحكم
│   ├── video.js            # مشغل الفيديو
│   ├── payment.js          # نظام الدفع
│   └── exam.js             # نظام الامتحانات
├── DATABASE_SCHEMA.md      # هيكل قاعدة البيانات
├── README.md               # هذا الملف
└── vercel.json             # إعدادات Vercel
```

## استخدام المنصة

### للطلاب

1. **إنشاء حساب**: سجّل حساباً جديداً باستخدام رقم الهاتف وكلمة المرور
2. **اختيار الصف**: اختر صفك الدراسي (إعدادي/ثانوي) والشعبة (علمي/أدبي)
3. **الاشتراك**: اشترك في الشهور التي تريد دراستها
4. **المحتوى**: استمتع بالفيديوهات والمذكرات والامتحانات

### للمدرس (الأدمن)

1. **تسجيل الدخول**: استخدم رقم الهاتف وكلمة المرور المحددين في الإعدادات
2. **إدارة الصفوف**: أضف أو عدّل أو احذف الصفوف الدراسية
3. **إدارة الشهور**: نظّم شهور الدراسة لكل صف
4. **إضافة المحتوى**: أضف فيديوهات ومذكرات وامتحانات
5. **متابعة الطلاب**: راقب تقدم الطلاب والاشتراكات
6. **الإحصائيات**: شاهد الأرباح والإحصائيات

## نظام الاشتراكات

### خطط الاشتراك

- **شهر واحد**: 100 ج.م
- **شهرين**: 200 ج.م
- **3 شهور**: 300 ج.م
- **6 شهور**: 600 ج.م

### طرق الدفع

- Vodafone Cash
- Visa
- MasterCard
- InstaPay

### تفعيل الاشتراك

1. اختر خطة الاشتراك
2. أكمل عملية الدفع عبر Paymob
3. احصل على كود تفعيل
4. أدخل الكود في لوحة التحكم
5. استمتع بالمحتوى

### انتهاء الاشتراك

- تنتهي الاشتراكات تلقائياً بعد 30 يوماً
- يمكنك تجديد الاشتراك في أي وقت

## الأمان

- تشفير كلمات المرور
- حماية الصفحات الخاصة
- منع الوصول للمحتوى بدون اشتراك
- حماية الفيديوهات من التحميل
- Row Level Security (RLS) في Supabase

## الأداء

- تحميل سريع بفضل Lazy Loading
- ضغط الصور والفيديوهات
- كود نظيف ومُحسّن
- Semantic HTML
- تحسين SEO

## الدعم

للدعم والاستفسارات، تواصل معنا عبر:
- فيسبوك
- واتساب
- تيليجرام
- يوتيوب

## الترخيص

جميع الحقوق محفوظة © 2024 منصة الباسط

## المساهمة

المساهمات مرحب بها! يرجى فتح Issue أو Pull Request.

## ملاحظات مهمة

- تأكد من تحديث بيانات Supabase و Paymob في ملف `config.js`
- قم بإنشاء الجداول في Supabase باستخدام ملف `DATABASE_SCHEMA.md`
- للاستخدام الإنتاجي، يُنصح باستخدام بيئة استضافة آمنة
- قم بعمل نسخ احتياطية منتظمة لقاعدة البيانات

## التحديثات المستقبلية

- [ ] تطبيق موبايل (iOS/Android)
- [ ] نظام إشعارات
- [ ] غرف دردشة مباشرة
- [ ] نظام نقاط ومكافآت
- [ ] تكامل مع وسائل التواصل الاجتماعي
- [ ] دعم لغات إضافية
