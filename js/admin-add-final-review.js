// Admin Add Final Review JavaScript

function setupDropZone(zoneId, inputId, onSelect) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file) onSelect(file, zone);
    });
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) onSelect(file, zone);
    });
}

function showFilePreview(zone, file, label) {
    const p = zone.querySelector('p');
    if (p) p.textContent = label || '\u2713 ' + file.name;
    zone.classList.add('has-file');
}

function setUploadProgress(pct, text) {
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('progressText');
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = text || pct + '%';
    document.getElementById('uploadProgress').hidden = false;
}

let thumbnailFile = null;
let contentItems = {
    video: [],
    pdf: [],
    audio: [],
    exam: []
};
let contentItemCounter = 0;

onDOMReady(async () => {
    if (!await requireAdmin()) return;

    await loadGradesSelect();
    setupThumbnailDropZone();
    document.getElementById('finalReviewForm').addEventListener('submit', handleSubmit);
});

async function loadGradesSelect() {
    const grades = await db.getGrades();
    document.getElementById('reviewGrade').innerHTML = grades.map(g =>
        `<option value="${g.id}">${g.name}</option>`
    ).join('');
}

function setupThumbnailDropZone() {
    setupDropZone('thumbnailDropZone', 'thumbnailInput', (file, zone) => {
        thumbnailFile = file;
        showFilePreview(zone, file, 'صورة الغلاف');
    });
}

