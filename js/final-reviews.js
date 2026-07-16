// Final Reviews JavaScript for Student Dashboard

let currentTab = 'available';
let availableReviews = [];
let purchasedReviews = [];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    setupTabs();
    await loadFinalReviews();
});

function setupTabs() {
    document.querySelectorAll('.final-reviews-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.final-reviews-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderFinalReviews();
        });
    });
}

async function loadFinalReviews() {
    try {
        // Load available reviews for user's grade
        availableReviews = await db.getFinalReviews();
        
        // Load purchased reviews
        purchasedReviews = await db.getUserFinalReviewPurchases(currentUser.id);
        
        renderFinalReviews();
    } catch (error) {
        console.error('Error loading final reviews:', error);
        document.getElementById('finalReviewsContainer').innerHTML = `
            <p class="error-state">حدث خطأ أثناء تحميل المراجعات</p>
        `;
    }
}

function renderFinalReviews() {
    const container = document.getElementById('finalReviewsContainer');
    
    if (currentTab === 'available') {
        renderAvailableReviews(container);
    } else {
        renderPurchasedReviews(container);
    }
}

function renderAvailableReviews(container) {
    // Filter out already purchased reviews
    const purchasedIds = purchasedReviews.map(p => p.final_review_id);
    const available = availableReviews.filter(r => !purchasedIds.includes(r.id) && r.is_active);

    if (available.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>لا توجد مراجعات نهائية متاحة حالياً</p>
            </div>
        `;
        return;
    }

    container.innerHTML = available.map(review => `
        <div class="final-review-card">
            <div class="review-thumbnail">
                ${review.thumbnail 
                    ? `<img src="${review.thumbnail}" alt="${review.title}" class="review-thumb-img">`
                    : `<div class="review-thumb-placeholder">📚</div>`
                }
            </div>
            <div class="review-info">
                <h3 class="review-title">${review.title}</h3>
                ${review.description ? `<p class="review-description">${review.description}</p>` : ''}
                <div class="review-meta">
                    <span class="review-price">${review.is_free ? 'مجاني' : formatCurrency(review.price)}</span>
                    ${review.is_free ? '<span class="badge badge-free">مجاني</span>' : ''}
                </div>
                ${review.is_free 
                    ? `<button type="button" class="btn btn-primary btn-full" onclick="openReview(${review.id})">
                         فتح المراجعة
                       </button>`
                    : `<button type="button" class="btn btn-primary btn-full" onclick="purchaseReview(${review.id}, ${review.price})">
                         اشتري الآن
                       </button>`
                }
            </div>
        </div>
    `).join('');
}

function renderPurchasedReviews(container) {
    if (purchasedReviews.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>لم تشترِ أي مراجعات نهائية بعد</p>
            </div>
        `;
        return;
    }

    container.innerHTML = purchasedReviews.map(purchase => {
        const review = purchase.final_reviews;
        const isExpired = purchase.expires_at && new Date(purchase.expires_at) < new Date();
        
        return `
            <div class="final-review-card purchased ${isExpired ? 'expired' : ''}">
                <div class="review-thumbnail">
                    ${review.thumbnail 
                        ? `<img src="${review.thumbnail}" alt="${review.title}" class="review-thumb-img">`
                        : `<div class="review-thumb-placeholder">📚</div>`
                    }
                </div>
                <div class="review-info">
                    <h3 class="review-title">${review.title}</h3>
                    ${review.description ? `<p class="review-description">${review.description}</p>` : ''}
                    <div class="review-meta">
                        <span class="purchase-date">تم الشراء: ${formatDate(purchase.purchased_at)}</span>
                        ${purchase.expires_at ? `<span class="expiry-date">تنتهي: ${formatDate(purchase.expires_at)}</span>` : ''}
                    </div>
                    ${isExpired 
                        ? `<button type="button" class="btn btn-outline btn-full" disabled>منتهية الصلاحية</button>`
                        : `<button type="button" class="btn btn-primary btn-full" onclick="openReview(${review.id})">فتح المراجعة</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

async function purchaseReview(reviewId, price) {
    try {
        // Check if the review is free
        const review = availableReviews.find(r => r.id === reviewId);
        if (review && review.is_free) {
            window.location.href = `final-reviews-view.html?review_id=${reviewId}`;
            return;
        }

        // Create payment record
        const paymentData = {
            user_id: currentUser.id,
            amount: price,
            months: 0,
            payment_method: 'pending',
            status: 'pending',
            metadata: { type: 'final_review', review_id: reviewId }
        };

        const payment = await db.createPayment(paymentData);

        // Redirect to payment page
        window.location.href = `payment-final-review.html?payment_id=${payment.id}&review_id=${reviewId}`;
    } catch (error) {
        console.error('Error initiating purchase:', error);
        showAlert('حدث خطأ أثناء بدء عملية الشراء', 'error');
    }
}

function openReview(reviewId) {
    window.location.href = `final-reviews-view.html?review_id=${reviewId}`;
}

function formatCurrency(amount) {
    return `${parseFloat(amount).toFixed(2)} ج.م`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showAlert(message, type) {
    document.querySelectorAll('.alert').forEach(a => a.remove());
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = message;
    document.body.insertBefore(el, document.body.firstChild);
    setTimeout(() => el.remove(), 7000);
}
