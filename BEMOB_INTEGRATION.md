# دليل تكامل BeMob Payment Gateway
## منصة الباسط للعلوم الشرعية

هذا الدليل يشرح كيفية إعداد واستخدام بوابة الدفع BeMob في منصة الباسط.

---

## نظرة عامة

تم تصميم نظام الدفع الجديد ليعمل بالشكل التالي:

1. **عندما يضغط الطالب على "ادفع الآن"**: يتم تحويله مباشرة إلى صفحة الدفع الآمنة الخاصة بـ BeMob
2. **داخل BeMob**: يختار الطالب وسيلة الدفع ويُكمل العملية بشكل آمن
3. **بعد نجاح الدفع**: ترسل BeMob إشعارًا (Webhook) إلى منصة الباسط
4. **معالجة الإشعار**: يتم التحقق من التوقيع، تسجيل العملية، توزيع الأرباح، وتفعيل الاشتراك تلقائيًا

---

## المتطلبات التقنية

### 1. قاعدة البيانات

قم بتنفيذ ملفات الترحيل (Migration Files) بالترتيب:

```bash
# ترحيل حقول BeMob
migration-bemob-payments.sql

# ترحيل إعدادات توزيع الأرباح
migration-profit-distribution.sql
```

### 2. Supabase Edge Functions

تم إنشاء Edge Function جديد لمعالجة إشعارات BeMob:

```
supabase/functions/bemob-webhook/index.ts
```

### 3. إعدادات البيئة (Environment Variables)

في لوحة تحكم Supabase → Edge Functions → Secrets، أضف المتغيرات التالية:

```
BEMOB_WEBHOOK_SECRET=your_webhook_secret_here
BEMOB_API_KEY=your_api_key_here (اختياري)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## خطوات الإعداد

### الخطوة 1: الحصول على بيانات BeMob

1. سجل حسابًا في [BeMob](https://bemob.com)
2. احصل على:
   - **Merchant ID**: معرف التاجر
   - **API Key**: مفتاح API
   - **Webhook Secret**: المفتاح السري للتحقق من التوقيع

### الخطوة 2: تحديث ملف التكوين

في ملف `js/config.js`، قم بتحديث إعدادات BeMob:

```javascript
BEMOB: {
    API_KEY: '', // اتركه فارغاً - سيتم جلبه من Edge Function
    MERCHANT_ID: 'YOUR_MERCHANT_ID', // معرف التاجر من BeMob
    WEBHOOK_URL: `${CONFIG.SUPABASE.URL}/functions/v1/bemob-webhook`,
    WEBHOOK_SECRET: '', // يتم ضبطه في Edge Function Secrets
    PAYMENT_URL: 'https://payment.bemob.com/checkout',
    ENABLED: true // تفعيل BeMob
}
```

### الخطوة 3: إعداد Webhook في BeMob

1. في لوحة تحكم BeMob، أضف Webhook جديد
2. رابط Webhook: `https://olnilgksaopmlzulnftw.supabase.co/functions/v1/bemob-webhook`
3. حدد الأحداث (Events) التي تريد استقبالها:
   - Payment Success
   - Payment Failed
   - Payment Cancelled

### الخطوة 4: إعداد توزيع الأرباح

في جدول `teacher_settings` في قاعدة البيانات، قم بتحديث:

```sql
-- نسبة أرباح المدرس (70%)
UPDATE teacher_settings 
SET setting_value = '70' 
WHERE setting_key = 'teacher_profit_percentage';

-- نسبة أرباح المستثمر (20%)
UPDATE teacher_settings 
SET setting_value = '20' 
WHERE setting_key = 'investor_profit_percentage';

-- نسبة أرباح المنصة (10%)
UPDATE teacher_settings 
SET setting_value = '10' 
WHERE setting_key = 'platform_profit_percentage';

-- معرف المستخدم الخاص بالمدرس
UPDATE teacher_settings 
SET setting_value = 'UUID_OF_TEACHER_USER' 
WHERE setting_key = 'teacher_user_id';

-- معرف المستخدم الخاص بالمستثمر (اختياري)
UPDATE teacher_settings 
SET setting_value = 'UUID_OF_INVESTOR_USER' 
WHERE setting_key = 'investor_user_id';
```

