// Manual Payment Module — Replaces Paymob when CONFIG.PAYMENT.PROVIDER === 'manual'
// كل كود Paymob محفوظ — التبديل بين manual/paymob يتم عبر CONFIG.PAYMENT.PROVIDER

let manualPaymentMethod = 'vodafone_cash';

onDOMReady(async () => {
    if (CONFIG.PAYMENT.PROVIDER !== 'manual') return;

    const paymobMethods = document.querySelector('.payment-methods');
    const payButton = document.getElementById('payButton');
    if (paymobMethods) paymobMethods.style.display = 'none';
    if (payButton) payButton.style.display = 'none';

    try {
        await loadManualPaymentSection();
    } catch (error) {
        console.error('Error loading manual payment:', error);
    }
});

async function loadManualPaymentSection() {
    const container = document.querySelector('.payment-container');
    if (!container) return;

    let vodafone = CONFIG.PAYMENT.VODAFONE_CASH;
    let instapay = CONFIG.PAYMENT.INSTAPAY_ID;
    let instructions = 'يرجى تحويل المبلغ على أحد الحسابات التالية ثم اضغط "تم الدفع" لرفع الإيصال';
    try {
        const settings = await db.getPaymentSettings();
        if (settings.vodafone_cash) vodafone = settings.vodafone_cash;
        if (settings.instapay_id) instapay = settings.instapay_id;
        if (settings.payment_instructions) instructions = settings.payment_instructions;
    } catch (error) {
        console.error('Error loading payment settings, using defaults:', error);
    }

    const section = document.createElement('div');
    section.id = 'manualPaymentSection';
    section.innerHTML = `
        <div class="payment-methods" id="manualMethods" style="margin-top:24px">
            <h2 class="section-title">طريقة الدفع اليدوي</h2>
            <p style="color:var(--gray-500);margin-bottom:16px">${instructions}</p>
            <div class="payment-methods-grid">
                <div class="payment-method-card selected" data-manual-method="vodafone_cash" onclick="selectManualMethod('vodafone_cash', this)">
                    <div class="payment-icon method-icon-cash">📱</div>
                    <h3>فودافون كاش</h3>
                    <p class="payment-method-desc" style="direction:ltr;text-align:center;font-family:monospace;font-size:18px;font-weight:700">${vodafone}</p>
                    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); copyToClipboard('${vodafone}')" style="margin-top:8px">📋 نسخ الرقم</button>
                </div>
                <div class="payment-method-card" data-manual-method="instapay" onclick="selectManualMethod('instapay', this)">
                    <div class="payment-icon method-icon-wallet">🏦</div>
                    <h3>انستا باي</h3>
                    <p class="payment-method-desc" style="direction:ltr;text-align:center;font-family:monospace;font-size:18px;font-weight:700">${instapay}</p>
                    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); copyToClipboard('${instapay}')" style="margin-top:8px">📋 نسخ ID</button>
                </div>
            </div>
        </div>
        <div style="margin-top:24px;text-align:center">
            <button class="btn btn-primary btn-full" id="showPaymentFormBtn" onclick="showPaymentForm()">✅ تم الدفع — رفع الإيصال</button>
        </div>
        <div id="paymentFormContainer" style="display:none;margin-top:24px"></div>
    `;
    container.appendChild(section);
}

function selectManualMethod(method, element) {
    manualPaymentMethod = method;
    document.querySelectorAll('[data-manual-method]').forEach(c => c.classList.remove('selected'));
    if (element) element.classList.add('selected');
}

