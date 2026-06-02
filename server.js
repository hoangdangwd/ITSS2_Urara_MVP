const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
    pingInterval: 10000, // Gửi ping mỗi 10s
    pingTimeout: 5000    // Cleanup nếu không phản hồi sau 5s (Task 14)
});

const PORT = process.env.PORT || 3000;

// ===== Serve static files =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== In-memory room storage =====
const rooms = new Map();

// ===== Helper functions =====
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function getRoomData(roomId) {
    const room = rooms.get(roomId);
    if (!room) return null;
    return {
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
        mode: room.mode,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        members: Array.from(room.members.values())
    };
}

// ===== Socket.io Event Handling =====
io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);

    let currentUser = null;
    let currentRoomId = null;

    // --- User identity ---
    socket.on('set-identity', (data) => {
        currentUser = {
            id: socket.id,
            name: data.name || 'Ẩn danh',
            avatar: data.avatar || '😊',
            cameraOn: false,
            micOn: false,
            status: '🖥️ Đang học'
        };
        console.log(`[Identity] ${currentUser.name} (${socket.id})`);
    });

    // --- Create room ---
    socket.on('create-room', (data, callback) => {
        const roomId = generateRoomCode();
        const room = {
            id: roomId,
            code: roomId,
            name: data.name || 'Phòng học',
            description: data.description || '',
            mode: data.mode || 'public',
            createdBy: socket.id,
            createdAt: Date.now(),
            members: new Map()
        };

        rooms.set(roomId, room);
        console.log(`[Room Created] ${room.name} (${roomId})`);

        if (callback) callback({ success: true, roomId, code: roomId });
    });

    // --- Join room ---
    socket.on('join-room', (data, callback) => {
        const roomId = data.roomId;
        const room = rooms.get(roomId);

        if (!room) {
            if (callback) callback({ success: false, error: 'Phòng không tồn tại' });
            return;
        }

        // Leave previous room if any
        if (currentRoomId && currentRoomId !== roomId) {
            leaveCurrentRoom();
        }

        currentRoomId = roomId;
        socket.join(roomId);

        // Add member to room
        const member = {
            id: socket.id,
            name: currentUser ? currentUser.name : 'Ẩn danh',
            avatar: currentUser ? currentUser.avatar : '😊',
            cameraOn: false,
            micOn: false,
            status: currentUser ? currentUser.status : '🖥️ Đang học',
            joinedAt: Date.now()
        };
        room.members.set(socket.id, member);

        // Notify others in room
        socket.to(roomId).emit('user-joined', member);

        console.log(`[Join] ${member.name} → ${room.name} (${room.members.size} members)`);

        if (callback) callback({
            success: true,
            room: getRoomData(roomId)
        });
    });

    // --- Leave room ---
    function leaveCurrentRoom() {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (room) {
            room.members.delete(socket.id);
            socket.to(currentRoomId).emit('user-left', {
                id: socket.id,
                name: currentUser ? currentUser.name : 'Ẩn danh'
            });
            console.log(`[Leave] ${currentUser?.name} ← ${room.name} (${room.members.size} remaining)`);

            // Delete room if empty
            if (room.members.size === 0) {
                rooms.delete(currentRoomId);
                console.log(`[Room Deleted] ${room.name} (empty)`);
            }
        }
        socket.leave(currentRoomId);
        currentRoomId = null;
    }

    socket.on('leave-room', () => {
        leaveCurrentRoom();
    });

    // --- Chat message ---
    socket.on('chat-message', (data) => {
        if (!currentRoomId) return;
        const message = {
            id: Date.now(),
            userId: socket.id,
            userName: currentUser ? currentUser.name : 'Ẩn danh',
            text: data.text,
            timestamp: Date.now()
        };
        socket.to(currentRoomId).emit('chat-message', message);
    });

    // --- User status change ---
    socket.on('status-change', (data) => {
        if (!currentRoomId || !currentUser) return;
        currentUser.status = data.status;
        const room = rooms.get(currentRoomId);
        if (room) {
            const member = room.members.get(socket.id);
            if (member) member.status = data.status;
        }
        socket.to(currentRoomId).emit('user-status-changed', {
            id: socket.id,
            status: data.status
        });
    });

    // --- Camera toggle ---
    socket.on('camera-toggle', (data) => {
        if (!currentRoomId || !currentUser) return;
        currentUser.cameraOn = data.cameraOn;
        const room = rooms.get(currentRoomId);
        if (room) {
            const member = room.members.get(socket.id);
            if (member) member.cameraOn = data.cameraOn;
        }
        socket.to(currentRoomId).emit('user-camera-changed', {
            id: socket.id,
            cameraOn: data.cameraOn
        });
    });

    // --- Mic toggle ---
    socket.on('mic-toggle', (data) => {
        if (!currentRoomId || !currentUser) return;
        currentUser.micOn = data.micOn;
        const room = rooms.get(currentRoomId);
        if (room) {
            const member = room.members.get(socket.id);
            if (member) member.micOn = data.micOn;
        }
        socket.to(currentRoomId).emit('user-mic-changed', {
            id: socket.id,
            micOn: data.micOn
        });
    });

    // --- WebRTC Signaling ---
    socket.on('webrtc-offer', (data) => {
        socket.to(data.target).emit('webrtc-offer', {
            offer: data.offer,
            from: socket.id
        });
    });

    socket.on('webrtc-answer', (data) => {
        socket.to(data.target).emit('webrtc-answer', {
            answer: data.answer,
            from: socket.id
        });
    });

    socket.on('webrtc-ice-candidate', (data) => {
        socket.to(data.target).emit('webrtc-ice-candidate', {
            candidate: data.candidate,
            from: socket.id
        });
    });

    // --- Get room list ---
    socket.on('get-rooms', (callback) => {
        const roomList = [];
        rooms.forEach((room) => {
            if (room.mode === 'public') {
                roomList.push({
                    id: room.id,
                    code: room.code,
                    name: room.name,
                    description: room.description,
                    memberCount: room.members.size,
                    members: Array.from(room.members.values()).map(m => ({
                        name: m.name,
                        avatar: m.avatar
                    }))
                });
            }
        });
        if (callback) callback(roomList);
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
        leaveCurrentRoom();
        console.log(`[Disconnect] ${currentUser?.name || socket.id}`);
    });
});

// ===== Start server =====
// When required by Electron main.js, start automatically
// When run directly (node server.js), also start
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   📚 StudyBuddy Server                  ║
║   Running at http://localhost:${PORT}       ║
╚══════════════════════════════════════════╝
    `);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`[Server] Port ${PORT} is already in use. Assuming server is already running.`);
    } else {
        console.error('[Server] Failed to start:', err);
    }
});

module.exports = { app, server, io };
