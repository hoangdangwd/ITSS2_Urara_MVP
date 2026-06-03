/**
 * room.js - Room page logic
 * Phòng học: video grid, chat, status, camera/mic controls
 */

const RoomPage = {
    currentRoom: null,
    timerInterval: null,
    timerSeconds: 0,
    cameraOn: false,
    micOn: false,

    /**
     * Enter room with real data from server
     */
    async enterRoom(roomData) {
        this.currentRoom = roomData;
        this._showRoomScreen(roomData.name);
        this.renderMembers(roomData.members);
        this.startTimer();
        this._setupSocketListeners();

        // Update room code display
        const codeEl = document.getElementById('room-code-value');
        if (codeEl) codeEl.textContent = roomData.code || roomData.id;

        // Auto mute behavior (Task 9)
        this.micOn = false;
        this.cameraOn = false;

        // Initialize WebRTC Manager
        WebRTCManager.init();

        // Initialize actual media devices (camera & microphone)
        try {
            // Request both camera and microphone permissions & stream
            const stream = await MediaManager.requestAll();
            
            // Ensure tracks start as DISABLED (OFF) initially to respect default state
            if (stream) {
                stream.getVideoTracks().forEach(track => track.enabled = false);
                stream.getAudioTracks().forEach(track => track.enabled = false);
                
                // Register local stream for WebRTC
                WebRTCManager.setLocalStream(stream);
            }
            
            showToast('🔇 Mic của bạn đang được tắt tự động để tránh ồn', 4000); // 4s toast
        } catch (err) {
            console.warn('[Room] Cannot request camera/microphone on enter:', err);
            showToast('⚠️ Không thể tự động bật Camera/Mic: ' + err.message);
        }

        // Connect to all existing members in the room via WebRTC
        const myId = SocketClient.getId();
        if (roomData.members) {
            roomData.members.forEach(member => {
                if (member.id !== myId) {
                    // We initiate the WebRTC connection/offer to all existing peers
                    WebRTCManager.connectToPeer(member.id);
                }
            });
        }
    },

    /**
     * Enter mock room (demo mode)
     */
    enterMockRoom(name, desc) {
        this.currentRoom = {
            id: 'mock-room',
            name: name,
            description: desc,
            code: 'ABC123',
            members: []
        };

        this._showRoomScreen(name);
        this.renderMockMembers();
        this.startTimer();
        this.startMockFocusAnimation();
        
        this.micOn = false;
        showToast('🔇 Mic của bạn đang được tắt tự động để tránh ồn', 4000);
    },

    /**
     * Show room screen, hide home
     */
    _showRoomScreen(roomName) {
        document.getElementById('peer-home').classList.remove('active');
        document.getElementById('peer-room').classList.add('active');

        const titleEl = document.getElementById('room-title');
        if (titleEl) titleEl.textContent = '🖥️ ' + roomName;
    },

    /**
     * Leave room and go back to home
     */
    leaveRoom() {
        if (SocketClient.connected) {
            SocketClient.leaveRoom();
        }

        MediaManager.stopAll();
        this.stopTimer();
        this.currentRoom = null;
        this.cameraOn = false;
        this.micOn = false;
        
        // Clean up WebRTC peer connections
        WebRTCManager.closeAll();

        document.getElementById('peer-room').classList.remove('active');
        document.getElementById('peer-home').classList.add('active');

        // Refresh room list
        HomePage.loadRoomList();
    },

    /**
     * Render member cards
     */
    renderMembers(members) {
        const grid = document.getElementById('members-grid');
        if (!grid) return;

        const user = UserStorage.getUser();
        let html = this._renderMyCard(user);

        // Task 3: Max 6 videos
        const MAX_VISIBLE = 5; // 1 for self + 5 others = 6 max
        const otherMembers = members.filter(m => m.id !== SocketClient.getId());
        
        let count = 0;
        otherMembers.forEach(m => {
            if (count < MAX_VISIBLE) {
                html += this._renderMemberCard(m);
                count++;
            }
        });

        if (otherMembers.length > MAX_VISIBLE) {
            const hiddenCount = otherMembers.length - MAX_VISIBLE;
            html += `
                <div class="member-card more-members-card">
                    <div class="more-members-content">
                        <span class="more-members-icon">👥</span>
                        <span>+${hiddenCount} người khác</span>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;
        this._updateAudioVolumes(); // Update volumes for newly rendered members (Task 16)
    },

    /**
     * Render mock members
     */
    renderMockMembers() {
        const grid = document.getElementById('members-grid');
        if (!grid) return;

        const user = UserStorage.getUser();
        const mockMembers = [
            { id: 'm1', name: 'Long', avatar: '👨‍💻', cameraOn: true, micOn: false, status: '🖥️ Đang code', focus: 85 },
            { id: 'm2', name: 'Hình', avatar: '👩‍💻', cameraOn: true, micOn: true, status: '🔥 Tập trung cao độ', focus: 95 },
            { id: 'm3', name: 'Tùng', avatar: '😴', cameraOn: false, micOn: false, status: '☕ Nghỉ giải lao', focus: 30 },
            { id: 'm4', name: 'An', avatar: '🧑‍🎓', cameraOn: true, micOn: false, status: '📖 Đọc tài liệu', focus: 72 },
            { id: 'm5', name: 'Bình', avatar: '🧑‍🎨', cameraOn: false, micOn: false, status: '🎨 Thiết kế', focus: 60 },
            { id: 'm6', name: 'Cường', avatar: '🥷', cameraOn: true, micOn: false, status: '🖥️ Đang code', focus: 88 },
        ];

        let html = this._renderMyCard(user);
        
        // Task 3: Max 6 limit logic
        let count = 0;
        mockMembers.forEach(m => { 
            if(count < 5) {
                html += this._renderMockMemberCard(m); 
                count++;
            }
        });
        
        if (mockMembers.length > 5) {
            html += `
                <div class="member-card more-members-card">
                    <div class="more-members-content">
                        <span class="more-members-icon">👥</span>
                        <span>+${mockMembers.length - 5} người khác</span>
                    </div>
                </div>
            `;
        }
        
        grid.innerHTML = html;
    },

    _renderMyCard(user) {
        const name = user ? user.name : 'Bạn';
        const avatar = user ? user.avatar : '😊';
        // Task 11: Mic glow class
        const micGlowClass = this.micOn ? 'speaking-glow' : '';
        return `
            <div class="member-card is-you ${micGlowClass}" id="my-card">
                <div class="member-camera" id="my-camera">
                    <!-- WebRTC-ready: video element sẵn sàng cho camera thật -->
                    <video id="my-video" class="member-video" autoplay muted playsinline style="display:none;"></video>
                    <div class="camera-placeholder" id="my-camera-placeholder">
                        <span class="camera-emoji">${avatar}</span>
                        <span>Camera tắt</span>
                    </div>
                    <!-- Task 11: Mic status icon -->
                    <div class="member-mic-status ${this.micOn ? 'on' : 'off'}" id="my-mic-icon">
                        ${this.micOn ? '🎤' : '🔇'}
                    </div>
                    <span class="camera-badge" id="my-camera-badge" style="display:none;">📷 ON</span>
                </div>
                <div class="member-info">
                    <div class="member-name">
                        <span class="status-dot online"></span>
                        ${escapeHtml(name)}
                        <span class="you-badge">YOU</span>
                    </div>
                    <div class="member-status" id="my-status-text">🖥️ Đang học</div>
                </div>
                <div class="member-actions">
                    <button class="btn btn-sm btn-ghost" onclick="RoomPage.toggleCamera()" id="btn-camera-toggle">
                        📷 Bật Camera
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="RoomPage.toggleMic()" id="btn-mic-toggle">
                        🎤 Bật Mic
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="RoomPage.showStatusPicker()">
                        ✏️ Đổi trạng thái
                    </button>
                </div>
            </div>
        `;
    },

    _renderMemberCard(member) {
        const isCameraActive = member.cameraOn ? 'active' : '';
        const micGlowClass = member.micOn ? 'speaking-glow' : '';
        const dotClass = member.cameraOn ? 'online' : 'away';

        return `
            <div class="member-card ${micGlowClass}" data-member-id="${member.id}">
                <div class="member-camera ${isCameraActive}">
                    <div class="camera-active-view" style="${member.cameraOn ? '' : 'display: none;'}">
                        <video data-peer-id="${member.id}" autoplay playsinline class="local-video"></video>
                        <span class="big-emoji" style="display: none;">${member.avatar}</span>
                    </div>
                    <div class="camera-placeholder" style="${member.cameraOn ? 'display: none;' : ''}">
                        <span class="camera-emoji">${member.avatar}</span>
                        <span>Camera tắt</span>
                    </div>
                    <span class="camera-badge" style="${member.cameraOn ? '' : 'display: none;'}">📷 ON</span>
                    <div class="member-mic-status ${member.micOn ? 'on' : 'off'}">
                        ${member.micOn ? '🎤' : '🔇'}
                    </div>
                </div>
                <div class="member-info">
                    <div class="member-name">
                        <span class="status-dot ${dotClass}"></span>
                        ${escapeHtml(member.name)}
                    </div>
                    <div class="member-status">${escapeHtml(member.status || '🖥️ Đang học')}</div>
                </div>
                <!-- Hidden audio element for voice mixer (Task 16) -->
                <audio class="member-audio" data-member-id="${member.id}" autoplay></audio>
            </div>
        `;
    },

    _renderMockMemberCard(member) {
        const cameraHtml = member.cameraOn
            ? `<div class="camera-active-view"><span class="big-emoji">${member.avatar}</span></div><span class="camera-badge">📷 ON</span>`
            : `<div class="camera-placeholder"><span class="camera-emoji">${member.avatar}</span><span>Camera tắt</span></div>`;
        const dotClass = member.focus > 50 ? 'online' : 'away';
        const focusClass = member.focus >= 90 ? 'high' : member.focus <= 40 ? 'low' : '';

        return `
            <div class="member-card" data-member-id="${member.id}">
                <div class="member-camera ${member.cameraOn ? 'active' : ''}">
                    ${cameraHtml}
                </div>
                <div class="member-info">
                    <div class="member-name">
                        <span class="status-dot ${dotClass}"></span>
                        ${escapeHtml(member.name)}
                    </div>
                    <div class="member-status">${member.status}</div>
                </div>
                <div class="member-focus-bar">
                    <div class="focus-label">Tập trung</div>
                    <div class="focus-track">
                        <div class="focus-fill ${focusClass}" style="width: ${member.focus}%;"></div>
                    </div>
                    <div class="focus-value">${member.focus}%</div>
                </div>
            </div>
        `;
    },

    // ===== Camera / Mic Controls =====

    async toggleCamera() {
        try {
            if (!this.cameraOn) {
                const camBtn = document.getElementById('btn-camera-toggle');
                if (camBtn) camBtn.textContent = '⏳ Đang bật...';
                
                let stream = MediaManager.getStream();
                if (!stream || stream.getVideoTracks().length === 0) {
                    stream = await MediaManager.requestCamera();
                    WebRTCManager.setLocalStream(MediaManager.getStream());
                    
                    // Add video track to all active peer connections
                    const videoTrack = MediaManager.getStream().getVideoTracks()[0];
                    if (videoTrack) {
                        WebRTCManager.addTrackToAllPeers(videoTrack, MediaManager.getStream());
                    }
                } else {
                    MediaManager.cameraOn = true;
                    stream.getVideoTracks().forEach(track => track.enabled = true);
                }
                this.cameraOn = true;

                // Show real video preview in my card
                const cam = document.querySelector('#my-card .member-camera');
                const videoEl = document.getElementById('my-video');
                const placeholder = document.getElementById('my-camera-placeholder');
                const badge = document.getElementById('my-camera-badge');
                
                if (videoEl && MediaManager.getStream()) {
                    videoEl.srcObject = MediaManager.getStream();
                    videoEl.style.display = 'block';
                }
                if (placeholder) placeholder.style.display = 'none';
                if (badge) badge.style.display = '';
                if (cam) cam.classList.add('active');
                if (camBtn) camBtn.textContent = '📷 Tắt Camera';

                showToast('📷 Camera đã bật');
            } else {
                MediaManager.toggleCamera();
                this.cameraOn = false;

                const videoEl = document.getElementById('my-video');
                const placeholder = document.getElementById('my-camera-placeholder');
                const badge = document.getElementById('my-camera-badge');
                const cam = document.querySelector('#my-card .member-camera');
                const camBtn = document.getElementById('btn-camera-toggle');
                
                if (videoEl) { videoEl.style.display = 'none'; videoEl.srcObject = null; }
                if (placeholder) placeholder.style.display = '';
                if (badge) badge.style.display = 'none';
                if (cam) cam.classList.remove('active');
                if (camBtn) camBtn.textContent = '📷 Bật Camera';

                showToast('Camera đã tắt');
            }

            if (SocketClient.connected) {
                SocketClient.toggleCamera(this.cameraOn);
            }
        } catch (err) {
            showToast('⚠️ ' + err.message);
            // Task 6: Deep link OS Settings
            if (err.message.includes('bị chặn từ OS') || err.message.includes('NotAllowedError')) {
                if (window.electronAPI) {
                    setTimeout(() => {
                        if (confirm('Bạn có muốn mở Cài đặt Hệ điều hành để cấp quyền Camera không?')) {
                            window.electronAPI.openSettings('camera');
                        }
                    }, 500);
                }
            }
        }
    },

    async toggleMic() {
        try {
            if (!this.micOn) {
                const btn = document.getElementById('btn-mic-toggle');
                if (btn) btn.textContent = '⏳ Đang bật...';

                let stream = MediaManager.getStream();
                if (!stream || stream.getAudioTracks().length === 0) {
                    stream = await MediaManager.requestMicrophone();
                    WebRTCManager.setLocalStream(MediaManager.getStream());
                    
                    // Add audio track to all active peer connections
                    const audioTrack = MediaManager.getStream().getAudioTracks()[0];
                    if (audioTrack) {
                        WebRTCManager.addTrackToAllPeers(audioTrack, MediaManager.getStream());
                    }
                } else {
                    MediaManager.micOn = true;
                    stream.getAudioTracks().forEach(track => track.enabled = true);
                }
                this.micOn = true;
                showToast('🎤 Microphone đã bật');
            } else {
                MediaManager.toggleMic();
                this.micOn = false;
                showToast('🔇 Microphone đã tắt');
            }

            const btn = document.getElementById('btn-mic-toggle');
            if (btn) {
                btn.textContent = this.micOn ? '🔇 Tắt Mic' : '🎤 Bật Mic';
            }

            // Task 11: Update mic icon and glow
            const myCard = document.getElementById('my-card');
            const myMicIcon = document.getElementById('my-mic-icon');
            if (myCard) {
                if (this.micOn) myCard.classList.add('speaking-glow');
                else myCard.classList.remove('speaking-glow');
            }
            if (myMicIcon) {
                myMicIcon.textContent = this.micOn ? '🎤' : '🔇';
                myMicIcon.className = 'member-mic-status ' + (this.micOn ? 'on' : 'off');
            }

            if (SocketClient.connected) {
                SocketClient.toggleMic(this.micOn);
            }
        } catch (err) {
            showToast('⚠️ Không thể bật microphone: ' + err.message);
            const btn = document.getElementById('btn-mic-toggle');
            if (btn) btn.textContent = '🎤 Bật Mic';
        }
    },

    // ===== Audio Mixer (Task 16) =====

    _updateAudioVolumes() {
        const volumeSlider = document.getElementById('voice-volume-slider');
        const vol = volumeSlider ? volumeSlider.value / 100 : 0.8; // Default 80%
        document.querySelectorAll('audio.member-audio').forEach(audio => {
            audio.volume = vol;
        });
    },

    setVoiceVolume(val) {
        document.getElementById('voice-volume-value').textContent = val + '%';
        this._updateAudioVolumes();
    },

    // ===== Status =====

    showStatusPicker() {
        document.getElementById('status-picker').classList.remove('hidden');
    },

    setStatus(status) {
        document.getElementById('my-status-text').textContent = status;
        document.getElementById('status-picker').classList.add('hidden');

        if (SocketClient.connected) {
            SocketClient.changeStatus(status);
        }

        showToast('Đã cập nhật: ' + status);
    },

    // ===== Chat =====

    sendChat() {
        const input = document.getElementById('chat-input');
        const msg = input.value.trim();
        if (!msg) return;

        // Add to local chat
        this._appendChatMessage(UserStorage.getUser()?.name || 'Bạn', msg, 'var(--accent-light)');

        // Send to server
        if (SocketClient.connected) {
            SocketClient.sendMessage(msg);
        }

        input.value = '';
    },

    _appendChatMessage(author, text, color) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<span class="chat-author" style="color: ${color};">${escapeHtml(author)}:</span><span>${escapeHtml(text)}</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    // ===== Timer =====

    startTimer() {
        this.timerSeconds = 0;
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            const el = document.getElementById('room-timer');
            if (el) el.textContent = '⏱️ ' + formatTime(this.timerSeconds);
        }, 1000);
    },

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    },

    // ===== Copy room code =====

    copyRoomCode() {
        const code = document.getElementById('room-code-value')?.textContent;
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                showToast('📋 Đã copy mã phòng: ' + code);
            }).catch(() => {
                showToast('📋 Mã phòng: ' + code);
            });
        }
    },

    // ===== Mock animation for focus bars =====

    startMockFocusAnimation() {
        setInterval(() => {
            document.querySelectorAll('.member-card:not(.is-you) .focus-fill').forEach(fill => {
                const current = parseFloat(fill.style.width);
                const delta = (Math.random() - 0.4) * 6;
                const next = Math.max(10, Math.min(100, current + delta));
                fill.style.width = next + '%';
                const valueEl = fill.closest('.member-focus-bar')?.querySelector('.focus-value');
                if (valueEl) valueEl.textContent = Math.round(next) + '%';

                fill.classList.remove('high', 'low');
                if (next >= 90) fill.classList.add('high');
                else if (next <= 40) fill.classList.add('low');
            });
        }, 3000);
    },

    // ===== Socket event listeners =====

    _setupSocketListeners() {
        SocketClient.on('user-joined', (member) => {
            const grid = document.getElementById('members-grid');
            if (grid) {
                grid.insertAdjacentHTML('beforeend', this._renderMemberCard(member));
            }
            this._appendChatMessage('Hệ thống', member.name + ' đã tham gia phòng', 'var(--green)');
            showToast('👋 ' + member.name + ' đã tham gia!');
        });

        SocketClient.on('user-left', (data) => {
            const card = document.querySelector(`[data-member-id="${data.id}"]`);
            if (card) card.remove();
            this._appendChatMessage('Hệ thống', data.name + ' đã rời phòng', 'var(--text-muted)');
            
            // Clean up WebRTC Peer Connection
            WebRTCManager.removePeer(data.id);
        });

        SocketClient.on('chat-message', (data) => {
            this._appendChatMessage(data.userName, data.text, getRandomColor());
        });

        SocketClient.on('user-status-changed', (data) => {
            const card = document.querySelector(`[data-member-id="${data.id}"]`);
            if (card) {
                const statusEl = card.querySelector('.member-status');
                if (statusEl) statusEl.textContent = data.status;
            }
        });

        SocketClient.on('user-camera-changed', (data) => {
            const card = document.querySelector(`[data-member-id="${data.id}"]`);
            if (card) {
                const cam = card.querySelector('.member-camera');
                const activeView = card.querySelector('.camera-active-view');
                const placeholder = card.querySelector('.camera-placeholder');
                const badge = card.querySelector('.camera-badge');
                const statusDot = card.querySelector('.status-dot');

                if (data.cameraOn) {
                    if (cam) cam.classList.add('active');
                    if (activeView) activeView.style.display = '';
                    if (placeholder) placeholder.style.display = 'none';
                    if (badge) badge.style.display = '';
                    if (statusDot) {
                        statusDot.classList.remove('away');
                        statusDot.classList.add('online');
                    }
                    
                    // Re-attach stream if we have it
                    const stream = WebRTCManager.remoteStreams.get(data.id);
                    if (stream) {
                        WebRTCManager._attachRemoteStream(data.id, stream);
                    }
                } else {
                    if (cam) cam.classList.remove('active');
                    if (activeView) activeView.style.display = 'none';
                    if (placeholder) placeholder.style.display = '';
                    if (badge) badge.style.display = 'none';
                    if (statusDot) {
                        statusDot.classList.remove('online');
                        statusDot.classList.add('away');
                    }
                }
            }
        });

        // Task 11: Mic status updates
        SocketClient.on('user-mic-changed', (data) => {
            const card = document.querySelector(`[data-member-id="${data.id}"]`);
            if (card) {
                if (data.micOn) card.classList.add('speaking-glow');
                else card.classList.remove('speaking-glow');
                
                const micIcon = card.querySelector('.member-mic-status');
                if (micIcon) {
                    micIcon.textContent = data.micOn ? '🎤' : '🔇';
                    micIcon.className = 'member-mic-status ' + (data.micOn ? 'on' : 'off');
                }
            }
        });
    }
};
