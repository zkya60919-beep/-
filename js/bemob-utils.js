// BeMob Payment Utilities
// وظائف مساعدة للتعامل مع بوابة الدفع BeMob

const BEMOB_EDGE_FUNCTION = `${CONFIG.SUPABASE.URL}/functions/v1/bemob-webhook`;

/**
 * بدء عملية الدفع عبر BeMob
 * @param {number} amount - مبلغ الدفع
 * @param {object} paymentData - بيانات الدفع
 * @param {object} userData - بيانات المستخدم
 * @param {object} extraParams - معاملات إضافية (month_id, term, etc.)
 * @returns {Promise<{success: boolean, payment_url?: string, error?: string}>}
 */
async function initiateBeMobPayment(amount, paymentData, userData, extraParams = {}) {
    if (!ensureHttpOrigin()) {
        return { success: false, error: 'يرجى تشغيل التطبيق عبر http:// أو https://.' };
    }

    if (!CONFIG.BEMOB.ENABLED) {
        return { success: false, error: 'BeMob payment gateway is not enabled' };
    }

    try {
        // تحديث بيانات الدفع في قاعدة البيانات
        const updateData = {
            payment_gateway: 'bemob',
            payment_method: 'bemob',
            student_id: userData.id };
        if (extraParams.course_id) {
            updateData.course_id = extraParams.course_id;
        } else if (extraParams.month_id) {
            updateData.course_id = extraParams.month_id;
        }
        await db.updatePayment(paymentData.id, updateData);

        // إنشاء معرف فريد للطلب
        const orderId = `ALBASIT_${paymentData.id}_${Date.now()}`;

        // تحضير بيانات العميل
        const customerData = {
            customer_id: userData.id,
            customer_name: userData.name,
            customer_phone: userData.phone,
            customer_email: userData.email || 'student@albasit.com'
        };

        // تحضير بيانات المنتج/الكورس
        const isCourse = !!extraParams.course_id;
        const productData = {
            product_id: extraParams.course_id || extraParams.month_id || 'subscription',
            product_name: isCourse ? 'شراء كورس' : (extraParams.term ? 'اشتراك ترم' : 'اشتراك شهري'),
            amount: amount,
            currency: 'EGP'
        };

        // إنشاء رابط الدفع
        const paymentUrl = buildBeMobPaymentUrl(orderId, customerData, productData, extraParams);

        // حفظ معرف الطلب والبيانات الوصفية
        const metadata = {
            ...paymentData.metadata,
            bemob_order_id: orderId,
            payment_method: 'bemob',
            initiated_at: new Date().toISOString(),
            payment_type: isCourse ? 'course' : 'subscription',
            course_id: extraParams.course_id || null
        };

        await db.updatePayment(paymentData.id, { metadata });

        return {
            success: true,
            payment_url: paymentUrl,
            order_id: orderId
        };
    } catch (error) {
        console.error('BeMob payment initiation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * بناء رابط الدفع لـ BeMob
 * @param {string} orderId - معرف الطلب
 * @param {object} customerData - بيانات العميل
 * @param {object} productData - بيانات المنتج
 * @param {object} extraParams - معاملات إضافية
 * @returns {string} رابط الدفع
 */
function buildBeMobPaymentUrl(orderId, customerData, productData, extraParams = {}) {
    const baseUrl = CONFIG.BEMOB.PAYMENT_URL;
    const url = new URL(baseUrl);

    // إضافة معاملات أساسية
    url.searchParams.set('merchant_id', CONFIG.BEMOB.MERCHANT_ID);
    url.searchParams.set('order_id', orderId);
    url.searchParams.set('amount', productData.amount);
    url.searchParams.set('currency', productData.currency);

    // إضافة بيانات العميل
    url.searchParams.set('customer_id', customerData.customer_id);
    url.searchParams.set('customer_name', encodeURIComponent(customerData.customer_name));
    url.searchParams.set('customer_phone', customerData.customer_phone);
    url.searchParams.set('customer_email', customerData.customer_email);

    // إضافة بيانات المنتج
    url.searchParams.set('product_id', productData.product_id);
    url.searchParams.set('product_name', encodeURIComponent(productData.product_name));

    // إضافة رابط Webhook
    url.searchParams.set('webhook_url', encodeURIComponent(CONFIG.BEMOB.WEBHOOK_URL));

    // إضافة معاملات إضافية
    if (extraParams.month_id) {
        url.searchParams.set('month_id', extraParams.month_id);
    }
    if (extraParams.course_id) {
        url.searchParams.set('course_id', extraParams.course_id);
    }
    if (extraParams.term) {
        url.searchParams.set('term', extraParams.term);
    }

    // إضافة رابط العودة بعد الدفع
    const returnUrl = new URL(window.location.origin + '/payment.html');
    returnUrl.searchParams.set('bemob_return', '1');
    returnUrl.searchParams.set('payment_id', orderId.split('_')[1]);
    if (extraParams.month_id) returnUrl.searchParams.set('month_id', extraParams.month_id);
    if (extraParams.course_id) returnUrl.searchParams.set('course_id', extraParams.course_id);
    if (extraParams.term) returnUrl.searchParams.set('term', extraParams.term);
    
    url.searchParams.set('return_url', encodeURIComponent(returnUrl.toString()));

    // إضافة رابط الإلغاء
    const cancelUrl = new URL(window.location.origin + '/dashboard.html');
    url.searchParams.set('cancel_url', encodeURIComponent(cancelUrl.toString()));

    return url.toString();
}

/**
 * معالجة رجوع الدفع من BeMob
 * @returns {Promise<void>}
 */
async function handleBeMobCallback() {
    const bemobReturn = getUrlParam('bemob_return');
    const paymentId = getUrlParam('payment_id');
    const monthId = getUrlParam('month_id');
    const term = getUrlParam('term');
    const courseId = getUrlParam('course_id');

    if (bemobReturn === '1' && paymentId) {
        try {
            const payment = await db.getPayment(parseInt(paymentId));

            if (!payment) {
                showAlert('بيانات الدفع غير موجودة', 'error');
                window.location.href = 'dashboard.html';
                return;
            }

            async function activateCourseAndRedirect() {
                if (courseId) {
                    await supabase.from('course_purchases').insert({
                        user_id: payment.student_id,
                        course_id: parseInt(courseId),
                        payment_id: parseInt(paymentId),
                        status: 'active'
                    });
                }
                const redirectUrl = courseId ? `course-details.html?id=${courseId}` : 'dashboard.html';
                setTimeout(() => { window.location.href = redirectUrl; }, 2500);
            }

            if (payment.webhook_processed) {
                if (payment.status === 'success') {
                    showAlert('تم الدفع بنجاح!', 'success');
                    await activateCourseAndRedirect();
                } else if (payment.status === 'failed') {
                    showAlert('لم تكتمل عملية الدفع، يرجى المحاولة مرة أخرى', 'error');
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2500);
                } else if (payment.status === 'cancelled') {
                    showAlert('تم إلغاء عملية الدفع', 'info');
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2500);
                } else {
                    showAlert('جاري معالجة الدفع، يرجى الانتظار...', 'info');
                    setTimeout(async () => {
                        const updatedPayment = await db.getPayment(parseInt(paymentId));
                        if (updatedPayment.webhook_processed) {
                            window.location.reload();
                        } else {
                            showAlert('لا يزال الدفع قيد المعالجة، سيتم تفعيل اشتراكك تلقائياً عند اكتمال الدفع', 'info');
                            setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);
                        }
                    }, 3000);
                }
            } else {
                showAlert('جاري معالجة الدفع، سيتم تفعيل اشتراكك تلقائياً عند اكتمال الدفع', 'info');
                
                let attempts = 0;
                const maxAttempts = 10;
                const checkInterval = setInterval(async () => {
                    attempts++;
                    const updatedPayment = await db.getPayment(parseInt(paymentId));
                    
                    if (updatedPayment.webhook_processed) {
                        clearInterval(checkInterval);
                        window.location.reload();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        showAlert('لا يزال الدفع قيد المعالجة، سيتم تفعيل اشتراكك تلقائياً عند اكتمال الدفع', 'info');
                        if (courseId) {
                            // حتى لو ماوصلش webhook، نفعّل الكورس ونكمل
                            await supabase.from('course_purchases').insert({
                                user_id: payment.student_id,
                                course_id: parseInt(courseId),
                                payment_id: parseInt(paymentId),
                                status: 'active'
                            }).catch(() => {});
                        }
                        setTimeout(() => { window.location.href = courseId ? `course-details.html?id=${courseId}` : 'dashboard.html'; }, 3000);
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Error handling BeMob callback:', error);
            showAlert('حدث خطأ أثناء معالجة الدفع', 'error');
        }
    }
}

/**
 * التحقق من أن BeMob مفعل
 * @returns {boolean}
 */
function isBeMobEnabled() {
    return CONFIG.BEMOB.ENABLED && 
           CONFIG.BEMOB.MERCHANT_ID && 
           CONFIG.BEMOB.PAYMENT_URL;
}

/**
 * الحصول على اسم بوابة الدفع النشطة
 * @returns {string}
 */
function getActivePaymentGateway() {
    if (isBeMobEnabled()) {
        return 'bemob';
    }
    return 'paymob'; // الافتراضي
}
