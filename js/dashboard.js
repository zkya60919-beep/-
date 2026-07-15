// Student Dashboard Module

let selectedMonthId = null;
let currentGrade = null;
let gradeMonths = [];
let userSubscriptions = [];
let pendingSubscribeMonthId = null;

const MONTH_NAMES = [
  "الشهر الأول",
  "الشهر الثاني",
  "الشهر الثالث",
  "الشهر الرابع",
  "الشهر الخامس",
  "الشهر السادس",
  "الشهر السابع",
  "الشهر الثامن",
  "الشهر التاسع"
];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== تحميل داشبورد الطالب ===');
    console.log('currentUser قبل checkAuth:', currentUser);

    await checkAuth();

    console.log('currentUser بعد checkAuth:', currentUser);
    console.log('grade_id:', currentUser?.grade_id);

    // إذا لم يكن المستخدم موجوداً، حاول تحميله من localStorage
    if (!currentUser) {
        const userId = localStorage.getItem('userId');
        console.log('المستخدم غير موجود، userId من localStorage:', userId);
        if (!userId) {
            console.log('لا يوجد userId - إعادة التوجيه لصفحة تسجيل الدخول');
            window.location.href = 'login.html';
            return;
        }
        // حاول تحميل المستخدم من قاعدة البيانات
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('phone', userId)
                .maybeSingle();
            if (error) {
                console.error('خطأ في تحميل المستخدم:', error);
                // لا نعيد التوجيه - نسمح بالاستمرار
            } else if (user) {
                console.log('تم تحميل المستخدم:', user);
                currentUser = user;
                sessionStorage.setItem('albasit_user_cache', JSON.stringify(user));
            } else {
                console.log('المستخدم غير موجود في قاعدة البيانات');
                window.location.href = 'login.html';
                return;
            }
        } catch (e) {
            console.error('استثناء في تحميل المستخدم:', e);
        }
    }

    // التحقق من pending grade_id (محفوظ محلياً)
    const pendingGradeId = localStorage.getItem('pendingGradeId');
    if (pendingGradeId && (!currentUser || !currentUser.grade_id)) {
        currentUser.grade_id = parseInt(pendingGradeId, 10);
        cacheUser(currentUser);
        localStorage.removeItem('pendingGradeId');
        // محاولة تحديث DB في الخلفية
        if (currentUser && currentUser.id) {
            supabase.from('users').update({ grade_id: currentUser.grade_id }).eq('id', currentUser.id).then().catch(() => {});
        }
    }

    if (!currentUser || !currentUser.grade_id) {
        console.log('grade_id غير موجود - إعادة التوجيه لاختيار الصف');
        window.location.href = 'select-grade.html';
        return;
    }

    console.log('بدء تحميل بيانات الداشبورد');
    await db.expireOldSubscriptions();
    await loadDashboardData();
    await loadMonths();
    bindSidebar();
    restoreDashboardSection();
    loadSubscriptionSection(); // load prices on every page load
    console.log('تم تحميل الداشبورد بنجاح');
});

function restoreDashboardSection() {
    const hash = (window.location.hash || '').replace('#', '');
    const stored = sessionStorage.getItem('dashboardReturnSection');
    const section = hash || stored;
    if (section && document.getElementById(`${section}-section`)) {
        showSection(section);
        sessionStorage.removeItem('dashboardReturnSection');
    }
}

function bindSidebar() {
    document.querySelectorAll('.sidebar .menu-item[data-section]').forEach(item => {
        item.addEventListener('click', () => showSection(item.dataset.section));
    });
}

