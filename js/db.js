// Database API Layer - Supabase operations for Al-Basit Platform

const db = {
    // --- Users ---
    async getUserByPhone(phone) {
        const { data, error } = await supabase.from('users').select('*').eq('phone', phone).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async updateUser(userId, updates) {
        const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
        if (error) throw error;
        return data;
    },

    // --- Grades ---
    async getGrades(visibleOnly = false) {
        const build = () => {
            let q = supabase.from('grades').select('*');
            if (visibleOnly) q = q.eq('visible', true);
            return q;
        };
        let { data, error } = await build().order('order', { ascending: true });
        if (error) {
            const res = await build().order('id', { ascending: true });
            if (res.error) throw res.error;
            data = res.data;
        }
        return data || [];
    },

    async getAllGrades() {
        return this.getGrades(false);
    },

    async createGrade(gradeData) {
        const row = {
            name: gradeData.name,
            order: gradeData.order_num ?? gradeData.order ?? 0,
            visible: gradeData.visible !== false
        };
        const { data, error } = await supabase.from('grades').insert(row).select().single();
        if (error) throw error;
        return data;
    },

    async updateGrade(id, gradeData) {
        const row = {
            name: gradeData.name,
            order: gradeData.order_num ?? gradeData.order,
            visible: gradeData.visible
        };
        const { data, error } = await supabase.from('grades').update(row).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteGrade(id) {
        const { error } = await supabase.from('grades').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Months ---
    async getMonths(gradeId = null) {
        let query = supabase.from('months').select('*').order('order', { ascending: true });
        if (gradeId) query = query.eq('grade_id', gradeId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getAllMonths(gradeId) {
        return this.getMonths(gradeId);
    },

    async createMonth(monthData) {
        const row = {
            grade_id: monthData.grade_id,
            name: monthData.name,
            order: monthData.order_num ?? monthData.order ?? 0,
            visible: monthData.visible !== false
        };
        const { data, error } = await supabase.from('months').insert(row).select().single();
        if (error) throw error;
        return data;
    },

    async updateMonth(id, monthData) {
        const row = {
            grade_id: monthData.grade_id,
            name: monthData.name,
            order: monthData.order_num ?? monthData.order,
            visible: monthData.visible
        };
        const { data, error } = await supabase.from('months').update(row).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteMonth(id) {
        const { error } = await supabase.from('months').delete().eq('id', id);
        if (error) throw error;
    },

    async ensureNineMonths(gradeId) {
        const months = await this.getMonths(gradeId);
        const names = [
            'الشهر الأول', 'الشهر الثاني', 'الشهر الثالث', 'الشهر الرابع', 'الشهر الخامس',
            'الشهر السادس', 'الشهر السابع', 'الشهر الثامن', 'الشهر التاسع'
        ];
        for (let i = months.length; i < 9; i++) {
            await this.createMonth({
                grade_id: gradeId,
                name: names[i],
                order_num: i + 1,
                visible: true
            });
        }
        return this.getMonths(gradeId);
    },

    // --- Videos ---
    async getVideos(gradeId, monthId) {
        let query = supabase.from('videos').select('*');
        if (gradeId) query = query.eq('grade_id', gradeId);
        if (monthId) query = query.eq('month_id', monthId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getVideo(id) {
        const { data, error } = await supabase.from('videos').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async createVideo(videoData) {
        const row = { ...videoData };
        if (!row.playback_url && row.hls_url) row.playback_url = row.hls_url;
        if (!row.playback_url && row.video_url) row.playback_url = row.video_url;
        const { data, error } = await supabase.from('videos').insert(row).select().single();
        if (error) throw error;
        return data;
    },

    async updateVideo(id, videoData) {
        const { data, error } = await supabase.from('videos').update(videoData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteVideo(id) {
        const { error } = await supabase.from('videos').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Notes ---
    async getNotes(gradeId, monthId) {
        let query = supabase.from('notes').select('*');
        if (gradeId) query = query.eq('grade_id', gradeId);
        if (monthId) query = query.eq('month_id', monthId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getNote(id) {
        const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async createNote(noteData) {
        const { data, error } = await supabase.from('notes').insert(noteData).select().single();
        if (error) throw error;
        return data;
    },

    async updateNote(id, noteData) {
        const { data, error } = await supabase.from('notes').update(noteData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteNote(id) {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) throw error;
    },

    // Alias for admin "products"
    async getProducts(gradeId, monthId) {
        return this.getNotes(gradeId, monthId);
    },

    async createProduct(data) {
        return this.createNote(data);
    },

    async updateProduct(id, data) {
        return this.updateNote(id, data);
    },

    async deleteProduct(id) {
        return this.deleteNote(id);
    },

    // --- Audio ---
    async getAudioFiles(gradeId, monthId) {
        let query = supabase.from('audio').select('*');
        if (gradeId) query = query.eq('grade_id', gradeId);
        if (monthId) query = query.eq('month_id', monthId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getAudio(id) {
        const { data, error } = await supabase.from('audio').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async createAudio(audioData) {
        const { data, error } = await supabase.from('audio').insert(audioData).select().single();
        if (error) throw error;
        return data;
    },

    async updateAudio(id, audioData) {
        const { data, error } = await supabase.from('audio').update(audioData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteAudio(id) {
        const { error } = await supabase.from('audio').delete().eq('id', id);
        if (error) throw error;
    },

    // --- Exams ---
    async getExams(gradeId, monthId) {
        let query = supabase.from('exams').select('*');
        if (gradeId) query = query.eq('grade_id', gradeId);
        if (monthId) query = query.eq('month_id', monthId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getExam(id) {
        const { data: exam, error } = await supabase.from('exams').select('*').eq('id', id).single();
        if (error) throw error;
        const { data: questions } = await supabase
            .from('exam_questions')
            .select('*')
            .eq('exam_id', id)
            .order('order_num', { ascending: true });
        exam.exam_questions = questions || [];
        return exam;
    },

    async createExam(examData) {
        const { data, error } = await supabase.from('exams').insert(examData).select().single();
        if (error) throw error;
        return data;
    },

    async updateExam(id, examData) {
        const { data, error } = await supabase.from('exams').update(examData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteExam(id) {
        const { error } = await supabase.from('exams').delete().eq('id', id);
        if (error) throw error;
    },

    async saveExamQuestions(examId, questions) {
        await supabase.from('exam_questions').delete().eq('exam_id', examId);
        if (!questions.length) return;
        const rows = questions.map((q, i) => ({
            exam_id: examId,
            question_text: q.question_text,
            question_type: q.question_type || 'mcq',
            options: q.options || null,
            correct_answer: String(q.correct_answer),
            marks: q.marks || 1,
            order_num: i + 1
        }));
        const { error } = await supabase.from('exam_questions').insert(rows);
        if (error) throw error;
    },

    async saveExamResult(resultData) {
        const { data, error } = await supabase.from('exam_results').insert(resultData).select().single();
        if (error) throw error;
        return data;
    },

    async getUserExamResults(userId, examId = null) {
        let query = supabase.from('exam_results').select('*, exams(title)').eq('user_id', userId);
        if (examId) query = query.eq('exam_id', examId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // --- Enhanced Exam Attempts & Analytics ---
    async saveExamResultEnhanced(resultData) {
        // Store counts inside answers JSONB so they're available even without columns
        const answersWithCounts = {
            ...resultData.answers,
            _correct_count: resultData.correct_count || 0,
            _wrong_count: resultData.wrong_count || 0
        };

        const row = {
            exam_id: resultData.exam_id,
            user_id: resultData.user_id,
            answers: answersWithCounts,
            score: resultData.score,
            total_marks: resultData.total_marks,
            percentage: resultData.percentage,
            passed: resultData.passed,
            time_taken: resultData.time_taken
        };

        const { data, error } = await supabase.from('exam_results').insert(row).select().single();
        if (error) throw error;
        return data;
    },

    async getAllExamAttempts(filters = {}) {
        let examIds = null;
        if (filters.gradeId || filters.monthId) {
            let examQuery = supabase.from('exams').select('id');
            if (filters.gradeId) {
                examQuery = examQuery.eq('grade_id', parseInt(filters.gradeId));
            }
            if (filters.monthId) {
                examQuery = examQuery.eq('month_id', parseInt(filters.monthId));
            }
            const { data: matchingExams } = await examQuery;
            examIds = (matchingExams || []).map(e => e.id);
            if (!examIds.length) return [];
        }

        // Use LEFT JOINs to avoid failures if FK relationships are not detected
        let query = supabase
            .from('exam_results')
            .select('*, exams(title, grade_id), users(name, phone, grade_id)')
            .order('created_at', { ascending: false });

        if (filters.examId) {
            query = query.eq('exam_id', parseInt(filters.examId));
        }
        if (filters.userId) {
            query = query.eq('user_id', filters.userId);
        }
        if (examIds) {
            query = query.in('exam_id', examIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getExamAttempt(resultId) {
        // Use LEFT JOINs for maximum compatibility
        const { data, error } = await supabase
            .from('exam_results')
            .select('*, exams(title, grade_id, duration), users(name, phone, grade_id)')
            .eq('id', parseInt(resultId))
            .single();
        if (error) throw error;
        return data;
    },

    async getExamAttemptsForStudent(studentId) {
        const { data, error } = await supabase
            .from('exam_results')
            .select('*, exams(title, grade_id)')
            .eq('user_id', studentId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getExamAttemptResultOnly(resultId) {
        const { data, error } = await supabase
            .from('exam_results')
            .select('*')
            .eq('id', parseInt(resultId))
            .single();
        if (error) throw error;
        return data;
    },

    async getExamAnalytics(examId) {
        const { data: results, error } = await supabase
            .from('exam_results')
            .select('score, total_marks, percentage, passed, correct_count, wrong_count, user_id')
            .eq('exam_id', parseInt(examId));
        if (error) throw error;
        if (!results || !results.length) {
            return {
                total_attempts: 0,
                average_score: 0,
                highest_score: 0,
                lowest_score: 0,
                pass_rate: 0,
                fail_rate: 0,
                average_percentage: 0
            };
        }

        const total = results.length;
        const totalPercentage = results.reduce((s, r) => s + (r.percentage || 0), 0);
        const totalScore = results.reduce((s, r) => s + (r.score || 0), 0);
        const totalMarks = results.reduce((s, r) => s + (r.total_marks || 0), 0);
        const passedCount = results.filter(r => r.passed).length;
        const percentages = results.map(r => r.percentage || 0);

        return {
            total_attempts: total,
            total_unique_students: new Set(results.map(r => r.user_id)).size,
            average_score: total > 0 ? totalScore / total : 0,
            highest_score: percentages.length ? Math.max(...percentages) : 0,
            lowest_score: percentages.length ? Math.min(...percentages) : 0,
            pass_rate: total > 0 ? (passedCount / total) * 100 : 0,
            fail_rate: total > 0 ? ((total - passedCount) / total) * 100 : 0,
            average_percentage: total > 0 ? totalPercentage / total : 0,
            total_correct: results.reduce((s, r) => s + (r.correct_count || 0), 0),
            total_wrong: results.reduce((s, r) => s + (r.wrong_count || 0), 0)
        };
    },

    async getIncorrectQuestionStats(examId) {
        const { data: results, error } = await supabase
            .from('exam_results')
            .select('answers')
            .eq('exam_id', parseInt(examId));
        if (error) throw error;
        if (!results || !results.length) return [];

        const questionMap = {};
        results.forEach(result => {
            const answers = result.answers || {};
            const details = answers.questions_detail || [];
            details.forEach(q => {
                const qid = q.question_id;
                if (!questionMap[qid]) {
                    questionMap[qid] = {
                        question_id: qid,
                        question_text: q.question_text,
                        question_type: q.question_type,
                        total_attempts: 0,
                        wrong_count: 0,
                        correct_count: 0
                    };
                }
                questionMap[qid].total_attempts++;
                if (q.is_correct === false) {
                    questionMap[qid].wrong_count++;
                } else if (q.is_correct === true) {
                    questionMap[qid].correct_count++;
                }
            });
        });

        return Object.values(questionMap)
            .map(q => ({
                ...q,
                wrong_percentage: q.total_attempts > 0 ? (q.wrong_count / q.total_attempts) * 100 : 0
            }))
            .sort((a, b) => b.wrong_count - a.wrong_count);
    },

    // --- Subscriptions ---
    async getUserSubscriptions(userId) {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*, months(name)')
            .eq('user_id', userId)
            .order('end_date', { ascending: false });
        if (error) { console.error('getUserSubscriptions error:', error); throw error; }
        return data || [];
    },

    async getActiveSubscription(userId, monthId) {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('month_id', monthId)
            .gt('end_date', new Date().toISOString())
            .eq('status', 'active')
            .limit(1);
        if (error) throw error;
        return data?.[0] || null;
    },

    async hasMonthAccess(userId, monthId) {
        const sub = await this.getActiveSubscription(userId, monthId);
        return !!sub;
    },

    async createSubscription(subscriptionData) {
        const { data, error } = await supabase.from('subscriptions').insert(subscriptionData).select().single();
        if (error) throw error;
        return data;
    },

    async expireOldSubscriptions() {
        await supabase
            .from('subscriptions')
            .update({ status: 'expired' })
            .lt('end_date', new Date().toISOString())
            .eq('status', 'active');
    },

    // --- Subscription Codes ---
    async getCode(code) {
        const { data, error } = await supabase
            .from('subscription_codes')
            .select('*')
            .eq('code', code.toUpperCase().trim())
            .eq('used', false)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async createCode(codeData) {
        const { data, error } = await supabase.from('subscription_codes').insert({
            ...codeData,
            code: (codeData.code || generateCode()).toUpperCase()
        }).select().single();
        if (error) throw error;
        return data;
    },

    async useCode(codeId, userId) {
        const { error } = await supabase
            .from('subscription_codes')
            .update({ used: true, used_at: new Date().toISOString(), user_id: userId })
            .eq('id', codeId);
        if (error) throw error;
    },

    async getUserCodes(userId) {
        const { data, error } = await supabase
            .from('subscription_codes')
            .select('*, months(name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // --- Payments ---
    async createPayment(paymentData) {
        const { data, error } = await supabase.from('payments').insert(paymentData).select().single();
        if (error) throw error;
        return data;
    },

    async updatePayment(id, updates) {
        const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async getPayment(id) {
        const { data, error } = await supabase.from('payments').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async getUserPayments(userId) {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // --- Stats (admin) ---
    async getAdminStats() {
        const safeCount = async (query) => {
            try {
                const { count, error } = await query;
                return error ? 0 : (count || 0);
            } catch (_) { return 0; }
        };

        const [students, videos, notes, audio, exams, subscriptions, finalReviews, courses, pendingPaymentRequests] = await Promise.all([
            safeCount(supabase.from('users').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('videos').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('notes').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('audio').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('exams').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('subscriptions').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('final_reviews').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('courses').select('*', { count: 'exact', head: true })),
            safeCount(supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'))
        ]);

        let monthlyRevenue = 0;
        try {
            const { data: payments } = await supabase.from('payments').select('amount, status, created_at').eq('status', 'success');
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            monthlyRevenue = (payments || [])
                .filter(p => p.created_at >= monthStart)
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        } catch (_) { /* ignore */ }

        return {
            students, videos, notes, audio, exams,
            subscriptions, finalReviews, courses,
            monthlyRevenue, pendingPaymentRequests
        };
    },

    // --- Courses ---
    async getCourses(gradeId) {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('grade_id', gradeId)
            .eq('status', 'published')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getUserCoursePurchases(userId) {
        const { data, error } = await supabase
            .from('course_purchases')
            .select('course_id')
            .eq('user_id', userId)
            .eq('status', 'active');
        if (error) throw error;
        return data || [];
    },

    // --- Final Reviews ---
    async getFinalReviews(gradeId = null) {
        let query = supabase.from('final_reviews').select('*');
        if (gradeId) query = query.eq('grade_id', gradeId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getFinalReview(id) {
        const { data, error } = await supabase.from('final_reviews').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async getFinalReviewWithContent(id) {
        const { data: review, error } = await supabase
            .from('final_reviews')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;

        const { data: content } = await supabase
            .from('final_review_content')
            .select('*')
            .eq('final_review_id', id)
            .order('order_num', { ascending: true });

        review.content = content || [];
        return review;
    },

    async createFinalReview(reviewData) {
        const { data, error } = await supabase.from('final_reviews').insert(reviewData).select().single();
        if (error) throw error;
        return data;
    },

    async updateFinalReview(id, reviewData) {
        const { data, error } = await supabase.from('final_reviews').update(reviewData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteFinalReview(id) {
        const { error } = await supabase.from('final_reviews').delete().eq('id', id);
        if (error) throw error;
    },

    async getFinalReviewContent(reviewId) {
        const { data, error } = await supabase
            .from('final_review_content')
            .select('*')
            .eq('final_review_id', reviewId)
            .order('order_num', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async createFinalReviewContent(contentData) {
        const { data, error } = await supabase.from('final_review_content').insert(contentData).select().single();
        if (error) throw error;
        return data;
    },

    async deleteFinalReviewContent(id) {
        const { error } = await supabase.from('final_review_content').delete().eq('id', id);
        if (error) throw error;
    },

    async getFinalReviewPurchase(reviewId, userId) {
        const { data, error } = await supabase
            .from('final_review_purchases')
            .select('*')
            .eq('final_review_id', reviewId)
            .eq('user_id', userId)
            .eq('status', 'completed')
            .limit(1);
        if (error) throw error;
        return data?.[0] || null;
    },

    async hasPurchasedFinalReview(userId, reviewId) {
        const purchase = await this.getFinalReviewPurchase(reviewId, userId);
        if (!purchase) return false;
        
        // Check expiration
        if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
            return false;
        }
        return true;
    },

    async createFinalReviewPurchase(purchaseData) {
        const { data, error } = await supabase.from('final_review_purchases').insert(purchaseData).select().single();
        if (error) throw error;
        return data;
    },

    async updateFinalReviewPurchase(id, updates) {
        const { data, error } = await supabase.from('final_review_purchases').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async getUserFinalReviewPurchases(userId) {
        const { data, error } = await supabase
            .from('final_review_purchases')
            .select('*, final_reviews(*)')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('purchased_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getFinalReviewSales(reviewId = null) {
        let query = supabase.from('final_review_purchases').select('*, final_reviews(title), users(name)');
        if (reviewId) query = query.eq('final_review_id', reviewId);
        const { data, error } = await query.order('purchased_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // --- Projects ---
    async getProjects(gradeId = null, monthId = null) {
        let query = supabase.from('projects').select('*');
        if (gradeId) query = query.eq('grade_id', gradeId);
        if (monthId) query = query.eq('month_id', monthId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getProject(id) {
        const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async createProject(projectData) {
        const { data, error } = await supabase.from('projects').insert(projectData).select().single();
        if (error) throw error;
        return data;
    },

    async updateProject(id, projectData) {
        const { data, error } = await supabase.from('projects').update(projectData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteProject(id) {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
    },

    async getProjectSubmissions(projectId) {
        const { data, error } = await supabase
            .from('project_submissions')
            .select('*, users(name, phone)')
            .eq('project_id', projectId)
            .order('submitted_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async submitProject(submissionData) {
        const { data, error } = await supabase.from('project_submissions').insert(submissionData).select().single();
        if (error) throw error;
        return data;
    },

    async gradeSubmission(id, grade, feedback) {
        const { data, error } = await supabase.from('project_submissions').update({
            grade: grade,
            feedback: feedback,
            graded_at: new Date().toISOString()
        }).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async searchStudents(query) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        return data || [];
    },

    // --- Manual Payment System ---
    async getPaymentSettings() {
        const { data, error } = await supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        return data || {};
    },

    async updatePaymentSettings(updates) {
        const { data, error } = await supabase.from('payment_settings').update(updates).eq('id', 1).select().single();
        if (error) throw error;
        return data;
    },

    async createPaymentRequest(reqData) {
        const { data, error } = await supabase.from('payment_requests').insert(reqData).select().single();
        if (error) throw error;
        return data;
    },

    async getPaymentRequest(id) {
        const { data, error } = await supabase.from('payment_requests').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data;
    },

    async getUserPaymentRequests(userId) {
        const { data, error } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('student_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getAllPaymentRequests(filters = {}) {
        let query = supabase.from('payment_requests').select('*, users:student_id(name, phone, grade_id)');
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.search) {
            query = query.or(`student_name.ilike.%${filters.search}%,student_phone.ilike.%${filters.search}%`);
        }
        if (filters.sort === 'oldest') query = query.order('created_at', { ascending: true });
        else query = query.order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async updatePaymentRequest(id, updates) {
        const { data, error } = await supabase.from('payment_requests').update(updates).eq('id', id).select();
        if (error) throw error;
        return data?.[0] || null;
    },

    async deletePaymentRequest(id) {
        const { error } = await supabase.from('payment_requests').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteUser(id) {
        await supabase.from('subscriptions').delete().eq('user_id', id);
        await supabase.from('payments').delete().eq('user_id', id);
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteSubscription(id) {
        const { error } = await supabase.from('subscriptions').delete().eq('id', id);
        if (error) throw error;
    },

    async deletePayment(id) {
        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteAllPayments() {
        const { error } = await supabase.from('payments').delete().neq('id', 0);
        if (error) throw error;
    },

    async uploadPaymentReceipt(file, userId) {
        const ext = file.name.split('.').pop();
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data, error } = await supabase.storage.from('payment-receipts').upload(path, file, {
            cacheControl: '3600',
            upsert: false
        });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('payment-receipts').getPublicUrl(path);
        return { path, url: publicUrl };
    }
};

window.db = db;
