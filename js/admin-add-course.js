// Admin Add Course Module

let uploadedThumbnail = null;

// Load grades on page load
onDOMReady(async () => {
    if (!await requireAdmin()) return;
    await loadCourseGradesDropdown();
    initVideoUpload();
});

// Load grades for dropdown
async function loadCourseGradesDropdown() {
    try {
        const grades = await db.getGrades();

        const select = document.getElementById('courseGrade');
        if (select) {
            select.innerHTML = '<option value="">اختر الصف الدراسي</option>' +
                grades.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

// Handle thumbnail preview
function handleThumbnailPreview(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة صالح');
        event.target.value = '';
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت');
        event.target.value = '';
        return;
    }

    uploadedThumbnail = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        const placeholder = document.getElementById('thumbnailPlaceholder');
        const preview = document.getElementById('thumbnailPreview');
        const image = document.getElementById('thumbnailImage');

        if (placeholder) placeholder.style.display = 'none';
        if (preview) {
            preview.style.display = 'inline-block';
        }
        if (image) {
            image.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);
}

// Remove thumbnail
function removeThumbnail() {
    uploadedThumbnail = null;
    const input = document.getElementById('courseThumbnail');
    const placeholder = document.getElementById('thumbnailPlaceholder');
    const preview = document.getElementById('thumbnailPreview');

    if (input) input.value = '';
    if (placeholder) placeholder.style.display = 'block';
    if (preview) preview.style.display = 'none';
}

// Initialize video upload
function initVideoUpload() {
    const uploadArea = document.getElementById('videoUploadArea');
    const fileInput = document.getElementById('videoFilesInput');

    if (!uploadArea || !fileInput) return;

    // Drag and drop handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
        if (files.length > 0) {
            addVideos(files);
        }
    });
}

// Handle video file selection
function handleVideoFileSelect(event) {
    const files = Array.from(event.target.files);
    addVideos(files);
    event.target.value = '';
}

// Add videos to the list
function addVideos(files) {
    if (uploadedVideos.length + files.length > 20) {
        alert('الحد الأقصى هو 20 فيديو');
        return;
    }

    files.forEach(file => {
        if (!file.type.startsWith('video/')) return;
        
        const videoObj = {
            file: file,
            name: file.name,
            size: formatFileSize(file.size),
            id: Date.now() + Math.random(),
            duration: 0
        };

        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        videoEl.onloadedmetadata = function() {
            videoObj.duration = Math.round(videoEl.duration);
            URL.revokeObjectURL(videoEl.src);
            renderVideoList();
        };
        videoEl.src = URL.createObjectURL(file);

        uploadedVideos.push(videoObj);
    });

    renderVideoList();
}

// Render video list
function renderVideoList() {
    const container = document.getElementById('videoList');
    if (!container) return;

    container.innerHTML = uploadedVideos.map((video, index) => `
        <div class="video-item" draggable="true" data-id="${video.id}">
            <div class="video-item-number">${index + 1}</div>
            <div class="video-item-info">
                <input type="text" class="video-title-input" value="${escapeHtml(video.customTitle || video.name.replace(/\.[^/.]+$/, ''))}" 
                    onchange="updateVideoCustomTitle('${video.id}', this.value)" 
                    placeholder="اسم الفيديو">
                <div class="video-item-meta">${video.size}${video.duration ? ' | ' + formatDuration(video.duration) : ''}</div>
            </div>
            <div class="video-item-actions">
                <button type="button" class="video-item-btn delete" onclick="removeVideo('${video.id}')">حذف</button>
            </div>
        </div>
    `).join('');

    // Add drag and drop for reordering
    initVideoReorder();
}

// Remove video from list
function removeVideo(id) {
    uploadedVideos = uploadedVideos.filter(v => v.id != id);
    renderVideoList();
}

