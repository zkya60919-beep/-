// Video Utilities - Format converters, URL parsers, and custom premium player template

function parseYouTubeId(url) {
    if (!url) return null;
    const s = String(url).trim();
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = s.match(p);
        if (m) return m[1];
    }
    return null;
}

function parseVimeoId(url) {
    const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
}

function getVideoSourceType(url) {
    if (!url) return 'unknown';
    if (parseYouTubeId(url)) return 'youtube';
    if (parseVimeoId(url)) return 'vimeo';
    if (/\.(mp4|webm|m3u8)(\?|$)/i.test(url) || url.includes('supabase.co/storage') || url.includes('r2.dev') || url.includes('cloudflarestorage.com')) return 'direct';
    return 'external';
}

function normalizeVideoUrl(url) {
    const trimmed = String(url).trim();
    const yt = parseYouTubeId(trimmed);
    if (yt) return `https://www.youtube.com/watch?v=${yt}`;
    return trimmed;
}

function getYouTubeThumbnail(url) {
    const id = parseYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function buildVideoPlayerHtml(url, options = {}) {
    const { hasAccess = true } = options;
    if (!hasAccess) {
        return `
            <div class="locked-overlay">
                <div class="lock-icon">🔒</div>
                <div class="locked-message">هذا الفيديو متاح للمشتركين فقط</div>
                <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">اشترك الآن</button>
            </div>`;
    }

    if (options.hlsUrl) {
        url = options.hlsUrl;
    }

    const type = getVideoSourceType(url);
    const yt = parseYouTubeId(url);
    const vimeo = parseVimeoId(url);

    // If it's standard YouTube embed
    if (type === 'youtube' && yt) {
        return `
            <div class="embed-responsive">
                <iframe
                    src="https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1"
                    title="فيديو"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    loading="lazy"
                ></iframe>
            </div>`;
    }

    // If it's standard Vimeo embed
    if (type === 'vimeo' && vimeo) {
        return `
            <div class="embed-responsive">
                <iframe src="https://player.vimeo.com/video/${vimeo}" frameborder="0" allowfullscreen allow="autoplay"></iframe>
            </div>`;
    }

    // Premium Protected custom HTML5 and HLS video player markup
    return `
        <div class="premium-player-container" id="premiumPlayer" data-url="${url}"${options.originalUrl ? ` data-original-url="${options.originalUrl}"` : ''}>
            <video id="premiumVideo" class="premium-video" playsinline preload="metadata" oncontextmenu="return false;" disablePictureInPicture controlsList="nodownload noremoteplayback" src="${url}">

            <!-- Loader Spinner -->
            <div class="player-spinner" id="playerSpinner">
                <div class="spinner-ring"></div>
            </div>

            <!-- Watch Resume toast inside player -->
            <div class="watch-resume-toast" id="watchResumeToast">
                <span class="resume-toast-text">استئناف المشاهدة من حيث توقفت؟</span>
                <div class="toast-btns">
                    <button type="button" class="btn-toast-yes" id="btnResumeYes">نعم</button>
                    <button type="button" class="btn-toast-no" id="btnResumeNo">تجاهل</button>
                </div>
            </div>

            <!-- Custom Controls -->
            <div class="custom-controls" id="customControls">
                <!-- Seek Bar -->
                <div class="progress-container" id="seekBarContainer">
                    <div class="seek-tooltip" id="seekTooltip">00:00</div>
                    <div class="progress-bar-rail">
                        <div class="buffer-bar" id="bufferBarFill"></div>
                        <div class="playback-bar" id="playbackBarFill"></div>
                        <div class="seek-handle" id="seekHandle"></div>
                    </div>
                </div>

                <div class="controls-row">
                    <!-- Left actions (Play, volume, duration) -->
                    <div class="controls-group">
                        <button type="button" class="control-btn" id="playPauseBtn" title="تشغيل/إيقاف">▶</button>
                        
                        <div class="volume-container" id="volumeContainer">
                            <button type="button" class="control-btn" id="muteBtn" title="كتم الصوت">🔊</button>
                            <div class="volume-slider-wrapper">
                                <input type="range" class="volume-slider" id="volumeSlider" min="0" max="1" step="0.05" value="1">
                            </div>
                        </div>

                        <div class="time-display">
                            <span id="currentTime">00:00</span>
                            <span class="time-separator">/</span>
                            <span id="durationTime">00:00</span>
                        </div>
                    </div>

                    <!-- Right actions (Speed, Quality, Fullscreen) -->
                    <div class="controls-group">
                        <!-- Playback Speed -->
                        <div class="dropdown-control" id="speedDropdownContainer">
                            <button type="button" class="control-btn dropdown-btn" id="speedBtn" title="سرعة التشغيل">1.0x</button>
                            <div class="dropdown-menu" id="speedMenu">
                                <div class="dropdown-item" data-speed="0.5">0.5x</div>
                                <div class="dropdown-item" data-speed="0.75">0.75x</div>
                                <div class="dropdown-item active" data-speed="1">1.0x</div>
                                <div class="dropdown-item" data-speed="1.25">1.25x</div>
                                <div class="dropdown-item" data-speed="1.5">1.5x</div>
                                <div class="dropdown-item" data-speed="2">2.0x</div>
                            </div>
                        </div>

                        <!-- Quality Level (Filled by Hls.js) -->
                        <div class="dropdown-control" id="qualityDropdownContainer">
                            <button type="button" class="control-btn dropdown-btn" id="qualityBtn" title="الجودة">تلقائي</button>
                            <div class="dropdown-menu" id="qualityMenu">
                                <div class="dropdown-item active" data-quality="-1">تلقائي (Auto)</div>
                            </div>
                        </div>

                        <button type="button" class="control-btn" id="fullscreenBtn" title="ملء الشاشة">📺</button>
                    </div>
                </div>
            </div>
        </div>`;
}

window.parseYouTubeId = parseYouTubeId;
window.getVideoSourceType = getVideoSourceType;
window.normalizeVideoUrl = normalizeVideoUrl;
window.getYouTubeThumbnail = getYouTubeThumbnail;
window.buildVideoPlayerHtml = buildVideoPlayerHtml;

function renderVideoPlayerHtml(url, opts = {}) {
    const hasAccess = opts.locked === true ? false : (opts.hasAccess !== false);
    return buildVideoPlayerHtml(url, {
        hasAccess,
        hlsUrl: opts.hlsUrl,
        originalUrl: opts.originalUrl || ''
    });
}

window.renderVideoPlayerHtml = renderVideoPlayerHtml;
