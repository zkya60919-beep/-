/**
 * Session Guard - نظام منع مشاركة الاشتراك
 * منصة الباسط للعلوم الشرعية
 * 
 * يمنع مشاهدة نفس الفيديو من أكثر من جهاز في نفس الوقت
 */

class SessionGuard {
    constructor() {
        this.sessionToken = null;
        this.currentVideoId = null;
        this.heartbeatInterval = null;
        this.isBlocked = false;
        this.HEARTBEAT_INTERVAL = 15000;  // كل 15 ثانية
        this.SESSION_TIMEOUT = 45000;     // 45 ثانية بدون heartbeat = جلسة منتهية
    }

    /**
     * توليد session token فريد
     */
    generateToken() {
        return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 12);
    }

    /**
     * الحصول على معلومات الجهاز
     */
    getDeviceInfo() {
        const ua = navigator.userAgent;
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
        const browser = /Chrome/i.test(ua) ? 'Chrome'
            : /Firefox/i.test(ua) ? 'Firefox'
            : /Safari/i.test(ua) ? 'Safari'
            : /Edge/i.test(ua) ? 'Edge' : 'Unknown';
        return `${isMobile ? 'Mobile' : 'Desktop'} - ${browser}`;
    }

    /**
     * بدء جلسة مشاهدة
     * @param {string} videoId - معرف الفيديو
     * @param {string} userId - رقم هاتف المستخدم
     * @returns {Promise<{allowed: boolean, message?: string}>}
     */
    async startSession(videoId, userId) {
        if (!videoId || !userId) return { allowed: true };

        try {
            // التحقق من وجود جلسة نشطة أخرى
            const { data: existingSessions, error } = await window.supabase
                .from('active_video_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('video_id', videoId)
                .eq('is_active', true)
                .order('last_heartbeat', { ascending: false })
                .limit(1);

            if (error) {
                console.warn('SessionGuard: خطأ في التحقق من الجلسات:', error.message);
                // في حالة الخطأ، نسمح بالتشغيل
                return { allowed: true };
            }

            if (existingSessions && existingSessions.length > 0) {
                const existing = existingSessions[0];
                const lastBeat = new Date(existing.last_heartbeat).getTime();
                const now = Date.now();
                const timeSinceLastBeat = now - lastBeat;

                // إذا الجلسة الموجودة نشطة (heartbeat خلال 45 ثانية)
                if (timeSinceLastBeat < this.SESSION_TIMEOUT) {
                    // إذا نفس الـ token (نفس الجهاز) - اسمح
                    if (existing.session_token === this.sessionToken) {
                        return { allowed: true };
                    }
                    // جهاز آخر نشط!
                    this.isBlocked = true;
                    return {
                        allowed: false,
                        message: `⚠️ هذا الحساب يُستخدم حالياً على جهاز آخر\n\nالجهاز: ${existing.device_info || 'جهاز آخر'}\n\nيرجى إيقاف المشاهدة على الجهاز الآخر أولاً.`,
                        deviceInfo: existing.device_info
                    };
                } else {
                    // الجلسة القديمة منتهية - أنهِها
                    await this._endOldSession(existing.id);
                }
            }

            // إنشاء جلسة جديدة
            this.sessionToken = this.generateToken();
            this.currentVideoId = videoId;
            this.isBlocked = false;

            const { error: insertError } = await window.supabase
                .from('active_video_sessions')
                .insert({
                    user_id: userId,
                    video_id: videoId,
                    session_token: this.sessionToken,
                    device_info: this.getDeviceInfo(),
                    started_at: new Date().toISOString(),
                    last_heartbeat: new Date().toISOString(),
                    is_active: true
                });

            if (insertError) {
                console.warn('SessionGuard: خطأ في إنشاء الجلسة:', insertError.message);
                return { allowed: true }; // نسمح في حالة الخطأ
            }

            // بدء إرسال الـ heartbeat
            this._startHeartbeat(userId);

            // تنظيف الجلسة عند إغلاق الصفحة
            window.addEventListener('beforeunload', () => this.endSession());
            window.addEventListener('visibilitychange', () => {
                if (document.hidden) this._pauseHeartbeat();
                else this._resumeHeartbeat(userId);
            });

            return { allowed: true };

        } catch (err) {
            console.warn('SessionGuard: استثناء:', err);
            return { allowed: true };
        }
    }

    /**
     * إرسال heartbeat دوري
     */
    _startHeartbeat(userId) {
        this._stopHeartbeat();
        this.heartbeatInterval = setInterval(async () => {
            await this._sendHeartbeat(userId);
        }, this.HEARTBEAT_INTERVAL);
    }

    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    _pauseHeartbeat() {
        this._stopHeartbeat();
    }

    _resumeHeartbeat(userId) {
        if (this.sessionToken && !this.isBlocked) {
            this._startHeartbeat(userId);
        }
    }

    async _sendHeartbeat(userId) {
        if (!this.sessionToken || this.isBlocked) return;
        try {
            await window.supabase
                .from('active_video_sessions')
                .update({ last_heartbeat: new Date().toISOString() })
                .eq('session_token', this.sessionToken)
                .eq('user_id', userId);
        } catch (err) {
            console.warn('SessionGuard: heartbeat failed:', err);
        }
    }

    /**
     * إنهاء جلسة قديمة
     */
    async _endOldSession(sessionId) {
        try {
            await window.supabase
                .from('active_video_sessions')
                .update({ is_active: false, ended_at: new Date().toISOString() })
                .eq('id', sessionId);
        } catch (err) {
            console.warn('SessionGuard: خطأ في إنهاء الجلسة القديمة:', err);
        }
    }

    /**
     * إنهاء الجلسة الحالية
     */
    async endSession() {
        if (!this.sessionToken) return;
        this._stopHeartbeat();
        try {
            await window.supabase
                .from('active_video_sessions')
                .update({ is_active: false, ended_at: new Date().toISOString() })
                .eq('session_token', this.sessionToken);
        } catch (err) {
            console.warn('SessionGuard: خطأ في إنهاء الجلسة:', err);
        }
        this.sessionToken = null;
        this.currentVideoId = null;
        this.isBlocked = false;
    }

    /**
     * إيقاف مؤقت (عند pause)
     */
    pause() {
        this._stopHeartbeat();
    }

    /**
     * استئناف (عند play)
     */
    resume(userId) {
        if (this.sessionToken && !this.isBlocked) {
            this._startHeartbeat(userId);
        }
    }

    /**
     * عرض رسالة الحجب للمستخدم
     */
    showBlockedMessage(message) {
        // إزالة رسالة سابقة إن وجدت
        const old = document.getElementById('session-block-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'session-block-overlay';
        overlay.innerHTML = `
            <div class="session-block-modal">
                <div class="session-block-icon">🔒</div>
                <h3>المحتوى غير متاح</h3>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <div class="session-block-actions">
                    <button onclick="document.getElementById('session-block-overlay').remove(); history.back();" class="btn btn-outline">
                        العودة للخلف
                    </button>
                </div>
            </div>
        `;
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        const modal = overlay.querySelector('.session-block-modal');
        modal.style.cssText = `
            background: white; border-radius: 24px; padding: 48px 40px;
            max-width: 480px; width: 90%; text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.4);
            animation: slideUp 0.4s cubic-bezier(0.4,0,0.2,1);
        `;
        const icon = overlay.querySelector('.session-block-icon');
        icon.style.cssText = 'font-size: 64px; margin-bottom: 20px; display: block;';
        const h3 = overlay.querySelector('h3');
        h3.style.cssText = 'font-size: 24px; font-weight: 800; color: #1F2937; margin-bottom: 16px;';
        const p = overlay.querySelector('p');
        p.style.cssText = 'color: #4B5563; line-height: 1.8; margin-bottom: 32px; font-size: 15px;';

        document.body.appendChild(overlay);
    }
}

// تصدير كـ Singleton
window.SessionGuard = new SessionGuard();
