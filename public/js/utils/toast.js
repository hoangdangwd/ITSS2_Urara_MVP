/**
 * toast.js - Toast notification system
 * Task 20: Focus block mode — chặn toast khi đang focus
 */

let toastTimeout = null;
let focusBlockMode = false; // Task 20: Khi true, chỉ hiển thị toast quan trọng

/**
 * Show a toast notification
 * @param {string} msg - Message to display
 * @param {number} duration - Duration in ms (default: 2500)
 * @param {boolean} force - Bypass focus block mode (for important alerts)
 */
function showToast(msg, duration = 2500, force = false) {
    // Task 20: Block toast nếu đang focus (trừ khi force=true)
    if (focusBlockMode && !force) return;

    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * Toggle focus block mode (Task 20)
 */
function setFocusBlockMode(enabled) {
    focusBlockMode = enabled;
    console.log('[Toast] Focus block mode:', enabled ? 'ON' : 'OFF');
}
