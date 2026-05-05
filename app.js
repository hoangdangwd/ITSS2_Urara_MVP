// ===== STATE =====
let currentSolution = 'peer';
let roomTimerInterval = null;
let roomSeconds = 0;
let memoTimerInterval = null;
let memoTotalSeconds = 25 * 60;
let memoRemainingSeconds = 25 * 60;
let distractions = [];
let cameraOn = false;

// ===== NAVIGATION =====
function switchSolution(sol) {
    currentSolution = sol;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('nav-tab-' + sol).classList.add('active');
    document.querySelectorAll('.solution-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sol + '-section').classList.add('active');
}

// ===== SOLUTION 1: PEER PRESSURE =====

function showCreateRoom() {
    document.getElementById('create-room-modal').classList.add('show');
}

function hideCreateRoom() {
    document.getElementById('create-room-modal').classList.remove('show');
}

function closeModal(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('show');
    }
}

function joinRoom() {
    hideCreateRoom();
    document.getElementById('peer-home').classList.remove('active');
    document.getElementById('peer-room').classList.add('active');
    startRoomTimer();
    showToast('🎉 Đã tham gia phòng học!');
}

function backToHome() {
    document.getElementById('peer-room').classList.remove('active');
    document.getElementById('peer-home').classList.add('active');
    stopRoomTimer();
}

function startRoomTimer() {
    roomSeconds = 0;
    if (roomTimerInterval) clearInterval(roomTimerInterval);
    roomTimerInterval = setInterval(() => {
        roomSeconds++;
        document.getElementById('room-timer').textContent = '⏱️ ' + formatTime(roomSeconds);
    }, 1000);
}

function stopRoomTimer() {
    if (roomTimerInterval) clearInterval(roomTimerInterval);
}

function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
}

function toggleCamera() {
    cameraOn = !cameraOn;
    const cam = document.querySelector('#my-card .member-camera');
    const btn = document.getElementById('btn-toggle-camera');
    if (cameraOn) {
        cam.classList.add('active');
        cam.innerHTML = '<div class="camera-active-view"><span class="big-emoji">😊</span></div><span class="camera-badge">📷 ON</span>';
        btn.textContent = '📷 Tắt Camera';
        showToast('📷 Camera đã bật');
    } else {
        cam.classList.remove('active');
        cam.innerHTML = '<div class="camera-placeholder"><span class="camera-emoji">😊</span><span>Camera tắt</span></div>';
        btn.textContent = '📷 Bật Camera';
        showToast('Camera đã tắt');
    }
}

function showStatusPicker() {
    document.getElementById('status-picker').classList.remove('hidden');
}

function setStatus(status) {
    document.getElementById('my-status-text').textContent = status;
    document.getElementById('status-picker').classList.add('hidden');
    showToast('Đã cập nhật trạng thái: ' + status);
}

// Close status picker on click outside
document.addEventListener('click', function(e) {
    const picker = document.getElementById('status-picker');
    if (!picker.classList.contains('hidden') && !e.target.closest('.status-picker-content') && !e.target.closest('#btn-change-status')) {
        picker.classList.add('hidden');
    }
});

function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = '<span class="chat-author" style="color: var(--accent-light);">Bạn:</span><span>' + escapeHtml(msg) + '</span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    input.value = '';
}

// ===== SOLUTION 2: DISTRACTION MEMO =====

function setTimerPreset(minutes, btn) {
    memoTotalSeconds = minutes * 60;
    memoRemainingSeconds = memoTotalSeconds;
    document.getElementById('memo-timer-value').textContent = formatMemoTime(memoRemainingSeconds);
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function formatMemoTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return m + ':' + s;
}

function startStudySession() {
    document.getElementById('timer-controls-start').style.display = 'none';
    document.getElementById('distraction-area').classList.remove('hidden');
    document.getElementById('memo-timer-label').textContent = 'Đang tập trung...';

    const progressEl = document.getElementById('timer-ring-progress');
    progressEl.classList.add('active');
    distractions = [];
    updateDistractionCount();

    memoTimerInterval = setInterval(() => {
        memoRemainingSeconds--;
        if (memoRemainingSeconds <= 0) {
            endStudySession();
            return;
        }
        document.getElementById('memo-timer-value').textContent = formatMemoTime(memoRemainingSeconds);
        // Update ring progress
        const progress = 1 - (memoRemainingSeconds / memoTotalSeconds);
        const circumference = 565.48;
        progressEl.style.strokeDashoffset = circumference * (1 - progress);
    }, 1000);

    showToast('🎯 Phiên học bắt đầu! Tập trung nào!');
}

