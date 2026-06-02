/**
 * focus.js - Focus Mode page logic
 * Pomodoro timer + Distraction tracking + Tab visibility detection
 */

const FocusPage = {
    timerInterval: null,
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    distractions: [],
    isRunning: false,
    tabLeaveCount: 0,
    tabLeaveTime: 0,
    sessionStartTime: null,

    /**
     * Initialize focus page
     */
    init() {
        this.setupTabTracking();
        this.checkExistingSession();
        if (typeof FocusDashboard !== 'undefined') {
            FocusDashboard.render();
        }

        // Task 21: Listen for distracting apps
        if (window.electronAPI) {
            window.electronAPI.onDistractingAppDetected((appName) => {
                showToast(`⚠️ Bạn đang mở ${appName}! Hãy tập trung học nhé!`, 4000, true);
                
                // Cảnh báo native
                window.electronAPI.showNotification(
                    'Cảnh báo xao nhãng',
                    `Phát hiện ${appName} đang chạy. Hãy quay lại StudyBuddy!`
                );
            });
        }
    },

    /**
     * Set timer preset
     */
    setPreset(minutes, btn) {
        this.totalSeconds = minutes * 60;
        this.remainingSeconds = this.totalSeconds;
        document.getElementById('focus-timer-value').textContent = formatMinSec(this.remainingSeconds);

        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        document.getElementById('custom-time').value = '';
    },

    /**
     * Set custom timer preset (Task 22)
     */
    setCustomPreset(val, input) {
        const minutes = parseInt(val, 10);
        if (isNaN(minutes) || minutes < 1) return;
        this.totalSeconds = minutes * 60;
        this.remainingSeconds = this.totalSeconds;
        document.getElementById('focus-timer-value').textContent = formatMinSec(this.remainingSeconds);
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    },

    /**
     * Start study session
     */
    startSession() {
        this.isRunning = true;
        this.distractions = [];
        this.tabLeaveCount = 0;
        this.tabLeaveTime = 0;
        this.sessionStartTime = Date.now();

        // Save session data to local storage for persistence (Task 22)
        localStorage.setItem('activeFocusSession', JSON.stringify({
            startTime: this.sessionStartTime,
            totalSeconds: this.totalSeconds
        }));

        // Task 21 & 24: Kích hoạt chế độ tập trung trên Desktop App
        if (window.electronAPI) {
            window.electronAPI.setFocusMode(true);
            window.electronAPI.startAppMonitoring();
        }

        document.getElementById('timer-controls-start').style.display = 'none';
        document.getElementById('distraction-area').classList.remove('hidden');
        document.getElementById('focus-timer-label').textContent = 'Đang tập trung...';

        const progressEl = document.getElementById('timer-ring-progress');
        progressEl.classList.add('active');
        this.updateDistractionCount();

        this.timerInterval = setInterval(() => {
            this.remainingSeconds--;
            if (this.remainingSeconds <= 0) {
                this.endSession();
                return;
            }
            document.getElementById('focus-timer-value').textContent = formatMinSec(this.remainingSeconds);

            // Update ring progress
            const progress = 1 - (this.remainingSeconds / this.totalSeconds);
            const circumference = 565.48;
            progressEl.style.strokeDashoffset = circumference * (1 - progress);
        }, 1000);

        showToast('🎯 Phiên học bắt đầu! Tập trung nào!');

        // Activate focus stats bar
        const statsBar = document.getElementById('focus-stats-bar');
        if (statsBar) statsBar.style.display = 'flex';
    },

    /**
     * Check if there's an ongoing session that was interrupted (Task 22)
     */
    checkExistingSession() {
        const saved = localStorage.getItem('activeFocusSession');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                const elapsedSeconds = Math.floor((Date.now() - data.startTime) / 1000);
                
                if (elapsedSeconds < data.totalSeconds) {
                    // Resume session
                    this.totalSeconds = data.totalSeconds;
                    this.remainingSeconds = data.totalSeconds - elapsedSeconds;
                    this.sessionStartTime = data.startTime;
                    
                    showToast('🔄 Đã khôi phục phiên học đang dở dang!');
                    
                    // Call startSession but bypass resetting vars
                    this.isRunning = true;
                    document.getElementById('timer-controls-start').style.display = 'none';
                    document.getElementById('distraction-area').classList.remove('hidden');
                    document.getElementById('focus-timer-label').textContent = 'Đang tập trung...';
                    
                    const progressEl = document.getElementById('timer-ring-progress');
                    progressEl.classList.add('active');
                    
                    this.timerInterval = setInterval(() => {
                        this.remainingSeconds--;
                        if (this.remainingSeconds <= 0) {
                            this.endSession();
                            return;
                        }
                        document.getElementById('focus-timer-value').textContent = formatMinSec(this.remainingSeconds);
                        const progress = 1 - (this.remainingSeconds / this.totalSeconds);
                        progressEl.style.strokeDashoffset = 565.48 * (1 - progress);
                    }, 1000);
                } else {
                    // Session expired while app was closed
                    localStorage.removeItem('activeFocusSession');
                }
            } catch(e) {
                localStorage.removeItem('activeFocusSession');
            }
        }
    },


    /**
     * Save distraction
     */
    saveDistraction() {
        const input = document.getElementById('distraction-input');
        const text = input.value.trim();
        if (!text) return;

        this.distractions.push({
            text: text,
            time: Date.now()
        });
        input.value = '';
        this.updateDistractionCount();
        showToast('📥 Đã lưu! Quay lại tập trung nào 💪');

        // Animate vault icon
        const vault = document.querySelector('.vault-icon');
        if (vault) {
            vault.style.transform = 'scale(1.3)';
            setTimeout(() => vault.style.transform = 'scale(1)', 300);
        }
    },

    /**
     * Update distraction count display
     */
    updateDistractionCount() {
        const countEl = document.getElementById('distraction-count');
        if (countEl) countEl.textContent = this.distractions.length;

        const tabCountEl = document.getElementById('focus-tab-leave-count');
        if (tabCountEl) tabCountEl.textContent = this.tabLeaveCount;
    },

    /**
     * End study session
     */
    async endSession() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.isRunning = false;
        
        // Task 21 & 24: Tắt chế độ tập trung trên Desktop App
        if (window.electronAPI) {
            window.electronAPI.setFocusMode(false);
            window.electronAPI.stopAppMonitoring();
        }

        // Task 22: Clear persisted session
        localStorage.removeItem('activeFocusSession');

        // Calculate stats
        const timeSpent = this.totalSeconds - this.remainingSeconds;
        const focusPercent = this.tabLeaveTime > 0
            ? Math.round((1 - this.tabLeaveTime / (timeSpent * 1000)) * 100)
            : 100;

        document.getElementById('review-time').textContent = formatMinSec(timeSpent);
        document.getElementById('review-count').textContent = this.distractions.length;

        // Score calculation (fixed logic)
        let score = 'A+';
        if (this.distractions.length > 10) score = 'C';
        else if (this.distractions.length > 5) score = 'B';
        else if (this.distractions.length > 2) score = 'A';
        document.getElementById('review-score').textContent = score;

        // Build review list
        const list = document.getElementById('review-list');
        list.innerHTML = '';

        if (this.distractions.length === 0) {
            list.innerHTML = '<div class="review-item"><span style="color: var(--green);">🏆 Tuyệt vời! Bạn không bị xao nhãng lần nào!</span></div>';
        } else {
            this.distractions.forEach((d, i) => {
                const item = document.createElement('div');
                item.className = 'review-item';
                item.style.animationDelay = (i * 0.1) + 's';
                item.innerHTML = `
                    <span class="review-item-num">${i + 1}</span>
                    <span>${escapeHtml(d.text)}</span>
                    <span class="review-item-check" onclick="FocusPage.toggleDone(this)" title="Đã xử lý">☐</span>
                `;
                list.appendChild(item);
            });
        }

        // Save session to IndexedDB
        try {
            await SessionStorage.save({
                duration: timeSpent,
                distractionCount: this.distractions.length,
                distractions: this.distractions,
                tabLeaveCount: this.tabLeaveCount,
                focusPercent: focusPercent,
                score: score
            });
            
            // Re-render dashboard with new session
            if (typeof FocusDashboard !== 'undefined') {
                await FocusDashboard.render();
            }
        } catch (err) {
            console.warn('[Focus] Error saving session:', err);
        }

        // Switch screen
        document.getElementById('focus-study').classList.remove('active');
        document.getElementById('focus-review').classList.add('active');
    },

    /**
     * Toggle review item done
     */
    toggleDone(el) {
        const item = el.closest('.review-item');
        item.classList.toggle('done');
        el.textContent = item.classList.contains('done') ? '☑' : '☐';
    },

    /**
     * Reset and start new session
     */
    resetSession() {
        this.distractions = [];
        this.remainingSeconds = this.totalSeconds;
        this.tabLeaveCount = 0;
        this.tabLeaveTime = 0;
        
        localStorage.removeItem('activeFocusSession');

        document.getElementById('focus-timer-value').textContent = formatMinSec(this.remainingSeconds);
        document.getElementById('focus-timer-label').textContent = 'Chưa bắt đầu';
        document.getElementById('timer-controls-start').style.display = '';
        document.getElementById('distraction-area').classList.add('hidden');
        document.getElementById('timer-ring-progress').classList.remove('active');
        document.getElementById('timer-ring-progress').style.strokeDashoffset = 565.48;
        this.updateDistractionCount();

        const statsBar = document.getElementById('focus-stats-bar');
        if (statsBar) statsBar.style.display = 'none';

        document.getElementById('focus-review').classList.remove('active');
        document.getElementById('focus-study').classList.add('active');
    },

    /**
     * Setup tab visibility tracking (focus monitoring)
     */
    setupTabTracking() {
        let leaveTimestamp = null;

        document.addEventListener('visibilitychange', () => {
            if (!this.isRunning) return;

            if (document.hidden) {
                // User left the tab
                this.tabLeaveCount++;
                leaveTimestamp = Date.now();
                this.updateDistractionCount();

                // Send notification if permitted
                if (Notification.permission === 'granted') {
                    new Notification('📚 StudyBuddy', {
                        body: '⚠️ Bạn đang rời khỏi phiên học! Quay lại tập trung nào!',
                        icon: '📚'
                    });
                }
            } else {
                // User came back
                if (leaveTimestamp) {
                    this.tabLeaveTime += (Date.now() - leaveTimestamp);
                    leaveTimestamp = null;
                }
                showToast('👋 Chào mừng quay lại! Tiếp tục tập trung nào!');
            }
        });

        // Beforeunload warning
        window.addEventListener('beforeunload', (e) => {
            if (this.isRunning) {
                e.preventDefault();
                e.returnValue = 'Phiên học chưa kết thúc. Bạn có chắc muốn thoát?';
            }
        });

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            // Will ask when user starts a session
        }
    },

    /**
     * Request notification permission
     */
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
};
