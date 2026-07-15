// Final Reviews View JavaScript - for viewing purchased final review content

let currentReview = null;
let currentReviewId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    currentReviewId = getUrlParam('review_id');
    if (!currentReviewId) {
        window.location.href = 'dashboard.html';
        return;
    }

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = `مرحباً، ${currentUser.name}`;
    await loadReviewContent();
});

async function loadReviewContent() {
    try {
        // Load review first to check is_free
        currentReview = await db.getFinalReview(parseInt(currentReviewId));

        // Free reviews are accessible without purchase
        const isFree = currentReview && currentReview.is_free === true;
        if (!isFree) {
            const hasPurchased = await db.hasPurchasedFinalReview(currentUser.id, parseInt(currentReviewId));
            if (!hasPurchased) {
                document.getElementById('reviewContent').innerHTML = `
                    <div class="access-denied">
                        <div class="access-denied-icon">🔒</div>
                        <h2>عذراً، ليس لديك صلاحية للوصول لهذا المحتوى</h2>
                        <p>يجب شراء المراجعة النهائية أولاً لعرض المحتوى</p>
                        <button type="button" class="btn btn-primary" onclick="window.location.href='dashboard.html'">العودة للوحة التحكم</button>
                    </div>
                `;
                return;
            }
        }

        // Load review with content
        currentReview = await db.getFinalReviewWithContent(parseInt(currentReviewId));
        
        if (!currentReview) {
            document.getElementById('reviewContent').innerHTML = `
                <div class="error-state">
                    <h2>المراجعة غير موجودة</h2>
                    <button type="button" class="btn btn-primary" onclick="window.location.href='dashboard.html'">العودة للوحة التحكم</button>
                </div>
            `;
            return;
        }

        renderReviewContent();
    } catch (error) {
        console.error('Error loading review:', error);
        document.getElementById('reviewContent').innerHTML = `
            <div class="error-state">
                <h2>حدث خطأ أثناء تحميل المحتوى</h2>
                <p>${error.message}</p>
                <button type="button" class="btn btn-primary" onclick="window.location.href='dashboard.html'">العودة للوحة التحكم</button>
            </div>
        `;
    }
}

function renderReviewContent() {
    const container = document.getElementById('reviewContent');
    
    // Group content by type
    const contentByType = {
        video: currentReview.content.filter(c => c.content_type === 'video'),
        pdf: currentReview.content.filter(c => c.content_type === 'pdf'),
        audio: currentReview.content.filter(c => c.content_type === 'audio'),
        exam: currentReview.content.filter(c => c.content_type === 'exam')
    };

    let html = `
        <div class="review-header">
            <h1 class="review-title">${currentReview.title}</h1>
            ${currentReview.description ? `<p class="review-description">${currentReview.description}</p>` : ''}
        </div>
    `;

    // Videos Section
    if (contentByType.video.length > 0) {
        html += `
            <div class="content-section">
                <h2 class="content-section-title">📹 الفيديوهات</h2>
                <div class="content-items-grid">
                    ${contentByType.video.map((item, index) => `
                        <div class="content-item-card video-item">
                            <h3 class="content-item-title">${item.title || `فيديو ${index + 1}`}</h3>
                            ${item.description ? `<p class="content-item-desc">${item.description}</p>` : ''}
                            <div class="video-player-container">
                                ${renderVideoPlayer(item)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // PDF Notes Section
    if (contentByType.pdf.length > 0) {
        html += `
            <div class="content-section">
                <h2 class="content-section-title">📄 المذكرات PDF</h2>
                <div class="content-items-grid">
                    ${contentByType.pdf.map((item, index) => `
                        <div class="content-item-card pdf-item">
                            <div class="pdf-icon">📄</div>
                            <h3 class="content-item-title">${item.title || `مذكرة ${index + 1}`}</h3>
                            ${item.description ? `<p class="content-item-desc">${item.description}</p>` : ''}
                            <button type="button" onclick='openReviewNote(${JSON.stringify(item.file_url)})' class="btn btn-primary">
                                👁 عرض المذكرة
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Audio Section
    if (contentByType.audio.length > 0) {
        html += `
            <div class="content-section">
                <h2 class="content-section-title">🎵 الصوتيات</h2>
                <div class="content-items-grid">
                    ${contentByType.audio.map((item, index) => `
                        <div class="content-item-card audio-item">
                            <div class="audio-icon">🎵</div>
                            <h3 class="content-item-title">${item.title || `صوتي ${index + 1}`}</h3>
                            ${item.description ? `<p class="content-item-desc">${item.description}</p>` : ''}
                            <audio controls class="audio-player">
                                <source src="${item.file_url}" type="audio/mpeg">
                                متصفحك لا يدعم تشغيل الصوت
                            </audio>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Exams Section
    if (contentByType.exam.length > 0) {
        html += `
            <div class="content-section">
                <h2 class="content-section-title">📝 الامتحانات</h2>
                <div class="content-items-grid">
                    ${contentByType.exam.map((item, index) => {
                        if (item.exam_id) {
                            return `
                                <div class="content-item-card exam-item">
                                    <div class="exam-icon">📝</div>
                                    <h3 class="content-item-title">${item.title || `امتحان ${index + 1}`}</h3>
                                    ${item.description ? `<p class="content-item-desc">${item.description}</p>` : ''}
                                    <button type="button" class="btn btn-primary" onclick="openExam(${item.exam_id})">
                                        حل الامتحان
                                    </button>
                                </div>
                            `;
                        } else if (item.file_url) {
                            return `
                                <div class="content-item-card exam-pdf-item">
                                    <div class="pdf-icon">📄</div>
                                    <h3 class="content-item-title">${item.title || `امتحان ${index + 1}`}</h3>
                                    ${item.description ? `<p class="content-item-desc">${item.description}</p>` : ''}
                                    <button type="button" onclick='openReviewNote(${JSON.stringify(item.file_url)})' class="btn btn-primary">
                                        👁 عرض الامتحان
                                    </button>
                                </div>
                            `;
                        }
                        return '';
                    }).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderVideoPlayer(item) {
    if (item.video_url) {
        const youtubeId = parseYouTubeId(item.video_url);
        if (youtubeId) {
            return `
                <iframe 
                    src="https://www.youtube.com/embed/${youtubeId}" 
                    class="video-iframe"
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
        } else {
            return `
                <video controls class="video-player">
                    <source src="${item.video_url}" type="video/mp4">
                    متصفحك لا يدعم تشغيل الفيديو
                </video>
            `;
        }
    } else if (item.file_url) {
        return `
            <video controls class="video-player">
                <source src="${item.file_url}" type="video/mp4">
                متصفحك لا يدعم تشغيل الفيديو
            </video>
        `;
    }
    return '<p class="error">لا يوجد فيديو متاح</p>';
}

function openExam(examId) {
    window.location.href = `exam.html?exam_id=${examId}`;
}

function openReviewNote(url) {
    if (!url) { alert('رابط الملف غير متاح'); return; }
    window.open(url, '_blank');
}

function parseYouTubeId(url) {
    if (!url) return null;
    const s = String(url).trim();
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = s.match(p);
        if (m) return m[1];
    }
    return null;
}

function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function goBackToDashboard(section) {
    sessionStorage.setItem('dashboardReturnSection', section);
    window.location.href = 'dashboard.html';
}

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    if (typeof currentUser !== 'undefined') { currentUser = null; }
    window.location.href = 'index.html';
}
