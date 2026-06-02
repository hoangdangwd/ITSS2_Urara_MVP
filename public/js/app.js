/**
 * app.js - Main application entry point
 * SPA Router + Navigation + User Identity
 */

// ===== CURRENT STATE =====
let currentPage = 'peer'; // 'peer' | 'memo' | 'focus'

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
});
