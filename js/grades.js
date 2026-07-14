// Grades Module

// Load grades on home page
async function loadGrades() {
    try {
        const gradesGrid = document.getElementById('gradesGrid');
        if (!gradesGrid) return;

        gradesGrid.innerHTML = '<div class="spinner"></div>';

        const { data: grades, error } = await supabase
            .from('grades')
            .select('*')
            .eq('visible', true)
            .order('order', { ascending: true });

        if (error) throw error;

        if (!grades || grades.length === 0) {
            gradesGrid.innerHTML = '<p class="text-center">لا توجد صفوف دراسية حالياً</p>';
            return;
        }

        gradesGrid.innerHTML = grades.map(grade => `
            <div class="grade-card" onclick="selectGrade(${grade.id})">
                <div class="grade-card-icon">${grade.name.charAt(0)}</div>
                <h3 class="grade-card-title">${grade.name}</h3>
                <p class="grade-card-description">اضغط لعرض المحتوى</p>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading grades:', error);
        const gradesGrid = document.getElementById('gradesGrid');
        if (gradesGrid) {
            gradesGrid.innerHTML = '<p class="text-center">حدث خطأ أثناء تحميل الصفوف</p>';
        }
    }
}

// Select a grade and redirect to months page
function selectGrade(gradeId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    if (!currentUser.grade_id) {
        showAlert('يرجى اختيار صفك الدراسي أولاً', 'info');
        window.location.href = 'select-grade.html';
        return;
    }
    
    // Store selected grade in session
    sessionStorage.setItem('selectedGradeId', gradeId);
    window.location.href = 'months.html';
}

// Load latest videos
async function loadLatestVideos() {
    try {
        const videosGrid = document.getElementById('latestVideosGrid');
        if (!videosGrid) return;

        videosGrid.innerHTML = '<div class="spinner"></div>';

        const { data: videos, error } = await supabase
            .from('videos')
            .select(`
                *,
                grades (name),
                months (name)
            `)
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) throw error;

        if (!videos || videos.length === 0) {
            videosGrid.innerHTML = '<p class="text-center">لا توجد فيديوهات حالياً</p>';
            return;
        }

        videosGrid.innerHTML = videos.map(video => `
            <div class="video-card" onclick="watchVideo(${video.id})">
                <div class="video-thumbnail">
                    ${video.thumbnail ? `<img src="${video.thumbnail}" alt="${video.title}" loading="lazy">` : '<div class="placeholder-thumbnail"></div>'}
                    <div class="play-button">▶</div>
                </div>
                <div class="video-info">
                    <h3 class="video-title">${video.title}</h3>
                    <div class="video-meta">
                        <span>${video.grades?.name || ''}</span>
                        <span>${video.months?.name || ''}</span>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading latest videos:', error);
        const videosGrid = document.getElementById('latestVideosGrid');
        if (videosGrid) {
            videosGrid.innerHTML = '<p class="text-center">حدث خطأ أثناء تحميل الفيديوهات</p>';
        }
    }
}

// Load reviews (static for now, can be made dynamic)
function loadReviews() {
    const reviewsGrid = document.getElementById('reviewsGrid');
    if (!reviewsGrid) return;
    
    const reviews = [
        { name: 'أحمد محمد', rating: 5, text: 'منصة ممتازة والشرح واضح جداً. أنصح بها بشدة لكل الطلاب.' },
        { name: 'سارة أحمد', rating: 5, text: 'أفضل منصة تعليمية جربتها. المحتوى غني ومفيد.' },
        { name: 'محمد علي', rating: 4, text: 'شرح رائع ومحتوى قيم. شكراً للأستاذ الباسط.' }
    ];
    
    reviewsGrid.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div class="review-avatar">${review.name.charAt(0)}</div>
                <div>
                    <div class="review-name">${review.name}</div>
                    <div class="review-rating">${'★'.repeat(review.rating)}</div>
                </div>
            </div>
            <p class="review-text">${review.text}</p>
        </div>
    `).join('');
}

// Watch video
function watchVideo(videoId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    sessionStorage.setItem('selectedVideoId', videoId);
    window.location.href = 'video.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadGrades();
    loadLatestVideos();
    loadReviews();
});
