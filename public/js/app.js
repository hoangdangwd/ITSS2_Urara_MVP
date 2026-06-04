/**
 * app.js - Main application entry point
 * SPA Router + Navigation + User Identity
 */

// ===== CURRENT STATE =====
let currentPage = 'peer'; // 'peer' | 'memo' | 'focus'

// ===== SEB-LIKE LOCK MODE =====
const LockMode = {
    enabled: false,
    listenersAttached: false,

    isPeerHomeActive() {
        const peerSection = document.getElementById('peer-section');
        const peerHome = document.getElementById('peer-home');
        const peerRoom = document.getElementById('peer-room');
        return Boolean(
            peerSection && peerSection.classList.contains('active') &&
            peerHome && peerHome.classList.contains('active') &&
            peerRoom && !peerRoom.classList.contains('active')
        );
    },

    updateExitButtonVisibility() {
        const btn = document.getElementById('btn-exit-lock-mode');
        if (!btn) return;
        btn.style.display = this.enabled && this.isPeerHomeActive() ? '' : 'none';
    },

    handleKeydown(event) {
        if (!LockMode.enabled) return;
        const key = (event.key || '').toLowerCase();
        const blocked =
            key === 'f11' ||
            (event.ctrlKey && key === 'tab') ||
            (event.ctrlKey && key === 'w') ||
            (event.altKey && key === 'f4');

        if (!blocked) return;

        event.preventDefault();
        event.stopPropagation();
        showToast('🔒 Chế độ khóa đang bật. Không thể rời phiên bằng phím tắt này.', 2500, true);
    },

    async handleFullscreenChange() {
        if (!LockMode.enabled) return;
        if (window.electronAPI) return;

        if (!document.fullscreenElement) {
            showToast('🔒 Đang yêu cầu quay lại toàn màn hình...', 2500, true);
            try {
                await document.documentElement.requestFullscreen();
            } catch (err) {
                showToast('⚠️ Trình duyệt từ chối tự vào lại toàn màn hình. Hãy bật lại thủ công.', 3500, true);
            }
        }
    },

    attachListeners() {
        if (this.listenersAttached) return;

        this._keydownHandler = this.handleKeydown.bind(this);
        this._fullscreenChangeHandler = this.handleFullscreenChange.bind(this);

        document.addEventListener('keydown', this._keydownHandler, true);
        document.addEventListener('fullscreenchange', this._fullscreenChangeHandler);
        this.listenersAttached = true;
    },

    detachListeners() {
        if (!this.listenersAttached) return;

        document.removeEventListener('keydown', this._keydownHandler, true);
        document.removeEventListener('fullscreenchange', this._fullscreenChangeHandler);
        this.listenersAttached = false;
    },

    async enter() {
        let entered = false;

        const isDesktopApp = Boolean(window.electronAPI?.enterLockMode);

        if (isDesktopApp) {
            entered = await window.electronAPI.enterLockMode();
        } else {
            try {
                await document.documentElement.requestFullscreen();
                document.body.classList.add('lock-mode-browser');
                entered = true;
            } catch (err) {
                document.body.classList.add('lock-mode-browser');
                showToast('⚠️ Browser không cho tự fullscreen. Đã bật chế độ giả lập fullscreen.', 3500, true);
                entered = true;
            }
        }

        if (!entered) return false;

        this.enabled = true;
        this.attachListeners();
        this.updateExitButtonVisibility();

        return true;
    },

    async exit() {
        if (!this.enabled) return;

        if (!this.isPeerHomeActive()) {
            showToast('⚠️ Bạn phải rời room và quay về Home trước khi thoát chế độ toàn màn hình.', 3000, true);
            return;
        }

        if (window.electronAPI?.exitLockMode) {
            await window.electronAPI.exitLockMode();
        } else {
            document.body.classList.remove('lock-mode-browser');

            if (document.fullscreenElement && document.exitFullscreen) {
                try {
                    await document.exitFullscreen();
                } catch (err) {}
            }
        }

        this.enabled = false;
        this.detachListeners();
        this.updateExitButtonVisibility();
        showToast('✅ Đã thoát chế độ toàn màn hình.', 2000);
    },

    bindElectronEvents() {
        if (!window.electronAPI) return;

        if (window.electronAPI.onLockModeChanged) {
            window.electronAPI.onLockModeChanged((active) => {
                this.enabled = Boolean(active);
                if (this.enabled) this.attachListeners();
                else this.detachListeners();
                this.updateExitButtonVisibility();
            });
        }

        if (window.electronAPI.onLockEscapeAttempt) {
            window.electronAPI.onLockEscapeAttempt((action) => {
                showToast('🔒 Thao tác bị chặn: ' + action, 2000, true);
            });
        }
    },

    async startupPrompt() {
        const accepted = window.confirm(
            'Chế độ giám sát đang bật. Bạn có muốn mở chế độ toàn màn hình ngay bây giờ không?\n\n' +
            '- Không cho phép thoát bằng F11/Ctrl+Tab\n' +
            '- Muốn thoát phải quay về Home và dùng nút thoát'
        );

        if (!accepted) return;
        await this.enter();
    }
};