**ملاحظة**: مجموع النسب الثلاث يجب أن يساوي 100%

---

## آلية العمل

### 1. بدء عملية الدفع

عندما يضغط الطالب على "ادفع الآن":

```javascript
// في payment.js
async function processPayment() {
    // التحقق من تفعيل BeMob
    if (isBeMobEnabled()) {
        // إنشاء رابط الدفع لـ BeMob
        const bemobResponse = await initiateBeMobPayment(
            paymentData.amount, 
            paymentData, 
            currentUser, 
            { month_id: targetMonthId, term: getUrlParam('term') }
        );
        
        // تحويل الطالب إلى صفحة الدفع
        window.location.href = bemobResponse.payment_url;
    }
}
```

### 2. معالجة Webhook

عند استلام إشعار من BeMob:

```typescript
// في supabase/functions/bemob-webhook/index.ts
Deno.serve(async (req) => {
    // 1. التحقق من التوقيع
    const isValidSignature = await verifySignature(body, webhookSecret);
    
    // 2. التحقق من Idempotency (منع التكرار)
    const existingPayment = await supabase
        .from('payments')
        .select('*')
        .eq('bemob_transaction_id', transaction_id)
        .single();
    
    // 3. معالجة الدفع الناجح
    if (status === 'success') {
        await processSuccessfulPayment(supabase, paymentData);
    }
});
```

### 3. تفعيل الاشتراك تلقائيًا

```typescript
async function processSuccessfulPayment(supabase, paymentData) {
    // 1. تحديث حالة الدفع
    await supabase.from('payments').update({
        status: 'success',
        payment_gateway: 'bemob',
        webhook_processed: true
    });
    
    // 2. إنشاء الاشتراك
    await supabase.from('subscriptions').insert({
        user_id: student_id,
        month_id: course_id,
        start_date: startDate,
        end_date: endDate,
        status: 'active'
    });
    
    // 3. توزيع الأرباح
    await distributeProfits(supabase, paymentId, amount);
    
    // 4. إرسال الإشعارات
    await sendNotifications(supabase, student_id, paymentId, amount);
}
```

### 4. توزيع الأرباح

```typescript
async function distributeProfits(supabase, paymentId, amount) {
    // الحصول على النسب المئوية
    const teacherPercent = 70; // من الإعدادات
    const investorPercent = 20;
    const platformPercent = 10;
    
    // حساب المبالغ
    const teacherShare = (amount * teacherPercent) / 100;
    const investorShare = (amount * investorPercent) / 100;
    const platformShare = (amount * platformPercent) / 100;
    
    // تسجيل التوزيع
    await supabase.from('payment_distributions').insert([
        { recipient_type: 'teacher', amount: teacherShare },
        { recipient_type: 'investor', amount: investorShare },
        { recipient_type: 'platform', amount: platformShare }
    ]);
}
```

---

## حالات الدفع

### نجاح الدفع (Success)

- **الإجراء**: تفعيل الاشتراك فورًا
- **الرسالة**: "تم الدفع بنجاح وتم تفعيل اشتراكك"
- **الخطوات**:
  1. تحديث حالة الدفع إلى `success`
  2. إنشاء اشتراك جديد
  3. توزيع الأرباح
  4. إرسال إشعار للطالب
  5. إرسال إشعار للمدرس

### فشل الدفع (Failed)

- **الإجراء**: لا يتم تفعيل الاشتراك
- **الرسالة**: "لم تكتمل عملية الدفع، يرجى المحاولة مرة أخرى"
- **الخطوات**:
  1. تحديث حالة الدفع إلى `failed`
  2. إرسال إشعار للطالب

### إلغاء الدفع (Cancelled)

- **الإجراء**: العودة لصفحة الاشتراك دون تغيير
- **الرسالة**: "تم إلغاء عملية الدفع"
- **الخطوات**:
  1. تحديث حالة الدفع إلى `cancelled`
  2. إعادة التوجيه للوحة التحكم

---

## الميزات الأمنية

### 1. التحقق من التوقيع (Signature Verification)

يتم التحقق من توقيع كل Webhook باستخدام HMAC-SHA256:

