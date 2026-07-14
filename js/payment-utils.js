// Payment Utilities - Module مشترك لـ payment.js و payment-final-review.js

const PAYMOB_EDGE_FUNCTION = `${CONFIG.SUPABASE.URL}/functions/v1/paymob-proxy`;

async function initiatePaymobPaymentViaProxy(amount, paymentData, billingData, callbackUrl, paymentMethod = 'card') {
    if (!ensureHttpOrigin()) {
        return { success: false, error: 'يرجى تشغيل التطبيق عبر http:// أو https://.' };
    }

    try {
        const response = await fetch(PAYMOB_EDGE_FUNCTION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                billing_data: billingData,
                callback_url: callbackUrl.toString(),
                payment_method: paymentMethod
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Paymob proxy failed');
        }

        return {
            success: true,
            payment_url: result.payment_url || null,
            bill_reference: result.bill_reference || null,
            order_id: result.order_id,
            payment_key: result.payment_key
        };
    } catch (error) {
        console.error('Paymob proxy error:', error);
        return { success: false, error: error.message };
    }
}

function openPaymobIframe(src) {
    const container = document.getElementById('paymobContainer');
    if (!container) {
        window.location.href = src;
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="paymob-overlay">
            <div class="paymob-overlay-header">
                <h3>إتمام الدفع عبر Paymob</h3>
                <button class="paymob-close-button" onclick="closePaymobIframe()">×</button>
            </div>
            <iframe src="${src}" allowpaymentrequest="true"></iframe>
            <div class="paymob-overlay-note">بعد انتهاء الدفع، سيتم إعادة توجيهك تلقائياً إلى الصفحة لعرض حالة الدفع.</div>
        </div>
    `;

    window.addEventListener('message', handlePaymobMessage);
}

function closePaymobIframe() {
    const container = document.getElementById('paymobContainer');
    if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
}

function handlePaymobMessage(event) {
    if (!event.origin.includes('accept.paymob.com')) return;
    const payload = event.data;
    if (!payload || typeof payload !== 'object') return;

    if (payload.success === true || payload.action === 'completed' || payload.event === 'completed') {
        window.location.reload();
    }
}

function cancelPayment() {
    if (confirm('هل أنت متأكد من إلغاء عملية الدفع؟')) {
        window.location.href = 'dashboard.html';
    }
}

function buildBillingData(currentUser) {
    return {
        apartment: 'NA',
        email: currentUser.email || 'student@albasit.com',
        floor: 'NA',
        first_name: currentUser.name.split(' ')[0] || 'User',
        street: 'NA',
        building: 'NA',
        phone_number: currentUser.phone || '201000000000',
        shipping_method: 'NA',
        postal_code: 'NA',
        city: 'Cairo',
        country: 'EG',
        last_name: currentUser.name.split(' ').slice(-1)[0] || 'User',
        state: 'Cairo'
    };
}

function buildCallbackUrl(paymentData, extraParams) {
    const callbackUrl = new URL(window.location.origin + window.location.pathname);
    callbackUrl.searchParams.set('success', 'true');
    callbackUrl.searchParams.set('payment_id', paymentData.id);
    if (extraParams) {
        Object.entries(extraParams).forEach(([key, value]) => {
            if (value) callbackUrl.searchParams.set(key, value);
        });
    }
    callbackUrl.searchParams.set('paymob_return', '1');
    return callbackUrl;
}
