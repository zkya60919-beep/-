// Main JavaScript File

// ===== Utility: Sanitize HTML to prevent XSS =====
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Load page-specific content
    loadPageContent();
    // Initialize mobile menu
    initializeMobileMenu();
    // Initialize theme
    initializeTheme();
    // Inject theme toggle into navbar (all pages)
    injectNavThemeToggle();
});

// Toggle mobile menu
function toggleMobileMenu() {
    const navList = document.querySelector('.nav-list');
    const overlay = document.querySelector('.nav-overlay');
    if (!navList) return;
    const isActive = navList.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
}

// Close mobile menu when clicking on a link
function closeMobileMenu() {
    const navList = document.querySelector('.nav-list');
    const overlay = document.querySelector('.nav-overlay');
    if (!navList) return;
    navList.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Theme toggle functions
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
    }
}

function toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function injectNavThemeToggle() {
    const headerContent = document.querySelector('.header-content');
    if (!headerContent) return;
    if (headerContent.querySelector('.nav-theme-toggle')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-theme-toggle';
    wrapper.style.cssText = 'display:flex;align-items:center;margin:0 4px;';
    wrapper.innerHTML = '<button class="theme-toggle-btn" onclick="toggleTheme()" aria-label="\u062A\u0628\u062F\u064A\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064A\u0644\u064A">' +
        '<svg class="theme-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>' +
        '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>' +
        '<line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>' +
        '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>' +
        '</svg>' +
        '<svg class="theme-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>' +
        '</svg>' +
        '</button>';
    const authBtns = headerContent.querySelector('#authButtons');
    if (authBtns) {
        headerContent.insertBefore(wrapper, authBtns);
    } else {
        headerContent.appendChild(wrapper);
    }
}

// Initialize mobile menu event listeners
function initializeMobileMenu() {
    // Close menu when clicking on nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Close menu when clicking on auth buttons
    const authLinks = document.querySelectorAll('.nav-list .btn');
    authLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
}

// Load page-specific content based on current page
function loadPageContent() {
    const path = window.location.pathname;
    
    if (path.includes('index.html') || path === '/') {
        // Home page content
        loadLatestCourses();
    }
}

// Load latest courses on homepage
async function loadLatestCourses() {
    try {
        const { data: courses, error } = await supabase
            .from('courses')
            .select('*, grades(name)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) throw error;

        const coursesGrid = document.getElementById('latestCoursesGrid');
        if (!coursesGrid) return;

        if (!courses || !courses.length) {
            coursesGrid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; padding: 40px; color: var(--gray-500);">لا توجد كورسات متاحة حالياً</p>';
            return;
        }

        coursesGrid.innerHTML = courses.map(course => {
            const thumbnail = course.thumbnail || 'images/logo.jpg';
            const gradeName = course.grades?.name || '-';
            const priceClass = course.price === 0 ? 'free' : '';
            const priceText = course.price === 0 ? 'مجاني' : formatCurrency(course.price);
            
            return `
                <div class="course-card" onclick="viewCourseDetails(${course.id})">
                    <div class="course-thumbnail">
                        <img src="${thumbnail}" alt="${course.title}" loading="lazy">
                    </div>
                    <div class="course-content">
                        <h3 class="course-title">${course.title}</h3>
                        <div class="course-meta">
                            <span class="course-meta-item">📚 ${gradeName}</span>
                            <span class="course-meta-item">🎬 ${course.video_count || 0} فيديو</span>
                        </div>
                        <div class="course-price ${priceClass}">${priceText}</div>
                        <button class="course-btn">عرض التفاصيل</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading courses:', error);
        const coursesGrid = document.getElementById('latestCoursesGrid');
        if (coursesGrid) {
            coursesGrid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; padding: 40px; color: var(--gray-500);">تعذر تحميل الكورسات</p>';
        }
    }
}

// View course details
function viewCourseDetails(courseId) {
    window.location.href = `course-details.html?id=${courseId}`;
}

// Utility functions

// Format date to Arabic
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format duration from seconds to minutes:seconds
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Calculate days remaining
function calculateDaysRemaining(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
}

// Format currency
function formatCurrency(amount) {
    return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

function ensureHttpOrigin() {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return true;
    }
    showAlert('يرجى تشغيل التطبيق عبر http:// أو https://، لا يمكن استخدام الدفع من ملف محلي.', 'error');
    return false;
}

function isHttpOrigin() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function waitForElement(selector, maxAttempts = 10, interval = 50) {
    return new Promise(resolve => {
        let attempts = 0;
        const check = () => {
            const element = document.querySelector(selector);
            if (element || attempts >= maxAttempts) {
                resolve(element);
            } else {
                attempts += 1;
                setTimeout(check, interval);
            }
        };
        check();
    });
}

function onDOMReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// Generate random code
function generateCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

const PUBLIC_STORAGE_BUCKETS = new Set(['notes', 'audio', 'exams', 'videos', 'thumbnails', 'attachments', 'final-reviews', 'payment-receipts']);

function isExternalUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function isStoragePath(value) {
    return typeof value === 'string' && !isExternalUrl(value) && value.includes('/');
}

async function resolveStorageAssetUrl(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return null;

    const normalized = decodeURIComponent(rawPath.trim());
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length < 2) return null;

    const bucket = segments[0];
    const objectPath = segments.slice(1).join('/');
    if (!bucket || !objectPath) return null;

    if (PUBLIC_STORAGE_BUCKETS.has(bucket)) {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        if (publicData && publicData.publicUrl) {
            return publicData.publicUrl;
        }
    }

    const { data: signedData, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
    if (signedError) {
        console.error('Unable to create signed URL for storage object:', bucket, objectPath, signedError);
        throw signedError;
    }
    return signedData?.signedUrl || null;
}

async function resolveFileUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    const trimmed = rawUrl.trim();
    if (isExternalUrl(trimmed)) return trimmed;
    if (isStoragePath(trimmed)) return await resolveStorageAssetUrl(trimmed);

    return trimmed;
}

function getPublicIdFromCloudinaryUrl(url) {
    try {
        const u = new URL(url);
        const segs = u.pathname.split('/').filter(Boolean);
        if (segs.length < 4) return null;
        const rest = segs.slice(3);
        const first = rest[0] || '';
        const isVersion = first.startsWith('v') && /^\d+$/.test(first.substring(1));
        return (isVersion ? rest.slice(1) : rest).join('/');
    } catch { return null; }
}

async function getSignedCloudinaryUrl(url) {
    const publicId = getPublicIdFromCloudinaryUrl(url);
    if (!publicId) return url;
    const sigUrl = CONFIG.SUPABASE.URL + '/functions/v1/cloudinary-signature?public_id=' + encodeURIComponent(publicId) + '&resource_type=raw';
    const res = await fetch(sigUrl, {
        headers: { apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: 'Bearer ' + CONFIG.SUPABASE.ANON_KEY }
    });
    if (!res.ok) return url;
    const data = await res.json();
    return data.signed_url || url;
}

async function openContentUrl(rawUrl) {
    try {
        const resolvedUrl = await resolveFileUrl(rawUrl);
        if (!resolvedUrl) throw new Error('رابط الملف غير صالح');

        const isPdf = resolvedUrl.toLowerCase().includes('.pdf') || rawUrl.toLowerCase().includes('.pdf');
        if (isPdf) {
            const signedUrl = await getSignedCloudinaryUrl(resolvedUrl);
            window.open(signedUrl, '_blank');
            return;
        }

        const tab = window.open('', '_blank');
        if (!tab) {
            alert('الرجاء السماح بفتح النوافذ المنبثقة حتى يتم فتح الملف.');
            return;
        }
        tab.location.href = resolvedUrl;
    } catch (error) {
        console.error('Failed to open content URL:', error);
        if (typeof tab !== 'undefined' && tab && tab.document) {
            tab.document.write('<div style="font-family:sans-serif;padding:24px;text-align:center;">تعذر فتح الملف. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.</div>');
            tab.document.close();
        } else {
            showAlert('تعذر فتح الملف', 'error');
        }
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('تم النسخ بنجاح', 'success');
    }).catch(err => {
        console.error('Copy error:', err);
        showAlert('فشل النسخ', 'error');
    });
}

// Lazy load images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Initialize lazy loading
lazyLoadImages();

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Add loading state to buttons
function setButtonLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = 'جاري التحميل...';
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
    }
}

// Validate phone number (Egyptian format)
function validatePhone(phone) {
    const phoneRegex = /^(01|00201)[0-9]{9}$/;
    return phoneRegex.test(phone);
}

// Validate password strength
function validatePassword(password) {
    return password.length >= 6;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Local storage helpers
const storage = {
    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            return localStorage.getItem(key);
        }
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
    remove(key) {
        localStorage.removeItem(key);
    }
};

// Session storage helpers
const session = {
    get(key) {
        try {
            return JSON.parse(sessionStorage.getItem(key));
        } catch (e) {
            return sessionStorage.getItem(key);
        }
    },
    set(key, value) {
        sessionStorage.setItem(key, JSON.stringify(value));
    },
    remove(key) {
        sessionStorage.removeItem(key);
    }
};

// API response handler
async function handleApiResponse(response, errorMessage = 'حدث خطأ') {
    if (!response.ok) {
        throw new Error(errorMessage);
    }
    return await response.json();
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Scroll to top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Get URL parameters
function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Set URL parameter
function setUrlParam(name, value) {
    const url = new URL(window.location);
    url.searchParams.set(name, value);
    window.history.pushState({}, '', url);
}

// Remove URL parameter
function removeUrlParam(name) {
    const url = new URL(window.location);
    url.searchParams.delete(name);
    window.history.pushState({}, '', url);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        calculateDaysRemaining,
        formatCurrency,
        generateCode,
        copyToClipboard,
        lazyLoadImages,
        setButtonLoading,
        validatePhone,
        validatePassword,
        debounce,
        throttle,
        storage,
        session,
        handleApiResponse,
        isInViewport,
        scrollToTop,
        getUrlParam,
        setUrlParam,
        removeUrlParam
    };
}
