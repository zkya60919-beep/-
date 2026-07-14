// Payment Module for Final Reviews

let selectedPaymentMethod = null;
let paymentData = null;
let targetReviewId = null;

onDOMReady(async () => {
    await checkAuth();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // If the review is free, skip payment and redirect directly
    const reviewId = getUrlParam('review_id');
    if (reviewId) {
        const review = await db.getFinalReview(parseInt(reviewId));
        if (review && review.is_free) {
            showAlert('هذه المراجعة مجانية، جاري تحويلك...', 'success');
            setTimeout(() => {
                window.location.href = 'final-reviews-view.html?review_id=' + reviewId;
            }, 1000);
            return;
        }
    }

    await loadPaymentData();
});

async function loadPaymentData() {
    try {
        if (!ensureHttpOrigin()) return;

        const paymentId = getUrlParam('payment_id');
        targetReviewId = getUrlParam('review_id');

        if (!paymentId || !targetReviewId) {
            window.location.href = 'dashboard.html';
            return;
        }

        paymentData = await db.getPayment(parseInt(paymentId));
        if (!paymentData) {
            showAlert('بيانات الدفع غير صحيحة', 'error');
            window.location.href = 'dashboard.html';
            return;
        }

        const [amountDisplayEl] = await Promise.all([
            waitForElement('#amountDisplay')
        ]);
        console.debug('Final-review payment page elements', { amountDisplayEl });
        if (!amountDisplayEl) {
            throw new Error('عناصر صفحة الدفع غير موجودة — تأكد من أن payment-final-review.html محمل بالكامل');
        }

        amountDisplayEl.textContent = formatCurrency(paymentData.amount);
        
        // Update user name in header
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = `مرحباً، ${currentUser.name}`;
        }
    } catch (error) {
        console.error('Error loading payment data:', error);
        showAlert('حدث خطأ أثناء تحميل بيانات الدفع', 'error');
    }
}

function selectPaymentMethod(method, element) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.classList.remove('selected');
    });
    if (element) element.classList.add('selected');
    document.getElementById('payButton').disabled = false;
}

async function processPayment() {
    if (!ensureHttpOrigin()) return;
    if (!selectedPaymentMethod || !paymentData) {
        showAlert('يرجى اختيار طريقة الدفع', 'error');
        return;
    }

    try {
        const payButton = document.getElementById('payButton');
        setButtonLoading(payButton, true);
        await db.updatePayment(paymentData.id, { payment_method: selectedPaymentMethod });

        const paymobResponse = await initiatePaymobPayment(paymentData.amount, selectedPaymentMethod);

        if (paymobResponse.success && paymobResponse.payment_url) {
            sessionStorage.setItem('pendingPaymentId', paymentData.id);
            sessionStorage.setItem('pendingReviewId', targetReviewId);
            window.location.href = paymobResponse.payment_url;
            return;
        }

        // وضع تجريبي: تفعيل الشراء مباشرة (من غير بوابة دفع)
        await db.updatePayment(paymentData.id, { status: 'success', payment_method: selectedPaymentMethod });
        await db.createFinalReviewPurchase({
            final_review_id: parseInt(targetReviewId),
            user_id: currentUser.id,
            payment_id: paymentData.id,
            amount: paymentData.amount,
            status: 'completed',
            purchased_at: new Date().toISOString()
        });
        showAlert('✅ تم الدفع بنجاح! جاري تحويلك للمراجعة...', 'success');
        sessionStorage.removeItem('pendingPaymentId');
        sessionStorage.removeItem('pendingReviewId');
        setButtonLoading(document.getElementById('payButton'), false);
        setTimeout(() => {
            window.location.href = 'final-reviews-view.html?review_id=' + targetReviewId;
        }, 2000);
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
            review_id: targetReviewId
        });

        const billingData = buildBillingData(currentUser);

        const result = await initiatePaymobPaymentViaProxy(amount, paymentData, billingData, callbackUrl);

        if (!result.success) {
            return result;
        }

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
            payment_url: result.payment_url
        };
    } catch (error) {
        console.error('Paymob error:', error);
        return { success: false, error: error.message };
    }
}

async function handlePaymentCallback() {
    const isSuccess = getUrlParam('success');
    const paymentId = getUrlParam('payment_id') || sessionStorage.getItem('pendingPaymentId');
    const reviewId = getUrlParam('review_id') || sessionStorage.getItem('pendingReviewId');

    if (isSuccess === 'true' && paymentId && reviewId) {
        try {
            await db.updatePayment(parseInt(paymentId), { status: 'success' });
            
            // Create final review purchase
            const payment = await db.getPayment(parseInt(paymentId));
            await db.createFinalReviewPurchase({
                final_review_id: parseInt(reviewId),
                user_id: currentUser.id,
                payment_id: parseInt(paymentId),
                amount: payment.amount,
                status: 'completed',
                purchased_at: new Date().toISOString()
            });

            showAlert('تم الدفع بنجاح! جاري تحويلك للمراجعة...', 'success');
            sessionStorage.removeItem('pendingPaymentId');
            sessionStorage.removeItem('pendingReviewId');
            
            setTimeout(() => {
                window.location.href = `final-reviews-view.html?review_id=${reviewId}`;
            }, 2000);
        } catch (error) {
            console.error('Error handling payment callback:', error);
            showAlert('حدث خطأ أثناء معالجة الدفع', 'error');
        }
    } else if (isSuccess === 'false') {
        if (paymentId) await db.updatePayment(parseInt(paymentId), { status: 'failed' });
        showAlert('فشلت عملية الدفع', 'error');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
    }
}

if (getUrlParam('success') !== null) {
    onDOMReady(() => handlePaymentCallback());
}

function formatCurrency(amount) {
    return `${parseFloat(amount).toFixed(2)} ج.م`;
}

function showAlert(message, type) {
    document.querySelectorAll('.alert').forEach(a => a.remove());
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = message;
    document.body.insertBefore(el, document.body.firstChild);
    setTimeout(() => el.remove(), 7000);
}
