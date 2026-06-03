const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell, ipcMain, globalShortcut } = require('electron');
const path = require('path');

// Start the embedded server
const server = require('./server');

let mainWindow = null;
let tray = null;
let isFocusing = false; // Task 24
let monitoringInterval = null; // Task 21
let isLockModeEnabled = false;
let lockShortcutsRegistered = false;
const PORT = process.env.PORT || 3000;

function notifyLockModeChanged() {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('lock-mode-changed', isLockModeEnabled);
    }
}

function registerLockShortcuts() {
    if (lockShortcutsRegistered) return;
    globalShortcut.register('F11', () => {
        if (isLockModeEnabled && mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('lock-escape-attempt', 'F11');
        }
    });
    globalShortcut.register('CommandOrControl+Tab', () => {
        if (isLockModeEnabled && mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('lock-escape-attempt', 'Ctrl+Tab');
        }
    });
    lockShortcutsRegistered = true;
}

function unregisterLockShortcuts() {
    if (!lockShortcutsRegistered) return;
    globalShortcut.unregister('F11');
    globalShortcut.unregister('CommandOrControl+Tab');
    lockShortcutsRegistered = false;
}

// ===== Create Main Window =====
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'StudyBuddy',
        icon: path.join(__dirname, 'public', 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        // Frameless with custom titlebar feel
        frame: true,
        backgroundColor: '#0a0a1a',
        show: false
    });

    // Load the web app from embedded server
    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Show when ready to prevent white flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!isLockModeEnabled) return;

        const key = (input.key || '').toLowerCase();
        const isF11 = key === 'f11';
        const isCtrlTab = Boolean(input.control) && key === 'tab';

        if (isF11 || isCtrlTab) {
            event.preventDefault();
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('lock-escape-attempt', isF11 ? 'F11' : 'Ctrl+Tab');
            }
        }
    });

    mainWindow.on('leave-full-screen', () => {
        if (!isLockModeEnabled) return;
        mainWindow.setFullScreen(true);
        if (mainWindow.webContents) {
            mainWindow.webContents.send('lock-escape-attempt', 'leave-fullscreen');
        }
    });

    mainWindow.on('minimize', (event) => {
        if (!isLockModeEnabled) return;
        event.preventDefault();
        mainWindow.focus();
        if (mainWindow.webContents) {
            mainWindow.webContents.send('lock-escape-attempt', 'minimize');
        }
    });

    // Prevent closing — minimize to tray instead
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();

            if (isLockModeEnabled) {
                dialog.showMessageBox(mainWindow, {
                    type: 'warning',
                    title: 'Chế độ toàn màn hình đang bật',
                    message: 'Không thể thoát hoặc thu nhỏ khi đang khóa màn hình.',
                    detail: 'Hãy rời room và dùng nút Thoát chế độ toàn màn hình ở trang Home.',
                    buttons: ['Đã hiểu']
                });
                return;
            }
            
            // Task 24: Native OS warning during focus
            if (isFocusing) {
                dialog.showMessageBox(mainWindow, {
                    type: 'warning',
                    title: 'Cảnh báo Tập trung',
                    message: 'Bạn đang trong phiên tập trung!',
                    detail: 'Việc thu nhỏ ứng dụng có thể làm giảm hiệu quả. Hãy giữ cửa sổ mở để theo dõi thời gian.',
                    buttons: ['Đã hiểu']
                });
            }

            mainWindow.hide();
            if (tray) {
                tray.displayBalloon({
                    title: 'StudyBuddy',
                    content: isFocusing ? 'Cảnh báo: Bạn đang trong phiên tập trung!' : 'Ứng dụng vẫn chạy trong khay hệ thống'
                });
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ===== System Tray =====
function createTray() {
    // Create a simple tray icon (16x16 colored square as fallback)
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '📚 Mở StudyBuddy',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: '🔄 Tham gia lại phòng gần nhất',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.webContents.executeJavaScript(
                        'if(typeof HomePage !== "undefined") HomePage.joinLastRoom && HomePage.joinLastRoom();'
                    );
                }
            }
        },
        { type: 'separator' },
        {
            label: '❌ Thoát hoàn toàn',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('StudyBuddy - Môi trường học tập hiệu quả');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// ===== App Lifecycle =====
// Register custom protocol for deep linking (Task 13)
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('studybuddy', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('studybuddy');
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    // IPC Handlers for OS-level features

    // Task 6 & 19: Open OS Settings
    ipcMain.on('open-settings', (event, settingType) => {
        if (settingType === 'camera') {
            shell.openExternal('ms-settings:privacy-webcam');
        } else if (settingType === 'focus') {
            shell.openExternal('ms-settings:quiethours');
        }
    });

    ipcMain.on('app-quit', () => {
        app.isQuitting = true;
        app.quit();
    });

    // Task 17: Pop-out Memo Window
    let memoWindow = null;
    ipcMain.on('open-memo-window', () => {
        if (memoWindow) {
            memoWindow.focus();
            return;
        }
        memoWindow = new BrowserWindow({
            width: 400,
            height: 600,
            title: 'StudyBuddy - Ghi chú',
            icon: path.join(__dirname, 'public', 'assets', 'icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            autoHideMenuBar: true,
            alwaysOnTop: true // Giúp bề mặt ghi chú luôn nổi lên trên
        });
        
        // Load the memo page
        memoWindow.loadURL(`http://localhost:${PORT}/memo.html`);
        
        memoWindow.on('closed', () => {
            memoWindow = null;
        });
    });

    // Task 22: Startup App
    ipcMain.on('toggle-startup', (event, enable) => {
        app.setLoginItemSettings({
            openAtLogin: enable,
            openAsHidden: true // Khởi động nhưng thu nhỏ vào Tray
        });
    });

    // Task 24: Set focus mode state
    ipcMain.on('set-focus-mode', (event, active) => {
        isFocusing = active;
    });

    // Task 21: App Monitoring (Distracting apps)
    const { exec } = require('child_process');
    const distractingApps = ['chrome.exe', 'Discord.exe', 'TikTok.exe', 'msedge.exe'];

    ipcMain.on('start-app-monitoring', (event) => {
        if (monitoringInterval) clearInterval(monitoringInterval);
        monitoringInterval = setInterval(() => {
            if (!isFocusing) return; // Only check when focusing
            if (process.platform === 'win32') {
                exec('tasklist', (err, stdout, stderr) => {
                    if (err) return;
                    for (const app of distractingApps) {
                        if (stdout.toLowerCase().includes(app.toLowerCase())) {
                            if (mainWindow) {
                                mainWindow.webContents.send('distracting-app-detected', app);
                            }
                        }
                    }
                });
            }
        }, 10000); // Check every 10 seconds
    });

    ipcMain.on('stop-app-monitoring', (event) => {
        if (monitoringInterval) {
            clearInterval(monitoringInterval);
            monitoringInterval = null;
        }
    });

    ipcMain.handle('enter-lock-mode', async () => {
        if (!mainWindow) return false;
        isLockModeEnabled = true;
        registerLockShortcuts();
        mainWindow.setFullScreen(true);
        mainWindow.focus();
        notifyLockModeChanged();
        return true;
    });

    ipcMain.handle('exit-lock-mode', async () => {
        if (!mainWindow) return false;
        isLockModeEnabled = false;
        unregisterLockShortcuts();
        mainWindow.setFullScreen(false);
        notifyLockModeChanged();
        return true;
    });
});

app.on('will-quit', () => {
    unregisterLockShortcuts();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Still don't quit — tray keeps running
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

// ===== Prevent multiple instances =====
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();

            // Task 13: Handle deep link when app is already running
            const url = commandLine.find(arg => arg.startsWith('studybuddy://'));
            if (url) {
                mainWindow.webContents.send('deep-link', url);
            }
        }
    });
}