// Update custom title for a video
function updateVideoCustomTitle(id, newTitle) {
    const video = uploadedVideos.find(v => v.id == id);
    if (video) {
        video.customTitle = newTitle.trim() || null;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Initialize video reordering
function initVideoReorder() {
    const items = document.querySelectorAll('.video-item');
    let draggedItem = null;

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const container = document.getElementById('videoList');
            const afterElement = getDragAfterElement(container, e.clientY);
            if (draggedItem && afterElement == null) {
                container.appendChild(draggedItem);
            } else if (draggedItem && afterElement !== draggedItem) {
                container.insertBefore(draggedItem, afterElement);
            }
        });

        item.addEventListener('drop', () => {
            updateVideoOrder();
        });
    });
}

// Get drag after element
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.video-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Update video order after drag and drop
function updateVideoOrder() {
    const items = document.querySelectorAll('.video-item');
    const newOrder = [];
    
    items.forEach(item => {
        const id = item.dataset.id;
        const video = uploadedVideos.find(v => v.id == id);
        if (video) newOrder.push(video);
    });

    uploadedVideos = newOrder;
    renderVideoList();
}

// Handle course submission
async function handleCourseSubmit(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('courseSubmitBtn');
    if (!submitBtn) return;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';

        const title = document.getElementById('courseTitle').value;
        const description = document.getElementById('courseDescription').value;
        const gradeId = document.getElementById('courseGrade').value;
        const price = document.getElementById('coursePrice').value;
        const status = document.getElementById('courseStatus').value;

        if (!title || !gradeId || !price) {
            alert('يرجى ملء جميع الحقول المطلوبة');
            submitBtn.disabled = false;
            submitBtn.textContent = 'حفظ الكورس';
            return;
        }

        // Upload thumbnail if provided
        let thumbnailUrl = null;
        if (uploadedThumbnail) {
            thumbnailUrl = await uploadThumbnail(uploadedThumbnail);
        }

        // Create course record
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .insert({
                title: title,
                description: description,
                grade_id: parseInt(gradeId),
                thumbnail: thumbnailUrl,
                price: parseFloat(price),
                status: status,
                video_count: uploadedVideos.length
            })
            .select()
            .single();

        if (courseError) throw courseError;

        // Upload videos to R2
        let uploadedCount = 0;
        let failedCount = 0;
        let lastError = '';
        for (let i = 0; i < uploadedVideos.length; i++) {
            const video = uploadedVideos[i];
            try {
                const result = await uploadVideo(video.file, `course-${course.id}`, (pct) => {
                    submitBtn.textContent = `رفع ${i + 1}/${uploadedVideos.length}: ${pct}%`;
                });

                await supabase.from('course_videos').insert({
                    course_id: course.id,
                    video_url: result.secure_url,
                    title: video.customTitle || video.name.replace(/\.[^/.]+$/, ''),
                    order_number: i + 1,
                    duration: video.duration || 0
                });
                uploadedCount++;
            } catch (videoErr) {
                console.error(`فشل رفع الفيديو ${video.name}:`, videoErr);
                failedCount++;
                lastError = videoErr.message || videoErr.toString();
            }
        }

        const msg = failedCount > 0
            ? `تم حفظ الكورس! رفع ${uploadedCount} فيديو، فشل ${failedCount} فيديو.\n\nسبب الفشل: ${lastError}`
            : `تم حفظ الكورس بنجاح مع ${uploadedCount} فيديو!`;
        alert(msg);
        window.location.href = 'admin.html';

    } catch (error) {
        console.error('Error saving course:', error);
        alert('حدث خطأ أثناء حفظ الكورس: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'حفظ الكورس';
    }
}

    // Upload thumbnail to R2
async function uploadThumbnail(file) {
    const result = await uploadImage(file, 'course-thumbnails');
    return result.secure_url;
}

// Mobile menu functions
function toggleAdminMobileMenu() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.admin-sidebar-overlay');
    const layout = document.querySelector('.admin-layout');
    if (!sidebar) return;
    const isActive = sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active', isActive);
    if (layout) layout.classList.toggle('sidebar-active', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
}

function closeAdminMobileMenu() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.admin-sidebar-overlay');
    const layout = document.querySelector('.admin-layout');
    if (!sidebar) return;
    sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (layout) layout.classList.remove('sidebar-active');
    document.body.style.overflow = '';
}
