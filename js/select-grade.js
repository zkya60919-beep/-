// Grade Selection — cards for student

const GRADE_ICONS = ['📗', '📘', '📙', '📕', '📒', '📓'];

document.addEventListener('DOMContentLoaded', async () => {
    loadCachedUser();
    const userId = localStorage.getItem('userId');

    if (!userId) {
        window.location.href = 'login.html';
        return;
    }

    if (!currentUser) {
        try {
            const { data: user } = await supabase.from('users').select('*').eq('phone', userId).single();
            if (user) cacheUser(user);
        } catch (e) {
            console.error(e);
        }
    }

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    if (currentUser.grade_id) {
        window.location.href = 'dashboard.html';
        return;
    }

    renderGrades(await fetchGradesForSelection());
});

async function fetchGradesForSelection() {
    try {
        let grades = await db.getGrades(true);

        if (grades.length === 0) {
            await ensureDefaultGradesInDb();
            grades = await db.getGrades(true);
        }
        return grades.length ? grades : CONFIG.DEFAULT_GRADES;
    } catch (error) {
        console.error('Grades fetch error:', error);
        return CONFIG.DEFAULT_GRADES;
    }
}

async function ensureDefaultGradesInDb() {
    const { data: existing } = await supabase.from('grades').select('id').limit(1);
    if (existing?.length) return;

    await supabase.from('grades').insert(
        CONFIG.DEFAULT_GRADES.map(g => ({
            name: g.name,
            order: g.order,
            visible: true
        }))
    );
}

function renderGrades(grades) {
    const grid = document.getElementById('gradesGrid');
    const list = grades || [];

    if (!list.length) {
        grid.innerHTML = '<p class="text-center">لا توجد صفوف. تواصل مع الإدارة.</p>';
        return;
    }

    grid.innerHTML = list.map((grade, i) => `
        <button type="button" class="grade-card grade-pick-card" data-grade-id="${grade.id}" aria-label="${grade.name}">
            <div class="grade-card-icon">${GRADE_ICONS[i] || '📚'}</div>
            <h3 class="grade-card-title">${grade.name}</h3>
            <p class="grade-card-description">اضغط لاختيار هذا الصف</p>
        </button>
    `).join('');

    grid.querySelectorAll('.grade-pick-card').forEach(card => {
        card.addEventListener('click', () => selectGrade(parseInt(card.dataset.gradeId, 10)));
    });
}

async function selectGrade(gradeId) {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const card = document.querySelector(`[data-grade-id="${gradeId}"]`);
    if (card) {
        card.disabled = true;
        card.style.opacity = '0.7';
    }

    try {
        const { data: updated, error } = await supabase
            .from('users')
            .update({ grade_id: gradeId })
            .eq('id', currentUser.id)
            .select()
            .single();

        if (error) {
            console.warn('فشل تحديث الصف في DB، استخدام التخزين المحلي:', error);
            currentUser.grade_id = gradeId;
            localStorage.setItem('pendingGradeId', gradeId);
            cacheUser(currentUser);
        } else if (updated) {
            updated.grade_id = gradeId;
            cacheUser(updated);
        }

        db.ensureNineMonths(gradeId).catch(() => {});

        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Error selecting grade:', error);
        currentUser.grade_id = gradeId;
        localStorage.setItem('pendingGradeId', gradeId);
        cacheUser(currentUser);
        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.href = 'dashboard.html';
    }
}