async function loadDashboardData() {
    try {
        // Ensure we have the latest user data
        if (!currentUser) {
            console.error('No current user');
            return;
        }

        // Update header user name
        const headerUserName = document.getElementById('userName');
        if (headerUserName) {
            headerUserName.textContent = `مرحباً، ${currentUser.name}`;
        }

        // Update sidebar name
        const sidebarName = document.getElementById('sidebarUserName');
        if (sidebarName) sidebarName.textContent = currentUser.name;

        // Load avatar
        const avatarImg = document.getElementById('avatarImg');
        const avatarIcon = document.getElementById('avatarIcon');
        if (currentUser.avatar_url && avatarImg) {
            avatarImg.src = currentUser.avatar_url;
            avatarImg.style.display = 'block';
            if (avatarIcon) avatarIcon.style.display = 'none';
        }

        // Load and display grade
        const grades = await db.getGrades();
        currentGrade = grades.find(g => g.id == currentUser.grade_id);
        
        const userGradeElement = document.getElementById('userGrade');
        if (userGradeElement) {
            userGradeElement.textContent = currentGrade ? currentGrade.name : 'غير محدد';
        }

        // Update overview section (نظرة عامة)
        const userGradeOverviewElement = document.getElementById('userGradeOverview');
        if (userGradeOverviewElement) {
            userGradeOverviewElement.textContent = currentGrade ? currentGrade.name : 'غير محدد';
        }
        
        const userNameOverviewElement = document.getElementById('userNameOverview');
        if (userNameOverviewElement) {
            userNameOverviewElement.textContent = currentUser.name;
        }

        // Load subscriptions
        userSubscriptions = await db.getUserSubscriptions(currentUser.id);
        const now = new Date();
        const active = userSubscriptions.filter(s => new Date(s.end_date) > now && s.status === 'active');

        const userSubscriptionStatusElement = document.getElementById('userSubscriptionStatus');
        if (userSubscriptionStatusElement) {
            userSubscriptionStatusElement.textContent = active.length > 0 ? 'نشط' : 'غير مشترك';
        }

        await loadSubscriptionStatus();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function isMonthActive(monthId) {
    const now = new Date();
    return userSubscriptions.some(
        s => s.month_id === monthId && new Date(s.end_date) > now && s.status === 'active'
    );
}

function getMonthSubscription(monthId) {
    const now = new Date();
    return userSubscriptions.find(
        s => s.month_id === monthId && new Date(s.end_date) > now && s.status === 'active'
    );
}

async function loadSubscriptionStatus() {
    const el = document.getElementById('subscriptionStatus');
    if (!el) return;

    const now = new Date();
    const active = userSubscriptions.filter(s => new Date(s.end_date) > now && s.status === 'active');

    if (!active.length) {
        el.innerHTML = `
            <h3>حالة الاشتراك</h3>
            <div class="status-item"><div class="status-label">الحالة</div><div class="status-value status-expired">غير مشترك</div></div>
            <div class="status-item"><div class="status-label">الشهور المفتوحة</div><div class="status-value">0</div></div>
        `;
        return;
    }

    const latest = active[0];
    el.innerHTML = `
        <h3>حالة الاشتراك</h3>
        <div class="status-item"><div class="status-label">الحالة</div><div class="status-value status-active">نشط</div></div>
        <div class="status-item"><div class="status-label">الشهور المفتوحة</div><div class="status-value">${active.length}</div></div>
        <div class="status-item"><div class="status-label">أقرب انتهاء</div><div class="status-value">${formatDate(latest.end_date)}</div></div>
        <div class="status-item"><div class="status-label">الأيام المتبقية</div><div class="status-value">${calculateDaysRemaining(latest.end_date)} يوم</div></div>
    `;
}

async function loadMonths() {
    try {
        gradeMonths = await db.getMonths(currentUser.grade_id);
        if (gradeMonths.length < 9) {
            gradeMonths = await db.ensureNineMonths(currentUser.grade_id);
        }

        const tabMap = {
            monthsTabs: 'videos',
            notesMonthsTabs: 'notes',
            audioMonthsTabs: 'audio',
            examsMonthsTabs: 'exams'
        };
        Object.entries(tabMap).forEach(([id, section]) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = buildMonthTabsHtml(section);
        });

        if (gradeMonths.length) {
            selectedMonthId = gradeMonths[0].id;
            await loadSectionContent(selectedMonthId);
        }
    } catch (error) {
        console.error('Error loading months:', error);
    }
}

function buildMonthTabsHtml(section) {
    return gradeMonths.map((month, index) => {
        const active = isMonthActive(month.id);
        const locked = !active;
        return `
            <button type="button"
                class="month-tab ${index === 0 ? 'active' : ''} ${locked ? 'locked-tab' : 'unlocked-tab'}"
                data-month-id="${month.id}"
                data-section="${section}"
                onclick="selectMonthForSection(${month.id}, '${section}', this)">
                ${month.name}
                ${locked ? '<span class="tab-lock">🔒</span>' : '<span class="tab-unlock">✓</span>'}
            </button>
        `;
    }).join('');
}

async function selectMonthForSection(monthId, section, element) {
    selectedMonthId = monthId;
    const container = element.closest('.months-tabs');
    if (container) {
        container.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
        element.classList.add('active');
    }

    if (section === 'videos') await loadVideos(monthId);
    else if (section === 'notes') await loadNotes(monthId);
    else if (section === 'audio') await loadAudio(monthId);
    else if (section === 'exams') await loadExams(monthId);
    else await loadSectionContent(monthId);
}

async function selectMonth(monthId, element) {
    await selectMonthForSection(monthId, 'videos', element);
}

async function loadSectionContent(monthId) {
    await Promise.all([
        loadVideos(monthId),
        loadNotes(monthId),
        loadAudio(monthId),
        loadExams(monthId)
    ]);
}

function subscribeButton(monthId, monthName) {
    return `<button type="button" class="btn btn-primary btn-sm" onclick="subscribeToMonth(${monthId}, '${monthName.replace(/'/g, '')}')">اشترك الآن</button>`;
}

async function loadVideos(monthId) {
    const container = document.getElementById('videosContainer');
    if (!container) return;
    container.innerHTML = '<div class="spinner"></div>';

    try {
        const videos = await db.getVideos(currentUser.grade_id, monthId);
        const hasSub = isMonthActive(monthId);

        // تحميل المشتريات الفردية للفيديوهات
        let purchasedVideoIds = new Set();
        try {
            const { data: purchasedVideos } = await supabase
                .from('content_purchases')
                .select('content_id')
                .eq('user_id', currentUser.id)
                .eq('content_type', 'video')
                .eq('status', 'active');
            if (purchasedVideos) {
                purchasedVideoIds = new Set(purchasedVideos.map(p => p.content_id));
            }
        } catch (e) {
            console.warn('content_purchases table not available, ignoring:', e.message);
        }

        if (!videos.length) {
            container.innerHTML = '<p class="empty-state">لا توجد فيديوهات في هذا الشهر</p>';
            return;
        }

        container.innerHTML = videos.map(video => {
            const hasIndividualPurchase = purchasedVideoIds.has(video.id);
            const hasAccess = hasSub || video.is_free || hasIndividualPurchase;
            const price = video.price || 0;

            return `
                <article class="video-card ${hasAccess ? '' : 'locked-content'}">
                    <div class="video-thumbnail">
                        ${(video.thumbnail || (typeof getYouTubeThumbnail === 'function' && getYouTubeThumbnail(video.video_url))) ? `<img src="${video.thumbnail || getYouTubeThumbnail(video.video_url)}" alt="" loading="lazy">` : '<div class="placeholder-thumbnail">🎬</div>'}
                        ${hasAccess
                            ? (video.hls_url || video.video_url || video.playback_url
                                ? `<button type="button" class="play-button" onclick="watchVideo(${video.id})" aria-label="تشغيل">▶</button>`
                                : '<span class="badge badge-error">الرابط غير متاح</span>')
                            : `
                            <div class="locked-overlay">
                                <div class="lock-icon">🔒</div>
                                <p>محتوى مدفوع</p>
                                ${price > 0 ? `<p class="price">${price} ج.م</p>` : ''}
                                <button type="button" class="btn btn-primary btn-sm" onclick="purchaseContent('video', ${video.id}, ${price})">شراء الفيديو</button>
                            </div>`}
                    </div>
                    <div class="video-info">
                        <h3 class="video-title">${escapeHtml(video.title)}</h3>
                        <p class="content-desc">${escapeHtml(video.description || '')}</p>
                        <div class="video-meta">
                            <span class="badge ${video.is_free ? 'badge-free' : 'badge-paid'}">${video.is_free ? 'مجاني' : 'مدفوع'}</span>
                            ${hasIndividualPurchase ? '<span class="badge badge-success">تم الشراء</span>' : ''}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p class="empty-state">حدث خطأ أثناء التحميل</p>';
    }
}

function openNoteUrl(url) {
    if (!url) { showAlert('رابط الملف غير متاح', 'error'); return; }
    window.open(url, '_blank');
}

async function loadNotes(monthId) {
    const container = document.getElementById('notesContainer');
    if (!container) return;
    container.innerHTML = '<div class="spinner"></div>';

    try {
        const notes = await db.getNotes(currentUser.grade_id, monthId);
        const hasSub = isMonthActive(monthId);

        // تحميل المشتريات الفردية للمذكرات
        let purchasedNoteIds = new Set();
        try {
            const { data: purchasedNotes } = await supabase
                .from('content_purchases')
                .select('content_id')
                .eq('user_id', currentUser.id)
                .eq('content_type', 'note')
                .eq('status', 'active');
            if (purchasedNotes) {
                purchasedNoteIds = new Set(purchasedNotes.map(p => p.content_id));
            }
        } catch (e) {
            console.warn('content_purchases table not available, ignoring:', e.message);
        }

        if (!notes.length) {
            container.innerHTML = '<p class="empty-state">لا توجد مذكرات في هذا الشهر</p>';
            return;
        }

        container.innerHTML = notes.map(note => {
            const hasIndividualPurchase = purchasedNoteIds.has(note.id);
            const hasAccess = hasSub || note.is_free || hasIndividualPurchase;
            const price = note.price || 0;

            const openAction = hasAccess
                ? `openNoteUrl(${JSON.stringify(note.file_url)})`
                : `purchaseContent('note', ${note.id}, ${price})`;

            return `
                <article class="note-card ${hasAccess ? '' : 'locked-content'}">
                    <div class="note-icon">📄</div>
                    <div class="note-info">
                        <h3 class="note-title">${escapeHtml(note.title)}</h3>
                        <p class="content-desc">${escapeHtml(note.description || '')}</p>
                        <div class="note-meta">
                            <span class="badge ${note.is_free ? 'badge-free' : 'badge-paid'}">${note.is_free ? 'مجاني' : 'مدفوع'}</span>
                            ${hasIndividualPurchase ? '<span class="badge badge-success">تم الشراء</span>' : ''}
                            <button type="button" class="btn ${hasAccess ? 'btn-outline' : 'btn-primary'} btn-sm" onclick='${openAction}'>
                                ${hasAccess ? 'فتح المذكرة' : 'شراء المذكرة'}
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p class="empty-state">حدث خطأ أثناء التحميل</p>';
    }
}

async function loadAudio(monthId) {
    const container = document.getElementById('audioContainer');
    if (!container) return;
    container.innerHTML = '<div class="spinner"></div>';

    try {
        const files = await db.getAudioFiles(currentUser.grade_id, monthId);
        const hasSub = isMonthActive(monthId);

        if (!files.length) {
            container.innerHTML = '<p class="empty-state">لا توجد صوتيات في هذا الشهر</p>';
            return;
        }

        container.innerHTML = files.map(audio => {
            const hasAccess = hasSub || audio.is_free;
            const url = audio.audio_url || audio.file_url;
            return `
                <article class="audio-card ${hasAccess ? '' : 'locked-content'}">
                    <div class="audio-icon">🎵</div>
                    <div class="audio-info">
                        <h3 class="audio-title">${escapeHtml(audio.title)}</h3>
                        <p class="content-desc">${escapeHtml(audio.description || '')}</p>
                        <div class="audio-meta">
                            <span class="badge ${audio.is_free ? 'badge-free' : 'badge-paid'}">${audio.is_free ? 'مجاني' : 'مدفوع'}</span>
                        </div>
        ${hasAccess
            ? (url ? `
                <div class="inline-player">
                    <audio controls controlsList="nodownload" preload="metadata" src="${url}" onerror="this.outerHTML='<span class=\\'badge badge-error\\'>ملف الصوت غير متاح</span>'"></audio>
                </div>
            ` : '<span class="badge badge-error">الملف غير متاح</span>')
                            : `<div class="audio-locked">${subscribeButton(monthId, '')}</div>`}
                    </div>
                </article>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p class="empty-state">حدث خطأ أثناء التحميل</p>';
    }
}

async function loadExams(monthId) {
    const container = document.getElementById('examsContainer');
    if (!container) return;
    container.innerHTML = '<div class="spinner"></div>';

    try {
        const exams = await db.getExams(currentUser.grade_id, monthId);
        const hasSub = isMonthActive(monthId);
        let results = [];
        try {
            results = await db.getUserExamResults(currentUser.id);
        } catch (e) {
            console.warn('exam_results table not available, ignoring:', e.message);
        }

        if (!exams.length) {
            container.innerHTML = '<p class="empty-state">لا توجد امتحانات في هذا الشهر</p>';
            return;
        }

        container.innerHTML = exams.map(exam => {
            const hasAccess = hasSub || exam.is_free;
            const lastResult = results.find(r => r.exam_id === exam.id);
            return `
                <article class="exam-card ${hasAccess ? '' : 'locked-content'}">
                    <div class="exam-icon">📝</div>
                    <div class="exam-info">
                        <h3 class="exam-title">${escapeHtml(exam.title)}</h3>
                        <p class="content-desc">${exam.duration ? `${escapeHtml(exam.duration)} دقيقة` : ''}</p>
                        ${lastResult ? `<p class="exam-score">آخر درجة: ${escapeHtml(lastResult.score)}/${escapeHtml(lastResult.total_marks)} (${escapeHtml(lastResult.percentage)}%)</p>` : ''}
                        ${!exam.is_free ? `<p><strong>السعر:</strong> ${exam.price ? escapeHtml(exam.price) + ' ج.م' : 'حدد السعر'}</p>` : ''}
                        ${exam.file_url ? `<p><button type="button" onclick='openContentUrl(${JSON.stringify(exam.file_url)})' class="btn btn-outline btn-sm">عرض ملف الامتحان</button></p>` : ''}
                        ${exam.teacher_name ? `<p><strong>المدرس:</strong> ${escapeHtml(exam.teacher_name)}</p>` : ''}
                        <div class="exam-meta">
                            <span class="badge ${exam.is_free ? 'badge-free' : 'badge-paid'}">${exam.is_free ? 'مجاني' : 'مدفوع'}</span>
                            ${hasAccess
                                ? `<button type="button" class="btn btn-outline btn-sm" onclick="startExam(${exam.id})">بدء الامتحان</button>`
                                : subscribeButton(monthId, '')}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p class="empty-state">حدث خطأ أثناء التحميل</p>';
    }
}

async function loadSubscriptionSection() {
    const list = document.getElementById('subscriptionsList');
    if (!list) return;

    await db.expireOldSubscriptions();
    userSubscriptions = await db.getUserSubscriptions(currentUser.id);
    const now = new Date();

    const monthMap = {};
    gradeMonths.forEach(m => { monthMap[m.id] = m.name; });

    const rows = gradeMonths.map(month => {
        const sub = userSubscriptions.find(s => s.month_id === month.id);
        const active = sub && new Date(sub.end_date) > now && sub.status === 'active';
        const daysLeft = sub ? calculateDaysRemaining(sub.end_date) : 0;

        return `
            <div class="sub-month-card ${active ? 'open' : 'closed'}">
                <div class="sub-month-header">
                    <h4>${month.name}</h4>
                    <span class="sub-badge ${active ? 'open' : 'closed'}">${active ? 'مفتوح' : 'مغلق'}</span>
                </div>
                ${sub ? `
                    <p><strong>البداية:</strong> ${formatDate(sub.start_date)}</p>
                    <p><strong>الانتهاء:</strong> ${formatDate(sub.end_date)}</p>
                    <p><strong>المتبقي:</strong> ${active ? `${daysLeft} يوم` : 'منتهي'}</p>
                ` : '<p>لم يتم الاشتراك بعد</p>'}
                ${!active ? `<button type="button" class="btn btn-primary btn-sm" onclick="subscribeToMonth(${month.id}, '${month.name}')">اشتراك شهري</button>` : ''}
            </div>
        `;
    }).join('');

    list.innerHTML = rows || '<p class="empty-state">لا توجد شهور</p>';

    try {
        const settingsRes = await supabase.from('teacher_settings').select('*');
        if (!settingsRes.error) {
            const smap = {};
            settingsRes.data.forEach(s => smap[s.setting_key] = s.setting_value);
            
            const gradePrice = currentUser.grade_id == 6
                ? (smap['grade6_monthly_price'] || smap['monthly_price_grade_6'] || smap['monthly_price'] || '0')
                : (smap['monthly_price_grade_' + currentUser.grade_id] || smap['monthly_price'] || '0');
            const term1Price = smap['term1_price_grade_' + currentUser.grade_id] || smap['term1_price'] || '0';
            const term2Price = smap['term2_price_grade_' + currentUser.grade_id] || smap['term2_price'] || '0';
            
            if (document.getElementById('packageMonthlyPrice')) document.getElementById('packageMonthlyPrice').textContent = gradePrice;
            if (document.getElementById('packageTerm1Price')) document.getElementById('packageTerm1Price').textContent = term1Price;
            if (document.getElementById('packageTerm2Price')) document.getElementById('packageTerm2Price').textContent = term2Price;

            // Grade 6 special badge
            const monthlyCard = document.getElementById('packageMonthlyCard');
            if (monthlyCard && currentUser.grade_id == 6) {
                if (!monthlyCard.querySelector('.grade6-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'grade6-badge';
                    badge.textContent = '🎯 خاص بالثالث الثانوي';
                    badge.style.cssText = 'position:absolute;top:-8px;right:-8px;background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;box-shadow:0 2px 8px rgba(245,158,11,0.4);z-index:2';
                    monthlyCard.style.position = 'relative';
                    monthlyCard.appendChild(badge);
                }
            }
        }
    } catch(e) {
        console.error(e);
    }
}

async function subscribeToTerm(termNum) {
    try {
        const settingsRes = await supabase.from('teacher_settings').select('*');
        let smap = {};
        if (!settingsRes.error) {
            settingsRes.data.forEach(s => smap[s.setting_key] = s.setting_value);
        }
        const gradeKey = 'term' + termNum + '_price_grade_' + currentUser.grade_id;
        const globalKey = 'term' + termNum + '_price';
        const price = smap[gradeKey] || smap[globalKey] || '0';

        const payment = await db.createPayment({
            user_id: currentUser.id,
            amount: price,
            months: 4,
            status: 'pending',
            payment_method: null,
            metadata: { term: termNum }
        });

        window.location.href = `payment.html?payment_id=${payment.id}&term=${termNum}`;
    } catch (error) {
        console.error(error);
        showAlert('حدث خطأ أثناء إنشاء عملية الدفع', 'error');
    }
}

async function subscribeToMonth(monthId, monthName) {
    pendingSubscribeMonthId = monthId;
    try {
        const settingsRes = await supabase.from('teacher_settings').select('*');
        let smap = {};
        if (!settingsRes.error) {
            settingsRes.data.forEach(s => smap[s.setting_key] = s.setting_value);
        }
        const price = currentUser.grade_id == 6
            ? (smap['grade6_monthly_price'] || smap['monthly_price_grade_6'] || smap['monthly_price'] || '0')
            : (smap['monthly_price_grade_' + currentUser.grade_id] || smap['monthly_price'] || '0');

        const payment = await db.createPayment({
            user_id: currentUser.id,
            amount: price,
            months: 1,
            status: 'pending',
            payment_method: null
        });

        window.location.href = `payment.html?payment_id=${payment.id}&months=1&month_id=${monthId}`;
    } catch (error) {
        console.error(error);
        showAlert('حدث خطأ أثناء إنشاء عملية الدفع', 'error');
    }
}

async function subscribe(months) {
    await subscribeToMonth(selectedMonthId || gradeMonths[0]?.id, '');
}

// --- Courses ---
async function loadCourses() {
    const container = document.getElementById('coursesContainer');
    if (!container) return;
    container.innerHTML = '<div class="loading-grid"><div class="content-skeleton"><div class="skeleton skeleton-thumbnail"></div><div class="skeleton skeleton-text" style="margin:16px;width:70%;"></div><div class="skeleton skeleton-text-sm" style="margin:4px 16px 16px;width:50%;"></div></div><div class="content-skeleton"><div class="skeleton skeleton-thumbnail"></div><div class="skeleton skeleton-text" style="margin:16px;width:70%;"></div><div class="skeleton skeleton-text-sm" style="margin:4px 16px 16px;width:50%;"></div></div></div>';

    try {
        const [courses, purchased] = await Promise.all([
            db.getCourses(currentUser.grade_id),
            db.getUserCoursePurchases(currentUser.id)
        ]);
        const purchasedIds = new Set(purchased.map(p => p.course_id));

        if (!courses.length) {
            container.innerHTML = '<p class="empty-state">لا توجد كورسات متاحة لصفك الدراسي حالياً</p>';
            return;
        }

        container.innerHTML = courses.map(course => {
            const hasAccess = purchasedIds.has(course.id);
            const thumbnail = course.thumbnail || 'images/logo.jpg';
            const priceClass = course.price === 0 ? 'free' : '';
            const priceText = course.price === 0 ? 'مجاني' : formatCurrency(course.price);

            return '<div class="course-card">' +
                '<div class="course-thumbnail">' +
                '<img src="' + thumbnail + '" alt="' + escapeHtml(course.title) + '" loading="lazy">' +
                (course.videos_count ? '<span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;">' + course.videos_count + ' فيديو</span>' : '') +
                '</div>' +
                '<div class="course-content">' +
                '<h3 class="course-title">' + escapeHtml(course.title) + '</h3>' +
                (course.description ? '<p style="color:var(--gray-500);font-size:13px;margin:0 0 8px;line-height:1.5;">' + escapeHtml(course.description.substring(0, 100)) + (course.description.length > 100 ? '...' : '') + '</p>' : '') +
                '<div class="course-price ' + priceClass + '">' + (hasAccess ? '✅ مملوك' : priceText) + '</div>' +
                '<button class="course-btn" onclick="' + (hasAccess ? "window.location.href='course-details.html?id=" + course.id + "'" : "purchaseCourse(" + course.id + "," + course.price + ",'" + escapeHtml(course.title) + "')") + '">' +
                (hasAccess ? 'عرض الكورس' : 'شراء الكورس') +
                '</button>' +
                '</div>' +
                '</div>';
        }).join('');
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = '<p class="empty-state">تعذر تحميل الكورسات</p>';
    }
}

async function purchaseCourse(courseId, price, title) {
    if (!price || price <= 0) {
        window.location.href = 'course-details.html?id=' + courseId;
        return;
    }
    try {
        const payment = await db.createPayment({
            user_id: currentUser.id,
            amount: price,
            months: 1,
            status: 'pending',
            payment_method: null,
            metadata: { type: 'course', course_id: courseId }
        });
        sessionStorage.setItem('pendingCourseId', courseId);
        window.location.href = 'payment.html?payment_id=' + payment.id + '&course_id=' + courseId;
    } catch (error) {
        console.error('Error purchasing course:', error);
        showAlert('حدث خطأ أثناء عملية الشراء', 'error');
    }
}

function showCodeModal() {
    document.getElementById('codeModal')?.classList.add('active');
}

async function handleCodeSubmit(event) {
    event.preventDefault();
    const codeInput = document.getElementById('activationCode');
    const code = codeInput?.value?.trim();
    if (!code) return;

    try {
        const codeData = await db.getCode(code);
        if (!codeData) {
            showAlert('الكود غير صحيح أو مستخدم مسبقاً', 'error');
            return;
        }
        if (new Date(codeData.expires_at) < new Date()) {
            showAlert('الكود منتهي الصلاحية', 'error');
            return;
        }

        const duration = CONFIG.PLATFORM.SUBSCRIPTION_DURATION || 30;
        const start = new Date();
        const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

        await db.createSubscription({
            user_id: currentUser.id,
            month_id: codeData.month_id,
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            amount: CONFIG.PLATFORM.MONTHLY_PRICE,
            status: 'active'
        });

        await db.useCode(codeData.id, currentUser.id);
        closeModal('codeModal');
        codeInput.value = '';
        showAlert('تم تفعيل الشهر بنجاح لمدة 30 يوماً', 'success');
        await loadDashboardData();
        await loadMonths();
        if (document.getElementById('subscription-section')?.classList.contains('active')) {
            loadSubscriptionSection();
        }
    } catch (error) {
        console.error(error);
        showAlert('حدث خطأ أثناء تفعيل الكود', 'error');
    }
}

function watchVideo(videoId) {
    sessionStorage.setItem('selectedVideoId', videoId);
    window.location.href = 'video.html';
}

async function purchaseContent(type, contentId, price) {
    try {
        const payment = await db.createPayment({
            user_id: currentUser.id,
            amount: price,
            months: 0,
            status: 'pending',
            payment_method: null,
            metadata: { type, content_id: contentId }
        });
        window.location.href = `payment.html?payment_id=${payment.id}&content_type=${type}&content_id=${contentId}`;
    } catch (error) {
        console.error('Error purchasing content:', error);
        showAlert('حدث خطأ أثناء عملية الشراء', 'error');
    }
}

function startExam(examId) {
    sessionStorage.setItem('selectedExamId', examId);
    window.location.href = 'exam.html';
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text || '';
    return d.innerHTML;
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function calculateDaysRemaining(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
}

function showAlert(message, type) {
    document.querySelectorAll('.alert').forEach(a => a.remove());
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = message;
    document.body.insertBefore(el, document.body.firstChild);
    setTimeout(() => el.remove(), 7000);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`${sectionId}-section`);
    if (section) section.classList.add('active');

    document.querySelectorAll('.sidebar .menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    if (sectionId === 'subscription' || sectionId === 'overview') loadSubscriptionSection();
    if (sectionId === 'courses') loadCourses();
}

async function uploadAvatar(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showAlert('حجم الصورة يتجاوز 2 ميجابايت', 'error'); input.value = ''; return; }
    try {
        const url = await uploadImageToCloudinary(file, 'avatars');
        if (!url) throw new Error('فشل رفع الصورة');
        const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', currentUser.id);
        if (error) throw error;
        currentUser.avatar_url = url;
        if (typeof cacheUser === 'function') cacheUser(currentUser);
        const img = document.getElementById('avatarImg');
        const icon = document.getElementById('avatarIcon');
        if (img) { img.src = url; img.style.display = 'block'; }
        if (icon) icon.style.display = 'none';
        showAlert('تم تحديث الصورة الشخصية', 'success');
    } catch (e) {
        console.error('Avatar upload error:', e);
        showAlert('فشل رفع الصورة: ' + e.message, 'error');
    }
    input.value = '';
}

async function uploadImageToCloudinary(file, folder) {
    const sigRes = await fetch(CONFIG.SUPABASE.URL + '/functions/v1/cloudinary-signature?folder=' + folder);
    if (!sigRes.ok) throw new Error('فشل الحصول على توقيع الرفع');
    const sigData = await sigRes.json();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigData.api_key);
    formData.append('timestamp', sigData.timestamp);
    formData.append('signature', sigData.signature);
    formData.append('folder', folder);
    const uploadRes = await fetch('https://api.cloudinary.com/v1_1/' + sigData.cloud_name + '/image/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'فشل الرفع');
    return uploadData.secure_url;
}

window.uploadAvatar = uploadAvatar;

// 🚀 INDIVIDUAL CONTENT PURCHASE
async function purchaseContent(contentType, contentId, price) {
    if (!price || price <= 0) {
        showAlert('المحتوى مجاني - لا يحتاج للشراء', 'info');
        return;
    }

    try {
        const payment = await db.createPayment({
            user_id: currentUser.id,
            amount: price,
            months: 0,
            status: 'pending',
            payment_method: null,
            metadata: {
                content_type: contentType,
                content_id: contentId,
                purchase_type: 'individual'
            }
        });

        // حفظ معلومات الشراء في sessionStorage
        sessionStorage.setItem('pendingPurchase', JSON.stringify({
            content_type: contentType,
            content_id: contentId,
            payment_id: payment.id
        }));

        window.location.href = `payment.html?payment_id=${payment.id}&individual=true`;
    } catch (error) {
        console.error('Error creating payment:', error);
        showAlert('حدث خطأ أثناء إنشاء عملية الدفع', 'error');
    }
}

window.purchaseContent = purchaseContent;