function addContentItem(type) {
    const containerId = `${type}ContentItems`;
    const container = document.getElementById(containerId);
    const itemId = `content-${type}-${contentItemCounter++}`;
    
    const itemHtml = `
        <div class="content-item" data-id="${itemId}" data-type="${type}">
            <div class="content-item-header">
                <span class="content-item-number">${contentItems[type].length + 1}</span>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeContentItem('${itemId}')">حذف</button>
            </div>
            <div class="content-item-body">
                <div class="form-group">
                    <label>العنوان</label>
                    <input type="text" class="content-title" placeholder="عنوان المحتوى">
                </div>
                <div class="form-group">
                    <label>الوصف (اختياري)</label>
                    <textarea class="content-description" rows="2" placeholder="وصف قصير..."></textarea>
                </div>
                ${getContentUploadFields(type, itemId)}
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', itemHtml);
    contentItems[type].push({ id: itemId, element: container.lastElementChild });
    setupContentDropZone(itemId, type);
}

function getContentUploadFields(type, itemId) {
    switch(type) {
        case 'video':
            return `
                <div class="upload-tabs">
                    <button type="button" class="upload-tab active" data-item-id="${itemId}" data-mode="url">رابط يوتيوب / فيديو</button>
                    <button type="button" class="upload-tab" data-item-id="${itemId}" data-mode="file">رفع ملف</button>
                </div>
                <div class="content-upload-panel panel-url" data-item-id="${itemId}">
                    <div class="form-group">
                        <label>رابط الفيديو</label>
                        <input type="url" class="content-video-url" placeholder="https://www.youtube.com/watch?v=...">
                    </div>
                </div>
                <div class="content-upload-panel panel-file hidden-panel" data-item-id="${itemId}">
                    <div class="drop-zone content-drop-zone" data-item-id="${itemId}">
                        <p>اسحب ملف الفيديو أو اضغط للرفع</p>
                        <span>MP4 - حتى 200 م.ب</span>
                    </div>
                    <input type="file" class="content-video-file" accept="video/*" data-item-id="${itemId}" hidden>
                </div>
            `;
        case 'pdf':
            return `
                <div class="form-group">
                    <label>ملف PDF</label>
                    <div class="drop-zone content-drop-zone" data-item-id="${itemId}">
                        <p>اسحب ملف PDF أو اضغط للرفع</p>
                        <span>PDF - حتى 50 م.ب</span>
                    </div>
                    <input type="file" class="content-pdf-file" accept=".pdf" data-item-id="${itemId}" hidden>
                </div>
            `;
        case 'audio':
            return `
                <div class="form-group">
                    <label>ملف صوتي</label>
                    <div class="drop-zone content-drop-zone" data-item-id="${itemId}">
                        <p>اسحب ملف الصوت أو اضغط للرفع</p>
                        <span>MP3 - حتى 50 م.ب</span>
                    </div>
                    <input type="file" class="content-audio-file" accept="audio/*" data-item-id="${itemId}" hidden>
                </div>
            `;
        case 'exam':
            return `
                <div class="upload-tabs">
                    <button type="button" class="upload-tab active" data-item-id="${itemId}" data-mode="interactive">كتابة الأسئلة</button>
                    <button type="button" class="upload-tab" data-item-id="${itemId}" data-mode="pdf">رفع PDF</button>
                </div>
                <div class="content-upload-panel panel-interactive" data-item-id="${itemId}">
                    <div class="form-group">
                        <label>مدة الامتحان (بالدقائق)</label>
                        <input type="number" class="content-exam-duration" value="30" min="5" required>
                    </div>
                    <div class="questions-builder" data-item-id="${itemId}">
                        <div class="section-header-inline">
                            <h4>الأسئلة</h4>
                            <button type="button" class="btn btn-outline btn-sm" onclick="addReviewExamQuestion('${itemId}')">+ إضافة سؤال</button>
                        </div>
                        <div class="questions-container"></div>
                    </div>
                </div>
                <div class="content-upload-panel panel-pdf hidden-panel" data-item-id="${itemId}">
                    <div class="form-group">
                        <label>ملف PDF للامتحان</label>
                        <div class="drop-zone content-drop-zone" data-item-id="${itemId}">
                            <p>اسحب ملف PDF أو اضغط للرفع</p>
                            <span>PDF - حتى 50 م.ب</span>
                        </div>
                        <input type="file" class="content-exam-file" accept=".pdf" data-item-id="${itemId}" hidden>
                    </div>
                </div>
            `;
        default:
            return '';
    }
}

function setupContentDropZone(itemId, type) {
    const dropZone = document.querySelector(`.content-drop-zone[data-item-id="${itemId}"]`);
    const input = document.querySelector(`.content-${type}-file[data-item-id="${itemId}"]`);
    
    if (!dropZone || !input) return;

    dropZone.addEventListener('click', () => input.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file, dropZone);
    });
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) handleFile(file, dropZone);
    });

    function handleFile(file, zone) {
        const itemData = contentItems[type].find(item => item.id === itemId);
        if (itemData) {
            itemData.file = file;
            showFilePreview(zone, file, type === 'pdf' ? 'ملف PDF' : type === 'audio' ? 'ملف صوتي' : type === 'exam' ? 'امتحان PDF' : 'فيديو');
        }
    }

    // Setup upload tabs
    document.querySelectorAll(`.upload-tab[data-item-id="${itemId}"]`).forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            document.querySelectorAll(`.upload-tab[data-item-id="${itemId}"]`).forEach(t => {
                t.classList.toggle('active', t.dataset.mode === mode);
            });
            document.querySelectorAll(`.content-upload-panel[data-item-id="${itemId}"]`).forEach(panel => {
                panel.classList.add('hidden-panel');
            });
            document.querySelector(`.panel-${mode}[data-item-id="${itemId}"]`).classList.remove('hidden-panel');
        });
    });

    // Automatically add one empty question when creating an exam block
    if (type === 'exam') {
        setTimeout(() => addReviewExamQuestion(itemId), 100);
    }
}

let examQuestionCounters = {};

window.addReviewExamQuestion = function(itemId) {
    if (!examQuestionCounters[itemId]) examQuestionCounters[itemId] = 0;
    const qid = examQuestionCounters[itemId]++;
    const container = document.querySelector(`.questions-builder[data-item-id="${itemId}"] .questions-container`);
    if (!container) return;
    
    const html = `
        <div class="question-block" data-qid="${qid}">
            <div class="form-group">
                <label>نص السؤال</label>
                <input type="text" class="q-text" required>
            </div>
            <div class="form-group">
                <label>النوع</label>
                <select class="q-type" onchange="toggleReviewExamOptions(this)">
                    <option value="mcq">اختيار من متعدد</option>
                    <option value="true_false">صح / خطأ</option>
                </select>
            </div>
            <div class="q-options">
                <input type="text" class="opt" placeholder="الخيار 1">
                <input type="text" class="opt" placeholder="الخيار 2">
                <input type="text" class="opt" placeholder="الخيار 3">
                <input type="text" class="opt" placeholder="الخيار 4">
            </div>
            <div class="form-group">
                <label>الإجابة الصحيحة (رقم الخيار 0-3 للمتعدد أو true/false لصح وخطأ)</label>
                <input type="text" class="q-answer" required>
            </div>
            <button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.question-block').remove()">حذف السؤال</button>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
};

