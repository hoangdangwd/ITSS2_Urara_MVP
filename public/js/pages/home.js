/**
 * home.js - Home page logic
 * Trang chủ: danh sách phòng, tạo phòng, tham gia phòng
 */

const HomePage = {
    /**
     * Initialize home page
     */
    init() {
        this.loadRoomList();
        this.startOnlineCountAnimation();
    },

    /**
     * Load room list from server (or mock)
     */
    async loadRoomList() {
        const container = document.getElementById('room-cards-container');
        if (!container) return;

        try {
            if (SocketClient.connected) {
                const rooms = await SocketClient.getRooms();
                this.renderRoomCards(rooms);
            } else {
                // Mock data khi chưa kết nối
                this.renderMockRooms();
            }
        } catch (err) {
            console.warn('[Home] Cannot load rooms:', err);
            this.renderMockRooms();
        }
    },

    /**
     * Render room cards
     */
    renderRoomCards(rooms) {
        const container = document.getElementById('room-cards-container');
        if (!container) return;

        let html = '';

        if (rooms.length === 0) {
            html += `
                <div class="room-card create-new" onclick="HomePage.showCreateRoom()">
                    <div class="create-icon">+</div>
                    <h3>Tạo phòng mới</h3>
                    <p>Bắt đầu phiên học của bạn</p>
                </div>
            `;
        } else {
            rooms.forEach(room => {
                const membersHtml = room.members.slice(0, 3).map(m =>
                    `<span class="member-dot" style="background: ${getRandomColor()};">${m.name.charAt(0)}</span>`
                ).join('');
                const extra = room.memberCount > 3 ? `<span class="member-count">+${room.memberCount - 3}</span>` : '';

                html += `
                    <div class="room-card" onclick="HomePage.joinExistingRoom('${room.id}')">
                        <div class="room-card-header">
                            <span class="room-emoji">🖥️</span>
                            <span class="room-badge live">LIVE</span>
                        </div>
                        <h3>${escapeHtml(room.name)}</h3>
                        <p>${escapeHtml(room.description || 'Phòng học đang hoạt động')}</p>
                        <div class="room-members-preview">
                            ${membersHtml}${extra}
                        </div>
                    </div>
                `;
            });

            html += `
                <div class="room-card create-new" onclick="HomePage.showCreateRoom()">
                    <div class="create-icon">+</div>
                    <h3>Tạo phòng mới</h3>
                    <p>Bắt đầu phiên học của bạn</p>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    /**
     * Render mock rooms (khi chưa kết nối server)
     */
    renderMockRooms() {
        const mockRooms = [
            {
                id: 'mock-1', name: 'Nhóm ITSS - Sprint Review',
                description: 'Cùng nhau code đồ án cuối kỳ', memberCount: 5,
                members: [{ name: 'Long' }, { name: 'Hình' }, { name: 'Tùng' }]
            },
            {
                id: 'mock-2', name: 'Ôn thi Giải tích',
                description: 'Giải bài tập chương 5-6', memberCount: 3,
                members: [{ name: 'An' }, { name: 'Minh' }]
            }
        ];
        this.renderRoomCards(mockRooms);
    },

    /**
     * Show create room modal
     */
    showCreateRoom() {
        document.getElementById('create-room-modal').classList.add('show');
    },

    /**
     * Hide create room modal
     */
    hideCreateRoom() {
        document.getElementById('create-room-modal').classList.remove('show');
    },
    
    /**
     * Show join room modal and auto-fill last code (Task 12)
     */
    showJoinRoom() {
        const modal = document.getElementById('join-room-modal');
        const input = document.getElementById('join-room-code');
        if (modal) modal.classList.add('show');
        if (input) {
            const lastCode = localStorage.getItem('lastRoomCode');
            if (lastCode) {
                input.value = lastCode;
                // Select the text for quick override if they don't want it
                setTimeout(() => input.select(), 100);
            } else {
                input.value = '';
                setTimeout(() => input.focus(), 100);
            }
        }
    },

    /**
     * Create room and join
     */
    async createAndJoin() {
        const name = document.getElementById('room-name').value.trim() || 'Phòng học';
        const desc = document.getElementById('room-desc').value.trim();
        const mode = document.querySelector('input[name="room-mode"]:checked')?.value || 'public';

        this.hideCreateRoom();

        if (SocketClient.connected) {
            try {
                const result = await SocketClient.createRoom({ name, description: desc, mode });
                if (result.success) {
                    const joinResult = await SocketClient.joinRoom(result.roomId);
                    if (joinResult.success) {
                        RoomPage.enterRoom(joinResult.room);
                        localStorage.setItem('lastRoomCode', joinResult.room.code || result.roomId);
                        showToast('🎉 Đã tạo và tham gia phòng!');
                    }
                }
            } catch (err) {
                showToast('⚠️ Không thể tạo phòng: ' + err.message);
            }
        } else {
            // Mock mode
            RoomPage.enterMockRoom(name, desc);
            localStorage.setItem('lastRoomCode', 'ABC123');
            showToast('🎉 Đã tham gia phòng! (demo)');
        }
    },

    /**
     * Join existing room by code
     */
    async joinByCode() {
        const code = document.getElementById('join-room-code')?.value.trim();
        if (!code) {
            showToast('⚠️ Vui lòng nhập mã phòng');
            return;
        }

        if (SocketClient.connected) {
            const result = await SocketClient.joinRoom(code);
            if (result.success) {
                RoomPage.enterRoom(result.room);
                localStorage.setItem('lastRoomCode', code);
                showToast('🎉 Đã tham gia phòng!');
            } else {
                showToast('⚠️ ' + (result.error || 'Không thể tham gia phòng'));
            }
        } else {
            RoomPage.enterMockRoom('Phòng ' + code, '');
            localStorage.setItem('lastRoomCode', code);
            showToast('🎉 Đã tham gia phòng! (demo)');
        }
    },

    /**
     * Join existing room by ID
     */
    async joinExistingRoom(roomId) {
        if (SocketClient.connected) {
            const result = await SocketClient.joinRoom(roomId);
            if (result.success) {
                RoomPage.enterRoom(result.room);
                showToast('🎉 Đã tham gia phòng!');
            } else {
                showToast('⚠️ ' + (result.error || 'Không thể tham gia phòng'));
            }
        } else {
            RoomPage.enterMockRoom('Phòng học nhóm', 'Cùng nhau học tập');
            showToast('🎉 Đã tham gia phòng! (demo)');
        }
    },

    /**
     * Animate online count on hero
     */
    startOnlineCountAnimation() {
        setInterval(() => {
            const el = document.getElementById('online-count');
            if (el) {
                const n = 10 + Math.floor(Math.random() * 6);
                el.textContent = n;
            }
        }, 5000);
    }
};
