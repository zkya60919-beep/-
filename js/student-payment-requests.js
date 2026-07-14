let allRequests = [];
let currentFilter = 'all';

onDOMReady(async () => {
    await checkAuth();
    if (!currentUser) { window.location.href = 'index.html'; return; }
    await loadRequests();
});

async function loadRequests() {
    try {
        allRequests = await db.getUserPaymentRequests(currentUser.id);
        renderRequests();
    } catch (error) {
        console.error('Error loading payment requests:', error);
        document.getElementById('requestsList').innerHTML = '<p class="text-center" style="color:var(--gray-500);padding:40px">حدث خطأ أثناء التحميل</p>';
    }
}

function renderRequests() {
    const list = document.getElementById('requestsList');
    const filtered = currentFilter === 'all' ? allRequests : allRequests.filter(r => r.status === currentFilter);

    if (!filtered.length) {
        list.innerHTML = '<p class="text-center" style="color:var(--gray-500);padding:40px">لا توجد طلبات دفع</p>';
        return;
    }

    list.innerHTML = filtered.map(r => {
        const statusBadge = getStatusBadge(r.status);
        const date = formatDate(r.created_at);
        const methodLabel = r.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 'انستا باي';

        return `
            <div class="summary-card" style="padding:20px">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px">
                    <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                            <strong>#${r.id}</strong>
                            ${statusBadge}
                        </div>
                        <p style="color:var(--gray-500);font-size:14px">${date} — ${methodLabel}</p>
                        <p style="font-weight:700;font-size:18px;margin-top:4px">${r.amount} ج.م</p>
                        ${r.course_name ? `<p style="color:var(--gray-500);font-size:14px">${r.course_name}</p>` : ''}
                        ${r.grade_name ? `<p style="color:var(--gray-500);font-size:14px">الصف: ${r.grade_name}</p>` : ''}
                    </div>
                    <div style="text-align:left">
                        <button class="btn btn-outline btn-sm" onclick="viewReceipt('${r.image_url}')">🖼 عرض الإيصال</button>
                    </div>
                </div>
                ${r.status === 'rejected' && r.rejection_reason ? `
                    <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:8px;padding:12px;margin-top:12px">
                        <p style="color:#991b1b;font-weight:600;margin-bottom:4px">سبب الرفض:</p>
                        <p style="color:#991b1b;font-size:14px">${r.rejection_reason}</p>
                    </div>
                ` : ''}
                ${r.status === 'approved' && r.subscription_end ? `
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-top:12px">
                        <p style="color:#065f46;font-size:14px">✅ تم التفعيل — ينتهي في ${formatDate(r.subscription_end)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function getStatusBadge(status) {
    const map = {
        pending: '<span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">قيد الانتظار</span>',
        approved: '<span style="background:#d1fae5;color:#065f46;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">تم القبول</span>',
        rejected: '<span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">مرفوض</span>'
    };
    return map[status] || '';
}

function viewReceipt(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;cursor:pointer';
    overlay.innerHTML = `<img src="${url}" style="max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)">`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

function filterRequests(filter, element) {
    currentFilter = filter;
    document.querySelectorAll('#statusTabs .btn').forEach(b => b.classList.remove('active'));
    if (element) element.classList.add('active');
    renderRequests();
}

window.filterRequests = filterRequests;
window.viewReceipt = viewReceipt;