function showPaymentForm() {
    const container = document.getElementById('paymentFormContainer');
    if (!container) return;

    const courseName = document.getElementById('monthLabel')?.textContent || 'اشتراك شهري';
    const totalEl = document.getElementById('totalAmount');
    const amount = totalEl ? totalEl.textContent.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9.]/g, '') : '0';

    container.style.display = 'block';
    container.innerHTML = `
        <div class="summary-card" style="padding:24px">
            <h3 style="margin-bottom:16px">تأكيد عملية الدفع</h3>
            <form id="manualPaymentForm" onsubmit="submitManualPayment(event)">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group">
                        <label>الاسم</label>
                        <input type="text" class="form-input" id="payStudentName" value="${currentUser?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>رقم الهاتف</label>
                        <input type="text" class="form-input" id="payStudentPhone" value="${currentUser?.phone || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>الصف</label>
                        <input type="text" class="form-input" id="payStudentGrade" value="${currentUser?.grade_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>الكورس / الشهر</label>
                        <input type="text" class="form-input" id="payCourseName" value="${courseName}" readonly>
                    </div>
                    <div class="form-group">
                        <label>طريقة الدفع</label>
                        <input type="text" class="form-input" id="payMethodDisplay" value="${manualPaymentMethod === 'vodafone_cash' ? 'فودافون كاش' : 'انستا باي'}" readonly>
                    </div>
                    <div class="form-group">
                        <label>المبلغ</label>
                        <input type="text" class="form-input" id="payAmount" value="${totalEl?.textContent || ''}" readonly>
                    </div>
                    <div class="form-group" style="grid-column:1/-1">
                        <label>وقت التحويل</label>
                        <input type="datetime-local" class="form-input" id="payTransferTime" required>
                    </div>
                    <div class="form-group" style="grid-column:1/-1">
                        <label>ملاحظات (اختياري)</label>
                        <textarea class="form-input" id="payNotes" rows="2" placeholder="أي ملاحظات إضافية"></textarea>
                    </div>
                    <div class="form-group" style="grid-column:1/-1">
                        <label>إيصال الدفع (JPG, PNG, JPEG — حد أقصى 10 MB)</label>
                        <input type="file" class="form-input" id="payReceipt" accept=".jpg,.jpeg,.png" required>
                        <div id="receiptPreview" style="margin-top:8px;display:none">
                            <img id="receiptPreviewImg" style="max-width:200px;border-radius:8px;box-shadow:var(--shadow-sm)">
                        </div>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full" id="submitPaymentBtn" style="margin-top:16px">
                    إرسال طلب الدفع
                </button>
                <div id="paymentFormError" style="color:var(--danger);margin-top:8px;display:none"></div>
            </form>
        </div>
    `;

    const fileInput = document.getElementById('payReceipt');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showFormError('حجم الملف يتجاوز 10 ميجابايت');
            fileInput.value = '';
            return;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['jpg', 'jpeg', 'png'].includes(ext)) {
            showFormError('الرجاء رفع ملف JPG أو PNG فقط');
            fileInput.value = '';
            return;
        }
        const preview = document.getElementById('receiptPreview');
        const img = document.getElementById('receiptPreviewImg');
        preview.style.display = 'block';
        img.src = URL.createObjectURL(file);
    });
}

function showFormError(msg) {
    const el = document.getElementById('paymentFormError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function submitManualPayment(event) {
    event.preventDefault();
    const btn = document.getElementById('submitPaymentBtn');
    setButtonLoading(btn, true);

    try {
        const file = document.getElementById('payReceipt').files[0];
        if (!file) { showFormError('الرجاء رفع إيصال الدفع'); setButtonLoading(btn, false); return; }

        const uploadResult = await db.uploadPaymentReceipt(file, currentUser.id);

        const amountText = document.getElementById('payAmount')?.value || '0';
        const amountNum = parseFloat(amountText.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9.]/g, '')) || 0;

        paymentData = paymentData || {};
        const reqData = {
            student_id: currentUser.id,
            course_id: pendingCourseId || null,
            month_id: targetMonthId || null,
            term: getUrlParam('term') ? parseInt(getUrlParam('term')) : null,
            amount: amountNum,
            payment_method: manualPaymentMethod,
            image_url: uploadResult.url,
            student_name: document.getElementById('payStudentName').value,
            student_phone: document.getElementById('payStudentPhone').value,
            grade_name: document.getElementById('payStudentGrade').value,
            course_name: document.getElementById('payCourseName').value,
            transfer_time: document.getElementById('payTransferTime').value,
            notes: document.getElementById('payNotes').value || null,
            status: 'pending'
        };

        const request = await db.createPaymentRequest(reqData);

        document.querySelector('#manualPaymentSection .payment-methods')?.remove();
        document.getElementById('showPaymentFormBtn')?.remove();
        document.getElementById('paymentFormContainer')?.remove();

        const container = document.querySelector('.payment-container');
        const success = document.createElement('div');
        success.className = 'summary-card';
        success.style.cssText = 'margin-top:24px;text-align:center;padding:48px';
        success.innerHTML = `
            <div style="font-size:64px;margin-bottom:16px">✅</div>
            <h3 style="font-size:20px;font-weight:800;color:#1f2937;margin-bottom:8px">تم إرسال طلب الدفع بنجاح</h3>
            <p style="color:#6b7280;margin-bottom:8px">رقم الطلب: #${request.id}</p>
            <p style="color:#6b7280;margin-bottom:24px">سيتم تفعيل اشتراكك بعد مراجعة طلبك من قبل المدرس</p>
            <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">العودة للوحة التحكم</button>
        `;
        container.appendChild(success);

    } catch (error) {
        console.error('Manual payment error:', error);
        showFormError(error.message || 'حدث خطأ أثناء إرسال طلب الدفع');
        setButtonLoading(btn, false);
    }
}

window.selectManualMethod = selectManualMethod;
window.showPaymentForm = showPaymentForm;
window.submitManualPayment = submitManualPayment;
