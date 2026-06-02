const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Platform info
    platform: process.platform,
    isElectron: true,

    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),

    // OS-level features
    openSettings: (settingType) => ipcRenderer.send('open-settings', settingType),
    openMemoWindow: () => ipcRenderer.send('open-memo-window'),
    toggleStartup: (enable) => ipcRenderer.send('toggle-startup', enable),
    
    // Deep link listener
    onDeepLink: (callback) => ipcRenderer.on('deep-link', (event, url) => callback(url)),

    // Task 24: Set focus mode
    setFocusMode: (active) => ipcRenderer.send('set-focus-mode', active),
    
    // Task 21: App monitoring
    startAppMonitoring: () => ipcRenderer.send('start-app-monitoring'),
    stopAppMonitoring: () => ipcRenderer.send('stop-app-monitoring'),
    onDistractingAppDetected: (callback) => ipcRenderer.on('distracting-app-detected', (event, appName) => callback(appName)),

    // Notifications
    showNotification: (title, body) => {
        new Notification(title, { body });
    }
});
