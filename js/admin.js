// Admin Dashboard Module

function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}

function initAdminNav() {
    document.querySelectorAll('.admin-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                showAdminSection(section, item);
                closeAdminMobileMenu();
            }
        });
    });

    document.querySelectorAll('[data-admin-link]').forEach(link => {
        link.addEventListener('click', (e) => e.stopPropagation());
    });
}

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

onDOMReady(async () => {
    if (!await requireAdmin()) return;

    initAdminNav();

    const isFullAdmin = document.getElementById('admin-dashboard') !== null;

    if (isFullAdmin) {
        const tasks = [
            ['stats', loadDashboardStats],
            ['grades', loadGrades],
            ['filters', loadGradeFilters],
            ['settings', loadSettings]
        ];
        for (const [name, fn] of tasks) {
            try {
                await fn();
            } catch (err) {
                console.error(`Admin init (${name}):`, err);
            }
        }
    }
});

// Load Dashboard Statistics
async function loadDashboardStats() {
    try {
        const stats = await db.getAdminStats();
        const studentsOnly = await supabase.from('users').select('*').neq('division', 'admin');

        document.getElementById('totalStudents').textContent =
            (studentsOnly.data || []).filter(u => u.division !== 'admin').length || stats.students;
        document.getElementById('totalVideos').textContent = stats.videos;
        const notesEl = document.getElementById('totalNotes');
        if (notesEl) notesEl.textContent = stats.notes;
        const audioEl = document.getElementById('totalAudio');
        if (audioEl) audioEl.textContent = stats.audio;
        document.getElementById('totalExams').textContent = stats.exams;
        document.getElementById('totalSubscriptions').textContent = stats.subscriptions;
        document.getElementById('monthlyRevenue').textContent = formatCurrency(stats.monthlyRevenue);
        const finalReviewsEl = document.getElementById('totalFinalReviews');
        if (finalReviewsEl) finalReviewsEl.textContent = stats.finalReviews;
        const coursesEl = document.getElementById('totalCourses');
        if (coursesEl) coursesEl.textContent = stats.courses;
        const pendingReqEl = document.getElementById('totalPendingRequests');
        if (pendingReqEl) pendingReqEl.textContent = stats.pendingPaymentRequests || 0;

        // Load revenue reports
        await loadRevenueReports();

        await loadCharts();
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadRevenueReports() {
    try {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const { data: allPayments } = await supabase
            .from('payments')
            .select('amount, status, created_at, users(name)')
            .order('created_at', { ascending: false });

        if (!allPayments) return;

        const successful = allPayments.filter(p => p.status === 'success');
        const failed = allPayments.filter(p => p.status === 'failed');

        const todayRevenue = successful
            .filter(p => new Date(p.created_at) >= todayStart)
            .reduce((s, p) => s + Number(p.amount || 0), 0);

        const monthRevenue = successful
            .filter(p => new Date(p.created_at) >= monthStart)
            .reduce((s, p) => s + Number(p.amount || 0), 0);

        const todayEl = document.getElementById('todayRevenue');
        if (todayEl) todayEl.textContent = formatCurrency(todayRevenue);

        const monthEl = document.getElementById('monthRevenue');
        if (monthEl) monthEl.textContent = formatCurrency(monthRevenue);

        const successEl = document.getElementById('successfulPayments');
        if (successEl) successEl.textContent = successful.length;

        const failEl = document.getElementById('failedPayments');
        if (failEl) failEl.textContent = failed.length;

        // Latest payments list
        const latestEl = document.getElementById('latestPaymentsList');
        if (latestEl) {
            const latest5 = allPayments.slice(0, 10);
            latestEl.innerHTML = latest5.map(p => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">
                    <div>
                        <strong>${p.users?.name || 'طالب'}</strong>
                        <span style="font-size:13px;color:var(--gray-500);margin-right:8px">${new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div>
                        <span style="font-weight:700;margin-left:8px">${formatCurrency(p.amount)}</span>
                        <span style="font-size:13px;padding:2px 8px;border-radius:4px;background:${p.status === 'success' ? '#d1fae5' : '#fee2e2'};color:${p.status === 'success' ? '#065f46' : '#991b1b'}">${p.status === 'success' ? 'ناجح' : p.status === 'pending' ? 'معلق' : 'فاشل'}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading revenue reports:', error);
    }
}

let chartInstances = [];

function destroyCharts() {
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];
}

// Load Charts
async function loadCharts() {
    try {
        destroyCharts();
        const [{ data: users }, { data: grades }, { data: videos }, { data: subs }, { data: payments }] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('grades').select('*'),
            supabase.from('videos').select('grade_id'),
            supabase.from('subscriptions').select('status, end_date'),
            supabase.from('payments').select('amount, status, created_at').eq('status', 'success')
        ]);

        const students = (users || []).filter(u => u.division !== 'admin');
        const studentByGrade = {};
        const videoByGrade = {};
        (grades || []).forEach(g => {
            studentByGrade[g.name] = students.filter(u => u.grade_id === g.id).length;
            videoByGrade[g.name] = (videos || []).filter(v => v.grade_id === g.id).length;
        });

        const now = new Date();
        const activeSubs = (subs || []).filter(s => s.status === 'active' && new Date(s.end_date) > now).length;
        const expiredSubs = (subs || []).length - activeSubs;

        const studentsChartEl = document.getElementById('studentsByGradeChart');
        if (studentsChartEl) {
            chartInstances.push(new Chart(studentsChartEl, {
                type: 'bar',
                data: {
                    labels: Object.keys(studentByGrade),
                    datasets: [{ label: 'طلاب', data: Object.values(studentByGrade), backgroundColor: 'rgba(16, 185, 129, 0.8)' }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            }));
        }

        const vCtx = document.getElementById('videosByGradeChart');
        if (vCtx) {
            chartInstances.push(new Chart(vCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(videoByGrade),
                    datasets: [{ data: Object.values(videoByGrade), backgroundColor: ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899'] }]
                },
                options: { responsive: true }
            }));
        }

        const sCtx = document.getElementById('subscriptionsChart');
        if (sCtx) {
            chartInstances.push(new Chart(sCtx, {
                type: 'pie',
                data: {
                    labels: ['نشط', 'منتهي/آخر'],
                    datasets: [{ data: [activeSubs, Math.max(expiredSubs, 0)], backgroundColor: ['#4caf50', '#9e9e9e'] }]
                },
                options: { responsive: true }
            }));
        }

        const byMonth = {};
        (payments || []).forEach(p => {
            const d = new Date(p.created_at);
            const key = d.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });
            byMonth[key] = (byMonth[key] || 0) + Number(p.amount || 0);
        });
        const revLabels = Object.keys(byMonth).slice(-6);
        const revData = revLabels.map(k => byMonth[k]);

        const revenueEl = document.getElementById('revenueChart');
        if (revenueEl) {
            chartInstances.push(new Chart(revenueEl, {
                type: 'line',
                data: {
                    labels: revLabels.length ? revLabels : ['لا بيانات'],
                    datasets: [{
                        label: 'ج.م',
                        data: revData.length ? revData : [0],
                        borderColor: 'rgba(33, 150, 243, 1)',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            }));
        }
    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

// Show Admin Section
function showAdminSection(sectionId, navEl) {
    if (!sectionId) return;

    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });

    const target = document.getElementById(`admin-${sectionId}`);
    if (!target) {
        console.warn('Admin section not found:', sectionId);
        return;
    }
    target.classList.add('active');

    document.querySelectorAll('.admin-nav .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    const loaders = {
        dashboard: loadDashboardStats,
        grades: loadGrades,
        months: loadMonths,
        projects: loadProjects,
        videos: loadVideos,
        products: loadProducts,
        audio: loadAudio,
        exams: loadExams,
        students: loadStudents,
        subscriptions: loadSubscriptions,
        payments: loadPayments,
        'final-reviews': loadFinalReviews,
        courses: loadCourses,
        settings: loadSettings,
        'payment-requests': loadPaymentRequests,
        'payment-settings': loadPaymentSettings
    };

    const loader = loaders[sectionId];
    if (loader) {
        loader().catch(err => {
            console.error(`Error loading section ${sectionId}:`, err);
            showAlert('حدث خطأ أثناء تحميل هذا القسم', 'error');
        });
    }
}

// Load Grades
async function loadGrades() {
    try {
        const { data: grades, error } = await supabase
            .from('grades')
            .select('*')
            .order('order', { ascending: true });

        if (error) throw error;

        const tbody = document.getElementById('gradesTableBody');

        tbody.innerHTML = (grades || []).map(grade => `
            <tr>
                <td>${grade.name}</td>
                <td>${grade.order ?? grade.order_num ?? '-'}</td>
                <td>${grade.visible ? 'ظاهر' : 'مخفي'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="editGrade(${grade.id})">تعديل</button>
                        <button class="action-btn delete" onclick="deleteGrade(${grade.id})">حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

// Load Months
async function loadMonths() {
    try {
        const gradeFilter = document.getElementById('gradeFilter').value;
        let months;

        if (gradeFilter) {
            const { data, error } = await supabase
                .from('months')
                .select('*')
                .eq('grade_id', parseInt(gradeFilter))
                .order('id', { ascending: true });
            if (error) throw error;
            months = data;
        } else {
            const { data, error } = await supabase
                .from('months')
                .select('*')
                .order('id', { ascending: true });
            if (error) throw error;
            months = data;
        }

        const { data: grades, error: gradesError } = await supabase
            .from('grades')
            .select('*');

        if (gradesError) throw gradesError;

        const tbody = document.getElementById('monthsTableBody');

        if (!months || !months.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد شهور</td></tr>';
            return;
        }

        tbody.innerHTML = months.map(month => {
            const grade = grades.find(g => g.id === month.grade_id);
            return `
                <tr>
                    <td>${month.name}</td>
                    <td>${grade ? grade.name : '-'}</td>
                    <td>${month.order}</td>
                    <td>${month.visible ? 'ظاهر' : 'مخفي'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editMonth(${month.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteMonth(${month.id})">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading months:', error);
    }
}

// Load Videos
async function loadVideos() {
    try {
        const gradeFilter = document.getElementById('videoGradeFilter').value;
        const monthFilter = document.getElementById('videoMonthFilter').value;

        let query = supabase.from('videos').select('*');

        if (gradeFilter) {
            query = query.eq('grade_id', parseInt(gradeFilter));
        }
        if (monthFilter) {
            query = query.eq('month_id', parseInt(monthFilter));
        }

        const { data: videos, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const { data: grades, error: gradesError } = await supabase.from('grades').select('*');
        const { data: months, error: monthsError } = await supabase.from('months').select('*');

        if (gradesError || monthsError) throw gradesError || monthsError;

        const tbody = document.getElementById('videosTableBody');

        if (!videos || !videos.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد فيديوهات</td></tr>';
            return;
        }

        tbody.innerHTML = videos.map(video => {
            const grade = grades.find(g => g.id === video.grade_id);
            const month = months.find(m => m.id === video.month_id);
            return `
                <tr>
                    <td>${video.title}</td>
                    <td>${grade ? grade.name : '-'}</td>
                    <td>${month ? month.name : '-'}</td>
                    <td>${video.is_free ? 'مجاني' : 'مدفوع'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editVideo(${video.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteVideo(${video.id})">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading videos:', error);
        const tbody = document.getElementById('videosTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">تعذر تحميل الفيديوهات</td></tr>';
    }
}

// Load Products
async function loadProducts() {
    try {
        const gradeFilter = document.getElementById('productGradeFilter').value;
        const monthFilter = document.getElementById('productMonthFilter').value;

        let query = supabase.from('notes').select('*');

        if (gradeFilter) {
            query = query.eq('grade_id', parseInt(gradeFilter));
        }
        if (monthFilter) {
            query = query.eq('month_id', parseInt(monthFilter));
        }

        const { data: products, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const { data: grades, error: gradesError } = await supabase.from('grades').select('*');
        const { data: months, error: monthsError } = await supabase.from('months').select('*');

        if (gradesError || monthsError) throw gradesError || monthsError;

        const tbody = document.getElementById('productsTableBody');

        if (!products || !products.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد مذكرات</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(product => {
            const grade = grades.find(g => g.id === product.grade_id);
            const month = months.find(m => m.id === product.month_id);
            return `
                <tr>
                    <td>${product.title}</td>
                    <td>${grade ? grade.name : '-'}</td>
                    <td>${month ? month.name : '-'}</td>
                    <td>${product.is_free ? 'مجاني' : 'مدفوع'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editProduct(${product.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteProduct(${product.id})">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Load Audio
async function loadAudio() {
    try {
        const gradeFilter = document.getElementById('audioGradeFilter').value;
        const monthFilter = document.getElementById('audioMonthFilter').value;

        let query = supabase.from('audio').select('*');

        if (gradeFilter) {
            query = query.eq('grade_id', parseInt(gradeFilter));
        }
        if (monthFilter) {
            query = query.eq('month_id', parseInt(monthFilter));
        }

        const { data: audioFiles, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const { data: grades, error: gradesError } = await supabase.from('grades').select('*');
        const { data: months, error: monthsError } = await supabase.from('months').select('*');

        if (gradesError || monthsError) throw gradesError || monthsError;

        const tbody = document.getElementById('audioTableBody');

        if (!audioFiles || !audioFiles.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد صوتيات</td></tr>';
            return;
        }

        tbody.innerHTML = audioFiles.map(audio => {
            const grade = grades.find(g => g.id === audio.grade_id);
            const month = months.find(m => m.id === audio.month_id);
            return `
                <tr>
                    <td>${audio.title}</td>
                    <td>${grade ? grade.name : '-'}</td>
                    <td>${month ? month.name : '-'}</td>
                    <td>${audio.is_free ? 'مجاني' : 'مدفوع'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editAudio(${audio.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteAudio(${audio.id})">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading audio:', error);
    }
}

// Load Exams
async function loadExams() {
    try {
        const gradeFilter = document.getElementById('examGradeFilter').value;
        const monthFilter = document.getElementById('examMonthFilter').value;

        let query = supabase.from('exams').select('*');

        if (gradeFilter) {
            query = query.eq('grade_id', parseInt(gradeFilter));
        }
        if (monthFilter) {
            query = query.eq('month_id', parseInt(monthFilter));
        }

        const { data: exams, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const { data: grades, error: gradesError } = await supabase.from('grades').select('*');
        const { data: months, error: monthsError } = await supabase.from('months').select('*');

        if (gradesError || monthsError) throw gradesError || monthsError;

        const tbody = document.getElementById('examsTableBody');

        if (!exams || !exams.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد امتحانات</td></tr>';
            return;
        }

        tbody.innerHTML = exams.map(exam => {
            const grade = grades.find(g => g.id === exam.grade_id);
            const month = months.find(m => m.id === exam.month_id);
            return `
                <tr>
                    <td>${exam.title}</td>
                    <td>${grade ? grade.name : '-'}</td>
                    <td>${month ? month.name : '-'}</td>
                    <td>${exam.duration} دقيقة</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editExam(${exam.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteExam(${exam.id})">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading exams:', error);
    }
}

// Load Students

// Load Subscriptions
async function loadSubscriptions() {
    try {
        let result = await supabase
            .from('subscriptions')
            .select('*, users(name), months(name)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (result.error) {
            result = await supabase
                .from('subscriptions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
        }

        const tbody = document.getElementById('subscriptionsTableBody');
        if (result.error) throw result.error;

        const rows = result.data || [];
        const users = rows.length && !rows[0].users
            ? (await supabase.from('users').select('id, name')).data || []
            : [];
        const months = rows.length && !rows[0].months
            ? (await supabase.from('months').select('id, name')).data || []
            : [];

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد اشتراكات</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(sub => {
            const userName = sub.users?.name || users.find(u => u.id === sub.user_id)?.name || '-';
            const monthName = sub.months?.name || months.find(m => m.id === sub.month_id)?.name || '-';
            return `
            <tr>
                <td>${userName}</td>
                <td>${monthName}</td>
                <td>${formatDate(sub.start_date)}</td>
                <td>${formatDate(sub.end_date)}</td>
                <td>${sub.status}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="viewSubscription(${sub.id})">عرض</button>
                        <button class="action-btn delete" onclick="deleteSubscription(${sub.id})">حذف</button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        const tbody = document.getElementById('subscriptionsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">تعذر تحميل الاشتراكات</td></tr>';
    }
}

// Load Payments
async function loadPayments() {
    try {
        let result = await supabase
            .from('payments')
            .select('*, users(name)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (result.error) {
            result = await supabase
                .from('payments')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
        }

        const tbody = document.getElementById('paymentsTableBody');
        if (result.error) throw result.error;

        const rows = result.data || [];
        const users = rows.length && !rows[0].users
            ? (await supabase.from('users').select('id, name')).data || []
            : [];

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد مدفوعات</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(payment => {
            const userName = payment.users?.name || users.find(u => u.id === payment.user_id)?.name || '-';
            return `
            <tr>
                <td>${userName}</td>
                <td>${formatCurrency(payment.amount)}</td>
                <td>${payment.months}</td>
                <td>${payment.payment_method || '-'}</td>
                <td>${payment.status}</td>
                <td>${formatDate(payment.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn delete" onclick="deletePayment(${payment.id})">حذف</button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        // Store rows for CSV export
        window._paymentsData = rows;
        window._paymentsUsers = users;
        
    } catch (error) {
        console.error('Error loading payments:', error);
        const tbody = document.getElementById('paymentsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">تعذر تحميل المدفوعات</td></tr>';
    }
}

function exportPaymentsCSV() {
    const rows = window._paymentsData || [];
    const users = window._paymentsUsers || [];
    if (!rows.length) { showAlert('لا توجد مدفوعات للتصدير', 'error'); return; }

    const header = 'الطالب,المبلغ,الشهور,طريقة الدفع,الحالة,التاريخ\n';
    const csv = rows.map(p => {
        const name = p.users?.name || users.find(u => u.id === p.user_id)?.name || '-';
        return `${name},${p.amount},${p.months},${p.payment_method || '-'},${p.status},${new Date(p.created_at).toLocaleDateString('ar-EG')}`;
    }).join('\n');

    const blob = new Blob(['\uFEFF' + header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('✅ تم تصدير المدفوعات', 'success');
}

function exportPaymentsExcel() {
    const rows = window._paymentsData || [];
    const users = window._paymentsUsers || [];
    if (!rows.length) { showAlert('لا توجد مدفوعات للتصدير', 'error'); return; }

    // Generate HTML table for Excel
    let html = '<html><meta charset="utf-8"><table>';
    html += '<tr><th>الطالب</th><th>المبلغ</th><th>الشهور</th><th>طريقة الدفع</th><th>الحالة</th><th>التاريخ</th></tr>';
    rows.forEach(p => {
        const name = p.users?.name || users.find(u => u.id === p.user_id)?.name || '-';
        html += `<tr><td>${name}</td><td>${p.amount}</td><td>${p.months}</td><td>${p.payment_method || '-'}</td><td>${p.status}</td><td>${new Date(p.created_at).toLocaleDateString('ar-EG')}</td></tr>`;
    });
    html += '</table></html>';

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0,10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('✅ تم تصدير المدفوعات', 'success');
}

// Load Final Reviews
async function loadFinalReviews() {
    try {
        const gradeFilter = document.getElementById('finalReviewGradeFilter').value;

        let reviews;
        if (gradeFilter) {
            reviews = await db.getFinalReviews(parseInt(gradeFilter));
        } else {
            reviews = await db.getFinalReviews();
        }

        const { data: grades, error: gradesError } = await supabase.from('grades').select('*');
        if (gradesError) throw gradesError;

        const tbody = document.getElementById('finalReviewsTableBody');

        if (!reviews || !reviews.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد مراجعات نهائية</td></tr>';
            return;
        }

        // Fetch content counts for all reviews in parallel
        const contentCounts = await Promise.all(
            reviews.map(review => db.getFinalReviewContent(review.id))
        );

        tbody.innerHTML = reviews.map((review, index) => {
            const grade = grades.find(g => g.id === review.grade_id);
            const contentCount = contentCounts[index];
            const contentSummary = [];
            if (contentCount.some(c => c.content_type === 'video')) contentSummary.push('فيديو');
            if (contentCount.some(c => c.content_type === 'pdf')) contentSummary.push('PDF');
            if (contentCount.some(c => c.content_type === 'audio')) contentSummary.push('صوتي');
            if (contentCount.some(c => c.content_type === 'exam')) contentSummary.push('امتحان');

            return `
                <tr>
                    <td>${review.title}</td>
                    <td>${grade ? grade.name : '-'}</td>
                    <td>${review.is_free ? 'مجاني' : formatCurrency(review.price)}</td>
                    <td>${contentSummary.join(', ') || '-'}</td>
                    <td>${review.is_active ? 'نشط' : 'معطل'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editFinalReview(${review.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteFinalReview(${review.id})">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading final reviews:', error);
        const tbody = document.getElementById('finalReviewsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">تعذر تحميل المراجعات النهائية</td></tr>';
    }
}

// Load Grade Filters
async function loadGradeFilters() {
    try {
        const { data: grades, error } = await supabase.from('grades').select('*').order('order', { ascending: true });

        if (error) throw error;

        const options = '<option value="">كل الصفوف</option>' +
            grades.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

        const filterIds = ['gradeFilter', 'videoGradeFilter', 'productGradeFilter', 'audioGradeFilter', 'examGradeFilter', 'finalReviewGradeFilter', 'studentGradeFilter', 'projectGradeFilter'];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = options;
        });

        bindMonthFilters();

    } catch (error) {
        console.error('Error loading grade filters:', error);
    }
}

async function populateMonthFilter(selectId, gradeId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const base = '<option value="">كل الشهور</option>';
    if (!gradeId) {
        sel.innerHTML = base;
        return;
    }
    const months = await db.getMonths(parseInt(gradeId, 10));
    sel.innerHTML = base + months.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

function bindMonthFilters() {
    const pairs = [
        ['videoGradeFilter', 'videoMonthFilter', loadVideos],
        ['productGradeFilter', 'productMonthFilter', loadProducts],
        ['audioGradeFilter', 'audioMonthFilter', loadAudio],
        ['examGradeFilter', 'examMonthFilter', loadExams],
        ['projectGradeFilter', 'projectMonthFilter', loadProjects]
    ];
    pairs.forEach(([gradeId, monthId, loader]) => {
        const gradeSel = document.getElementById(gradeId);
        if (!gradeSel) return;
        gradeSel.addEventListener('change', async () => {
            await populateMonthFilter(monthId, gradeSel.value);
            loader();
        });
        const monthSel = document.getElementById(monthId);
        if (monthSel) {
            monthSel.removeAttribute('onchange');
            monthSel.addEventListener('change', () => loader());
        }
    });
}

// Load Settings
function togglePasswordVisibility() {
    const input = document.getElementById('teacherPassword');
    const btn = document.querySelector('.password-toggle');
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

async function loadSettings() {
    try {
        const settings = await supabase
            .from('teacher_settings')
            .select('*');
        
        if (settings.error) throw settings.error;
        
        const settingsMap = {};
        settings.data.forEach(s => {
            settingsMap[s.setting_key] = s.setting_value;
        });
        
        document.getElementById('teacherPhone').value = settingsMap.teacher_phone || '';
        document.getElementById('teacherPassword').value = settingsMap.teacher_password || '';
        document.getElementById('subscriptionDuration').value = settingsMap.subscription_duration || CONFIG.PLATFORM.SUBSCRIPTION_DURATION;
        document.getElementById('termSubscriptionDuration').value = settingsMap.term_subscription_duration || '365';
        
        // Grade 6 special monthly price
        const g6Price = document.getElementById('grade6MonthlyPrice');
        if (g6Price) g6Price.value = settingsMap['grade6_monthly_price'] || '';
        
        const grades = await db.getAllGrades();
        if (!grades) return;
        
        // Monthly prices per grade
        const monthlyContainer = document.getElementById('gradesMonthlyContainer');
        if (monthlyContainer) {
            monthlyContainer.innerHTML = grades.map(g => {
                const mp = settingsMap['monthly_price_grade_' + g.id] || '';
                return `
                    <div class="settings-price-card">
                        <span class="grade-label">${g.name}</span>
                        <input type="number" class="price-input" id="monthly_grade_${g.id}" value="${mp}" placeholder="0">
                        <span class="price-suffix">ج.م / شهرياً</span>
                    </div>
                `;
            }).join('');
        }
        
        // Term prices per grade (intensive subscriptions)
        const termContainer = document.getElementById('gradesTermContainer');
        if (termContainer) {
            termContainer.innerHTML = grades.map(g => {
                const t1 = settingsMap['term1_price_grade_' + g.id] || '';
                const t2 = settingsMap['term2_price_grade_' + g.id] || '';
                return `
                    <div class="grade-term-card">
                        <div class="grade-title">${g.name}</div>
                        <div class="grade-term-row">
                            <div class="term-field">
                                <label for="term1_grade_${g.id}">اشتراك الترم الأول (ج.م)</label>
                                <input type="number" id="term1_grade_${g.id}" value="${t1}" placeholder="0">
                            </div>
                            <div class="term-field">
                                <label for="term2_grade_${g.id}">اشتراك الترم الثاني (ج.م)</label>
                                <input type="number" id="term2_grade_${g.id}" value="${t2}" placeholder="0">
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save Settings
async function saveSettings(event) {
    event.preventDefault();
    
    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;
    btn.classList.add('loading');
    
    try {
        const settings = [
            { setting_key: 'teacher_phone', setting_value: document.getElementById('teacherPhone').value },
            { setting_key: 'teacher_password', setting_value: document.getElementById('teacherPassword').value },
            { setting_key: 'subscription_duration', setting_value: document.getElementById('subscriptionDuration').value },
            { setting_key: 'term_subscription_duration', setting_value: document.getElementById('termSubscriptionDuration').value || '365' }
        ];

        // Grade 6 special monthly price
        const g6PriceInput = document.getElementById('grade6MonthlyPrice');
        if (g6PriceInput) {
            settings.push({ setting_key: 'grade6_monthly_price', setting_value: g6PriceInput.value || '0' });
        }

        const grades = await db.getAllGrades();
        if (grades) {
            grades.forEach(g => {
                const mp = document.getElementById('monthly_grade_' + g.id);
                if (mp) settings.push({ setting_key: 'monthly_price_grade_' + g.id, setting_value: mp.value || '0' });
                
                const t1 = document.getElementById('term1_grade_' + g.id);
                const t2 = document.getElementById('term2_grade_' + g.id);
                if (t1) settings.push({ setting_key: 'term1_price_grade_' + g.id, setting_value: t1.value || '0' });
                if (t2) settings.push({ setting_key: 'term2_price_grade_' + g.id, setting_value: t2.value || '0' });
            });
        }
        
        // Save each setting individually
        for (const setting of settings) {
            const { data: existing } = await supabase
                .from('teacher_settings')
                .select('id')
                .eq('setting_key', setting.setting_key)
                .maybeSingle();
            
            if (existing && existing.id) {
                const { error } = await supabase
                    .from('teacher_settings')
                    .update({ setting_value: setting.setting_value })
                    .eq('id', existing.id);
                
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('teacher_settings')
                    .insert([setting]);
                
                if (error && error.code !== 'PGRST116') throw error;
            }
        }
        
        showAlert('✅ تم حفظ الإعدادات بنجاح', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showAlert('❌ حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

// Modal Functions
function showGradeModal() {
    document.getElementById('gradeModal').classList.add('active');
    document.getElementById('gradeId').value = '';
    document.getElementById('gradeName').value = '';
    document.getElementById('gradeOrder').value = '';
    document.getElementById('gradeVisible').checked = true;
}

function showMonthModal() {
    document.getElementById('monthModal').classList.add('active');
    loadGradeSelect('monthGrade');
}

function showVideoModal() {
    document.getElementById('videoModal').classList.add('active');
    loadGradeSelect('videoGrade');
}

function showProductModal() {
    document.getElementById('productModal').classList.add('active');
    loadGradeSelect('productGrade');
}

function showAudioModal() {
    document.getElementById('audioModal').classList.add('active');
    loadGradeSelect('audioGrade');
}

function showExamModal() {
    document.getElementById('examModal').classList.add('active');
    loadGradeSelect('examGrade');
}

async function loadGradeSelect(selectId) {
    try {
        const grades = await db.getAllGrades();
        const select = document.getElementById(selectId);
        select.innerHTML = grades.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

async function loadVideoMonths() {
    const gradeId = document.getElementById('videoGrade').value;
    if (gradeId) {
        const months = await db.getAllMonths(parseInt(gradeId));
        const select = document.getElementById('videoMonth');
        select.innerHTML = months.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
}

async function loadProductMonths() {
    const gradeId = document.getElementById('productGrade').value;
    if (gradeId) {
        const months = await db.getAllMonths(parseInt(gradeId));
        const select = document.getElementById('productMonth');
        select.innerHTML = months.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
}

async function loadAudioMonths() {
    const gradeId = document.getElementById('audioGrade').value;
    if (gradeId) {
        const months = await db.getAllMonths(parseInt(gradeId));
        const select = document.getElementById('audioMonth');
        select.innerHTML = months.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
}

async function loadExamMonths() {
    const gradeId = document.getElementById('examGrade').value;
    if (gradeId) {
        const months = await db.getAllMonths(parseInt(gradeId));
        const select = document.getElementById('examMonth');
        select.innerHTML = months.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
}

// Form Handlers
async function handleGradeSubmit(event) {
    event.preventDefault();
    
    const gradeData = {
        name: document.getElementById('gradeName').value,
        order_num: parseInt(document.getElementById('gradeOrder').value),
        visible: document.getElementById('gradeVisible').checked
    };
    
    try {
        const gradeId = document.getElementById('gradeId').value;
        if (gradeId) {
            await db.updateGrade(parseInt(gradeId), gradeData);
        } else {
            await db.createGrade(gradeData);
        }
        
        closeModal('gradeModal');
        loadGrades();
        showAlert('تم الحفظ بنجاح', 'success');
        
    } catch (error) {
        console.error('Error saving grade:', error);
        showAlert('حدث خطأ أثناء الحفظ', 'error');
    }
}

async function handleMonthSubmit(event) {
    event.preventDefault();
    
    const monthData = {
        grade_id: parseInt(document.getElementById('monthGrade').value),
        name: document.getElementById('monthName').value,
        order_num: parseInt(document.getElementById('monthOrder').value),
        visible: document.getElementById('monthVisible').checked
    };
    
    try {
        const monthId = document.getElementById('monthId').value;
        if (monthId) {
            await db.updateMonth(parseInt(monthId), monthData);
        } else {
            await db.createMonth(monthData);
        }
        
        closeModal('monthModal');
        loadMonths();
        showAlert('تم الحفظ بنجاح', 'success');
        
    } catch (error) {
        console.error('Error saving month:', error);
        showAlert('حدث خطأ أثناء الحفظ', 'error');
    }
}

async function handleVideoSubmit(event) {
    event.preventDefault();
    
    const videoData = {
        grade_id: parseInt(document.getElementById('videoGrade').value),
        month_id: parseInt(document.getElementById('videoMonth').value),
        title: document.getElementById('videoTitle').value,
        video_url: document.getElementById('videoUrl').value,
        thumbnail: document.getElementById('videoThumbnail').value,
        is_free: document.getElementById('videoFree').checked
    };
    
    try {
        const videoId = document.getElementById('videoId').value;
        if (videoId) {
            await db.updateVideo(parseInt(videoId), videoData);
        } else {
            await db.createVideo(videoData);
        }
        
        closeModal('videoModal');
        loadVideos();
        showAlert('تم الحفظ بنجاح', 'success');
        
    } catch (error) {
        console.error('Error saving video:', error);
        showAlert('حدث خطأ أثناء الحفظ', 'error');
    }
}

async function handleProductSubmit(event) {
    event.preventDefault();
    
    const productData = {
        grade_id: parseInt(document.getElementById('productGrade').value),
        month_id: parseInt(document.getElementById('productMonth').value),
        title: document.getElementById('productTitle').value,
        file_url: document.getElementById('productFile').value,
        is_free: document.getElementById('productFree').checked
    };
    
    try {
        const productId = document.getElementById('productId').value;
        if (productId) {
            await db.updateProduct(parseInt(productId), productData);
        } else {
            await db.createProduct(productData);
        }
        
        closeModal('productModal');
        loadProducts();
        showAlert('تم الحفظ بنجاح', 'success');
        
    } catch (error) {
        console.error('Error saving product:', error);
        showAlert('حدث خطأ أثناء الحفظ', 'error');
    }
}

async function handleAudioSubmit(event) {
    event.preventDefault();
    
    const audioData = {
        grade_id: parseInt(document.getElementById('audioGrade').value),
        month_id: parseInt(document.getElementById('audioMonth').value),
        title: document.getElementById('audioTitle').value,
        audio_url: document.getElementById('audioFile').value,
        is_free: document.getElementById('audioFree').checked
    };
    
    try {
        const audioId = document.getElementById('audioId').value;
        if (audioId) {
            await db.updateAudio(parseInt(audioId), audioData);
        } else {
            await db.createAudio(audioData);
        }
        
        closeModal('audioModal');
        loadAudio();
        showAlert('تم الحفظ بنجاح', 'success');
        
    } catch (error) {
        console.error('Error saving audio:', error);
        showAlert('حدث خطأ أثناء الحفظ', 'error');
    }
}

async function handleExamSubmit(event) {
    event.preventDefault();
    
    const examData = {
        grade_id: parseInt(document.getElementById('examGrade').value),
        month_id: parseInt(document.getElementById('examMonth').value),
        title: document.getElementById('examTitle').value,
        duration: parseInt(document.getElementById('examDuration').value),
        is_free: document.getElementById('examFree').checked
    };
    
    try {
        const examId = document.getElementById('examId').value;
        if (examId) {
            await db.updateExam(parseInt(examId), examData);
        } else {
            await db.createExam(examData);
        }
        
        closeModal('examModal');
        loadExams();
        showAlert('تم الحفظ بنجاح', 'success');
        
    } catch (error) {
        console.error('Error saving exam:', error);
        showAlert('حدث خطأ أثناء الحفظ', 'error');
    }
}

// Edit Functions
async function editGrade(gradeId) {
    try {
        const grades = await db.getAllGrades();
        const grade = grades.find(g => g.id === gradeId);
        
        document.getElementById('gradeId').value = grade.id;
        document.getElementById('gradeName').value = grade.name;
        document.getElementById('gradeOrder').value = grade.order ?? grade.order_num ?? '';
        document.getElementById('gradeVisible').checked = grade.visible;
        
        document.getElementById('gradeModal').classList.add('active');
        
    } catch (error) {
        console.error('Error editing grade:', error);
    }
}

async function deleteGrade(gradeId) {
    if (confirm('هل أنت متأكد من حذف هذا الصف؟')) {
        try {
            await db.deleteGrade(gradeId);
            loadGrades();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting grade:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

async function deleteMonth(monthId) {
    if (confirm('هل أنت متأكد من حذف هذا الشهر؟')) {
        try {
            await db.deleteMonth(monthId);
            loadMonths();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting month:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

async function deleteVideo(videoId) {
    if (confirm('هل أنت متأكد من حذف هذا الفيديو؟')) {
        try {
            await db.deleteVideo(videoId);
            loadVideos();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting video:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

async function deleteProduct(productId) {
    if (confirm('هل أنت متأكد من حذف هذه المذكرة؟')) {
        try {
            await db.deleteProduct(productId);
            loadProducts();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting product:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

async function deleteAudio(audioId) {
    if (confirm('هل أنت متأكد من حذف هذا الصوتي؟')) {
        try {
            await db.deleteAudio(audioId);
            loadAudio();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting audio:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

async function deleteExam(examId) {
    if (confirm('هل أنت متأكد من حذف هذا الامتحان؟')) {
        try {
            await supabase.from('exams').delete().eq('id', examId);
            loadExams();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting exam:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

async function deleteFinalReview(reviewId) {
    if (confirm('هل أنت متأكد من حذف هذه المراجعة النهائية؟ سيتم حذف جميع المحتويات المرتبطة بها.')) {
        try {
            await db.deleteFinalReview(reviewId);
            loadFinalReviews();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting final review:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

function editFinalReview(reviewId) {
    window.location.href = `admin-add-final-review.html?edit=${reviewId}`;
}

function viewStudent(userId) {
    showStudentDetail(userId);
}

function viewSubscription(subscriptionId) {
    showAlert('عرض تفاصيل الاشتراك', 'info');
}

async function deleteStudent(userId, userName) {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${userName}"؟\nسيتم حذف جميع اشتراكاته ومدفوعاته أيضاً.`)) return;
    try {
        await db.deleteUser(userId);
        showAlert('تم حذف الطالب وجميع بياناته', 'success');
        loadStudents();
    } catch (e) {
        showAlert('خطأ في حذف الطالب: ' + e.message, 'error');
    }
}

async function deleteSubscription(subId) {
    if (!confirm('هل أنت متأكد من حذف هذا الاشتراك؟')) return;
    try {
        await db.deleteSubscription(subId);
        showAlert('تم حذف الاشتراك', 'success');
        loadSubscriptions();
    } catch (e) {
        showAlert('خطأ في حذف الاشتراك: ' + e.message, 'error');
    }
}

async function deletePayment(paymentId) {
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;
    try {
        await db.deletePayment(paymentId);
        showAlert('تم حذف الدفعة', 'success');
        loadPayments();
    } catch (e) {
        showAlert('خطأ في حذف الدفعة: ' + e.message, 'error');
    }
}

async function deleteAllPayments() {
    if (!confirm('هل أنت متأكد من حذف جميع المدفوعات؟\nلا يمكن التراجع عن هذا الإجراء.')) return;
    try {
        await db.deleteAllPayments();
        showAlert('تم حذف جميع المدفوعات', 'success');
        loadPayments();
    } catch (e) {
        showAlert('خطأ في حذف المدفوعات: ' + e.message, 'error');
    }
}

// --- Projects CRUD ---

async function loadProjects() {
    try {
        const gradeFilter = document.getElementById('projectGradeFilter')?.value;
        const monthFilter = document.getElementById('projectMonthFilter')?.value;

        let query = supabase.from('projects').select('*');

        if (gradeFilter) query = query.eq('grade_id', parseInt(gradeFilter));
        if (monthFilter) query = query.eq('month_id', parseInt(monthFilter));

        const { data: projects, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        const { data: grades } = await supabase.from('grades').select('*');
        const { data: months } = await supabase.from('months').select('*');

        const tbody = document.getElementById('projectsTableBody');
        if (!tbody) return;

        if (!projects || !projects.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد مشاريع</td></tr>';
            return;
        }

        tbody.innerHTML = await Promise.all(projects.map(async project => {
            const grade = grades?.find(g => g.id === project.grade_id);
            const month = months?.find(m => m.id === project.month_id);
            const subs = await db.getProjectSubmissions(project.id);
            const subCount = subs.length;
            return `
                <tr>
                    <td>${project.title}</td>
                    <td>${grade ? grade.name : '-'}</td>
                    <td>${month ? month.name : '-'}</td>
                    <td><button class="action-btn edit" onclick="viewSubmissions(${project.id}, '${project.title.replace(/'/g, '')}')">${subCount} تسليم</button></td>
                    <td>${new Date(project.deadline) > new Date() ? 'مفتوح' : 'مغلق'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editProject(${project.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteProject(${project.id})">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        })).then(rows => rows.join(''));

    } catch (error) {
        console.error('Error loading projects:', error);
        const tbody = document.getElementById('projectsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">تعذر تحميل المشاريع</td></tr>';
    }
}

function showProjectModal() {
    document.getElementById('projectModal').classList.add('active');
    loadGradeSelect('projectGrade');
}

async function loadProjectMonths() {
    const gradeId = document.getElementById('projectGrade').value;
    if (gradeId) {
        const months = await db.getAllMonths(parseInt(gradeId));
        const select = document.getElementById('projectMonth');
        select.innerHTML = months.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
}

async function handleProjectSubmit(event) {
    event.preventDefault();

    const projectData = {
        grade_id: parseInt(document.getElementById('projectGrade').value),
        month_id: parseInt(document.getElementById('projectMonth').value),
        title: document.getElementById('projectTitle').value,
        description: document.getElementById('projectDescription').value,
        deadline: document.getElementById('projectDeadline').value,
        max_grade: parseInt(document.getElementById('projectMaxGrade').value) || 20
    };

    try {
        const projectId = document.getElementById('projectId').value;
        if (projectId) {
            await db.updateProject(parseInt(projectId), projectData);
        } else {
            await db.createProject(projectData);
        }

        closeModal('projectModal');
        loadProjects();
        showAlert('تم حفظ المشروع بنجاح', 'success');
    } catch (error) {
        console.error('Error saving project:', error);
        showAlert('حدث خطأ أثناء حفظ المشروع', 'error');
    }
}

async function editProject(projectId) {
    try {
        const project = await db.getProject(projectId);
        if (!project) return;

        document.getElementById('projectId').value = project.id;
        document.getElementById('projectTitle').value = project.title;
        document.getElementById('projectDescription').value = project.description || '';
        document.getElementById('projectDeadline').value = project.deadline ? project.deadline.split('T')[0] : '';
        document.getElementById('projectMaxGrade').value = project.max_grade || 20;

        const gradeSelect = document.getElementById('projectGrade');
        const grades = await db.getAllGrades();
        gradeSelect.innerHTML = grades.map(g => `<option value="${g.id}" ${g.id === project.grade_id ? 'selected' : ''}>${g.name}</option>`).join('');

        await loadProjectMonths();
        document.getElementById('projectMonth').value = project.month_id || '';

        document.getElementById('projectModal').classList.add('active');
    } catch (error) {
        console.error('Error editing project:', error);
    }
}

async function deleteProject(projectId) {
    if (confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
        try {
            await db.deleteProject(projectId);
            loadProjects();
            showAlert('تم الحذف بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting project:', error);
            showAlert('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

async function viewSubmissions(projectId, projectTitle) {
    try {
        document.getElementById('submissionsModalTitle').textContent = `تسليمات: ${projectTitle}`;
        const modal = document.getElementById('submissionsModal');
        modal.dataset.projectId = projectId;
        modal.classList.add('active');

        const container = document.getElementById('submissionsContainer');
        container.innerHTML = '<div class="spinner"></div>';

        const submissions = await db.getProjectSubmissions(projectId);

        if (!submissions.length) {
            container.innerHTML = '<p class="text-center" style="padding:40px;color:var(--gray-500)">لا توجد تسليمات بعد</p>';
            return;
        }

        container.innerHTML = submissions.map(sub => {
            const maxGrade = sub.max_grade || 20;
            return `
                <div class="sub-item" style="margin-bottom:12px;padding:20px;background:var(--gray-50);border-radius:12px;border:1px solid var(--gray-200)">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
                        <div>
                            <strong>${sub.users?.name || 'طالب'}</strong>
                            <span style="color:var(--gray-500);font-size:13px;margin-right:12px">${sub.users?.phone || ''}</span>
                        </div>
                        <span style="font-size:13px;color:var(--gray-500)">${formatDate(sub.submitted_at)}</span>
                    </div>
                    ${sub.file_url ? `<a href="${sub.file_url}" target="_blank" class="btn btn-outline btn-sm" style="margin-bottom:12px">عرض الملف</a>` : ''}
                    ${sub.notes ? `<p style="font-size:14px;color:var(--gray-600);margin-bottom:12px;padding:12px;background:var(--white);border-radius:8px">${sub.notes}</p>` : ''}
                    ${sub.grade !== null && sub.grade !== undefined ? `
                        <div style="padding:12px;background:var(--white);border-radius:8px;border:2px solid var(--primary-color)">
                            <strong>الدرجة: ${sub.grade}/${maxGrade}</strong>
                            ${sub.feedback ? `<p style="margin-top:8px;font-size:14px;color:var(--gray-600)">ملاحظات: ${sub.feedback}</p>` : ''}
                        </div>
                    ` : `
                        <div style="display:flex;gap:12px;flex-wrap:wrap">
                            <input type="number" id="gradeInput_${sub.id}" placeholder="الدرجة" min="0" max="${maxGrade}" style="padding:10px 14px;border:2px solid var(--gray-200);border-radius:8px;font-family:inherit;width:100px">
                            <input type="text" id="feedbackInput_${sub.id}" placeholder="ملاحظات (اختياري)" style="padding:10px 14px;border:2px solid var(--gray-200);border-radius:8px;font-family:inherit;flex:1;min-width:150px">
                            <button class="btn btn-primary btn-sm" onclick="gradeSubmission(${sub.id}, ${maxGrade})">تصحيح</button>
                        </div>
                    `}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

async function gradeSubmission(submissionId, maxGrade) {
    const grade = document.getElementById(`gradeInput_${submissionId}`).value;
    const feedback = document.getElementById(`feedbackInput_${submissionId}`).value;

    if (!grade || grade < 0 || grade > maxGrade) {
        showAlert(`الرجاء إدخال درجة بين 0 و ${maxGrade}`, 'error');
        return;
    }

    try {
        await db.gradeSubmission(submissionId, parseInt(grade), feedback);
        showAlert('تم حفظ التصحيح بنجاح', 'success');
        // Refresh submissions from the same project context
        const projectId = document.querySelector('#submissionsModal.active')?.dataset?.projectId;
        if (projectId) viewSubmissions(projectId, '');
    } catch (error) {
        console.error('Error grading submission:', error);
        showAlert('حدث خطأ أثناء التصحيح', 'error');
    }
}

// --- Improved Students ---

async function loadStudents() {
    try {
        const gradeFilter = document.getElementById('studentGradeFilter')?.value;
        const searchQuery = document.getElementById('studentSearch')?.value?.trim();

        let users;
        if (searchQuery) {
            users = await db.searchStudents(searchQuery);
        } else {
            let query = supabase.from('users').select('*');
            if (gradeFilter) query = query.eq('grade_id', parseInt(gradeFilter));
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            users = data || [];
        }

        const { data: grades } = await supabase.from('grades').select('*');
        const gradeMap = {};
        (grades || []).forEach(g => { gradeMap[g.id] = g; });

        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        if (!users || !users.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا يوجد طلاب</td></tr>';
            return;
        }

        const now = new Date();
        const { data: allSubs } = await supabase.from('subscriptions').select('user_id, end_date, status');
        const subMap = {};
        (allSubs || []).forEach(s => {
            if (!subMap[s.user_id]) subMap[s.user_id] = [];
            subMap[s.user_id].push(s);
        });

        tbody.innerHTML = users.filter(u => u.division !== 'admin').map(user => {
            const grade = gradeMap[user.grade_id];
            const userSubs = subMap[user.id] || [];
            const active = userSubs.filter(s => new Date(s.end_date) > now && s.status === 'active').length;
            const subStatus = active > 0 ? `<span style="color:#4caf50;font-weight:700">نشط (${active})</span>` : `<span style="color:#f44336;font-weight:700">غير مشترك</span>`;
            const safeName = escapeHtml(user.name);
            const safePhone = escapeHtml(user.phone);
            const safeDivision = escapeHtml(user.division || '-');
            const gradeBtn = !user.grade_id ? `<button class="action-btn edit" data-action="assignGrade" data-id="${user.id}">تحديد صف</button>` : '';
            return `
                <tr>
                    <td>${safeName}</td>
                    <td dir="ltr" style="text-align:right">${safePhone}</td>
                    <td>${grade?.name || '-'}</td>
                    <td>${safeDivision}</td>
                    <td>${subStatus}</td>
                    <td>${formatDate(user.created_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" data-action="viewStudent" data-id="${user.id}">عرض</button>
                            ${gradeBtn}
                            <button class="action-btn delete" data-action="deleteStudent" data-id="${user.id}" data-name="${safeName}">حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        tbody._listener = tbody._listener || (tbody.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'viewStudent') viewStudent(id);
            else if (action === 'deleteStudent') deleteStudent(id, btn.dataset.name);
            else if (action === 'assignGrade') assignGrade(id);
        }));

    } catch (error) {
        console.error('Error loading students:', error);
        const tbody = document.getElementById('studentsTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">تعذر تحميل الطلاب</td></tr>';
    }
}

let searchTimeout;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadStudents(), 400);
}

async function showStudentDetail(userId) {
    const modal = document.getElementById('studentDetailModal');
    const container = document.getElementById('studentDetailContainer');
    if (!modal || !container) return;
    modal.classList.add('active');
    container.innerHTML = '<div class="spinner"></div>';

    let user, subs = [], grade = null, allMonths = [];
    try {
        const { data: u, error: ue } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
        if (ue || !u) { container.innerHTML = '<p class="text-center" style="padding:40px">الطالب غير موجود</p>'; return; }
        user = u;
    } catch { container.innerHTML = '<p class="text-center" style="padding:40px">خطأ في تحميل بيانات الطالب</p>'; return; }

    try {
        const { data: s } = await supabase.from('subscriptions').select('*, months(name)').eq('user_id', userId).order('end_date', { ascending: false });
        if (s) subs = s;
    } catch {}

    const now = new Date();
    if (user.grade_id) {
        try {
            const { data: g } = await supabase.from('grades').select('name').eq('id', user.grade_id).maybeSingle();
            if (g) grade = g;
        } catch {}
    }
    try {
        const { data: m } = await supabase.from('months').select('*');
        if (m) allMonths = m;
    } catch {}

    const safeUserName = escapeHtml(user.name);
    const safeUserPhone = escapeHtml(user.phone);
    const safeUserDivision = escapeHtml(user.division || '-');
    container.innerHTML = `
        <div class="student-detail-grid">
            <div class="detail-field">
                <div class="field-label">الاسم</div>
                <div class="field-value">${safeUserName}</div>
            </div>
            <div class="detail-field">
                <div class="field-label">رقم الهاتف</div>
                <div class="field-value" dir="ltr" style="text-align:right">${safeUserPhone}</div>
            </div>
            <div class="detail-field">
                <div class="field-label">الصف</div>
                <div class="field-value">${grade?.name || 'غير محدد'}</div>
            </div>
            <div class="detail-field">
                <div class="field-label">الشعبة</div>
                <div class="field-value">${safeUserDivision}</div>
            </div>
            <div class="detail-field">
                <div class="field-label">تاريخ التسجيل</div>
                <div class="field-value">${formatDate(user.created_at)}</div>
            </div>
            <div class="detail-field">
                <div class="field-label">الاشتراكات النشطة</div>
                <div class="field-value" style="color:${subs.filter(s => new Date(s.end_date) > now && s.status === 'active').length ? '#4caf50' : '#f44336'}">
                    ${subs.filter(s => new Date(s.end_date) > now && s.status === 'active').length}
                </div>
            </div>
        </div>
        <h3 style="font-size:18px;font-weight:800;margin-bottom:16px">الاشتراكات</h3>
        <div class="student-subscriptions-list">
            ${subs.length ? subs.map(sub => {
                const mName = allMonths?.find(m => m.id === sub.month_id)?.name || sub.months?.name || 'شهر';
                return `
                <div class="sub-item">
                    <div>
                        <span class="sub-name">${mName}</span>
                        <span style="font-size:13px;color:var(--gray-500);margin-right:12px">${formatDate(sub.start_date)} - ${formatDate(sub.end_date)}</span>
                    </div>
                    <span class="sub-status" style="color:${new Date(sub.end_date) > now && sub.status === 'active' ? '#4caf50' : '#f44336'}">
                        ${new Date(sub.end_date) > now && sub.status === 'active' ? 'نشط' : 'منتهي'}
                    </span>
                </div>`;
            }).join('') : '<p style="color:var(--gray-500);text-align:center;padding:20px">لا توجد اشتراكات</p>'}
        </div>
        <div style="text-align:center;margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-outline" onclick="closeModal('studentDetailModal')">إغلاق</button>
        </div>
    `;
}

async function resetStudentDevice(userId) {
    if (!confirm('هل أنت متأكد من إعادة تعيين جهاز هذا الطالب؟')) return;
    try {
        const res = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/device-auth/reset-device`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
            body: JSON.stringify({
                user_id: userId,
                admin_session: localStorage.getItem('admin_session'),
                admin_sig: localStorage.getItem('admin_sig')
            })
        });
        const data = await res.json();
        if (data.success) {
            showAlert('✅ تم إعادة تعيين الجهاز بنجاح', 'success');
            showStudentDetail(userId);
        } else {
            showAlert('❌ ' + (data.error || 'فشل إعادة التعيين'), 'error');
        }
    } catch (error) {
        console.error('Error resetting device:', error);
        showAlert('حدث خطأ أثناء إعادة تعيين الجهاز', 'error');
    }
}

async function assignGrade(userId) {
    const gradeId = prompt('أدخل رقم الصف (من جدول الصفوف):');
    if (!gradeId) return;
    try {
        await db.updateUser(parseInt(userId), { grade_id: parseInt(gradeId) });
        showAlert('تم تحديد الصف بنجاح', 'success');
        loadStudents();
    } catch (error) {
        console.error('Error assigning grade:', error);
        showAlert('حدث خطأ', 'error');
    }
}

function editVideo(videoId) {
    window.location.href = `admin-add-video.html?edit=${videoId}`;
}

function editProduct(id) {
    window.location.href = `admin-add-note.html?edit=${id}`;
}

function editAudio(id) {
    window.location.href = `admin-add-audio.html?edit=${id}`;
}

function editExam(id) {
    window.location.href = `admin-add-exam.html?edit=${id}`;
}

function editMonth(monthId) {
    showAlert('استخدم زر التعديل في جدول الشهور', 'info');
}

// ===== Course Management Functions =====

let uploadedVideos = [];

async function loadCourses() {
    try {
        const { data: courses, error } = await supabase
            .from('courses')
            .select('*, grades(name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('coursesTableBody');

        if (!courses || !courses.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">لا توجد كورسات</td></tr>';
            return;
        }

        tbody.innerHTML = courses.map(course => {
            const gradeName = course.grades?.name || '-';
            const statusClass = course.status === 'published' ? 'published' : 'draft';
            const statusText = course.status === 'published' ? 'منشور' : 'مسودة';
            const thumbnail = course.thumbnail || 'images/logo.jpg';
            
            return `
                <tr>
                    <td><img src="${thumbnail}" alt="" class="course-thumbnail-preview"></td>
                    <td>${course.title}</td>
                    <td>${gradeName}</td>
                    <td>${course.video_count || 0}</td>
                    <td>${formatCurrency(course.price)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${formatDate(course.created_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editCourse(${course.id})">تعديل</button>
                            <button class="action-btn delete" onclick="deleteCourse(${course.id})">حذف</button>
                            ${course.status === 'published' 
                                ? `<button class="action-btn" style="background:#f59e0b;color:white" onclick="toggleCourseStatus(${course.id}, 'draft')">إيقاف</button>`
                                : `<button class="action-btn" style="background:#10b981;color:white" onclick="toggleCourseStatus(${course.id}, 'published')">نشر</button>`
                            }
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading courses:', error);
        const tbody = document.getElementById('coursesTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center">تعذر تحميل الكورسات</td></tr>';
    }
}

function showCourseModal() {
    document.getElementById('courseModalTitle').textContent = 'إضافة كورس جديد';
    document.getElementById('courseId').value = '';
    document.getElementById('courseTitle').value = '';
    document.getElementById('courseDescription').value = '';
    document.getElementById('courseThumbnail').value = '';
    document.getElementById('coursePrice').value = '';
    document.getElementById('courseStatus').value = 'draft';
    document.getElementById('videoList').innerHTML = '';
    uploadedVideos = [];
    
    // Load grades
    loadCourseGrades();
    
    openModal('courseModal');
    initVideoUpload();
}

async function loadCourseGrades() {
    try {
        const { data: grades, error } = await supabase
            .from('grades')
            .select('*')
            .order('order', { ascending: true });

        if (error) throw error;

        const select = document.getElementById('courseGrade');
        select.innerHTML = '<option value="">اختر الصف</option>' +
            grades.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

function initVideoUpload() {
    const uploadArea = document.getElementById('videoUploadArea');
    const fileInput = document.getElementById('videoFilesInput');

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
        handleVideoFiles(e.dataTransfer.files);
    });
}

function handleVideoFileSelect(event) {
    handleVideoFiles(event.target.files);
}

function handleVideoFiles(files) {
    const maxVideos = 20;
    const currentCount = uploadedVideos.length;
    const availableSlots = maxVideos - currentCount;

    if (availableSlots <= 0) {
        showAlert('وصلت للحد الأقصى من الفيديوهات (20 فيديو)', 'error');
        return;
    }

    const filesToAdd = Array.from(files).slice(0, availableSlots);
    
    filesToAdd.forEach((file, index) => {
        const video = {
            file: file,
            title: file.name.replace(/\.[^/.]+$/, ''),
            size: formatFileSize(file.size),
            duration: 'جاري الحساب...'
        };
        uploadedVideos.push(video);
    });

    renderVideoList();
}

function renderVideoList() {
    const videoList = document.getElementById('videoList');
    
    videoList.innerHTML = uploadedVideos.map((video, index) => `
        <div class="video-item" draggable="true" data-index="${index}">
            <div class="video-item-number">${index + 1}</div>
            <div class="video-item-info">
                <div class="video-item-name">${video.title}</div>
                <div class="video-item-meta">
                    <span>الحجم: ${video.size}</span>
                    <span>المدة: ${video.duration}</span>
                </div>
            </div>
            <div class="video-item-actions">
                <button class="video-item-btn move" onclick="moveVideo(${index}, -1)">↑</button>
                <button class="video-item-btn move" onclick="moveVideo(${index}, 1)">↓</button>
                <button class="video-item-btn delete" onclick="removeVideo(${index})">حذف</button>
            </div>
        </div>
    `).join('');

    // Add drag and drop for reordering
    initVideoReordering();
}

function initVideoReordering() {
    const videoItems = document.querySelectorAll('.video-item');
    let draggedItem = null;

    videoItems.forEach(item => {
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
            if (draggedItem && draggedItem !== item) {
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    item.parentNode.insertBefore(draggedItem, item);
                } else {
                    item.parentNode.insertBefore(draggedItem, item.nextSibling);
                }
            }
        });

        item.addEventListener('drop', () => {
            updateVideoOrder();
        });
    });
}

function updateVideoOrder() {
    const videoItems = document.querySelectorAll('.video-item');
    const newOrder = [];
    
    videoItems.forEach(item => {
        const index = parseInt(item.dataset.index);
        newOrder.push(uploadedVideos[index]);
    });
    
    uploadedVideos = newOrder;
    renderVideoList();
}

function moveVideo(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= uploadedVideos.length) return;
    
    const temp = uploadedVideos[index];
    uploadedVideos[index] = uploadedVideos[newIndex];
    uploadedVideos[newIndex] = temp;
    
    renderVideoList();
}

function removeVideo(index) {
    uploadedVideos.splice(index, 1);
    renderVideoList();
}

async function handleCourseSubmit(event) {
    event.preventDefault();
    
    const courseId = document.getElementById('courseId').value;
    const title = document.getElementById('courseTitle').value;
    const description = document.getElementById('courseDescription').value;
    const gradeId = document.getElementById('courseGrade').value;
    const thumbnail = document.getElementById('courseThumbnail').value;
    const price = parseFloat(document.getElementById('coursePrice').value);
    const status = document.getElementById('courseStatus').value;
    
    const btn = document.getElementById('courseSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';
    
    try {
        let courseData = {
            title,
            description,
            grade_id: parseInt(gradeId),
            thumbnail,
            price,
            status,
            video_count: uploadedVideos.length
        };

        let savedCourse;
        
        if (courseId) {
            // Update existing course
            const { data, error } = await supabase
                .from('courses')
                .update(courseData)
                .eq('id', parseInt(courseId))
                .select()
                .single();
            
            if (error) throw error;
            savedCourse = data;
        } else {
            // Create new course
            const { data, error } = await supabase
                .from('courses')
                .insert(courseData)
                .select()
                .single();
            
            if (error) throw error;
            savedCourse = data;
        }

        // Upload videos
        if (uploadedVideos.length > 0) {
            for (let i = 0; i < uploadedVideos.length; i++) {
                const video = uploadedVideos[i];
                // Here you would upload the video file to your storage service
                // For now, we'll just create a placeholder URL
                const videoUrl = `https://example.com/videos/${savedCourse.id}/${i + 1}.mp4`;
                
                await supabase.from('course_videos').insert({
                    course_id: savedCourse.id,
                    title: video.title,
                    video_url: videoUrl,
                    duration: 0, // Would be calculated after upload
                    order_number: i + 1
                });
            }
        }

        showAlert('تم حفظ الكورس بنجاح', 'success');
        closeModal('courseModal');
        loadCourses();
        
    } catch (error) {
        console.error('Error saving course:', error);
        showAlert('حدث خطأ أثناء حفظ الكورس', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'حفظ الكورس';
    }
}

async function editCourse(courseId) {
    try {
        const { data: course, error } = await supabase
            .from('courses')
            .select('*, course_videos(*)')
            .eq('id', courseId)
            .single();

        if (error) throw error;

        document.getElementById('courseModalTitle').textContent = 'تعديل الكورس';
        document.getElementById('courseId').value = course.id;
        document.getElementById('courseTitle').value = course.title;
        document.getElementById('courseDescription').value = course.description || '';
        document.getElementById('courseThumbnail').value = course.thumbnail || '';
        document.getElementById('coursePrice').value = course.price;
        document.getElementById('courseStatus').value = course.status;
        
        // Load videos
        uploadedVideos = (course.course_videos || []).map(v => ({
            id: v.id,
            title: v.title,
            videoUrl: v.video_url,
            duration: formatDuration(v.duration),
            size: '-'
        }));
        
        renderVideoList();
        loadCourseGrades();
        
        // Set grade
        setTimeout(() => {
            document.getElementById('courseGrade').value = course.grade_id;
        }, 100);
        
        openModal('courseModal');
        initVideoUpload();
        
    } catch (error) {
        console.error('Error loading course:', error);
        showAlert('حدث خطأ أثناء تحميل الكورس', 'error');
    }
}

async function deleteCourse(courseId) {
    if (!confirm('هل أنت متأكد من حذف هذا الكورس؟')) return;
    
    try {
        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', courseId);
        
        if (error) throw error;
        
        showAlert('تم حذف الكورس بنجاح', 'success');
        loadCourses();
        
    } catch (error) {
        console.error('Error deleting course:', error);
        showAlert('حدث خطأ أثناء حذف الكورس', 'error');
    }
}

async function toggleCourseStatus(courseId, newStatus) {
    try {
        const { error } = await supabase
            .from('courses')
            .update({ status: newStatus })
            .eq('id', courseId);
        
        if (error) throw error;
        
        showAlert(newStatus === 'published' ? 'تم نشر الكورس' : 'تم إيقاف الكورس', 'success');
        loadCourses();
        
    } catch (error) {
        console.error('Error toggling course status:', error);
        showAlert('حدث خطأ', 'error');
    }
}

// Helper functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// تعريض الدوال لـ HTML (onchange / onclick)
window.openModal = openModal;
window.closeModal = closeModal;
window.showAdminSection = showAdminSection;
window.loadVideos = loadVideos;
window.loadProducts = loadProducts;
window.loadAudio = loadAudio;
window.loadExams = loadExams;
window.loadMonths = loadMonths;
window.loadGrades = loadGrades;
window.loadProjects = loadProjects;
window.loadCourses = loadCourses;
window.editVideo = editVideo;
window.editProduct = editProduct;
// --- Payment Requests ---
let paymentReqSearchTimeout;

function debounceSearchPaymentReq() {
    clearTimeout(paymentReqSearchTimeout);
    paymentReqSearchTimeout = setTimeout(loadPaymentRequests, 400);
}

async function loadPaymentRequests() {
    const tbody = document.getElementById('paymentRequestsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="text-center"><div class="spinner"></div></td></tr>';

    try {
        const status = document.getElementById('paymentReqFilter')?.value || '';
        const search = document.getElementById('paymentReqSearch')?.value || '';
        const sort = document.getElementById('paymentReqSort')?.value || 'newest';

        const requests = await db.getAllPaymentRequests({ status, search, sort });

        if (!requests.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">لا توجد طلبات دفع</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(req => {
            const statusBadge = getPaymentStatusBadge(req.status);
            const methodLabel = req.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 'انستا باي';
            const studentName = req.users?.name || req.student_name || '-';
            const studentPhone = req.users?.phone || req.student_phone || '-';

            return `
                <tr>
                    <td>${req.id}</td>
                    <td>${escapeHtml(studentName)}</td>
                    <td>${escapeHtml(studentPhone)}</td>
                    <td>${escapeHtml(req.grade_name || req.course_name || '-')}</td>
                    <td>${req.amount} ج.م</td>
                    <td>${methodLabel}</td>
                    <td><button class="action-btn" onclick="viewReceiptImg('${req.image_url}')">🖼 عرض</button></td>
                    <td>${formatDate(req.created_at)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex;gap:4px;flex-wrap:wrap">
                            ${req.status === 'pending' ? `
                                <button class="action-btn" style="color:#065f46" onclick="approvePaymentReq(${req.id})">✅ قبول</button>
                                <button class="action-btn" style="color:#991b1b" onclick="showRejectModal(${req.id})">❌ رفض</button>
                            ` : ''}
                            <button class="action-btn delete" onclick="deletePaymentReq(${req.id})">🗑 حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading payment requests:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center">حدث خطأ أثناء التحميل</td></tr>';
    }
}

function getPaymentStatusBadge(status) {
    const map = {
        pending: '<span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">قيد الانتظار</span>',
        approved: '<span style="background:#d1fae5;color:#065f46;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">مقبول</span>',
        rejected: '<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">مرفوض</span>'
    };
    return map[status] || map.pending;
}

function viewReceiptImg(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;cursor:pointer';
    overlay.innerHTML = `<img src="${url}" style="max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)">`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

let pendingActionId = null;

function showRejectModal(id) {
    pendingActionId = id;
    document.getElementById('rejectionReason').value = '';
    document.getElementById('rejectionModal').classList.add('active');
    document.getElementById('confirmRejectBtn').onclick = async () => {
        const reason = document.getElementById('rejectionReason').value.trim();
        if (!reason) { showAlert('الرجاء إدخال سبب الرفض', 'error'); return; }
        await rejectPaymentReq(pendingActionId, reason);
        closeModal('rejectionModal');
    };
}

async function approvePaymentReq(id) {
    if (!confirm('هل أنت متأكد من قبول طلب الدفع هذا؟')) return;

    try {
        const request = await db.getPaymentRequest(id);
        if (!request) { showAlert('الطلب غير موجود', 'error'); return; }

        const settings = await db.getPaymentSettings();
        const duration = settings.subscription_duration || CONFIG.PLATFORM.SUBSCRIPTION_DURATION || 30;

        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

        const errors = [];

        if (request.month_id) {
            try {
                await supabase.from('subscriptions').insert({
                    user_id: request.student_id,
                    month_id: request.month_id,
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString(),
                    payment_id: null,
                    status: 'active'
                });
            } catch (e) { errors.push('الاشتراك الشهري: ' + e.message); }
        }

        if (request.course_id) {
            try {
                await supabase.from('course_purchases').insert({
                    user_id: request.student_id,
                    course_id: request.course_id,
                    payment_id: request.id,
                    status: 'active'
                });
            } catch (e) { errors.push('شراء الكورس: ' + e.message); }
        }

        await db.updatePaymentRequest(id, {
            status: 'approved',
            approved_at: startDate.toISOString(),
            approved_by: currentUser?.id || null,
            subscription_start: startDate.toISOString(),
            subscription_end: endDate.toISOString(),
            subscription_duration: duration
        });

        if (errors.length) {
            showAlert('✅ تم القبول ولكن حدث خطأ في: ' + errors.join(' | '), 'warning');
        } else {
            showAlert('✅ تم قبول طلب الدفع وتفعيل الاشتراك بنجاح', 'success');
        }
        loadPaymentRequests();
    } catch (error) {
        console.error('Error approving payment:', error);
        showAlert('حدث خطأ أثناء قبول طلب الدفع: ' + (error.message || 'خطأ غير معروف'), 'error');
    }
}

async function rejectPaymentReq(id, reason) {
    try {
        await db.updatePaymentRequest(id, { status: 'rejected', rejection_reason: reason });
        showAlert('تم رفض طلب الدفع', 'success');
        loadPaymentRequests();
    } catch (error) {
        console.error('Error rejecting payment:', error);
        showAlert('حدث خطأ أثناء رفض طلب الدفع', 'error');
    }
}

async function deletePaymentReq(id) {
    if (!confirm('هل أنت متأكد من حذف طلب الدفع هذا؟')) return;
    try {
        await db.deletePaymentRequest(id);
        showAlert('تم حذف طلب الدفع', 'success');
        loadPaymentRequests();
    } catch (error) {
        console.error('Error deleting payment request:', error);
        showAlert('حدث خطأ أثناء الحذف', 'error');
    }
}

// --- Payment Settings ---
async function loadPaymentSettings() {
    try {
        const settings = await db.getPaymentSettings();
        const vf = document.getElementById('settingsVodafone');
        const ip = document.getElementById('settingsInstapay');
        const instr = document.getElementById('settingsInstructions');
        const dur = document.getElementById('settingsDuration');
        const fs = document.getElementById('settingsFileSize');
        if (vf) vf.value = settings.vodafone_cash || CONFIG.PAYMENT.VODAFONE_CASH || '';
        if (ip) ip.value = settings.instapay_id || CONFIG.PAYMENT.INSTAPAY_ID || '';
        if (instr) instr.value = settings.payment_instructions || '';
        if (dur) dur.value = settings.subscription_duration || CONFIG.PLATFORM.SUBSCRIPTION_DURATION || 30;
        if (fs) fs.value = settings.allowed_file_size || 10;
    } catch (error) {
        console.error('Error loading payment settings:', error);
    }
}

async function savePaymentSettings(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);
    try {
        await db.updatePaymentSettings({
            vodafone_cash: document.getElementById('settingsVodafone').value,
            instapay_id: document.getElementById('settingsInstapay').value,
            payment_instructions: document.getElementById('settingsInstructions').value,
            subscription_duration: parseInt(document.getElementById('settingsDuration').value),
            allowed_file_size: parseInt(document.getElementById('settingsFileSize').value),
            updated_at: new Date().toISOString()
        });
        showAlert('✅ تم حفظ الإعدادات بنجاح', 'success');
    } catch (error) {
        console.error('Error saving payment settings:', error);
        showAlert('حدث خطأ أثناء حفظ الإعدادات', 'error');
    }
    setButtonLoading(btn, false);
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text || '';
    return d.innerHTML;
}

window.editAudio = editAudio;
window.editExam = editExam;
window.editCourse = editCourse;
window.deleteCourse = deleteCourse;
window.toggleCourseStatus = toggleCourseStatus;
window.showCourseModal = showCourseModal;
window.handleCourseSubmit = handleCourseSubmit;
window.handleVideoFileSelect = handleVideoFileSelect;
window.moveVideo = moveVideo;
window.removeVideo = removeVideo;
window.saveSettings = saveSettings;
window.showProjectModal = showProjectModal;
window.handleProjectSubmit = handleProjectSubmit;
window.loadProjectMonths = loadProjectMonths;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.viewSubmissions = viewSubmissions;
window.gradeSubmission = gradeSubmission;
window.viewStudent = viewStudent;
window.deleteStudent = deleteStudent;
window.showStudentDetail = showStudentDetail;
window.assignGrade = assignGrade;
window.toggleAdminMobileMenu = toggleAdminMobileMenu;
window.closeAdminMobileMenu = closeAdminMobileMenu;
window.debounceSearch = debounceSearch;
window.loadPaymentRequests = loadPaymentRequests;
window.loadPaymentSettings = loadPaymentSettings;
window.savePaymentSettings = savePaymentSettings;
window.approvePaymentReq = approvePaymentReq;
window.rejectPaymentReq = rejectPaymentReq;
window.deletePaymentReq = deletePaymentReq;
window.showRejectModal = showRejectModal;
window.viewReceiptImg = viewReceiptImg;
window.debounceSearchPaymentReq = debounceSearchPaymentReq;
