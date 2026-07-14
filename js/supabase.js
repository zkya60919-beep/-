// Supabase Client Initialization
// Uses a unique global name to avoid collision with the CDN library

let _supabaseClient = null;

function initSupabase() {
    if (_supabaseClient) return _supabaseClient;

    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('Supabase CDN library not loaded yet');
        return null;
    }

    try {
        _supabaseClient = window.supabase.createClient(
            CONFIG.SUPABASE.URL,
            CONFIG.SUPABASE.ANON_KEY,
            {
            auth: { 
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storage: window.localStorage
            },
                global: {
                    headers: { 'X-Client-Info': 'albasit-platform' }
                }
            }
        );

        // Keep backward compatibility for all files using window.supabase
        window.supabase = _supabaseClient;
        console.log('Supabase client initialized successfully');
        return _supabaseClient;
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        return null;
    }
}

function ensureSupabase() {
    const client = initSupabase();
    if (!client && typeof window.supabase?.from !== 'function') {
        const isFileProtocol = window.location.protocol === 'file:';
        const msg = isFileProtocol
            ? '⚠️ لا يمكن الاتصال بقاعدة البيانات من الملف المحلي.\n' +
              'قم بتشغيل المنصة عبر: npm start أو أي خادم محلي (Live Server).'
            : '⚠️ فشل الاتصال بقاعدة البيانات.';
        console.error(msg);
        // Show visible alert on page
        document.addEventListener('DOMContentLoaded', () => {
            const existing = document.querySelector('.supabase-error');
            if (existing) return;
            const div = document.createElement('div');
            div.className = 'supabase-error';
            div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;text-align:center;padding:16px;font-weight:700;z-index:99999;font-size:15px;';
            div.textContent = isFileProtocol
                ? '⚠️ افتح الموقع عبر خادم محلي (استخدم Live Server أو npm run dev)'
                : '⚠️ فشل الاتصال بقاعدة البيانات - تحقق من اتصال الإنترنت';
            document.body.prepend(div);
        });
    }
    return client;
}

// Try immediately
initSupabase();

// Retry on load if needed
if (!_supabaseClient || typeof window.supabase?.from !== 'function') {
    window.addEventListener('load', () => {
        if (!initSupabase()) ensureSupabase();
    });
}

// Also retry after a short delay
setTimeout(() => {
    if (!_supabaseClient) {
        initSupabase();
        ensureSupabase();
    }
}, 1000);

const INIT_KEY = 'albasit_db_init_v1';

function isHeavyInitPage() {
    const p = (window.location.pathname || '').toLowerCase();
    return /login\.html|register\.html|select-grade\.html|admin-add-/.test(p) || p.endsWith('login.html');
}

async function initializeDatabaseOnce() {
    if (sessionStorage.getItem(INIT_KEY) === 'done') return;

    try {
        const { data: grades, error: gradesError } = await supabase.from('grades').select('id').limit(1);
        if (!gradesError && (!grades || grades.length === 0)) {
            await supabase.from('grades').insert(
                CONFIG.DEFAULT_GRADES.map(g => ({
                    name: g.name,
                    order: g.order,
                    visible: true
                }))
            );
        }

        const { data: teacher } = await supabase
            .from('users')
            .select('id')
            .eq('phone', CONFIG.TEACHER.PHONE)
            .maybeSingle();

        if (!teacher) {
            console.warn('Teacher user not found. Create it via Supabase SQL: INSERT INTO users (name, phone, division) VALUES (\'أ / محمد عبد الباسط\', \'01127025715\', \'admin\');');
        }

        sessionStorage.setItem(INIT_KEY, 'done');
    } catch (e) {
        console.warn('DB init skipped:', e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (isHeavyInitPage()) return;
    initializeDatabaseOnce();
});

window.initializeDatabaseOnce = initializeDatabaseOnce;
