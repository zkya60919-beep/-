// Authentication Module

// ===== Password Hashing (SHA-256) =====
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, stored) {
    // Check if stored is a SHA-256 hash (64 hex chars)
    if (/^[a-f0-9]{64}$/.test(stored)) {
        const hashedInput = await hashPassword(password);
        return hashedInput === stored;
    }
    // Backward compat: stored is still plaintext
    return password === stored;
}

// Fallback for setButtonLoading (defined in main.js, loaded after this file)
if (typeof setButtonLoading !== 'function') {
    function setButtonLoading(button, loading) {
        if (!button) return;
        button.disabled = !!loading;
        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'جاري التحميل...';
        } else {
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }
}

let currentUser = null;

const SESSION_USER_KEY = 'albasit_user_cache';

function cacheUser(user) {
    if (!user) return;
    try {
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } catch (_) { /* ignore */ }
    currentUser = user;
}

function loadCachedUser() {
    try {
        let raw = sessionStorage.getItem(SESSION_USER_KEY);
        if (!raw) raw = localStorage.getItem(SESSION_USER_KEY);
        if (raw) {
            currentUser = JSON.parse(raw);
            return currentUser;
        }
    } catch (_) { /* ignore */ }
    return null;
}

async function getCurrentUser() {
    if (currentUser) return currentUser;
    loadCachedUser();
    if (currentUser) return currentUser;
    const userId = localStorage.getItem('userId');
    if (!userId) return null;
    try {
        const { data, error } = await supabase.from('users').select('*').eq('phone', userId).maybeSingle();
        if (error || !data) return null;
        cacheUser(data);
        return data;
    } catch {
        return null;
    }
}

window.getCurrentUser = getCurrentUser;

function isLoginPage() {
    return /login\.html/i.test(window.location.pathname || '');
}

function isSelectGradePage() {
    return /select-grade\.html/i.test(window.location.pathname || '');
}

document.addEventListener('DOMContentLoaded', () => {
    if (isLoginPage() || isSelectGradePage()) {
        loadCachedUser();
        return;
    }
    checkAuth();
});

const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 year (Persistent login)

async function checkAuth() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const loginTime = localStorage.getItem('loginTime');
    if (loginTime && (Date.now() - parseInt(loginTime) > SESSION_DURATION_MS)) {
        logout();
        return;
    }
    // Update loginTime to extend the session
    localStorage.setItem('loginTime', Date.now().toString());

    // التحقق من جلسة الأدمن عبر السيرفر
    const adminSession = localStorage.getItem('admin_session');
    if (adminSession) {
        const expiresAt = parseInt(localStorage.getItem('admin_expires'));
        if (expiresAt && Date.now() > expiresAt) {
            localStorage.removeItem('admin_session');
            localStorage.removeItem('admin_expires');
            localStorage.removeItem('admin_sig');
            localStorage.removeItem('isAdmin');
        } else {
            try {
                const res = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/admin-validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY },
                    body: JSON.stringify({
                        session_id: adminSession,
                        expires_at: expiresAt,
                        signature: localStorage.getItem('admin_sig')
                    })
                });
                const data = await res.json();
                if (data.valid) {
                    updateUIForLoggedInUser();
                    return;
                }
            } catch (_) { /* ignore */ }
        }
    }

    const cached = loadCachedUser();
    if (cached && cached.phone === userId) {
        updateUIForLoggedInUser();
        maybeRedirectStudent(cached);
        // إذا كان المستخدم موجود في cache، لا نحذف userId حتى لو فشل الاتصال
        return;
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', userId)
            .maybeSingle();

        if (error) {
            // لا نحذف userId عند أخطاء الشبكة - نسمح للمستخدم بالاستمرار
            return;
        }
        if (!user) {
            // DON'T remove userId — causes redirect loop to login
            return;
        }

        cacheUser(user);
        updateUIForLoggedInUser();
        maybeRedirectStudent(user);
    } catch (error) {
        // لا نحذف userId عند أخطاء عامة - نسمح للمستخدم بالاستمرار
    }
}

function maybeRedirectStudent(user) {
    const isAdminSession = localStorage.getItem('isAdmin') === 'true';
    const isAdminUser = user.division === 'admin';
    const isAdminPage = /admin/i.test(window.location.pathname || '');

    if (!user.grade_id && !isAdminSession && !isAdminUser && !isAdminPage && !isSelectGradePage()) {
        window.location.href = 'select-grade.html';
    }
}

