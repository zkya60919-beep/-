// Premium Video Player Controller with HLS, Security Watermark, and Resume Watch capabilities

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    await loadVideo();
    await loadRelatedVideos();
});

async function loadVideo() {
    try {
        const videoId = sessionStorage.getItem('selectedVideoId');
        if (!videoId) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        const videoIdNum = parseInt(videoId);
        console.log('selectedVideoId:', videoId, 'parsed:', videoIdNum);
        if (isNaN(videoIdNum)) {
            showAlert('معرف الفيديو غير صالح', 'error');
            window.location.href = 'dashboard.html';
            return;
        }
        console.log('1: before getVideo');
        const video = await db.getVideo(videoIdNum);
        console.log('2: after getVideo');
        if (!video) {
            showAlert('الفيديو غير موجود', 'error');
            window.location.href = 'dashboard.html';
            return;
        }
        console.log('3: after null check');
        
        // Check subscription/access
        const activeSubscription = await db.getActiveSubscription(currentUser.id, video.month_id);
        console.log('4: after getActiveSubscription');
        const hasAccess = activeSubscription || video.is_free;
        
        // Update details card
        document.getElementById('videoTitle').textContent = video.title;
        document.getElementById('videoDescription').textContent = video.description || '';
        
        console.log('5: before getGrades');
        const grades = await db.getGrades();
        console.log('6: after getGrades');
        const months = await db.getMonths(video.grade_id);
        const grade = grades.find(g => g.id === video.grade_id);
        const month = months.find(m => m.id === video.month_id);
        
        document.getElementById('videoGrade').textContent = grade ? grade.name : '-';
        document.getElementById('videoMonth').textContent = month ? month.name : '-';
        
        // Render video player (with signed URL if possible)
        const videoWrapper = document.getElementById('videoWrapper');
        let playUrl = video.hls_url || video.playback_url || video.video_url;
        
        // Try to get a signed URL for protected videos
        if (hasAccess && !video.is_free) {
            try {
                const signedRes = await fetch(`${CONFIG.SUPABASE.URL}/functions/v1/signed-url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE.ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE.ANON_KEY}` },
                    body: JSON.stringify({ video_id: parseInt(videoId), user_id: currentUser.id })
                });
                if (signedRes.ok) {
                    const signedData = await signedRes.json();
                    if (signedData.success && signedData.signed_url) {
                        playUrl = signedData.signed_url;
                    }
                }
            } catch (e) {
                console.warn('Signed URL fetch failed, using original URL:', e);
            }
        }
        
        const sourceType = getVideoSourceType(playUrl);
        const fallbackUrl = (video.video_url || video.playback_url || '');
        const willTransformToHls = !!(video.hls_url || playUrl.includes('.m3u8') || playUrl.includes('sp_hd,') || (playUrl.includes('res.cloudinary.com') && !playUrl.endsWith('.m3u8')));
        videoWrapper.innerHTML = renderVideoPlayerHtml(playUrl, {
            locked: !hasAccess,
            hlsUrl: video.hls_url,
            originalUrl: (willTransformToHls && fallbackUrl && !fallbackUrl.includes('.m3u8')) ? fallbackUrl : ''
        });
        
        if (hasAccess && sourceType !== 'youtube' && sourceType !== 'vimeo') {
            initPremiumPlayer(video.id);
        }
        
    } catch (error) {
        console.error('Error loading video:', error);
        console.dir(error);
        if (error && error.message) console.error('Error message:', error.message);
        if (error && error.code) console.error('Error code:', error.code);
        console.error('Stack:', error instanceof Error ? error.stack : new Error().stack);
        showAlert('حدث خطأ أثناء تحميل الفيديو', 'error');
    }
}

