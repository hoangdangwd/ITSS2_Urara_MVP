/**
 * socket-client.js - Socket.io client wrapper
 * Quản lý kết nối realtime với server
 * Phase 2: Auto-reconnect + Connection status banner
 */

const SocketClient = {
    serverUrl: 'https://itss2-urara-mvp-39i7.onrender.com',
    socket: null,
    connected: false,
    callbacks: {},
    _lastRoomId: null, // Lưu room ID để rejoin sau reconnect

    /**
     * Connect to the server
     */
    connect() {
        if (this.socket) return;

        this.socket = io(this.serverUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000
        });

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('[Socket] Connected:', this.socket.id);

            // Send identity
            const user = UserStorage.getUser();
            if (user) {
                this.socket.emit('set-identity', {
                    name: user.name,
                    avatar: user.avatar
                });
            }

            // Auto-rejoin room nếu bị mất kết nối giữa chừng
            if (this._lastRoomId) {
                console.log('[Socket] Auto-rejoining room:', this._lastRoomId);
                this.joinRoom(this._lastRoomId).then(result => {
                    if (result.success) {
                        showToast('🔄 Đã kết nối lại và tham gia phòng!');
                    }
                }).catch(() => {});
            }

            this._showConnectionBanner('online', '✅ Đã kết nối thành công');
            this._trigger('connected');
        });

        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            console.log('[Socket] Disconnected:', reason);
            
            if (reason === 'io server disconnect') {
                this._showConnectionBanner('offline', '❌ Mất kết nối với server');
            } else {
                this._showConnectionBanner('reconnecting', '🔄 Đang kết nối lại...');
            }
            
            this._trigger('disconnected');
        });

        this.socket.on('reconnect_attempt', (attempt) => {
            console.log('[Socket] Reconnecting... attempt', attempt);
            this._showConnectionBanner('reconnecting', `🔄 Đang kết nối lại... (${attempt})`);
        });

        this.socket.on('reconnect_failed', () => {
            console.log('[Socket] Reconnection failed');
            this._showConnectionBanner('offline', '❌ Không thể kết nối. Vui lòng kiểm tra mạng.');
        });

        this.socket.on('connect_error', (err) => {
            console.warn('[Socket] Connection error:', err.message);
        });

        // Room events
        this.socket.on('user-joined', (data) => this._trigger('user-joined', data));
        this.socket.on('user-left', (data) => this._trigger('user-left', data));
        this.socket.on('chat-message', (data) => this._trigger('chat-message', data));
        this.socket.on('user-status-changed', (data) => this._trigger('user-status-changed', data));
        this.socket.on('user-camera-changed', (data) => this._trigger('user-camera-changed', data));
        this.socket.on('user-mic-changed', (data) => this._trigger('user-mic-changed', data));

        // WebRTC signaling events
        this.socket.on('webrtc-offer', (data) => this._trigger('webrtc-offer', data));
        this.socket.on('webrtc-answer', (data) => this._trigger('webrtc-answer', data));
        this.socket.on('webrtc-ice-candidate', (data) => this._trigger('webrtc-ice-candidate', data));
    },

    /**
     * Show connection status banner
     */
    _showConnectionBanner(type, message) {
        let banner = document.getElementById('connection-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'connection-banner';
            banner.className = 'connection-banner';
            document.body.prepend(banner);
        }

        banner.className = 'connection-banner ' + type + ' show';
        banner.textContent = message;

        // Auto-hide online banner after 2 seconds
        if (type === 'online') {
            setTimeout(() => {
                banner.classList.remove('show');
            }, 2000);
        }
    },

    /**
     * Register event callback
     */
    on(event, callback) {
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(callback);
    },

    /**
     * Remove event callback
     */
    off(event, callback) {
        if (!this.callbacks[event]) return;
        this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    },

    /**
     * Trigger callbacks for an event
     */
    _trigger(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => cb(data));
        }
    },

    /**
     * Update identity after user changes name/avatar
     */
    setIdentity(name, avatar) {
        if (this.socket) {
            this.socket.emit('set-identity', { name, avatar });
        }
    },

    /**
     * Create a new room
     */
    createRoom(roomData) {
        return new Promise((resolve, reject) => {
            if (!this.socket) { reject(new Error('Chưa kết nối')); return; }
            this.socket.emit('create-room', roomData, (response) => {
                resolve(response);
            });
        });
    },

    /**
     * Join an existing room
     */
    joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            if (!this.socket) { reject(new Error('Chưa kết nối')); return; }
            this._lastRoomId = roomId; // Lưu để auto-rejoin
            this.socket.emit('join-room', { roomId }, (response) => {
                if (!response.success) {
                    this._lastRoomId = null;
                }
                resolve(response);
            });
        });
    },

    /**
     * Leave current room
     */
    leaveRoom() {
        if (this.socket) {
            this.socket.emit('leave-room');
        }
        this._lastRoomId = null;
    },

    /**
     * Send chat message
     */
    sendMessage(text) {
        if (this.socket) {
            this.socket.emit('chat-message', { text });
        }
    },

    /**
     * Update status
     */
    changeStatus(status) {
        if (this.socket) {
            this.socket.emit('status-change', { status });
        }
    },

    /**
     * Toggle camera
     */
    toggleCamera(cameraOn) {
        if (this.socket) {
            this.socket.emit('camera-toggle', { cameraOn });
        }
    },

    /**
     * Toggle mic
     */
    toggleMic(micOn) {
        if (this.socket) {
            this.socket.emit('mic-toggle', { micOn });
        }
    },

    /**
     * Get public rooms
     */
    getRooms() {
        return new Promise((resolve, reject) => {
            if (!this.socket) { reject(new Error('Chưa kết nối')); return; }
            this.socket.emit('get-rooms', (rooms) => {
                resolve(rooms);
            });
        });
    },

    /**
     * Get socket ID
     */
    getId() {
        return this.socket ? this.socket.id : null;
    }
};
