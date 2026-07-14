// Exam Module

let examData = null;
let userAnswers = {};
let examStartTime = null;
let timerInterval = null;
let autoSaveInterval = null;
let remainingSeconds = 0;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    await loadExam();
    startTimer();
    startAutoSave();
});

function getProgressKey() {
    return `exam_progress_${currentUser.id}_${examData.id}`;
}

function startAutoSave() {
    autoSaveInterval = setInterval(() => {
        const state = {
            answers: userAnswers,
            timeLeft: remainingSeconds,
            startTime: examStartTime
        };
        localStorage.setItem(getProgressKey(), JSON.stringify(state));
    }, 5000);
}

async function loadExam() {
    try {
        const examId = sessionStorage.getItem('selectedExamId');
        if (!examId) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Check if already submitted
        try {
            const { data: previousResult } = await supabase
                .from('exam_results')
                .select('id')
                .eq('exam_id', parseInt(examId))
                .eq('user_id', currentUser.id)
                .maybeSingle();
                
            if (previousResult) {
                showAlert('لقد قمت بحل هذا الامتحان مسبقاً', 'error');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
                return;
            }
        } catch (e) {
            console.warn('exam_results table not available, proceeding:', e.message);
        }
        
        examData = await db.getExam(parseInt(examId));
        if (!examData) {
            showAlert('الامتحان غير موجود', 'error');
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Check access
        const activeSubscription = await db.getActiveSubscription(currentUser.id, examData.month_id);
        if (!activeSubscription && !examData.is_free) {
            showAlert('هذا الامتحان متاح للمشتركين فقط', 'error');
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Update exam info
        document.getElementById('examTitle').textContent = examData.title;
        document.getElementById('examDuration').textContent = `${examData.duration} دقيقة`;
        document.getElementById('examQuestions').textContent = `${examData.exam_questions.length} أسئلة`;
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = `مرحباً، ${currentUser.name}`;
        
        // Load saved progress
        const savedStateStr = localStorage.getItem(`exam_progress_${currentUser.id}_${examData.id}`);
        if (savedStateStr) {
            try {
                const state = JSON.parse(savedStateStr);
                userAnswers = state.answers || {};
                remainingSeconds = state.timeLeft || (examData.duration * 60);
                examStartTime = state.startTime ? new Date(state.startTime) : new Date();
            } catch (e) {
                userAnswers = {};
                remainingSeconds = examData.duration * 60;
                examStartTime = new Date();
            }
        } else {
            userAnswers = {};
            remainingSeconds = examData.duration * 60;
            examStartTime = new Date();
        }

        // Randomize questions
        examData.exam_questions = shuffleArray(examData.exam_questions);
        
        // Randomize answers for MCQ
        examData.exam_questions.forEach(q => {
            if (q.question_type === 'mcq' && q.options) {
                // Store original options mapping
                q.originalOptions = [...q.options];
                // Shuffle options
                const shuffledIndices = shuffleArray([...Array(q.options.length).keys()]);
                q.shuffledOptions = shuffledIndices.map(i => ({ originalIndex: i, text: q.options[i] }));
            }
        });
        
        // Render questions
        renderQuestions();
        
    } catch (error) {
        console.error('Error loading exam:', error);
        showAlert('حدث خطأ أثناء تحميل الامتحان', 'error');
    }
}

function renderQuestions() {
    const container = document.getElementById('examQuestions');
    
    container.innerHTML = examData.exam_questions.map((question, index) => {
        let optionsHTML = '';
        
        if (question.question_type === 'mcq') {
            const shuffledOptions = question.shuffledOptions || [];
            optionsHTML = `
                <div class="question-options">
                    ${shuffledOptions.map((opt) => {
                        const isChecked = userAnswers[question.id] === opt.originalIndex.toString() ? 'checked' : '';
                        const isSelectedClass = isChecked ? 'selected' : '';
                        return `
                        <label class="option-label ${isSelectedClass}">
                            <input type="radio" name="question_${question.id}" value="${opt.originalIndex}" onchange="selectAnswer(${question.id}, '${opt.originalIndex}', this)" ${isChecked}>
                            <span>${opt.text}</span>
                        </label>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (question.question_type === 'true_false') {
            const isTrueChecked = userAnswers[question.id] === 'true' ? 'checked' : '';
            const isFalseChecked = userAnswers[question.id] === 'false' ? 'checked' : '';
            optionsHTML = `
                <div class="question-options">
                    <label class="option-label ${isTrueChecked ? 'selected' : ''}">
                        <input type="radio" name="question_${question.id}" value="true" onchange="selectAnswer(${question.id}, 'true', this)" ${isTrueChecked}>
                        <span>صح</span>
                    </label>
                    <label class="option-label ${isFalseChecked ? 'selected' : ''}">
                        <input type="radio" name="question_${question.id}" value="false" onchange="selectAnswer(${question.id}, 'false', this)" ${isFalseChecked}>
                        <span>خطأ</span>
                    </label>
                </div>
            `;
        } else if (question.question_type === 'essay') {
            const savedText = userAnswers[question.id] || '';
            optionsHTML = `
                <div class="question-options">
                    <textarea class="essay-answer" placeholder="أكتب إجابتك هنا..." oninput="selectAnswer(${question.id}, this.value, this)">${savedText}</textarea>
                </div>
            `;
        }
        
        return `
            <div class="question-card" id="question_${question.id}">
                <span class="question-number">سؤال ${index + 1}</span>
                <p class="question-text">${question.question_text}</p>
                ${optionsHTML}
            </div>
        `;
    }).join('');
}

function selectAnswer(questionId, answer, element) {
    userAnswers[questionId] = answer;
    
    // Update UI
    if (element.type === 'radio') {
        document.querySelectorAll(`input[name="question_${questionId}"]`).forEach(input => {
            input.closest('.option-label').classList.remove('selected');
        });
        element.closest('.option-label').classList.add('selected');
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        remainingSeconds--;
        
        if (remainingSeconds < 0) remainingSeconds = 0;
        
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        
        document.getElementById('timerDisplay').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            submitExam();
        }
    }, 1000);
}

async function submitExam() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    // Check if all questions are answered
    const unansweredQuestions = examData.exam_questions.filter(q => !userAnswers[q.id]);
    
    if (unansweredQuestions.length > 0 && remainingSeconds > 0) {
        if (!confirm(`لديك ${unansweredQuestions.length} أسئلة لم يتم الإجابة عليها. هل تريد تسليم الامتحان على أي حال؟`)) {
            startTimer();
            startAutoSave();
            return;
        }
    }
    
    try {
        // Calculate score
        let correctCount = 0;
        let totalMarks = 0;
        let earnedMarks = 0;
        
        examData.exam_questions.forEach(question => {
            totalMarks += question.marks;
            
            if (question.question_type === 'mcq' || question.question_type === 'true_false') {
                const userAnswer = userAnswers[question.id];
                if (userAnswer === question.correct_answer) {
                    correctCount++;
                    earnedMarks += question.marks;
                }
            }
            // Essay questions need manual grading
        });
        
        const percentage = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
        const passed = percentage >= (examData.passing_marks || 50);
        
        // Calculate time taken
        const examEndTime = new Date();
        const timeTakenSeconds = Math.round((examEndTime - examStartTime) / 1000);
        
        // Save result
        const resultData = {
            exam_id: examData.id,
            user_id: currentUser.id,
            answers: {
                answers: userAnswers,
                metrics: {
                    start_time: examStartTime.toISOString(),
                    end_time: examEndTime.toISOString(),
                    duration_seconds: timeTakenSeconds,
                    browser: navigator.userAgent,
                    device: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
                }
            },
            score: earnedMarks,
            total_marks: totalMarks,
            percentage: percentage,
            passed: passed,
            time_taken: timeTakenSeconds // DB expects seconds
        };
        
        try {
            await db.saveExamResult(resultData);
        } catch (e) {
            console.warn('exam_results table not available, result not saved to DB:', e.message);
        }
        
        // Clear saved progress
        localStorage.removeItem(getProgressKey());
        
        // Show results
        showResults(earnedMarks, totalMarks, correctCount, examData.exam_questions.length - correctCount, Math.round(timeTakenSeconds / 60), percentage, passed);
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        showAlert('حدث خطأ أثناء تسليم الامتحان', 'error');
    }
}

function showResults(score, total, correct, wrong, time, percentage, passed) {
    document.getElementById('scorePercentage').textContent = `${Math.round(percentage)}%`;
    document.getElementById('scoreValue').textContent = `${score} / ${total}`;
    document.getElementById('correctAnswers').textContent = correct;
    document.getElementById('wrongAnswers').textContent = wrong;
    document.getElementById('timeTaken').textContent = `${time} دقيقة`;
    
    const resultStatus = document.getElementById('resultStatus');
    if (passed) {
        resultStatus.textContent = 'ناجح! 🎉';
        resultStatus.className = 'result-status passed';
    } else {
        resultStatus.textContent = 'راسب ❌';
        resultStatus.className = 'result-status failed';
    }
    
    document.getElementById('resultModal').classList.add('active');
}

function cancelExam() {
    if (confirm('هل أنت متأكد من إلغاء الامتحان؟ سيتم فقدان جميع الإجابات.')) {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        window.location.href = 'dashboard.html';
    }
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}
