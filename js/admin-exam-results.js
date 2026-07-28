// Admin Exam Results Module
let allResults = [];
let filteredResults = [];
let currentPage = 1;
const pageSize = 20;

document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) await checkAuth();
    const isAdmin = (currentUser && (currentUser.division === 'admin' || currentUser.role === 'admin')) || localStorage.getItem('admin_session');
    if (!isAdmin && !await requireAdmin()) return;

    await loadFilters();
    await loadAllData();
});

async function loadFilters() {
    try {
        const { data: grades } = await supabase.from('grades').select('*').order('order', { ascending: true });
        const gradeSelect = document.getElementById('filterGrade');
        gradeSelect.innerHTML = '<option value="">كل الصفوف</option>' +
            (grades || []).map(g => `<option value="${g.id}">${g.name}</option>`).join('');

        const { data: exams } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
        const examSelect = document.getElementById('filterExam');
        examSelect.innerHTML = '<option value="">كل الامتحانات</option>' +
            (exams || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('');
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function loadAllData() {
    showLoading();
    try {
        allResults = await db.getAllExamAttempts();
        applyFilters();
    } catch (error) {
        console.error('Error loading exam results:', error);
        showError('حدث خطأ أثناء تحميل النتائج');
    }
}

function onFilterChange() {
    applyFilters();
}

async function applyFilters() {
    const gradeId = document.getElementById('filterGrade').value;
    const examId = document.getElementById('filterExam').value;

    filteredResults = allResults.filter(r => {
        if (gradeId && (!r.exams || r.exams.grade_id !== parseInt(gradeId))) {
            return false;
        }
        if (examId && r.exam_id !== parseInt(examId)) {
            return false;
        }
        return true;
    });

    currentPage = 1;
    renderAnalytics();
    renderTable();

    if (examId) {
        await renderIncorrectQuestions(parseInt(examId));
    } else {
        document.getElementById('incorrectQuestionsSection').style.display = 'none';
    }
}

async function renderIncorrectQuestions(examId) {
    const section = document.getElementById('incorrectQuestionsSection');
    const list = document.getElementById('incorrectQuestionsList');

    try {
        const stats = await db.getIncorrectQuestionStats(examId);
        if (!stats || !stats.length) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        list.innerHTML = stats.map((q, idx) => {
            const pct = Math.round(q.wrong_percentage);
            return `
                <div class="incorrect-question-item">
                    <div class="incorrect-question-header">
                        <span class="incorrect-question-title">${escapeHtml(q.question_text)}</span>
                        <div class="incorrect-question-stats">
                            <span class="incorrect-stat"><strong>${q.wrong_count}</strong> خطأ</span>
                            <span class="incorrect-stat">من <strong>${q.total_attempts}</strong> محاولة</span>
                            <span class="incorrect-stat" style="color:#dc2626"><strong>${pct}%</strong></span>
                        </div>
                    </div>
                    <div class="incorrect-progress-bar">
                        <div class="incorrect-progress-fill" style="width:${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading incorrect questions:', error);
        section.style.display = 'none';
    }
}

function renderAnalytics() {
    if (!filteredResults.length) {
        document.getElementById('totalStudents').textContent = '0';
        document.getElementById('avgScore').textContent = '0%';
        document.getElementById('highestScore').textContent = '0%';
        document.getElementById('lowestScore').textContent = '0%';
        document.getElementById('passRate').textContent = '0%';
        document.getElementById('failRate').textContent = '0%';
        return;
    }

    const total = filteredResults.length;
    const uniqueStudents = new Set(filteredResults.map(r => r.user_id)).size;
    const percentages = filteredResults.map(r => r.percentage || 0);
    const totalPercentage = percentages.reduce((s, v) => s + v, 0);
    const passed = filteredResults.filter(r => r.passed).length;

    document.getElementById('totalStudents').textContent = uniqueStudents;
    document.getElementById('avgScore').textContent = `${Math.round(totalPercentage / total)}%`;
    document.getElementById('highestScore').textContent = `${Math.round(Math.max(...percentages))}%`;
    document.getElementById('lowestScore').textContent = `${Math.round(Math.min(...percentages))}%`;
    document.getElementById('passRate').textContent = `${Math.round((passed / total) * 100)}%`;
    document.getElementById('failRate').textContent = `${Math.round(((total - passed) / total) * 100)}%`;
}

function renderTable() {
    const tbody = document.getElementById('resultsTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.getElementById('resultsTableWrapper');
    const pagination = document.getElementById('pagination');
    const countEl = document.getElementById('resultsCount');

    if (!filteredResults.length) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        tableWrapper.style.display = 'none';
        pagination.style.display = 'none';
        countEl.textContent = '0 نتيجة';
        return;
    }

    emptyState.style.display = 'none';
    tableWrapper.style.display = 'block';
    countEl.textContent = `${filteredResults.length} نتيجة`;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, filteredResults.length);
    const pageResults = filteredResults.slice(start, end);

    tbody.innerHTML = pageResults.map(r => {
        const percentage = r.percentage || 0;
        const passed = r.passed;
        const studentName = r.users?.name || 'غير معروف';
        const studentGrade = r.users?.grade_id || 'N/A';
        const examName = r.exams?.title || 'امتحان';
        const scoreBadge = passed ? 'score-badge pass' : 'score-badge fail';

        // Compute counts from questions_detail if columns not stored
        let correctCount = r.correct_count;
        let wrongCount = r.wrong_count;
        if (correctCount === null || correctCount === undefined) {
            correctCount = r.answers?._correct_count;
        }
        if (wrongCount === null || wrongCount === undefined) {
            wrongCount = r.answers?._wrong_count;
        }
        if ((correctCount === null || correctCount === undefined) && r.answers && r.answers.questions_detail) {
            correctCount = r.answers.questions_detail.filter(q => q.is_correct === true).length;
            wrongCount = r.answers.questions_detail.filter(q => q.is_correct === false).length;
        }

        const submissionDate = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-EG') : '-';

        let timeStr = '-';
        if (r.time_taken) {
            const min = Math.floor(r.time_taken / 60);
            const sec = r.time_taken % 60;
            timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
        }

        return `
            <tr>
                <td><strong>${escapeHtml(studentName)}</strong></td>
                <td>${escapeHtml(studentGrade)}</td>
                <td>${escapeHtml(examName)}</td>
                <td>${r.score} / ${r.total_marks}</td>
                <td><span class="${scoreBadge}">${Math.round(percentage)}%</span></td>
                <td>${correctCount || 0}</td>
                <td>${wrongCount || 0}</td>
                <td>${submissionDate}</td>
                <td>${timeStr}</td>
                <td>
                    <button class="action-btn edit" onclick="viewAttemptDetail(${r.id})">عرض التفاصيل</button>
                </td>
            </tr>
        `;
    }).join('');

    // Pagination
    const totalPages = Math.ceil(filteredResults.length / pageSize);
    if (totalPages > 1) {
        pagination.style.display = 'flex';
        document.getElementById('pageInfo').textContent = `الصفحة ${currentPage} من ${totalPages}`;
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;
    } else {
        pagination.style.display = 'none';
    }
}

function changePage(delta) {
    const totalPages = Math.ceil(filteredResults.length / pageSize);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
        document.querySelector('.results-table-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function viewAttemptDetail(resultId) {
    const modal = document.getElementById('attemptDetailModal');
    const content = document.getElementById('detailModalContent');
    modal.classList.add('active');

    content.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>جاري تحميل التفاصيل...</p>
        </div>
    `;

    try {
        let result;
        try {
            result = await db.getExamAttempt(resultId);
        } catch (_) {
            result = await db.getExamAttemptResultOnly(resultId);
        }
        if (!result) {
            content.innerHTML = '<div class="error-state"><p>لم يتم العثور على النتيجة</p></div>';
            return;
        }

        // Try to get user name if join didn't return it
        let studentName = result.users?.name;
        if (!studentName) {
            try {
                const { data: userData } = await supabase.from('users').select('name').eq('id', result.user_id).single();
                studentName = userData?.name || 'غير معروف';
            } catch (_) {
                studentName = 'غير معروف';
            }
        }

        // Try to get exam title if join didn't return it
        let examName = result.exams?.title;
        if (!examName) {
            try {
                const { data: examData } = await supabase.from('exams').select('title').eq('id', result.exam_id).single();
                examName = examData?.title || 'امتحان';
            } catch (_) {
                examName = 'امتحان';
            }
        }

        const answersData = result.answers || {};
        const questionsDetail = answersData.questions_detail || [];

        // Compute counts from questions_detail if columns not stored
        let correctCount = result.correct_count;
        let wrongCount = result.wrong_count;
        if (correctCount === null || correctCount === undefined) {
            correctCount = result.answers?._correct_count;
        }
        if (wrongCount === null || wrongCount === undefined) {
            wrongCount = result.answers?._wrong_count;
        }
        if ((correctCount === null || correctCount === undefined) && questionsDetail.length) {
            correctCount = questionsDetail.filter(q => q.is_correct === true).length;
            wrongCount = questionsDetail.filter(q => q.is_correct === false).length;
        }

        const percentage = result.percentage || 0;
        const passed = result.passed;

        const submissionDate = result.created_at ? new Date(result.created_at).toLocaleString('ar-EG') : '-';

        let timeStr = '-';
        if (result.time_taken) {
            const min = Math.floor(result.time_taken / 60);
            const sec = result.time_taken % 60;
            timeStr = `${min}:${sec.toString().padStart(2, '0')} دقيقة`;
        }

        // Build questions HTML
        let questionsHtml = '';
        if (questionsDetail && questionsDetail.length) {
            questionsHtml = questionsDetail.map((q, idx) => {
                const isCorrect = q.is_correct;
                let cardClass = 'detail-question-card';
                let resultLabel, resultClass;

                if (isCorrect === true) {
                    cardClass += ' q-correct';
                    resultLabel = '✅ صحيح';
                    resultClass = 'q-pass';
                } else if (isCorrect === false) {
                    cardClass += ' q-incorrect';
                    resultLabel = '❌ خطأ';
                    resultClass = 'q-fail';
                } else {
                    resultLabel = '⏳ بانتظار التصحيح';
                    resultClass = '';
                }

                const studentAnswerText = getDetailAnswerText(q, q.student_answer);
                const correctAnswerText = getDetailAnswerText(q, q.correct_answer);

                let studentAnswerClass = 'detail-answer-box';
                if (isCorrect === true) studentAnswerClass += ' student-correct';
                else if (isCorrect === false) studentAnswerClass += ' student-wrong';

                const showCorrect = isCorrect === false || q.question_type === 'essay';

                return `
                    <div class="${cardClass}">
                        <div class="detail-question-header">
                            <span class="detail-question-number">سؤال ${idx + 1}</span>
                            <span class="detail-question-result ${resultClass}">${resultLabel}</span>
                        </div>
                        <div class="detail-question-text">${escapeHtml(q.question_text)}</div>
                        <div class="detail-answers">
                            <div class="${studentAnswerClass}">
                                <span class="ans-label">إجابة الطالب</span>
                                <span class="ans-text">${escapeHtml(studentAnswerText)}</span>
                            </div>
                            ${showCorrect ? `
                            <div class="detail-answer-box correct-answer">
                                <span class="ans-label">الإجابة الصحيحة</span>
                                <span class="ans-text">${escapeHtml(correctAnswerText)}</span>
                            </div>
                            ` : ''}
                        </div>
                        ${q.teacher_explanation ? `
                        <div class="detail-explanation">
                            <span class="exp-label">ملاحظة المدرس</span>
                            <p class="exp-text">${escapeHtml(q.teacher_explanation)}</p>
                        </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        } else {
            questionsHtml = '<div class="empty-state"><p>تفاصيل الأسئلة غير متوفرة لهذه المحاولة</p></div>';
        }

        content.innerHTML = `
            <h2 class="modal-title">تفاصيل محاولة الامتحان</h2>
            <div class="detail-student-info">
                <div class="detail-info-grid">
                    <div class="detail-info-item">
                        <span class="label">الطالب</span>
                        <span class="value">${escapeHtml(studentName)}</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="label">الامتحان</span>
                        <span class="value">${escapeHtml(examName)}</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="label">الدرجة</span>
                        <span class="value">${result.score} / ${result.total_marks}</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="label">النسبة</span>
                        <span class="value" style="color:${passed ? '#059669' : '#dc2626'}">${Math.round(percentage)}% (${passed ? 'ناجح' : 'راسب'})</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="label">تاريخ التقديم</span>
                        <span class="value">${submissionDate}</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="label">الوقت المستغرق</span>
                        <span class="value">${timeStr}</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="label">إجابات صحيحة</span>
                        <span class="value" style="color:#059669">${correctCount || 0}</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="label">إجابات خاطئة</span>
                        <span class="value" style="color:#dc2626">${wrongCount || 0}</span>
                    </div>
                </div>
            </div>
            <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;color:#1f2937">مراجعة الإجابات</h3>
            <div class="detail-questions">
                ${questionsHtml}
            </div>
        `;
    } catch (error) {
        console.error('Error loading attempt detail:', error);
        content.innerHTML = '<div class="error-state"><p>حدث خطأ أثناء تحميل التفاصيل</p></div>';
    }
}

function getDetailAnswerText(question, answerValue) {
    if (answerValue === null || answerValue === undefined || answerValue === '') return 'لم يتم الإجابة';

    if (question.question_type === 'mcq') {
        const options = question.options || [];
        const idx = parseInt(answerValue);
        if (!isNaN(idx) && idx >= 0 && idx < options.length) {
            return options[idx];
        }
        return answerValue;
    }

    if (question.question_type === 'true_false') {
        return answerValue === 'true' ? 'صح' : 'خطأ';
    }

    return answerValue;
}

function closeDetailModal() {
    document.getElementById('attemptDetailModal').classList.remove('active');
}

function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('resultsContent').style.display = 'none';
}

function showError(msg) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = msg || 'حدث خطأ';
    document.getElementById('resultsContent').style.display = 'none';
}

function refreshData() {
    loadAllData();
}