function saveDistraction() {
    const input = document.getElementById('distraction-input');
    const text = input.value.trim();
    if (!text) return;
    distractions.push(text);
    input.value = '';
    updateDistractionCount();
    showToast('📥 Đã lưu! Quay lại tập trung nào 💪');

    // Animate the vault icon
    const vault = document.querySelector('.vault-icon');
    vault.style.transform = 'scale(1.3)';
    setTimeout(() => vault.style.transform = 'scale(1)', 300);
}

function updateDistractionCount() {
    document.getElementById('distraction-count').textContent = distractions.length;
}

function endStudySession() {
    if (memoTimerInterval) clearInterval(memoTimerInterval);

    // Calculate time spent
    const timeSpent = memoTotalSeconds - memoRemainingSeconds;
    document.getElementById('review-time').textContent = formatMemoTime(timeSpent);
    document.getElementById('review-count').textContent = distractions.length;

    // Score
    let score = 'A+';
    if (distractions.length > 5) score = 'B';
    else if (distractions.length > 10) score = 'C';
    else if (distractions.length > 2) score = 'A';
    document.getElementById('review-score').textContent = score;

    // Build review list
    const list = document.getElementById('review-list');
    list.innerHTML = '';
    if (distractions.length === 0) {
        list.innerHTML = '<div class="review-item"><span style="color: var(--green);">🏆 Tuyệt vời! Bạn không bị xao nhãng lần nào!</span></div>';
    } else {
        distractions.forEach((d, i) => {
            const item = document.createElement('div');
            item.className = 'review-item';
            item.style.animationDelay = (i * 0.1) + 's';
            item.innerHTML = '<span class="review-item-num">' + (i + 1) + '</span><span>' + escapeHtml(d) + '</span><span class="review-item-check" onclick="toggleDone(this)" title="Đã xử lý">☐</span>';
            list.appendChild(item);
        });
    }

    // Switch screen
    document.getElementById('memo-study').classList.remove('active');
    document.getElementById('memo-review').classList.add('active');
}

function toggleDone(el) {
    const item = el.closest('.review-item');
    item.classList.toggle('done');
    el.textContent = item.classList.contains('done') ? '☑' : '☐';
}

function resetMemo() {
    // Reset everything
    distractions = [];
    memoRemainingSeconds = memoTotalSeconds;
    document.getElementById('memo-timer-value').textContent = formatMemoTime(memoRemainingSeconds);
    document.getElementById('memo-timer-label').textContent = 'Chưa bắt đầu';
    document.getElementById('timer-controls-start').style.display = '';
    document.getElementById('distraction-area').classList.add('hidden');
    document.getElementById('timer-ring-progress').classList.remove('active');
    document.getElementById('timer-ring-progress').style.strokeDashoffset = 565.48;
    updateDistractionCount();

    document.getElementById('memo-review').classList.remove('active');
    document.getElementById('memo-study').classList.add('active');
}

// ===== UTILITIES =====
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== SIMULATE LIVE UPDATES =====
// Randomly update focus bars to feel "alive"
setInterval(() => {
    document.querySelectorAll('.member-card:not(.is-you) .focus-fill').forEach(fill => {
        const current = parseFloat(fill.style.width);
        const delta = (Math.random() - 0.4) * 6;
        const next = Math.max(10, Math.min(100, current + delta));
        fill.style.width = next + '%';
        const valueEl = fill.closest('.member-focus-bar').querySelector('.focus-value');
        if (valueEl) valueEl.textContent = Math.round(next) + '%';

        // Update class
        fill.classList.remove('high', 'low');
        if (next >= 90) fill.classList.add('high');
        else if (next <= 40) fill.classList.add('low');
    });
}, 3000);

// Animate online count
setInterval(() => {
    const el = document.getElementById('online-count');
    if (el) {
        const n = 10 + Math.floor(Math.random() * 6);
        el.textContent = n;
    }
}, 5000);
