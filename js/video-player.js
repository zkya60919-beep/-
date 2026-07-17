/**
 * Professional HLS Video Player Module
 * مشغل فيديو احترافي يدعم HLS Streaming مع ميزات متقدمة
 */

class ProfessionalVideoPlayer {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            autoplay: options.autoplay || false,
            muted: options.muted || false,
            controls: options.controls !== false,
            loop: options.loop || false,
            preload: options.preload || 'metadata',
            playbackRates: options.playbackRates || [0.5, 0.75, 1, 1.25, 1.5, 2],
            qualityLevels: options.qualityLevels || ['auto', '720p', '480p', '360p'],
            ...options
        };

        this.videoElement = null;
        this.hlsInstance = null;
        this.currentTime = 0;
        this.duration = 0;
        this.isPlaying = false;
        this.playbackRate = 1;
        this.currentQuality = 'auto';
        this.isFullscreen = false;
        this.volume = 1;

        this.init();
    }

    init() {
        this.createPlayer();
        this.setupEventListeners();
        this.loadSavedState();
    }

    createPlayer() {
        const wrapper = document.createElement('div');
        wrapper.className = 'premium-video-player';
        wrapper.style.position = 'relative';
        wrapper.style.userSelect = 'none';
        wrapper.oncontextmenu = () => false; // Disable right click
        wrapper.ondragstart = () => false; // Disable drag & drop
        
        wrapper.innerHTML = `
            <div class="player-container">
                <video class="video-element" playsinline disablePictureInPicture controlsList="nodownload noplaybackrate"></video>
                <div class="loading-spinner" style="display: none;">
                    <div class="spinner"></div>
                </div>
                <div class="player-controls">
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-buffered"></div>
                            <div class="progress-played"></div>
                            <div class="progress-thumb"></div>
                        </div>
                        <div class="time-display">
                            <span class="current-time">0:00</span>
                            <span class="time-separator">/</span>
                            <span class="total-time">0:00</span>
                        </div>
                    </div>
                    <div class="controls-row">
                        <div class="controls-left">
                            <button class="control-btn btn-play" aria-label="تشغيل/إيقاف">
                                <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                                <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                </svg>
                            </button>
                            <button class="control-btn btn-volume" aria-label="الصوت">
                                <svg class="icon-volume-high" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                </svg>
                                <svg class="icon-volume-muted" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                                </svg>
                            </button>
                            <div class="volume-slider-container" style="display: none;">
                                <input type="range" class="volume-slider" min="0" max="1" step="0.1" value="1">
                            </div>
                            <div class="time-divider"></div>
                            <button class="control-btn btn-speed" aria-label="السرعة">
                                <span class="speed-label">1x</span>
                            </button>
                            <div class="speed-menu" style="display: none;">
                                ${this.options.playbackRates.map(rate => 
                                    `<button class="speed-option" data-rate="${rate}">${rate}x</button>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="controls-right">
                            <button class="control-btn btn-quality" aria-label="الجودة">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                                </svg>
                                <span class="quality-label">Auto</span>
                            </button>
                            <div class="quality-menu" style="display: none;">
                                ${this.options.qualityLevels.map(quality => 
                                    `<button class="quality-option" data-quality="${quality}">${quality === 'auto' ? 'تلقائي' : quality}</button>`
                                ).join('')}
                            </div>
                            <button class="control-btn btn-fullscreen" aria-label="ملء الشاشة">
                                <svg class="icon-enter" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                                </svg>
                                <svg class="icon-exit" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        this.videoElement = wrapper.querySelector('.video-element');
        this.setupElements();
    }

    setupElements() {
        const wrapper = this.container.querySelector('.premium-video-player');
        
        this.elements = {
            wrapper,
            video: wrapper.querySelector('.video-element'),
            loadingSpinner: wrapper.querySelector('.loading-spinner'),
            playBtn: wrapper.querySelector('.btn-play'),
            volumeBtn: wrapper.querySelector('.btn-volume'),
            volumeSlider: wrapper.querySelector('.volume-slider'),
            volumeContainer: wrapper.querySelector('.volume-slider-container'),
            speedBtn: wrapper.querySelector('.btn-speed'),
            speedMenu: wrapper.querySelector('.speed-menu'),
            speedLabel: wrapper.querySelector('.speed-label'),
            qualityBtn: wrapper.querySelector('.btn-quality'),
            qualityMenu: wrapper.querySelector('.quality-menu'),
            qualityLabel: wrapper.querySelector('.quality-label'),
            fullscreenBtn: wrapper.querySelector('.btn-fullscreen'),
            progressBar: wrapper.querySelector('.progress-bar'),
            progressBuffered: wrapper.querySelector('.progress-buffered'),
            progressPlayed: wrapper.querySelector('.progress-played'),
            progressThumb: wrapper.querySelector('.progress-thumb'),
            currentTime: wrapper.querySelector('.current-time'),
            totalTime: wrapper.querySelector('.total-time'),
            iconPlay: wrapper.querySelector('.icon-play'),
            iconPause: wrapper.querySelector('.icon-pause'),
            iconVolumeHigh: wrapper.querySelector('.icon-volume-high'),
            iconVolumeMuted: wrapper.querySelector('.icon-volume-muted'),
            iconFullscreenEnter: wrapper.querySelector('.icon-enter'),
            iconFullscreenExit: wrapper.querySelector('.icon-exit')
        };
    }

    setupEventListeners() {
        const { video, playBtn, volumeBtn, volumeSlider, speedBtn, qualityBtn, fullscreenBtn, progressBar } = this.elements;

        // Video events
        video.addEventListener('play', () => this.onPlay());
        video.addEventListener('pause', () => this.onPause());
        video.addEventListener('timeupdate', () => this.onTimeUpdate());
        video.addEventListener('progress', () => this.onProgress());
        video.addEventListener('durationchange', () => this.onDurationChange());
        video.addEventListener('volumechange', () => this.onVolumeChange());
        video.addEventListener('waiting', () => this.onWaiting());
        video.addEventListener('canplay', () => this.onCanPlay());
        video.addEventListener('error', (e) => this.onError(e));

        // Control buttons
        playBtn.addEventListener('click', () => this.togglePlay());
        volumeBtn.addEventListener('click', () => this.toggleVolumeMenu());
        volumeSlider.addEventListener('input', (e) => this.setVolume(parseFloat(e.target.value)));
        speedBtn.addEventListener('click', () => this.toggleSpeedMenu());
        qualityBtn.addEventListener('click', () => this.toggleQualityMenu());
        fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Speed options
        this.elements.speedMenu.querySelectorAll('.speed-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const rate = parseFloat(btn.dataset.rate);
                this.setPlaybackRate(rate);
                this.toggleSpeedMenu();
            });
        });

        // Quality options
        this.elements.qualityMenu.querySelectorAll('.quality-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const quality = btn.dataset.quality;
                this.setQuality(quality);
                this.toggleQualityMenu();
            });
        });

        // Progress bar
        progressBar.addEventListener('click', (e) => this.seek(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Fullscreen change
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    }

    loadSource(source, type = 'hls', videoId = null) {
        const { video } = this.elements;

        // Store video ID for Session Guard
        this._videoId = videoId || source;

        // Destroy existing HLS instance
        if (this.hlsInstance) {
            this.hlsInstance.destroy();
            this.hlsInstance = null;
        }

        if (type === 'hls' && source.includes('.m3u8')) {
            if (Hls.isSupported()) {
                this.hlsInstance = new Hls({
                    debug: false,
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90,
                    maxBufferLength: 600
                });

                this.hlsInstance.loadSource(source);
                this.hlsInstance.attachMedia(video);

                this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                    this.setupQualityLevels();
                });

                this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        this.onError(data);
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = source;
            } else {
                console.error('HLS not supported');
            }
        } else {
            video.src = source;
        }
    }

    /**
     * التحقق من Session Guard قبل التشغيل
     */
    async _checkSessionBeforePlay() {
        if (!window.SessionGuard) return true;

        const userId = localStorage.getItem('userId');
        if (!userId) return true; // غير مسجل - اسمح

        const videoId = this._videoId || 'unknown';
        const result = await window.SessionGuard.startSession(videoId, userId);

        if (!result.allowed) {
            // إيقاف الفيديو
            this.elements.video.pause();
            this.onPause();

            // عرض رسالة الحجب
            window.SessionGuard.showBlockedMessage(result.message || 'الحساب مستخدم على جهاز آخر');
            return false;
        }

        return true;
    }

    setupQualityLevels() {
        if (!this.hlsInstance) return;

        const levels = this.hlsInstance.levels;
        if (levels && levels.length > 0) {
            this.elements.qualityMenu.innerHTML = `
                <button class="quality-option" data-quality="auto">تلقائي</button>
                ${levels.map((level, index) => `
                    <button class="quality-option" data-quality="${index}">
                        ${level.height}p
                    </button>
                `).join('')}
            `;
        }
    }

    setQuality(quality) {
        if (!this.hlsInstance) return;

        if (quality === 'auto') {
            this.hlsInstance.currentLevel = -1;
            this.elements.qualityLabel.textContent = 'Auto';
        } else {
            const levelIndex = parseInt(quality);
            this.hlsInstance.currentLevel = levelIndex;
            const level = this.hlsInstance.levels[levelIndex];
            this.elements.qualityLabel.textContent = `${level.height}p`;
        }

        this.currentQuality = quality;
        this.saveState();
    }

    async togglePlay() {
        const { video } = this.elements;
        if (video.paused) {
            // التحقق من Session Guard أولاً
            const allowed = await this._checkSessionBeforePlay();
            if (!allowed) return;
            video.play();
        } else {
            video.pause();
        }
    }

    onPlay() {
        this.isPlaying = true;
        this.elements.iconPlay.style.display = 'none';
        this.elements.iconPause.style.display = 'block';

        // استئناف heartbeat عند التشغيل
        if (window.SessionGuard) {
            const userId = localStorage.getItem('userId');
            if (userId) window.SessionGuard.resume(userId);
        }
    }

    onPause() {
        this.isPlaying = false;
        this.elements.iconPlay.style.display = 'block';
        this.elements.iconPause.style.display = 'none';
        this.saveState();

        // إيقاف heartbeat مؤقتاً عند الإيقاف
        if (window.SessionGuard) {
            window.SessionGuard.pause();
        }
    }

    onTimeUpdate() {
        const { video, currentTime: timeEl, progressPlayed, progressThumb } = this.elements;
        this.currentTime = video.currentTime;
        this.duration = video.duration;

        const percent = (video.currentTime / video.duration) * 100;
        progressPlayed.style.width = `${percent}%`;
        progressThumb.style.left = `${percent}%`;

        timeEl.textContent = this.formatTime(video.currentTime);
        this.saveState();
    }

    onProgress() {
        const { video, progressBuffered } = this.elements;
        if (video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const percent = (bufferedEnd / video.duration) * 100;
            progressBuffered.style.width = `${percent}%`;
        }
    }

    onDurationChange() {
        const { video, totalTime } = this.elements;
        this.duration = video.duration;
        totalTime.textContent = this.formatTime(video.duration);
    }

    onVolumeChange() {
        const { video, volumeSlider, iconVolumeHigh, iconVolumeMuted } = this.elements;
        this.volume = video.volume;
        volumeSlider.value = video.volume;

        if (video.muted || video.volume === 0) {
            iconVolumeHigh.style.display = 'none';
            iconVolumeMuted.style.display = 'block';
        } else {
            iconVolumeHigh.style.display = 'block';
            iconVolumeMuted.style.display = 'none';
        }

        this.saveState();
    }

    onWaiting() {
        this.elements.loadingSpinner.style.display = 'block';
    }

    onCanPlay() {
        this.elements.loadingSpinner.style.display = 'none';
    }

    onError(error) {
        console.error('Video error:', error);
        this.elements.loadingSpinner.style.display = 'none';
    }

    seek(e) {
        const { progressBar, video } = this.elements;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
    }

    setVolume(volume) {
        const { video } = this.elements;
        video.volume = volume;
        video.muted = volume === 0;
    }

    toggleVolumeMenu() {
        const { volumeContainer } = this.elements;
        volumeContainer.style.display = volumeContainer.style.display === 'none' ? 'block' : 'none';
    }

    setPlaybackRate(rate) {
        const { video, speedLabel } = this.elements;
        video.playbackRate = rate;
        this.playbackRate = rate;
        speedLabel.textContent = `${rate}x`;
        this.saveState();
    }

    toggleSpeedMenu() {
        const { speedMenu } = this.elements;
        speedMenu.style.display = speedMenu.style.display === 'none' ? 'block' : 'none';
    }

    toggleQualityMenu() {
        const { qualityMenu } = this.elements;
        qualityMenu.style.display = qualityMenu.style.display === 'none' ? 'block' : 'none';
    }

    toggleFullscreen() {
        const { wrapper } = this.elements;
        if (!document.fullscreenElement) {
            wrapper.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    }

    onFullscreenChange() {
        const { iconFullscreenEnter, iconFullscreenExit } = this.elements;
        this.isFullscreen = !!document.fullscreenElement;
        iconFullscreenEnter.style.display = this.isFullscreen ? 'none' : 'block';
        iconFullscreenExit.style.display = this.isFullscreen ? 'block' : 'none';
    }

    onKeyDown(e) {
        switch (e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.seekRelative(-5);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.seekRelative(5);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.adjustVolume(0.1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.adjustVolume(-0.1);
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                this.toggleMute();
                break;
        }
    }

    seekRelative(seconds) {
        const { video } = this.elements;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }

    adjustVolume(delta) {
        const { video } = this.elements;
        const newVolume = Math.max(0, Math.min(1, video.volume + delta));
        this.setVolume(newVolume);
    }

    toggleMute() {
        const { video } = this.elements;
        video.muted = !video.muted;
    }

    formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    saveState() {
        const state = {
            currentTime: this.currentTime,
            playbackRate: this.playbackRate,
            volume: this.volume,
            quality: this.currentQuality
        };
        localStorage.setItem(`video-state-${this.options.id || 'default'}`, JSON.stringify(state));
    }

    loadSavedState() {
        const saved = localStorage.getItem(`video-state-${this.options.id || 'default'}`);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if (state.currentTime) this.elements.video.currentTime = state.currentTime;
                if (state.playbackRate) this.setPlaybackRate(state.playbackRate);
                if (state.volume) this.setVolume(state.volume);
            } catch (e) {
                console.error('Error loading saved state:', e);
            }
        }
    }

    destroy() {
        if (this.hlsInstance) {
            this.hlsInstance.destroy();
        }
        // إنهاء جلسة المشاهدة
        if (window.SessionGuard) {
            window.SessionGuard.endSession();
        }
        this.container.innerHTML = '';
    }
}

// Export
window.ProfessionalVideoPlayer = ProfessionalVideoPlayer;