window.toggleReviewExamOptions = function(sel) {
    const block = sel.closest('.question-block');
    const opts = block.querySelector('.q-options');
    opts.style.display = sel.value === 'mcq' ? 'grid' : 'none';
};

function removeContentItem(itemId) {
    const item = document.querySelector(`.content-item[data-id="${itemId}"]`);
    if (item) {
        const type = item.dataset.type;
        contentItems[type] = contentItems[type].filter(i => i.id !== itemId);
        item.remove();
        // Renumber remaining items
        document.querySelectorAll(`#${type}ContentItems .content-item`).forEach((item, index) => {
            item.querySelector('.content-item-number').textContent = index + 1;
        });
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    setButtonLoading(btn, true);

    try {
        // Validate at least one content item
        const totalItems = Object.values(contentItems).reduce((sum, items) => sum + items.length, 0);
        if (totalItems === 0) {
            showAlert('يجب إضافة محتوى واحد على الأقل (فيديو، مذكرة، صوتي، أو امتحان)', 'error');
            setButtonLoading(btn, false);
            return;
        }

        // Upload thumbnail if provided
        let thumbnailUrl = null;
        if (thumbnailFile) {
            const onProgress = (pct, text) => setUploadProgress(pct, text);
            document.getElementById('uploadProgress').hidden = false;
            thumbnailUrl = (await uploadImage(thumbnailFile, 'final-reviews/thumbs', (pct) => onProgress(pct, `رفع ${pct}%`))).secure_url;
        }

        const isFree = document.getElementById('reviewFree').checked;
        const price = isFree ? 0 : parseFloat(document.getElementById('reviewPrice').value) || 0;

        // Create final review
        const reviewData = {
            grade_id: parseInt(document.getElementById('reviewGrade').value),
            title: document.getElementById('reviewTitle').value.trim(),
            description: document.getElementById('reviewDescription').value.trim(),
            price: price,
            is_free: isFree,
            thumbnail: thumbnailUrl,
            is_active: true,
            order_num: 0
        };

        const { data: review, error: reviewError } = await supabase
            .from('final_reviews')
            .insert(reviewData)
            .select()
            .single();

        if (reviewError) throw reviewError;

        // Upload and create content items
        setUploadProgress(30, 'جاري رفع المحتوى...');
        
        for (const [type, items] of Object.entries(contentItems)) {
            for (const item of items) {
                const element = item.element;
                const title = element.querySelector('.content-title').value.trim();
                const description = element.querySelector('.content-description').value.trim();
                
                let fileUrl = null;
                let videoUrl = null;
                let examId = null;

                // Handle file uploads based on type
                if (type === 'video') {
                    const mode = element.querySelector('.upload-tab.active').dataset.mode;
                    if (mode === 'url') {
                        videoUrl = element.querySelector('.content-video-url').value.trim();
                        if (!videoUrl) continue;
                        videoUrl = normalizeVideoUrl(videoUrl);
                    } else if (mode === 'file' && item.file) {
                        fileUrl = (await uploadVideo(item.file, 'final-reviews/videos', (pct) => 
                            setUploadProgress(30 + (pct * 0.5), `رفع ${pct}%`)
                        )).secure_url;
                    }
                } else if ((type === 'pdf' || type === 'audio') && item.file) {
                    const folder = type === 'pdf' ? 'final-reviews/pdfs' : 'final-reviews/audio';
                    const uploadFn = type === 'pdf' ? uploadPDF : uploadAttachment;
                    fileUrl = (await uploadFn(item.file, folder, (pct) => 
                        setUploadProgress(30 + (pct * 0.5), `رفع ${pct}%`)
                    )).secure_url;
                } else if (type === 'exam') {
                    const mode = element.querySelector('.upload-tab.active').dataset.mode;
                    
                    if (mode === 'pdf' && item.file) {
                        // PDF Exam Upload
                        fileUrl = (await uploadPDF(item.file, 'final-reviews/exam-pdfs', (pct) => 
                            setUploadProgress(30 + (pct * 0.5), `رفع ${pct}%`)
                        )).secure_url;
                    } else if (mode === 'interactive') {
                        // Interactive Exam
                        const duration = parseInt(element.querySelector('.content-exam-duration').value) || 30;
                        const questions = [];
                        element.querySelectorAll('.question-block').forEach(block => {
                            const qType = block.querySelector('.q-type').value;
                            const opts = [...block.querySelectorAll('.opt')].map(o => o.value).filter(Boolean);
                            questions.push({
                                question_text: block.querySelector('.q-text').value.trim(),
                                question_type: qType,
                                options: qType === 'mcq' ? opts : null,
                                correct_answer: block.querySelector('.q-answer').value.trim(),
                                marks: 1
                            });
                        });

                        if (questions.length === 0) {
                            throw new Error('يجب إضافة سؤال واحد على الأقل للامتحان التفاعلي: ' + title);
                        }

                        // Create the exam dynamically in the DB
                        const newExam = await db.createExam({
                            grade_id: reviewData.grade_id,
                            month_id: null, // Final reviews might not be bound to a month for exams
                            title: title || 'امتحان مراجعة',
                            duration: duration,
                            is_free: reviewData.is_free,
                            price: 0,
                            file_url: null
                        });
                        
                        await db.saveExamQuestions(newExam.id, questions);
                        examId = newExam.id;
                    }
                }

                // Create content item
                const contentData = {
                    final_review_id: review.id,
                    content_type: type,
                    title: title || `${type} ${contentItems[type].indexOf(item) + 1}`,
                    description: description || null,
                    file_url: fileUrl,
                    video_url: videoUrl,
                    exam_id: examId,
                    order_num: contentItems[type].indexOf(item)
                };

                const { error: contentError } = await supabase
                    .from('final_review_content')
                    .insert(contentData);

                if (contentError) throw contentError;
            }
        }

        setUploadProgress(100, 'تم الحفظ');
        showAlert('تم حفظ المراجعة النهائية بنجاح', 'success');
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1500);

    } catch (err) {
        console.error(err);
        showAlert(err.message || 'فشل الحفظ', 'error');
        setButtonLoading(btn, false);
        document.getElementById('uploadProgress').hidden = true;
    }
}

function toggleReviewPrice() {
    const isFree = document.getElementById('reviewFree').checked;
    const group = document.getElementById('reviewPriceGroup');
    group.classList.toggle('hidden', isFree);
    if (isFree) document.getElementById('reviewPrice').value = '';
}

function showAlert(message, type) {
    document.querySelectorAll('.alert').forEach(a => a.remove());
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = message;
    document.body.insertBefore(el, document.body.firstChild);
    setTimeout(() => el.remove(), 7000);
}
