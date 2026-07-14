// Admin Add Video Module - Cloudinary Upload

let thumbFile = null;
let videoFile = null;

onDOMReady(async () => {
    if (!await requireAdmin()) return;
    bindFilePickers();
    bindActions();
    await loadGradesAndMonths();
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

async function handleSubmit(e) {
    e.preventDefault();
    if (!videoFile) {
        showAlert('اختر ملف فيديو أولاً', 'error');
        return;
    }
    // Pre-check file size
    if (videoFile.size > 500 * 1024 * 1024) {
        showAlert(`حجم الفيديو (${formatBytes(videoFile.size)}) يتجاوز الحد المسموح (500 م.ب)`);
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    setButtonLoading(submitBtn, true);
    setStatus('جارٍ رفع الفيديو...', 0);
    document.getElementById('uploadProgressCard').style.display = 'block';
    document.getElementById('retryBtn').style.display = 'none';

    try {
        const [videoResult, thumbResult] = await Promise.all([
            uploadVideo(videoFile, 'monthly-videos', (pct) => {
                setStatus(`رفع الفيديو ${pct}%`, pct);
                document.getElementById('uploadPercentage').textContent = `${pct}%`;
                document.getElementById('uploadProgressBarFill').style.width = `${pct}%`;
            }),
            thumbFile ? uploadImage(thumbFile, 'thumbnails') : Promise.resolve(null)
        ]);

        const thumbnailUrl = thumbResult?.secure_url || null;

        setStatus('حفظ البيانات في Supabase...', 98);
        await db.createVideo({
            grade_id: parseInt(document.getElementById('videoGrade').value, 10),
            month_id: parseInt(document.getElementById('videoMonth').value, 10),
            title: document.getElementById('videoTitle').value.trim(),
            description: document.getElementById('videoDescription').value.trim(),
            video_url: videoResult.secure_url,
            playback_url: videoResult.secure_url,
            thumbnail: thumbnailUrl,
            is_free: document.getElementById('videoFree').checked
        });

        setStatus('تم بنجاح', 100);
        showAlert('تم رفع الفيديو وحفظه بنجاح', 'success');
        setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
    } catch (err) {
        console.error(err);
        showAlert(err.message || 'فشل رفع الفيديو', 'error');
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
    btn.textContent = loading ? 'جارٍ رفع الفيديو...' : 'رفع وحفظ الفيديو';
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