async function requestExitLockMode() {
    await LockMode.exit();

    if (window.electronAPI?.quitApp) {
        window.electronAPI.quitApp();
    }
}

// ===== NAVIGATION =====
function switchPage(page) {
    currentPage = page;

    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById('nav-tab-' + page);
    if (tab) tab.classList.add('active');

    // Update sections
    document.querySelectorAll('.solution-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(page + '-section');
    if (section) section.classList.add('active');

    // Initialize page if needed
    if (page === 'memo') MemoPage.init();
    if (page === 'focus') FocusPage.init();
    if (page === 'peer') HomePage.init();

    LockMode.updateExitButtonVisibility();
}

// ===== WELCOME MODAL (User Identity) =====
const AVATARS = ['😊', '👨‍💻', '👩‍💻', '🧑‍🎓', '🎯', '🦊', '🐱', '🌟', '🚀', '🎨'];
let selectedAvatar = '😊';

function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) modal.classList.add('show');

    renderAvatarPicker();
}

function renderAvatarPicker() {
    const container = document.getElementById('avatar-picker');
    if (!container) return;

    container.innerHTML = AVATARS.map(a =>
        `<div class="avatar-option ${a === selectedAvatar ? 'selected' : ''}" onclick="selectAvatar('${a}')">${a}</div>`
    ).join('');
}

function selectAvatar(avatar) {
    selectedAvatar = avatar;
    renderAvatarPicker();
}

function saveUserIdentity() {
    const nameInput = document.getElementById('welcome-name');
    const name = nameInput?.value.trim() || 'Sinh viên';

    const user = { name, avatar: selectedAvatar };
    UserStorage.saveUser(user);

    // Close modal
    const modal = document.getElementById('welcome-modal');
    if (modal) modal.classList.remove('show');

    // Update socket identity
    if (SocketClient.connected) {
        SocketClient.setIdentity(name, selectedAvatar);
    }

    showToast('👋 Chào mừng ' + name + '!');
}

// ===== MODAL HELPERS =====
function closeModal(e) {
    if (e.target.classList.contains('modal-overlay') && !e.target.id.includes('welcome')) {
        e.target.classList.remove('show');
    }
}

// Close status picker on click outside
document.addEventListener('click', function(e) {
    const picker = document.getElementById('status-picker');
    if (picker && !picker.classList.contains('hidden') &&
        !e.target.closest('.status-picker-content') &&
        !e.target.closest('[onclick*="showStatusPicker"]')) {
        picker.classList.add('hidden');
    }
});

// ===== BGM WIDGET TOGGLE =====
function toggleBGMPanel() {
    const panel = document.getElementById('bgm-panel');
    if (panel) panel.classList.toggle('show');
}

// Close BGM panel on click outside
document.addEventListener('click', function(e) {
    const panel = document.getElementById('bgm-panel');
    if (panel && panel.classList.contains('show') &&
        !e.target.closest('.bgm-widget')) {
        panel.classList.remove('show');
    }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('📚 StudyBuddy Web App starting...');

    LockMode.bindElectronEvents();
    LockMode.startupPrompt();

    // 1. Check user identity
    const user = UserStorage.getUser();
    if (!user) {
        showWelcomeModal();
    }

    // 2. Connect to Socket.io server
    try {
        SocketClient.connect();
    } catch (err) {
        console.warn('[App] Socket connection failed, running in offline mode');
    }

    // 3. Initialize BGM Player
    BGMPlayer.init();

    // 4. Initialize default page (Home)
    HomePage.init();

    // 5. Initialize IndexedDB
    openDB().then(() => {
        console.log('[App] IndexedDB ready');
    }).catch(err => {
        console.warn('[App] IndexedDB error:', err);
    });

    console.log('📚 StudyBuddy ready!');

    // Keep button state in sync because peer room/home is toggled directly by RoomPage.
    setInterval(() => {
        LockMode.updateExitButtonVisibility();
    }, 500);
});