function showLoginModal() {
    window.location.href = 'login.html';
}

function showRegisterModal() {
    window.location.href = 'register.html';
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}



async function handleLogin(event) {
    event.preventDefault();

    if (!window.supabase || !window.supabase.from) {
        showAlert('❌ خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }

    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = event.target.querySelector('button[type="submit"]') || event.submitter;

    if (btn) setButtonLoading(btn, true);

    try {
        // Fetch user first to check if admin
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (error || !user) {
            showAlert('رقم الهاتف غير مسجل', 'error');
            if (btn) setButtonLoading(btn, false);
            return;
        }

        if (!(await verifyPassword(password, user.password))) {
            showAlert('كلمة المرور غير صحيحة', 'error');
            if (btn) setButtonLoading(btn, false);
            return;
        }

        // Admin check only for admin users
        if (user.division === 'admin' || user.role === 'admin') {
            try {
                const adminRes = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/admin-auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
                    body: JSON.stringify({ phone, password })
                });
                const adminData = await adminRes.json();

                if (adminRes.ok && adminData.session_id) {
                    localStorage.setItem('admin_session', adminData.session_id);
                    localStorage.setItem('admin_expires', adminData.expires_at);
                    localStorage.setItem('admin_sig', adminData.signature);
                    localStorage.setItem('isAdmin', 'true');
                    localStorage.setItem('userId', phone);
                    localStorage.setItem('loginTime', Date.now().toString());
                    sessionStorage.removeItem(SESSION_USER_KEY);
                    showAlert('✅ تم تسجيل الدخول كمدير', 'success');
                    setTimeout(() => window.location.href = 'admin.html', 500);
                    return;
                }
            } catch (_) {
                // EF failed for admin — fall through to regular login
            }
        }

        // Clear ALL previous session data (admin or other user) before setting new user
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('admin_session');
        localStorage.removeItem('admin_expires');
        localStorage.removeItem('admin_sig');
        sessionStorage.removeItem(SESSION_USER_KEY);

        localStorage.setItem('userId', user.phone);
        localStorage.setItem('loginTime', Date.now().toString());
        cacheUser(user);
        closeModal('loginModal');

        const target = !user.grade_id ? 'select-grade.html' : 'dashboard.html';
        setTimeout(() => { window.location.href = target; }, 50);
    } catch (error) {
        console.error('Login error:', error);
        showAlert('حدث خطأ أثناء تسجيل الدخول', 'error');
        if (btn) setButtonLoading(btn, false);
    }
}

async function handleRegister(event) {
    event.preventDefault();

    if (!window.supabase || !window.supabase.from) {
        showAlert('❌ خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }

    const name = document.getElementById('registerName').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const division = document.getElementById('registerDivision').value;

    try {
        const { data: existingUser } = await supabase
            .from('users')
            .select('phone')
            .eq('phone', phone)
            .maybeSingle();

        if (existingUser) {
            showAlert('رقم الهاتف مسجل بالفعل', 'error');
            return;
        }

        const hashedPassword = await hashPassword(password);
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({ name, phone, password: hashedPassword, division })
            .select()
            .single();

        if (insertError) throw insertError;

        localStorage.setItem('userId', newUser.phone);
        localStorage.setItem('loginTime', Date.now().toString());
        localStorage.removeItem('isAdmin');
        cacheUser(newUser);
        closeModal('registerModal');
        setTimeout(() => { window.location.href = 'select-grade.html'; }, 50);
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('حدث خطأ أثناء إنشاء الحساب', 'error');
    }
}

function updateUIForLoggedInUser() {
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons && currentUser) {
        const isDashboard = /dashboard\.html/i.test(window.location.pathname || '');
        authButtons.innerHTML = `
            <span class="user-name">مرحباً، ${escapeHtml(currentUser.name)}</span>
            ${isDashboard ? '' : '<button class="btn btn-primary" onclick="goToDashboard()">لوحتي</button>'}
            <button class="btn btn-outline" onclick="window.location.href='index.html'">الرئيسية</button>
        `;
    }
    if (currentUser) {
        document.querySelectorAll('.nav-auth-btn').forEach(el => el.classList.add('hidden'));
    }
}

function goToDashboard(section) {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    if (!currentUser.grade_id) {
        window.location.href = 'select-grade.html';
        return;
    }
    if (section) {
        sessionStorage.setItem('dashboardReturnSection', section);
        window.location.href = `dashboard.html#${section}`;
    } else {
        window.location.href = 'dashboard.html';
    }
}

function goBackToDashboard(section) {
    const returnSection = section || sessionStorage.getItem('dashboardReturnSection') || '';
    if (returnSection) {
        sessionStorage.setItem('dashboardReturnSection', returnSection);
        window.location.href = `dashboard.html#${returnSection}`;
    } else {
        window.location.href = 'dashboard.html';
    }
}

window.goBackToDashboard = goBackToDashboard;

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('admin_session');
    localStorage.removeItem('admin_expires');
    localStorage.removeItem('admin_sig');
    localStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    currentUser = null;
    window.location.href = 'index.html';
}

