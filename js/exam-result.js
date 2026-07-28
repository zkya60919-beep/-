// Exam Result Page - Student Review
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const resultId = params.get('result_id');
    const isLocal = params.get('local') === 'true';

    if (isLocal) {
        loadFromLocalStorage();
        return;
    }

    if (!resultId) {
        showError('لم يتم العثور على معرف النتيجة');
        return;
    }

    await loadExamResult(resultId);
});

function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message || 'لم نتمكن من تحميل نتيجة الامتحان';
}

function getAnswerText(question, answerValue) {
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

function loadFromLocalStorage() {
    const stored = sessionStorage.getItem('lastExamResult');
    if (!stored) {
        showError('لم يتم العثور على نتيجة الامتحان');
        return;
    }
    try {
        const result = JSON.parse(stored);
        displayResult(result);
    } catch (e) {
        showError('حدث خطأ أثناء تحميل النتيجة');
    }
}

async function loadExamResult(resultId) {
    try {
        let result;
        try {
            result = await db.getExamAttempt(resultId);
        } catch (_) {
            result = await db.getExamAttemptResultOnly(resultId);
        }

        if (!result) {
            loadFromLocalStorage();
            return;
        }

        if (result.user_id !== currentUser.id) {
            showError('لا يمكنك عرض نتيجة امتحان لطالب آخر');
            return;
        }

        displayResult(result);

    } catch (error) {
        console.error('Error loading exam result:', error);
        loadFromLocalStorage();
    }
}

function displayResult(result) {
    const answersData = result.answers || {};
    const questionsDetail = answersData.questions_detail || [];

    let correctCount = result.correct_count;
    let wrongCount = result.wrong_count;
    if (correctCount === null || correctCount === undefined) {
        correctCount = answersData._correct_count;
    }
    if (wrongCount === null || wrongCount === undefined) {
        wrongCount = answersData._wrong_count;
    }
    if ((correctCount === null || correctCount === undefined) && questionsDetail.length) {
        correctCount = questionsDetail.filter(q => q.is_correct === true).length;
        wrongCount = questionsDetail.filter(q => q.is_correct === false).length;
    }

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('resultContent').style.display = 'block';

    const examTitle = result.exams?.title || answersData._exam_title || 'امتحان';
    document.getElementById('examTitle').textContent = examTitle;

    const percentage = result.percentage || 0;
    const passed = result.passed;

    const scoreCircle = document.getElementById('scoreCircle');
    document.getElementById('scorePercentage').textContent = `${Math.round(percentage)}%`;

    if (passed) {
        scoreCircle.className = 'score-circle passed';
        document.getElementById('resultStatus').textContent = 'ناجح';
        document.getElementById('resultStatus').className = 'score-status passed';
    } else {
        scoreCircle.className = 'score-circle failed';
        document.getElementById('resultStatus').textContent = 'راسب';
        document.getElementById('resultStatus').className = 'score-status failed';
    }

    document.getElementById('scoreValue').textContent = `${result.score} / ${result.total_marks}`;
    document.getElementById('correctCount').textContent = correctCount || 0;
    document.getElementById('wrongCount').textContent = wrongCount || 0;

    const submissionDate = result.created_at ? new Date(result.created_at).toLocaleString('ar-EG') : '-';
    document.getElementById('submissionDate').textContent = submissionDate;

    if (result.time_taken) {
        const minutes = Math.floor(result.time_taken / 60);
        const seconds = result.time_taken % 60;
        document.getElementById('timeTaken').textContent = `${minutes}:${seconds.toString().padStart(2, '0')} دقيقة`;
    } else {
        document.getElementById('timeTaken').textContent = '-';
    }

    renderQuestionsReview(questionsDetail);
}

function renderQuestionsReview(questionsDetail) {
    const container = document.getElementById('questionsReview');

    if (!questionsDetail || !questionsDetail.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><h3>لا توجد تفاصيل</h3><p>تفاصيل الأسئلة غير متوفرة لهذا الامتحان</p></div>';
        return;
    }

    container.innerHTML = questionsDetail.map((q, index) => {
        const isCorrect = q.is_correct;
        const isEssay = q.question_type === 'essay';

        let resultLabel, resultClass;
        if (isEssay) {
            resultLabel = 'بانتظار التصحيح';
            resultClass = 'result-ungraded';
        } else if (isCorrect === true) {
            resultLabel = '✅ صحيح';
            resultClass = 'result-correct';
        } else if (isCorrect === false) {
            resultLabel = '❌ خطأ';
            resultClass = 'result-incorrect';
        } else {
            resultLabel = 'بانتظار التصحيح';
            resultClass = 'result-ungraded';
        }

        let cardClass = 'question-review-card';
        if (isCorrect === true) cardClass += ' correct';
        else if (isCorrect === false) cardClass += ' incorrect';
        else cardClass += ' ungraded';

        const studentAnswerText = getAnswerText(q, q.student_answer);
        const correctAnswerText = getAnswerText(q, q.correct_answer);

        let studentAnswerClass = 'answer-box student-answer';
        if (isCorrect === true) studentAnswerClass += ' correct-answer';
        else if (isCorrect === false) studentAnswerClass += ' wrong-answer';

        const showCorrectAnswer = isCorrect === false || isEssay;

        const teacherExplanation = q.teacher_explanation || '';

        return `
            <div class="${cardClass}">
                <div class="question-review-header">
                    <span class="question-review-number">سؤال ${index + 1}</span>
                    <span class="question-review-result ${resultClass}">${resultLabel}</span>
                </div>
                <div class="question-review-text">${escapeHtml(q.question_text)}</div>
                <div class="question-review-answers">
                    <div class="${studentAnswerClass}">
                        <span class="answer-label">إجابتك</span>
                        <span class="answer-text">${escapeHtml(studentAnswerText)}</span>
                    </div>
                    ${showCorrectAnswer ? `
                    <div class="answer-box correct-answer-box">
                        <span class="answer-label">الإجابة الصحيحة</span>
                        <span class="answer-text">${escapeHtml(correctAnswerText)}</span>
                    </div>
                    ` : ''}
                </div>
                ${teacherExplanation ? `
                <div class="teacher-explanation">
                    <span class="explanation-label">ملاحظة المدرس</span>
                    <p class="explanation-text">${escapeHtml(teacherExplanation)}</p>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}
