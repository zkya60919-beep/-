// Admin Add Video Module - R2 Upload

let thumbFile = null;
let videoFile = null;

const editParams = new URLSearchParams(window.location.search);
const editVideoId = editParams.get('edit');
const isEditMode = !!editVideoId;

onDOMReady(async () => {
    if (!await requireAdmin()) return;
    bindFilePickers();
    bindActions();
    await loadGradesAndMonths();
    if (isEditMode) await loadVideoForEdit();
});

function bindActions() {
    document.getElementById('videoForm').addEventListener('submit', handleSubmit);
    document.getElementById('videoGrade').addEventListener('change', loadMonthsForGrade);
    document.getElementById('cancelBtn').addEventListener('click', () => window.location.href = 'admin.html');
    document.getElementById('retryBtn').addEventListener('click', () => document.getElementById('submitBtn').click());
}

function bindFilePickers() {
    setupDropZone('thumbDropZone', 'thumbInput', (file) => {
        thumbFile = file;
        const preview = document.getElementById('thumbPreview');
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
        const badge = document.getElementById('thumbBadge');
        badge.textContent = `✓ ${file.name}`;
        badge.style.display = 'inline-flex';
    });

    setupDropZone('videoDropZone', 'videoInput', (file) => {
        // Validate video file size before accepting
        if (file.size > 500 * 1024 * 1024) {
            showAlert(`حجم الملف (${formatBytes(file.size)}) يتجاوز الحد المسموح (500 م.ب)`);
            return;
        }
        if (!file.type.startsWith('video/')) {
            showAlert('الملف المحدد ليس فيديو');
            return;
        }
        videoFile = file;
        const badge = document.getElementById('videoBadge');
        badge.textContent = `✓ ${file.name} - ${formatBytes(file.size)}`;
        badge.style.display = 'inline-flex';
    });
}

function setupDropZone(zoneId, inputId, onSelect) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    
    if (!zone) {
        console.error(`Drop zone not found: ${zoneId}`);
        return;
    }
    if (!input) {
        console.error(`File input not found: ${inputId}`);
        return;
    }

    zone.addEventListener('click', (e) => {
        // Ignore clicks on the badge or preview
        if (e.target.closest('.file-selected-badge') || e.target.closest('.preview-container')) return;
        input.click();
    });
    
    zone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        zone.classList.add('dragover'); 
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file) onSelect(file);
    });
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) onSelect(file);
    });
}

async function loadGradesAndMonths() {
    const grades = await db.getGrades();
    document.getElementById('videoGrade').innerHTML = grades.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
    await loadMonthsForGrade();
}

async function loadMonthsForGrade() {
    const gradeId = parseInt(document.getElementById('videoGrade').value, 10);
    let months = await db.getMonths(gradeId);
    if (months.length < 9) months = await db.ensureNineMonths(gradeId);
    document.getElementById('videoMonth').innerHTML = months.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
}

