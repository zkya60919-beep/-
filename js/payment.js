// Payment Module

let selectedPaymentMethod = 'card';
let paymentData = null;
let targetMonthId = null;
let pendingCourseId = null;

onDOMReady(async () => {
    await checkAuth();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    await loadPaymentData();
});

async function loadPaymentData() {
    try {
        if (!ensureHttpOrigin()) return;

        const paymentId = getUrlParam('payment_id');
        const months = getUrlParam('months') || '1';
        targetMonthId = getUrlParam('month_id') ? parseInt(getUrlParam('month_id')) : null;
        pendingCourseId = getUrlParam('course_id') ? parseInt(getUrlParam('course_id')) : null;

        if (getUrlParam('success') !== null) return;
        if (!paymentId) {
            return;
        }

        paymentData = await db.getPayment(parseInt(paymentId));
        if (!paymentData) {
            showAlert('بيانات الدفع غير صحيحة', 'error');
            window.location.href = 'dashboard.html';
            return;
        }

        const [monthsCountEl, pricePerMonthEl, totalAmountEl] = await Promise.all([
            waitForElement('#monthsCount'),
            waitForElement('#pricePerMonth'),
            waitForElement('#totalAmount')
        ]);

        if (!monthsCountEl || !pricePerMonthEl || !totalAmountEl) {
            throw new Error('عناصر صفحة الدفع غير موجودة');
        }

        const monthSection = document.querySelector('.payment-month-section, .month-info');
        if (monthSection) monthSection.style.display = pendingCourseId ? 'none' : '';

        monthsCountEl.textContent = pendingCourseId ? '1' : months;
        pricePerMonthEl.textContent = formatCurrency(Math.round((paymentData.amount / Math.max(1, parseInt(pendingCourseId ? '1' : months))) * 100) / 100);
        totalAmountEl.textContent = formatCurrency(paymentData.amount);

        if (pendingCourseId) {
            const { data: course } = await supabase.from('courses').select('title').eq('id', pendingCourseId).single();
            const monthLabel = document.getElementById('monthLabel');
            if (monthLabel && course) monthLabel.textContent = course.title;
        } else {
            const monthLabel = document.getElementById('monthLabel');
            if (monthLabel && targetMonthId) {
                const monthsList = await db.getMonths(currentUser.grade_id);
                const m = monthsList.find(x => x.id === targetMonthId);
                monthLabel.textContent = m ? m.name : 'شهر محدد';
            }
        }

        // Activate pay button (method already selected by default)
        document.getElementById('payButton').disabled = false;

        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = `مرحباً، ${currentUser.name}`;
        }
    } catch (error) {
        console.error('Error loading payment data:', error);
        showAlert('حدث خطأ أثناء تحميل بيانات الدفع', 'error');
    }
}

function selectUserPaymentMethod(method, element) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
    if (element) element.classList.add('selected');
    document.getElementById('payButton').disabled = false;
}
window.selectUserPaymentMethod = selectUserPaymentMethod;

async function processPayment() {
    if (!ensureHttpOrigin()) return;
    if (!paymentData) return;

    try {
        const payButton = document.getElementById('payButton');
        setButtonLoading(payButton, true);
        await db.updatePayment(paymentData.id, { payment_method: selectedPaymentMethod });

        const paymobResponse = await initiatePaymobPayment(paymentData.amount, selectedPaymentMethod);
        if (paymobResponse.success) {
            sessionStorage.setItem('pendingPaymentId', paymentData.id);
            sessionStorage.setItem('pendingMonthId', targetMonthId || '');
            sessionStorage.setItem('pendingCourseId', pendingCourseId || '');
            sessionStorage.setItem('pendingUserId', currentUser?.id || '');
            const term = getUrlParam('term');
            if (term) sessionStorage.setItem('pendingTerm', term);

            if (paymobResponse.payment_url) {
                window.location.href = paymobResponse.payment_url;
                return;
            }

            if (paymobResponse.bill_reference) {
                showCashReference(paymobResponse.bill_reference, paymentData.amount);
                return;
            }
        }

        showAlert('⚠️ تعذر الاتصال ببوابة الدفع، يرجى المحاولة مرة أخرى', 'error');
        setButtonLoading(document.getElementById('payButton'), false);
    } catch (error) {
        console.error('Error processing payment:', error);
        showAlert('حدث خطأ أثناء معالجة الدفع', 'error');
        setButtonLoading(document.getElementById('payButton'), false);
    }
}

async function initiatePaymobPayment(amount, method) {
    if (!ensureHttpOrigin()) {
        return { success: false, error: 'يرجى تشغيل التطبيق عبر http:// أو https://.' };
    }

    try {
        const callbackUrl = buildCallbackUrl(paymentData, {
            month_id: targetMonthId,
            term: getUrlParam('term'),
            course_id: pendingCourseId
        });

        const billingData = buildBillingData(currentUser);
        const result = await initiatePaymobPaymentViaProxy(amount, paymentData, billingData, callbackUrl, method);

        if (!result.success) return result;

        const metadata = {
            ...paymentData.metadata,
            order_id: result.order_id,
            payment_key: result.payment_key,
            payment_method: method,
            initiated_at: new Date().toISOString()
        };

        await db.updatePayment(paymentData.id, { metadata });

        return {
            success: true,
            payment_url: result.payment_url,
            bill_reference: result.bill_reference || null
        };
    } catch (error) {
        console.error('Paymob error:', error);
        return { success: false, error: error.message };
    }
}

