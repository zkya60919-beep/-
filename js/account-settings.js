/**
 * Account Settings Module - إعدادات الحساب
 * منصة الباسط للعلوم الشرعية
 * 
 * يتيح للطالب تغيير كلمة المرور والصف الدراسي
 */

// ============================================================
// تغيير كلمة المرور
// ============================================================

async function handleChangePassword(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword')?.value?.trim();
    const newPassword = document.getElementById('newPassword')?.value?.trim();
    const confirmPassword = document.getElementById('confirmPassword')?.value?.trim();
    const btn = event.target.querySelector('button[type="submit"]');

    // التحقق من المدخلات
    if (!currentPassword || !newPassword || !confirmPassword) {
        showSettingsAlert('يرجى ملء جميع الحقول', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showSettingsAlert('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showSettingsAlert('كلمة المرور الجديدة وتأكيدها غير متطابقتين', 'error');
        return;
    }

    if (newPassword === currentPassword) {
        showSettingsAlert('كلمة المرور الجديدة مطابقة للحالية، اختر كلمة مختلفة', 'error');
        return;
    }

    if (btn) setButtonLoading(btn, true);

    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            showSettingsAlert('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        // التحقق من كلمة المرور الحالية
        const { data: user, error: fetchError } = await window.supabase
            .from('users')
            .select('password, id')
            .eq('phone', userId)
            .single();

        if (fetchError || !user) {
            showSettingsAlert('حدث خطأ في الاتصال بقاعدة البيانات', 'error');
            return;
        }

        if (user.password !== currentPassword) {
            showSettingsAlert('كلمة المرور الحالية غير صحيحة', 'error');
            return;
        }

        // تحديث كلمة المرور
        const { error: updateError } = await window.supabase
            .from('users')
            .update({ password: newPassword })
            .eq('phone', userId);

        if (updateError) throw updateError;

        // مسح النموذج
        event.target.reset();

        showSettingsAlert('✅ تم تغيير كلمة المرور بنجاح!', 'success');

    } catch (err) {
        console.error('خطأ في تغيير كلمة المرور:', err);
        showSettingsAlert('حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى', 'error');
    } finally {
        if (btn) setButtonLoading(btn, false);
    }
}

// ============================================================
// تغيير الصف الدراسي
// ============================================================

async function loadGradesForSettings() {
    const select = document.getElementById('newGradeSelect');
    if (!select) return;

    try {
        const { data: grades, error } = await window.supabase
            .from('grades')
            .select('id, name')
            .eq('visible', true)
            .order('order', { ascending: true });

        if (error || !grades) {
            select.innerHTML = '<option value="">تعذّر تحميل الصفوف</option>';
            return;
        }

        select.innerHTML = '<option value="">اختر الصف الدراسي</option>';
        grades.forEach(grade => {
            const opt = document.createElement('option');
            opt.value = grade.id;
            opt.textContent = grade.name;
            select.appendChild(opt);
        });

        // تحديد الصف الحالي
        const cached = sessionStorage.getItem('albasit_user_cache');
        if (cached) {
            try {
                const user = JSON.parse(cached);
                if (user.grade_id) select.value = user.grade_id;
            } catch (_) {}
        }

    } catch (err) {
        console.error('خطأ في تحميل الصفوف:', err);
    }
}

async function handleChangeGrade(event) {
    event.preventDefault();

    const newGradeId = document.getElementById('newGradeSelect')?.value;
    const btn = event.target.querySelector('button[type="submit"]');

    if (!newGradeId) {
        showSettingsAlert('يرجى اختيار الصف الدراسي', 'error');
        return;
    }

    if (btn) setButtonLoading(btn, true);

    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            showSettingsAlert('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        // التحقق من أن الصف تغيّر
        const cached = sessionStorage.getItem('albasit_user_cache');
        if (cached) {
            const user = JSON.parse(cached);
            if (user.grade_id && String(user.grade_id) === String(newGradeId)) {
                showSettingsAlert('أنت مسجل بهذا الصف بالفعل', 'error');
                if (btn) setButtonLoading(btn, false);
                return;
            }
        }

        // تحديث الصف في Supabase
        const { data: updatedUser, error } = await window.supabase
            .from('users')
            .update({ grade_id: parseInt(newGradeId) })
            .eq('phone', userId)
            .select()
            .single();

        if (error) throw error;

        // تحديث cache
        if (updatedUser) {
            try {
                sessionStorage.setItem('albasit_user_cache', JSON.stringify(updatedUser));
                // تحديث currentUser
                if (typeof currentUser !== 'undefined') {
                    currentUser = updatedUser;
                }
            } catch (_) {}
        }

        // تحديث عرض الصف في الصفحة
        const gradeNameEl = document.getElementById('userGrade');
        const gradeOverviewEl = document.getElementById('userGradeOverview');

        // جلب اسم الصف الجديد
        const { data: gradeData } = await window.supabase
            .from('grades')
            .select('name')
            .eq('id', newGradeId)
            .single();

        const gradeName = gradeData?.name || 'صف جديد';
        if (gradeNameEl) gradeNameEl.textContent = gradeName;
        if (gradeOverviewEl) gradeOverviewEl.textContent = gradeName;

        showSettingsAlert(`✅ تم تغيير الصف الدراسي إلى: ${gradeName}`, 'success');

        // إعادة تحميل محتوى الداشبورد بعد ثانيتين
        setTimeout(() => {
            if (typeof loadDashboardContent === 'function') {
                loadDashboardContent();
            }
        }, 2000);

    } catch (err) {
        console.error('خطأ في تغيير الصف:', err);
        showSettingsAlert('حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى', 'error');
    } finally {
        if (btn) setButtonLoading(btn, false);
    }
}

// ============================================================
// دوال مساعدة
// ============================================================

function showSettingsAlert(message, type = 'success') {
    const container = document.getElementById('settingsAlertContainer');
    if (!container) {
        // fallback للـ showAlert العامة
        if (typeof showAlert === 'function') showAlert(message, type);
        return;
    }

    container.innerHTML = `
        <div class="settings-alert settings-alert-${type}">
            ${message}
        </div>
    `;

    // إزالة الرسالة بعد 5 ثوانٍ
    setTimeout(() => {
        const alert = container.querySelector('.settings-alert');
        if (alert) {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => { container.innerHTML = ''; }, 300);
        }
    }, 5000);
}

function togglePasswordVisibility(fieldId, toggleBtn) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const isPassword = field.type === 'password';
    field.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? '🙈' : '👁️';
}

// تحميل الصفوف عند بدء الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // سيتم استدعاؤها عند فتح قسم الإعدادات
});

// تصدير الدوال للاستخدام العام
window.handleChangePassword = handleChangePassword;
window.handleChangeGrade = handleChangeGrade;
window.loadGradesForSettings = loadGradesForSettings;
window.togglePasswordVisibility = togglePasswordVisibility;