```typescript
async function verifySignature(body, secret) {
    const payloadString = JSON.stringify({ ...body, signature: undefined });
    const calculatedSignature = await hmacSha256(payloadString, secret);
    return calculatedSignature === body.signature;
}
```

### 2. منع التكرار (Idempotency)

يتم التحقق من أن كل معاملة تُعالج مرة واحدة فقط:

```typescript
if (existingPayment && existingPayment.webhook_processed) {
    return Response.json({ success: true, message: "Already processed" });
}
```

### 3. حماية المفاتيح السرية

- جميع المفاتيح السرية تُخزن في Edge Function Secrets
- لا تُرسل المفاتيح في الكود الأمامي
- استخدام Service Role Key للوصول الكامل لقاعدة البيانات

---

## مراقبة وتصحيح الأخطاء

### عرض سجلات Edge Function

```bash
supabase functions logs bemob-webhook
```

### التحقق من حالة الدفع

```sql
SELECT * FROM payments 
WHERE payment_gateway = 'bemob' 
ORDER BY created_at DESC 
LIMIT 10;
```

### عرض إحصائيات الدفع

```sql
SELECT * FROM payment_statistics;
```

### عرض سجل توزيع الأرباح

```sql
SELECT * FROM payment_distributions 
ORDER BY distributed_at DESC 
LIMIT 20;
```

---

## استكشاف الأخطاء

### المشكلة: Webhook لا يعمل

**الحلول:**
1. تحقق من أن رابط Webhook صحيح في إعدادات BeMob
2. تأكد من أن `BEMOB_WEBHOOK_SECRET` مضبوط في Edge Function Secrets
3. تحقق من سجلات Edge Function

### المشكلة: التوقيع غير صالح

**الحلول:**
1. تأكد من أن `BEMOB_WEBHOOK_SECRET` مطابق لما في BeMob
2. تحقق من أن البيانات المرسلة من BeMob متوقعة بشكل صحيح

### المشكلة: الاشتراك لا يُفعل

**الحلول:**
1. تحقق من حالة الدفع في قاعدة البيانات
2. تأكد من أن `webhook_processed = true`
3. تحقق من سجلات Edge Function لأي أخطاء

### المشكلة: الأرباح لا تُوزع

**الحلول:**
1. تحقق من إعدادات النسب المئوية في `teacher_settings`
2. تأكد من أن مجموع النسب يساوي 100%
3. تحقق من أن `teacher_user_id` مضبوط بشكل صحيح

---

## التبديل بين BeMob و Paymob

يمكنك التبديل بين بوابات الدفع بسهولة:

```javascript
// في js/config.js
BEMOB: {
    ENABLED: true  // true لتفعيل BeMob، false لاستخدام Paymob
}
```

عند تعطيل BeMob، سيعود النظام تلقائيًا لاستخدام Paymob.

---

## الدعم

للدعم الفني أو الاستفسارات:
- راجع سجلات Edge Function
- تحقق من وثائق BeMob الرسمية
- تواصل مع فريق التطوير

---

## ملاحظات مهمة

1. **اختبار الدفع**: قبل إطلاق النظام، قم باختبار الدفع باستخدام وضع الاختبار (Test Mode) في BeMob
2. **النسخ الاحتياطية**: تأكد من أخذ نسخ احتياطية لقاعدة البيانات قبل تنفيذ الترحيلات
3. **المراقبة**: راقب سجلات Webhook بانتظام للتأكد من عمل النظام بشكل صحيح
4. **الأمان**: لا تشارك المفاتيح السرية مع أي شخص
5. **التحديثات**: احتفظ بـ Edge Functions محدثة مع أحدث إصدارات

---

## الملفات المعدلة

### قاعدة البيانات
- `migration-bemob-payments.sql` - إضافة حقول BeMob
- `migration-profit-distribution.sql` - إعدادات توزيع الأرباح

### Supabase Edge Functions
- `supabase/functions/bemob-webhook/index.ts` - معالجة Webhook

### ملفات JavaScript
- `js/config.js` - إعدادات BeMob
- `js/bemob-utils.js` - وظائف مساعدة لـ BeMob
- `js/payment.js` - تحديث منطق الدفع

### ملفات HTML
- `payment.html` - تحديث واجهة الدفع

---

## الإصدار

الإصدار: 1.0.0
التاريخ: 2026-06-28