async function loadVideoForEdit() {
    try {
        const video = await db.getVideo(parseInt(editVideoId, 10));
        if (!video) throw new Error('الفيديو غير موجود');

        // Update page chrome to edit mode
        document.title = 'تعديل فيديو - لوحة المدرس';
        const badge = document.querySelector('.admin-badge');
        if (badge) badge.textContent = 'تعديل فيديو';
        const title = document.querySelector('.form-page-title');
        if (title) title.textContent = 'تعديل فيديو';
        document.getElementById('submitBtn').textContent = 'حفظ التعديلات';

        // Reveal thumbnail + pricing groups in edit mode
        const thumbGroup = document.querySelector('.media-upload-grid .form-group');
        if (thumbGroup) thumbGroup.style.display = 'block';
        const pricingGroup = document.querySelector('.pricing-group');
        if (pricingGroup) pricingGroup.style.display = 'block';

        // Fill fields
        document.getElementById('videoGrade').value = video.grade_id || '';
        await loadMonthsForGrade();
        document.getElementById('videoMonth').value = video.month_id || '';
        document.getElementById('videoTitle').value = video.title || '';
        document.getElementById('videoDescription').value = video.description || '';
        document.getElementById('videoFree').checked = !!video.is_free;

        if (video.thumbnail) {
            const preview = document.getElementById('thumbPreview');
            preview.src = video.thumbnail;
            preview.style.display = 'block';
            const tb = document.getElementById('thumbBadge');
            tb.textContent = `✓ ${video.thumbnail.split('/').pop().slice(-30)}`;
            tb.style.display = 'inline-flex';
        }

        const vb = document.getElementById('videoBadge');
        vb.textContent = '✓ الفيديو الحالي محفوظ — اختر ملف جديد لاستبداله (اختياري)';
        vb.style.display = 'inline-flex';
    } catch (err) {
        console.error('Error loading video for edit:', err);
        showAlert('تعذر تحميل بيانات الفيديو', 'error');
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    if (!isEditMode && !videoFile) {
        showAlert('اختر ملف فيديو أولاً', 'error');
        return;
    }
    if (videoFile && videoFile.size > 500 * 1024 * 1024) {
        showAlert(`حجم الفيديو (${formatBytes(videoFile.size)}) يتجاوز الحد المسموح (500 م.ب)`);
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    setButtonLoading(submitBtn, true);
    setStatus('جارٍ رفع الفيديو...', 0);
    document.getElementById('uploadProgressCard').style.display = 'block';
    document.getElementById('retryBtn').style.display = 'none';

    try {
        let videoResult = null;
        let thumbResult = null;

        if (videoFile) {
            videoResult = await uploadVideo(videoFile, 'monthly-videos', (pct) => {
                setStatus(`رفع الفيديو ${pct}%`, pct);
                document.getElementById('uploadPercentage').textContent = `${pct}%`;
                document.getElementById('uploadProgressBarFill').style.width = `${pct}%`;
            });
        }
        if (thumbFile) {
            thumbResult = await uploadImage(thumbFile, 'thumbnails', (pct) => {
                setStatus(`رفع الصورة ${pct}%`, pct);
                document.getElementById('uploadPercentage').textContent = `${pct}%`;
                document.getElementById('uploadProgressBarFill').style.width = `${pct}%`;
            });
        }

        const thumbnailUrl = thumbResult?.secure_url || null;
        const videoUrl = videoResult?.secure_url || null;

        const payload = {
            grade_id: parseInt(document.getElementById('videoGrade').value, 10),
            month_id: parseInt(document.getElementById('videoMonth').value, 10),
            title: document.getElementById('videoTitle').value.trim(),
            description: document.getElementById('videoDescription').value.trim(),
            is_free: document.getElementById('videoFree').checked
        };

        if (thumbnailUrl) payload.thumbnail = thumbnailUrl;

        setStatus('حفظ البيانات في Supabase...', 98);
        if (isEditMode) {
            if (videoUrl) {
                payload.video_url = videoUrl;
                payload.playback_url = videoUrl;
                payload.hls_url = null;
                payload.cloudinary_public_id = null;
            }
            await db.updateVideo(parseInt(editVideoId, 10), payload);
        } else {
            if (!videoUrl) throw new Error('لم يتم رفع ملف الفيديو');
            payload.video_url = videoUrl;
            payload.playback_url = videoUrl;
            payload.thumbnail = thumbnailUrl;
            await db.createVideo(payload);
        }

        setStatus('تم بنجاح', 100);
        showAlert(isEditMode ? 'تم تحديث الفيديو بنجاح' : 'تم رفع الفيديو وحفظه بنجاح', 'success');
        setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
    } catch (err) {
        console.error(err);
        showAlert(err.message || 'فشل حفظ الفيديو', 'error');
        document.getElementById('retryBtn').style.display = 'inline-flex';
        setButtonLoading(submitBtn, false);
    }
}

function setStatus(text, percent) {
    document.getElementById('uploadStatusText').textContent = text;
    if (percent == null) return;
    document.getElementById('uploadPercentage').textContent = `${percent}%`;
    document.getElementById('uploadProgressBarFill').style.width = `${percent}%`;
}

function setButtonLoading(btn, loading) {
    btn.disabled = loading;
    btn.textContent = loading ? 'جارٍ رفع الفيديو...' : (isEditMode ? 'حفظ التعديلات' : 'رفع وحفظ الفيديو');
}

function formatBytes(bytes) {
    if (!bytes || bytes < 1) return '0 بايت';
    const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب', 'ت.ب'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function showAlert(message, type) {
    document.querySelectorAll('.alert-toast').forEach((el) => el.remove());
    const el = document.createElement('div');
    el.className = 'alert-toast';
    el.textContent = message;
    el.style.cssText = `
        position:fixed;top:20px;right:20px;z-index:99999;padding:12px 16px;border-radius:10px;
        color:#fff;font-weight:700;max-width:90vw;background:${type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : '#2563eb'};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
}