async function loadRelatedVideos() {
    try {
        const videoId = sessionStorage.getItem('selectedVideoId');
        const video = await db.getVideo(parseInt(videoId));
        
        if (!video) return;
        
        const videos = await db.getVideos(video.grade_id, video.month_id);
        const relatedVideos = videos.filter(v => v.id !== parseInt(videoId)).slice(0, 6);
        
        const grid = document.getElementById('relatedVideosGrid');
        
        if (relatedVideos.length === 0) {
            grid.innerHTML = '<p class="text-center">لا توجد فيديوهات ذات صلة</p>';
            return;
        }
        
        grid.innerHTML = relatedVideos.map(v => `
            <div class="video-card" onclick="watchVideo(${v.id})">
                <div class="video-thumbnail">
                    ${v.thumbnail ? `<img src="${v.thumbnail}" alt="${v.title}" loading="lazy">` : '<div class="placeholder-thumbnail"></div>'}
                    <div class="play-button">▶</div>
                </div>
                <div class="video-info">
                    <h3 class="video-title">${v.title}</h3>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading related videos:', error);
    }
}

function watchVideo(videoId) {
    sessionStorage.setItem('selectedVideoId', videoId);
    window.location.reload();
}

function showPlayerError(message) {
    const wrapper = document.getElementById('videoWrapper');
    if (!wrapper) return;
    const existing = wrapper.querySelector('.player-error');
    if (existing) return;
    const div = document.createElement('div');
    div.className = 'player-error';
    div.style.cssText = 'text-align:center;padding:40px 20px;background:var(--bg-card, #fff);border-radius:12px;margin:20px 0;';
    div.innerHTML = `<p style="font-size:48px;margin-bottom:16px;">⚠️</p>
        <p style="font-size:18px;font-weight:700;color:var(--text, #333);margin-bottom:8px;">${message}</p>
        <p style="font-size:14px;color:var(--gray-500, #888);">يمكنك التواصل مع الدعم الفني لحل المشكلة.</p>`;
    wrapper.innerHTML = '';
    wrapper.appendChild(div);
}

/* --- Premium Player Event Handlers & Security Core --- */
function initPremiumPlayer(videoId) {
    const playerContainer = document.getElementById('premiumPlayer');
    const video = document.getElementById('premiumVideo');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const centerPlayBtn = document.getElementById('centerPlayBtn');
    const spinner = document.getElementById('playerSpinner');
    const watermark = document.getElementById('playerWatermark');

    // Controls panels
    const customControls = document.getElementById('customControls');
    const seekBarContainer = document.getElementById('seekBarContainer');
    const playbackBarFill = document.getElementById('playbackBarFill');
    const bufferBarFill = document.getElementById('bufferBarFill');
    const seekHandle = document.getElementById('seekHandle');
    const seekTooltip = document.getElementById('seekTooltip');

    // Mute & Volume
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');

    // Playback Speed
    const speedBtn = document.getElementById('speedBtn');
    const speedMenu = document.getElementById('speedMenu');

    // Quality Selector
    const qualityBtn = document.getElementById('qualityBtn');
    const qualityMenu = document.getElementById('qualityMenu');

    // Fullscreen
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // Video URL from container
    const videoUrl = playerContainer.dataset.url;
    const originalUrl = playerContainer.dataset.originalUrl;

    let hls = null;
    let hlsRetryCount = 0;
    const HLS_MAX_RETRIES = 3;
    let savedVolume = localStorage.getItem('player_vol') !== null ? parseFloat(localStorage.getItem('player_vol')) : 1;

    // Load user volume preference
    video.volume = savedVolume;
    volumeSlider.value = savedVolume;
    updateVolumeIcon(savedVolume);

    /* --- 1. Decoders and Hls.js Initialization --- */
    if (videoUrl.endsWith('.m3u8')) {
        if (Hls.isSupported()) {
            hls = new Hls({
                maxMaxBufferLength: 30, // Max buffering size (seconds)
                enableWorker: true
            });
            hls.loadSource(videoUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                // Manifest parsed successfully, load resolution list
                populateQualityMenu(hls, qualityMenu, qualityBtn);
                spinner.style.display = 'none';
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (!data.fatal) return;
                hlsRetryCount++;
                if (hlsRetryCount > HLS_MAX_RETRIES) {
                    if (originalUrl && !originalUrl.includes('.m3u8')) {
                        console.warn('HLS failed, falling back to original URL:', originalUrl);
                        hls.destroy();
                        hls = null;
                        video.src = originalUrl;
                        spinner.style.display = 'none';
                        qualityBtn.style.display = 'none';
                        return;
                    }
                    spinner.style.display = 'none';
                    showPlayerError('فشل تحميل الفيديو. قد يكون الرابط غير صالح.');
                    return;
                }
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        break;
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS for Safari (iOS/Safari Mac)
            video.src = videoUrl;
            qualityBtn.style.display = 'none'; // Controlled by iOS native player
            spinner.style.display = 'none';
        }
    } else {
        // Standard MP4 direct playback
        video.src = videoUrl;
        qualityBtn.style.display = 'none'; // Raw files have single quality
        video.addEventListener('loadedmetadata', () => {
            spinner.style.display = 'none';
        });
    }

    // Video-level error handler for all types
    video.addEventListener('error', () => {
        spinner.style.display = 'none';
        showPlayerError('حدث خطأ أثناء تحميل الفيديو. تأكد من اتصالك بالإنترنت أو أن رابط الفيديو صحيح.');
    });

    /* --- 2. Security Watermark Implementation --- */
    if (currentUser) {
        const textContent = `مُسجل للطالب: ${currentUser.name} (${currentUser.phone})`;
        watermark.textContent = textContent;
        
        const watermark2 = document.getElementById('playerWatermark2');
        const watermark3 = document.getElementById('playerWatermark3');
        if (watermark2) watermark2.textContent = textContent;
        if (watermark3) watermark3.textContent = textContent;
        
        // Dynamic floating mechanism: shifts position every 6 seconds randomly
        function moveWatermark() {
            const containerWidth = playerContainer.offsetWidth;
            const containerHeight = playerContainer.offsetHeight;
            const watermarkWidth = watermark.offsetWidth || 250;
            const watermarkHeight = watermark.offsetHeight || 30;

            const maxTop = containerHeight - watermarkHeight - 60; // Keep space for controls
            const maxLeft = containerWidth - watermarkWidth - 20;

            const randomTop = Math.max(20, Math.floor(Math.random() * maxTop));
            const randomLeft = Math.max(20, Math.floor(Math.random() * maxLeft));

            watermark.style.top = `${randomTop}px`;
            watermark.style.left = `${randomLeft}px`;

            // Second watermark (different position)
            if (watermark2) {
                const maxTop2 = containerHeight - (watermark2.offsetHeight || 30) - 60;
                const maxLeft2 = containerWidth - (watermark2.offsetWidth || 250) - 20;
                watermark2.style.top = `${Math.max(20, Math.floor(Math.random() * maxTop2))}px`;
                watermark2.style.left = `${Math.max(20, Math.floor(Math.random() * maxLeft2))}px`;
            }

            // Third watermark (different position)
            if (watermark3) {
                const maxTop3 = containerHeight - (watermark3.offsetHeight || 30) - 60;
                const maxLeft3 = containerWidth - (watermark3.offsetWidth || 250) - 20;
                watermark3.style.top = `${Math.max(20, Math.floor(Math.random() * maxTop3))}px`;
                watermark3.style.left = `${Math.max(20, Math.floor(Math.random() * maxLeft3))}px`;
            }
        }

        // Run immediately after rendering
        setTimeout(moveWatermark, 1000);
        setInterval(moveWatermark, 6000);
    }

    /* --- 3. Resume Watching Toast Trigger --- */
    const resumeToast = document.getElementById('watchResumeToast');
    const btnResumeYes = document.getElementById('btnResumeYes');
    const btnResumeNo = document.getElementById('btnResumeNo');
    const progressKey = `albasit_progress_${currentUser.id}_${videoId}`;
    const savedTime = localStorage.getItem(progressKey);

    video.addEventListener('loadedmetadata', () => {
        if (savedTime) {
            const time = parseFloat(savedTime);
            // Prompt if between 15 seconds and 92% of the video duration
            if (time > 15 && time < (video.duration * 0.92)) {
                const textTime = formatTime(time);
                document.querySelector('.resume-toast-text').textContent = `هل ترغب في استكمال المحاضرة من دقيقة ${textTime}؟`;
                resumeToast.classList.add('show');
                
                // Auto dismiss toast in 10 seconds
                setTimeout(() => resumeToast.classList.remove('show'), 10000);
            }
        }
    });

    btnResumeYes.addEventListener('click', () => {
        video.currentTime = parseFloat(savedTime);
        resumeToast.classList.remove('show');
        togglePlay();
    });

    btnResumeNo.addEventListener('click', () => {
        resumeToast.classList.remove('show');
        localStorage.removeItem(progressKey);
    });

    // Save playback time every 3 seconds
    video.addEventListener('timeupdate', () => {
        if (video.currentTime > 5 && !video.paused) {
            localStorage.setItem(progressKey, video.currentTime);
        }
    });

    /* --- 4. Controls Events Hooks --- */
    // Play/Pause toggles
    function togglePlay() {
        if (video.paused) {
            video.play();
            playPauseBtn.textContent = '⏸';
            centerPlayBtn.classList.add('hide');
            hideControlsDelayed();
        } else {
            video.pause();
            playPauseBtn.textContent = '▶';
            centerPlayBtn.classList.remove('hide');
            showControls();
        }
    }

    playPauseBtn.addEventListener('click', togglePlay);
    centerPlayBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);

    // Progress updates
    video.addEventListener('timeupdate', () => {
        const percent = (video.currentTime / video.duration) * 100;
        playbackBarFill.style.width = `${percent}%`;
        seekHandle.style.left = `${percent}%`;
        document.getElementById('currentTime').textContent = formatTime(video.currentTime);
    });

    video.addEventListener('durationchange', () => {
        document.getElementById('durationTime').textContent = formatTime(video.duration);
    });

    // Buffer range update
    video.addEventListener('progress', () => {
        if (video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const percent = (bufferedEnd / video.duration) * 100;
            bufferBarFill.style.width = `${percent}%`;
        }
    });

    // Seeking mechanisms
    let isSeeking = false;
    function seekToPosition(e) {
        const rect = seekBarContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        const duration = video.duration;
        if (!isFinite(duration) || duration <= 0) return;
        
        playbackBarFill.style.width = `${percent * 100}%`;
        seekHandle.style.left = `${percent * 100}%`;
        video.currentTime = percent * duration;
    }

    seekBarContainer.addEventListener('mousedown', (e) => {
        isSeeking = true;
        seekToPosition(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isSeeking) seekToPosition(e);
    });

    document.addEventListener('mouseup', () => {
        isSeeking = false;
    });

    // Touch support for mobiles/tablets
    seekBarContainer.addEventListener('touchstart', (e) => {
        isSeeking = true;
        seekToPosition(e);
    });

    seekBarContainer.addEventListener('touchmove', (e) => {
        if (isSeeking) seekToPosition(e);
    });

    seekBarContainer.addEventListener('touchend', () => {
        isSeeking = false;
    });

    // Hover time tooltip on Seekbar
    seekBarContainer.addEventListener('mousemove', (e) => {
        const rect = seekBarContainer.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const percent = hoverX / rect.width;
        const time = percent * video.duration;
        
        if (time >= 0 && time <= video.duration) {
            seekTooltip.style.left = `${hoverX}px`;
            seekTooltip.textContent = formatTime(time);
            seekTooltip.style.display = 'block';
        }
    });

    seekBarContainer.addEventListener('mouseleave', () => {
        seekTooltip.style.display = 'none';
    });

    // Volume Slider & Mute
    volumeSlider.addEventListener('input', () => {
        video.volume = volumeSlider.value;
        savedVolume = volumeSlider.value;
        localStorage.setItem('player_vol', savedVolume);
        updateVolumeIcon(savedVolume);
    });

    muteBtn.addEventListener('click', () => {
        if (video.volume > 0) {
            video.volume = 0;
            volumeSlider.value = 0;
            muteBtn.textContent = '🔇';
        } else {
            video.volume = savedVolume || 1;
            volumeSlider.value = savedVolume || 1;
            updateVolumeIcon(savedVolume || 1);
        }
    });

    function updateVolumeIcon(vol) {
        if (vol === 0) {
            muteBtn.textContent = '🔇';
        } else if (vol < 0.5) {
            muteBtn.textContent = '🔉';
        } else {
            muteBtn.textContent = '🔊';
        }
    }

    // Playback Speed dropdown trigger
    speedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speedMenu.classList.toggle('show');
        qualityMenu.classList.remove('show');
    });

    speedMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            speedMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const rate = parseFloat(item.dataset.speed);
            video.playbackRate = rate;
            speedBtn.textContent = rate === 1 ? '1.0x' : `${rate}x`;
            speedMenu.classList.remove('show');
        });
    });

    // Quality dropdown trigger
    qualityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        qualityMenu.classList.toggle('show');
        speedMenu.classList.remove('show');
    });

    // Close menus when clicking anywhere
    document.addEventListener('click', () => {
        speedMenu.classList.remove('show');
        qualityMenu.classList.remove('show');
    });

    // Fullscreen toggle logic (container-level to preserve custom interface)
    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (playerContainer.requestFullscreen) {
                playerContainer.requestFullscreen();
            } else if (playerContainer.webkitRequestFullscreen) {
                playerContainer.webkitRequestFullscreen();
            } else if (playerContainer.mozRequestFullScreen) {
                playerContainer.mozRequestFullScreen();
            } else if (playerContainer.msRequestFullscreen) {
                playerContainer.msRequestFullscreen();
            }
            fullscreenBtn.textContent = '🗖';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            fullscreenBtn.textContent = '📺';
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Double-click on video area toggles fullscreen
    video.addEventListener('dblclick', (e) => {
        e.preventDefault();
        toggleFullscreen();
    });

    /* --- 5. Controls Overlay Auto-Hide Timeout --- */
    let controlsTimeout = null;
    function showControls() {
        customControls.classList.add('active');
        playerContainer.style.cursor = 'default';
        if (controlsTimeout) clearTimeout(controlsTimeout);
    }

    function hideControlsDelayed() {
        if (controlsTimeout) clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (!video.paused && !isSeeking && !speedMenu.classList.contains('show') && !qualityMenu.classList.contains('show')) {
                customControls.classList.remove('active');
                playerContainer.style.cursor = 'none';
            }
        }, 3000);
    }

    playerContainer.addEventListener('mousemove', () => {
        showControls();
        hideControlsDelayed();
    });

    playerContainer.addEventListener('mouseleave', () => {
        if (!video.paused) {
            customControls.classList.remove('active');
        }
    });

    /* --- 6. Tab Switch Protection (prevents background recording) --- */
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !video.paused) {
            video.pause();
            playPauseBtn.textContent = '▶';
            centerPlayBtn.classList.remove('hide');
            showControls();
        }
    });

    /* --- 7. Security Keyboard & Shortcuts Blockers --- */
    // Prevent right-click context menu on entire container
    playerContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    // Disable standard video hotkeys globally
    document.addEventListener('keydown', (e) => {
        // Space to Play/Pause
        if (e.code === 'Space' && document.activeElement !== volumeSlider) {
            e.preventDefault();
            togglePlay();
        }
        // Left arrow to go back 5s
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            video.currentTime = Math.max(video.currentTime - 5, 0);
            showControls();
            hideControlsDelayed();
        }
        // Right arrow to go forward 5s
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            video.currentTime = Math.min(video.currentTime + 5, video.duration);
            showControls();
            hideControlsDelayed();
        }
        // Up arrow volume up
        if (e.code === 'ArrowUp') {
            e.preventDefault();
            const newVol = Math.min(video.volume + 0.05, 1);
            video.volume = newVol;
            volumeSlider.value = newVol;
            updateVolumeIcon(newVol);
        }
        // Down arrow volume down
        if (e.code === 'ArrowDown') {
            e.preventDefault();
            const newVol = Math.max(video.volume - 0.05, 0);
            video.volume = newVol;
            volumeSlider.value = newVol;
            updateVolumeIcon(newVol);
        }
        // 'F' key toggles fullscreen
        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleFullscreen();
        }
    });
}

/* --- Populate Hls.js quality items dynamically --- */
function populateQualityMenu(hls, menu, btn) {
    const levels = hls.levels;
    if (levels.length <= 1) return; // Single bitrate, no quality selection needed

    // Clear and add Auto
    menu.innerHTML = '<div class="dropdown-item active" data-quality="-1">تلقائي (Auto)</div>';

    levels.forEach((lvl, idx) => {
        const height = lvl.height || (lvl.attrs && lvl.attrs.RESOLUTION ? lvl.attrs.RESOLUTION.split('x')[1] : null);
        const name = height ? `${height}p` : `جودة ${idx + 1}`;
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = name;
        item.dataset.quality = idx;
        menu.appendChild(item);
    });

    menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const qualityIdx = parseInt(item.dataset.quality, 10);
            hls.currentLevel = qualityIdx;

            btn.textContent = qualityIdx === -1 ? 'تلقائي' : item.textContent;
            menu.classList.remove('show');
        });
    });
}

/* --- Helper function to format seconds into HH:MM:SS --- */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (n) => String(n).padStart(2, '0');

    if (hrs > 0) {
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
}

function showAlert(message, type) {
    document.querySelectorAll('.alert').forEach(a => a.remove());
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = message;
    document.body.insertBefore(el, document.body.firstChild);
    setTimeout(() => el.remove(), 7000);
}