function showCashReference(billReference, amount) {
    const container = document.querySelector('.payment-container');
    if (!container) return;

    document.querySelector('.payment-methods')?.remove();
    document.querySelector('.payment-actions')?.remove();

    const card = document.createElement('div');
    card.id = 'cashReferenceCard';
    card.className = 'summary-card';
    card.style.cssText = 'margin-top: 24px; text-align: center; padding: 48px;';
    card.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">💵</div>
        <h3 style="font-size: 20px; font-weight: 800; color: #1f2937; margin-bottom: 8px;">طلب دفع نقدي</h3>
        <p style="color: #6b7280; margin-bottom: 24px;">استخدم هذا الرقم للدفع في أي من فروع التحصيل (فوري، أمان، مصاري)</p>
        <div style="background: #f3f4f6; border-radius: 16px; padding: 24px; margin-bottom: 24px; direction: ltr;">
            <div style="font-size: 14px; color: #9ca3af; margin-bottom: 8px;">رقم المرجع / Bill Reference</div>
            <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: 4px; font-family: monospace;">${billReference}</div>
        </div>
        <div style="background: #fef3c7; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: right;">
            <p style="color: #92400e; font-size: 14px; margin: 0;">
                ⚠️ سيتم تفعيل الكورس / الاشتراك تلقائياً بعد تأكيد الدفع من Paymob. قد يستغرق التفعيل حتى 24 ساعة.
            </p>
        </div>
        <button class="btn btn-outline" onclick="goBackToDashboard('subscription')">العودة للوحة التحكم</button>
    `;
    container.appendChild(card);
}

async function handlePaymentCallback() {
    const isSuccess = getUrlParam('success');
    const paymentId = getUrlParam('payment_id') || sessionStorage.getItem('pendingPaymentId');
    const monthId = getUrlParam('month_id') || sessionStorage.getItem('pendingMonthId');
    const term = getUrlParam('term') || sessionStorage.getItem('pendingTerm');
    const courseId = getUrlParam('course_id') || sessionStorage.getItem('pendingCourseId');

    if (isSuccess === 'true') {
        try {
            const pid = paymentId ? parseInt(paymentId) : null;
            if (!pid) { showAlert('بيانات الدفع غير متوفرة', 'error'); return; }
            const userId = currentUser?.id || sessionStorage.getItem('pendingUserId');
            if (!userId) { showAlert('بيانات المستخدم غير متوفرة', 'error'); return; }
            await db.updatePayment(pid, { status: 'success' });
            
            const settingsRes = await supabase.from('teacher_settings').select('*').eq('setting_key', 'subscription_duration').single();
            const duration = settingsRes.data ? parseInt(settingsRes.data.setting_value) : 30;

            const termSettingsRes = await supabase.from('teacher_settings').select('*').eq('setting_key', 'term_subscription_duration').single();
            const termDuration = termSettingsRes.data ? parseInt(termSettingsRes.data.setting_value) : 365;

            const start = new Date();
            const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
            const termEnd = new Date(start.getTime() + termDuration * 24 * 60 * 60 * 1000);

            if (courseId) {
                await supabase.from('course_purchases').insert({
                    user_id: userId,
                    course_id: parseInt(courseId),
                    payment_id: pid,
                    status: 'active'
                });
                showAlert('تم شراء الكورس بنجاح!', 'success');
            } else if (term) {
                const termNum = parseInt(term);
                const allMonths = await db.getMonths(currentUser?.grade_id || userId);
                const startIndex = termNum === 1 ? 0 : 4;
                const monthsToActivate = allMonths.slice(startIndex, startIndex + 4);
                
                for (let m of monthsToActivate) {
                    await db.createSubscription({
                        user_id: userId,
                        month_id: m.id,
                        start_date: start.toISOString(),
                        end_date: termEnd.toISOString(),
                        payment_id: pid,
                        status: 'active'
                    });
                    await db.createCode({
                        user_id: userId,
                        month_id: m.id,
                        payment_id: pid,
                        expires_at: termEnd.toISOString(),
                        used: true,
                        used_at: new Date().toISOString()
                    });
                }
                showAlert('تم تفعيل اشتراك الترم بنجاح!', 'success');
            } else {
                let resolvedMonthId = monthId ? parseInt(monthId) : null;
                if (!resolvedMonthId) {
                    const months = await db.getMonths(currentUser?.grade_id || userId);
                    resolvedMonthId = months[0]?.id;
                }

                if (resolvedMonthId) {
                    await db.createSubscription({
                        user_id: userId,
                        month_id: resolvedMonthId,
                        start_date: start.toISOString(),
                        end_date: end.toISOString(),
                        payment_id: pid,
                        status: 'active'
                    });
                    await db.createCode({
                        user_id: userId,
                        month_id: resolvedMonthId,
                        payment_id: pid,
                        expires_at: end.toISOString(),
                        used: true,
                        used_at: new Date().toISOString()
                    });
                    showAlert('تم تفعيل الشهر بنجاح!', 'success');
                }
            }

            sessionStorage.removeItem('pendingPaymentId');
            sessionStorage.removeItem('pendingMonthId');
            sessionStorage.removeItem('pendingTerm');
            sessionStorage.removeItem('pendingCourseId');
            sessionStorage.removeItem('pendingUserId');
            setTimeout(() => { window.location.href = courseId ? `course-details.html?id=${courseId}` : 'dashboard.html'; }, 2500);
        } catch (error) {
            console.error('Error handling payment callback:', error);
            showAlert('حدث خطأ أثناء معالجة الدفع', 'error');
        }
    } else if (isSuccess === 'false') {
        if (paymentId) await db.updatePayment(parseInt(paymentId), { status: 'failed' });
    }
}

if (getUrlParam('success') !== null) {
    onDOMReady(() => handlePaymentCallback());
}

if (getUrlParam('bemob_return') === '1') {
    onDOMReady(() => handleBeMobCallback());
}
