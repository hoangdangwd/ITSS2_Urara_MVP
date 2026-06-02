/**
 * helpers.js - Utility functions
 */

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format seconds to HH:MM:SS
 */
function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
}

/**
 * Format seconds to MM:SS
 */
function formatMinSec(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return m + ':' + s;
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
}

/**
 * Generate a random color for member avatars
 */
function getRandomColor() {
    const colors = ['#6C5CE7', '#00B894', '#E17055', '#FDCB6E', '#74B9FF', '#A29BFE', '#55EFC4', '#FF7675'];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
