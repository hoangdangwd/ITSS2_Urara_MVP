/**
 * storage.js - Local storage utilities (localStorage + IndexedDB)
 */

// ===== LocalStorage Wrapper (User profile, settings) =====
const UserStorage = {
    KEY_USER: 'studybuddy_user',
    KEY_SETTINGS: 'studybuddy_settings',

    getUser() {
        try {
            const data = localStorage.getItem(this.KEY_USER);
            return data ? JSON.parse(data) : null;
        } catch { return null; }
    },

    saveUser(user) {
        localStorage.setItem(this.KEY_USER, JSON.stringify(user));
    },

    getSettings() {
        try {
            const data = localStorage.getItem(this.KEY_SETTINGS);
            return data ? JSON.parse(data) : this.defaultSettings();
        } catch { return this.defaultSettings(); }
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings));
    },

    defaultSettings() {
        return {
            autoMute: true,
            bgmVolume: 50,
            focusDuration: 25,
            notificationsEnabled: true
        };
    }
};

// ===== IndexedDB Wrapper (Memos, Focus sessions) =====
const DB_NAME = 'StudyBuddyDB';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) { resolve(dbInstance); return; }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            // Memos store
            if (!db.objectStoreNames.contains('memos')) {
                const memoStore = db.createObjectStore('memos', { keyPath: 'id' });
                memoStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            // Focus sessions store
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                sessionStore.createIndex('date', 'date', { unique: false });
            }
        };

        request.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };

        request.onerror = (e) => reject(e.target.error);
    });
}

// ===== Memo Storage =====
const MemoStorage = {
    async getAll() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('memos', 'readonly');
            const store = tx.objectStore('memos');
            const request = store.getAll();
            request.onsuccess = () => {
                const memos = request.result;
                memos.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(memos);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async get(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('memos', 'readonly');
            const store = tx.objectStore('memos');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async save(memo) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('memos', 'readwrite');
            const store = tx.objectStore('memos');
            memo.updatedAt = Date.now();
            if (!memo.createdAt) memo.createdAt = Date.now();
            const request = store.put(memo);
            request.onsuccess = () => resolve(memo);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('memos', 'readwrite');
            const store = tx.objectStore('memos');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// ===== Session Storage (Focus history) =====
const SessionStorage = {
    async save(session) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sessions', 'readwrite');
            const store = tx.objectStore('sessions');
            session.id = session.id || generateId();
            session.date = Date.now();
            const request = store.put(session);
            request.onsuccess = () => resolve(session);
            request.onerror = () => reject(request.error);
        });
    },

    async getAll() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('sessions', 'readonly');
            const store = tx.objectStore('sessions');
            const request = store.getAll();
            request.onsuccess = () => {
                const sessions = request.result;
                sessions.sort((a, b) => b.date - a.date);
                resolve(sessions);
            };
            request.onerror = () => reject(request.error);
        });
    }
};