function showAlert(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    const colors = {
        success: '#d4edda',
        error: '#f8d7da',
        warning: '#fff3cd',
        info: '#d1ecf1'
    };
    const textColors = {
        success: '#155724',
        error: '#721c24',
        warning: '#856404',
        info: '#0c5460'
    };

    // عرض في الصفحة
    const messagesDiv = document.getElementById('loginMessages');
    if (messagesDiv) {
        const alert = document.createElement('div');
        alert.style.cssText = `
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 6px;
            background: ${colors[type] || colors.info};
            color: ${textColors[type] || textColors.info};
            border: 1px solid rgba(0,0,0,0.1);
            font-size: 14px;
            line-height: 1.5;
        `;
        alert.textContent = message;
        messagesDiv.appendChild(alert);

        // إزالة بعد 10 ثواني
        setTimeout(() => alert.remove(), 10000);
    }

    // عرض كـ alert في body أيضاً
    document.querySelectorAll('.alert').forEach(a => a.remove());
    const bodyAlert = document.createElement('div');
    bodyAlert.className = `alert alert-${type}`;
    bodyAlert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${colors[type] || colors.info};
        color: ${textColors[type] || textColors.info};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 500;
        max-width: 400px;
    `;
    bodyAlert.textContent = message;
    document.body.appendChild(bodyAlert);
    setTimeout(() => bodyAlert.remove(), 5000);
}

window.addEventListener('click', function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
});

// ===== Password Toggle =====
function toggleFieldVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

// ===== Forgot Password =====
function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = '';
    document.getElementById('verifyForm').style.display = 'none';
    document.getElementById('forgotPhone').value = document.getElementById('loginPhone').value || '';
}

function hideForgotPassword() {
    document.getElementById('loginForm').style.display = '';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('verifyForm').style.display = 'none';
}

async function handleForgotPassword(event) {
    event.preventDefault();
    if (!window.supabase || !window.supabase.from) {
        showAlert('❌ خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }
    const phone = document.getElementById('forgotPhone').value.trim();
    if (!phone) { showAlert('يرجى إدخال رقم الهاتف', 'error'); return; }

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) setButtonLoading(btn, true);

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, phone')
            .eq('phone', phone)
            .maybeSingle();

        if (error || !user) {
            showAlert('رقم الهاتف غير مسجل في المنصة', 'error');
            if (btn) setButtonLoading(btn, false);
            return;
        }

        // إنشاء رمز عشوائي 6 أرقام
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // صالح 10 دقائق

        let savedLocally = false;
        try {
            // حذف الأكواد السابقة للمستخدم
            await supabase.from('reset_codes').delete().eq('user_id', user.id);
            const { error: insertError } = await supabase
                .from('reset_codes')
                .insert({ user_id: user.id, code, expires_at: new Date(expiresAt).toISOString() });

            if (insertError) {
                if (insertError.code === 'PGRST301' || insertError.code === '42501') {
                    console.warn('RLS on reset_codes, using local fallback');
                    savedLocally = true;
                } else {
                    throw insertError;
                }
            }
        } catch (dbError) {
            console.warn('Failed to save reset code to DB, using local storage:', dbError);
            savedLocally = true;
        }

        if (savedLocally) {
            localStorage.setItem('reset_code_' + user.id, JSON.stringify({
                code,
                expiresAt
            }));
        }

        // محاولة إرسال SMS عبر Edge Function (إذا كانت منشورة)
        try {
          const smsResponse = await fetch(
            `${CONFIG.SUPABASE.URL}/functions/v1/send-sms`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
              body: JSON.stringify({
                to: user.phone,
                message: `رمز التحقق الخاص بك في منصة الباسط: ${code}`
              })
            }
          );
          const smsResult = await smsResponse.json();
          if (smsResponse.ok && smsResult.success) {
            showAlert('✅ تم إرسال رمز التحقق إلى جوالك', 'success');
          } else {
            throw new Error(smsResult.error || 'SMS failed');
          }
        } catch (smsError) {
          // إذا فشل SMS، نظهر الرمز داخل المنصة
          console.warn('SMS not available, showing code on screen:', smsError);
          const debugEl = document.getElementById('codeDebug');
          if (debugEl) { debugEl.textContent = '🔑 رمز التحقق: ' + code; debugEl.style.display = ''; }
          setTimeout(() => { if (debugEl) debugEl.style.display = 'none'; }, 30000);
          showAlert('⚠️ رمز التحقق: ' + code, 'warning');
        }

        // عرض نموذج إدخال الرمز
        document.getElementById('forgotForm').style.display = 'none';
        document.getElementById('verifyForm').style.display = '';
        document.getElementById('verifyForm').dataset.userId = user.id;
        document.getElementById('verifyCode').value = '';
        document.getElementById('verifyCode').focus();

    } catch (error) {
        console.error('Forgot password error:', error);
        showAlert('حدث خطأ، حاول مرة أخرى', 'error');
    } finally {
        if (btn) setButtonLoading(btn, false);
    }
}

async function handleVerifyCode(event) {
    event.preventDefault();
    const code = document.getElementById('verifyCode').value.trim();
    const userId = event.target.dataset.userId;
    if (!userId) { showAlert('حدث خطأ، حاول طلب رمز جديد', 'error'); return; }

    if (!code || !/^\d{6}$/.test(code)) {
        showAlert('يرجى إدخال الرمز المكون من 6 أرقام', 'error');
        return;
    }

    let btn = event.target.querySelector('button[type="submit"]');
    if (btn) setButtonLoading(btn, true);

    try {
        // التحقق من الرمز في DB أولاً
        let validCode = false;
        let resetCode;

        const { data: dbCode, error } = await supabase
            .from('reset_codes')
            .select('*')
            .eq('user_id', userId)
            .eq('code', code)
            .is('used', false)
            .maybeSingle();

        if (dbCode && !error) {
            resetCode = dbCode;
            validCode = true;
        }

        // Fallback: التحقق من localStorage
        if (!validCode) {
            const localData = localStorage.getItem('reset_code_' + userId);
            if (localData) {
                const parsed = JSON.parse(localData);
                if (parsed.code === code && Date.now() < parsed.expiresAt) {
                    validCode = true;
                    localStorage.removeItem('reset_code_' + userId);
                }
            }
        }

        if (!validCode) {
            showAlert('الرمز غير صحيح أو منتهي الصلاحية', 'error');
            if (btn) setButtonLoading(btn, false);
            return;
        }

        // تعليم الرمز كمستخدم (فقط لو من DB)
        if (resetCode) {
            await supabase.from('reset_codes').update({ used: true }).eq('id', resetCode.id).catch(() => {});
        }

        // تسجيل دخول المستخدم
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !user) throw userError || new Error('User not found');

        localStorage.removeItem('isAdmin');
        localStorage.removeItem('admin_session');
        localStorage.removeItem('admin_expires');
        localStorage.removeItem('admin_sig');
        sessionStorage.removeItem(SESSION_USER_KEY);

        localStorage.setItem('userId', user.phone);
        localStorage.setItem('loginTime', Date.now().toString());
        cacheUser(user);

        showAlert('✅ تم تسجيل الدخول بنجاح', 'success');

        setTimeout(() => {
            if (!user.grade_id) {
                window.location.href = 'select-grade.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 500);

    } catch (error) {
        console.error('Verify code error:', error);
        showAlert('حدث خطأ، حاول مرة أخرى', 'error');
        if (btn) setButtonLoading(btn, false);
    }
}

window.requireAdmin = async function requireAdmin() {
    const sessionId = localStorage.getItem('admin_session');
    if (!sessionId) return false;

    const expiresAt = parseInt(localStorage.getItem('admin_expires'));
    if (expiresAt && Date.now() > expiresAt) {
        localStorage.removeItem('admin_session');
        localStorage.removeItem('admin_expires');
        localStorage.removeItem('admin_sig');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('userId');
        return false;
    }

    try {
        const res = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/admin-validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
            body: JSON.stringify({
                session_id: sessionId,
                expires_at: expiresAt,
                signature: localStorage.getItem('admin_sig')
            })
        });
        const data = await res.json();
        return !!data.valid;
    } catch (e) {
        return false;
    }
};
