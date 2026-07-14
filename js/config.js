// Configuration File for Al-Basit Platform

const CONFIG = {
    // Supabase Configuration
    SUPABASE: {
        URL: 'https://olnilgksaopmlzulnftw.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbmlsZ2tzYW9wbWx6dWxuZnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTI5NzgsImV4cCI6MjA5NTIyODk3OH0.8IB_J_ELT-9xqgVOM-mOzrCHdbA0X_hoGe3Xw4AkTTo'
    },
    
    // Payment Provider — Switch between 'manual' and 'paymob'
    // لا تقم بحذف كود Paymob — فقط غيّر PROVIDER إلى 'paymob' لإعادة تفعيله
    PAYMENT: {
        PROVIDER: 'manual', // 'manual' | 'paymob'
        VODAFONE_CASH: '01000943912',
        INSTAPAY_ID: '01127025715' },

    // Paymob Configuration (محفوظ للتفعيل المستقبلي — لا تحذف)
    PAYMOB: {
        API_KEY: '',
        INTEGRATION_ID: '5768731',
        IFRAME_ID: '1058216',
        HMAC_SECRET: ''
    },

    // BeMob Configuration
    // ⚠️ المفتاح السري (API_KEY) محذوف من الكود الأمامي — يتم ضبطه كـ Secret في Supabase Edge Function
    // راجع: supabase/functions/bemob-webhook/index.ts
    BEMOB: {
        API_KEY: '', // اتركه فارغاً — سيتم جلب المفتاح من .env في الـ Edge Function
        MERCHANT_ID: '', // معرف التاجر من BeMob
        WEBHOOK_URL: '', // سيتم تعيينه بعد تعريف CONFIG
        WEBHOOK_SECRET: '', // المفتاح السري للتحقق من التوقيع - يتم ضبطه في Edge Function Secrets
        PAYMENT_URL: 'https://payment.bemob.com/checkout', // رابط صفحة الدفع
        ENABLED: true // تفعيل/تعطيل BeMob
    },
    
    // Cloudinary — النظام الرسمي للصور والفيديوهات والـ PDF والمرفقات
    // الإعدادات الحساسة (API_SECRET) موجودة كـ Secrets في Supabase Edge Functions فقط
    CLOUDINARY: {
        ENABLED: true,
        SIGNATURE_FN: 'cloudinary-signature',
        VIDEO_FN: 'video-upload',
        IMAGE_FN: 'image-upload',
        PDF_FN: 'pdf-upload',
        ATTACHMENT_FN: 'attachment-upload',
        DELETE_FN: 'delete-file' },

    // Platform Settings
    PLATFORM: {
        NAME: 'الباسط',
        SUBSCRIPTION_DURATION: 30, // days
        CURRENCY: 'EGP',
        MONTHLY_PRICE: 100 // EGP
    },
    
    // Teacher Settings (for Admin)
    // ⚠️ كلمة السر محذوفة من الكود — تم نقلها إلى Supabase Edge Function Secrets (ADMIN_PASSWORD)
    TEACHER: {
        PHONE: '01127025715',
        SOCIAL: {
            FACEBOOK: 'https://facebook.com/albasit',
            WHATSAPP: 'https://wa.me/201127025715',
            TELEGRAM: 'https://t.me/albasit',
            YOUTUBE: 'https://youtube.com/@albasit',
            INSTAGRAM: 'https://instagram.com/albasit'
        }
    },
    
    // Designer Settings
    DESIGNER: {
        NAME: 'مصمم المنصة',
        SOCIAL: {
            FACEBOOK: '#',
            WHATSAPP: '#',
            GITHUB: '#',
            LINKEDIN: '#',
            INSTAGRAM: '#'
        }
    },
    
    // Default Grades
    DEFAULT_GRADES: [
        { id: 1, name: 'الأول الإعدادي', order: 1, visible: true },
        { id: 2, name: 'الثاني الإعدادي', order: 2, visible: true },
        { id: 3, name: 'الثالث الإعدادي', order: 3, visible: true },
        { id: 4, name: 'الأول الثانوي', order: 4, visible: true },
        { id: 5, name: 'الثاني الثانوي', order: 5, visible: true },
        { id: 6, name: 'الثالث الثانوي', order: 6, visible: true }
    ],
    
    // Default Months
    DEFAULT_MONTHS: [
        'الشهر الأول',
        'الشهر الثاني',
        'الشهر الثالث',
        'الشهر الرابع',
        'الشهر الخامس',
        'الشهر السادس',
        'الشهر السابع',
        'الشهر الثامن',
        'الشهر التاسع'
    ]
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Set WEBHOOK_URL after CONFIG is fully defined
CONFIG.BEMOB.WEBHOOK_URL = `${CONFIG.SUPABASE.URL}/functions/v1/bemob-webhook`;

