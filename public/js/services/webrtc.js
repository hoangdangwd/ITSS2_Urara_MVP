/**
 * webrtc.js - WebRTC Peer Connection Manager
 * Architecture: WebRTC-Ready — hiện tại dùng Socket sync,
 * nhưng interface đã chuẩn bị sẵn để plug-in video thật.
 * 
 * Để nâng cấp sang video thật, chỉ cần:
 * 1. Uncomment các dòng RTCPeerConnection trong createPeerConnection()
 * 2. Implement sendOffer/sendAnswer/sendIceCandidate
 * 3. Thêm TURN server vào config nếu cần NAT traversal
 */

const WebRTCManager = {
    peerConnections: new Map(), // peerId -> RTCPeerConnection
    remoteStreams: new Map(),   // peerId -> MediaStream
    localStream: null,
    isReady: false,

    // ICE Server config — sẵn sàng cho WebRTC thật
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
            // TODO: Thêm TURN server khi deploy production
            // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
        ]
    },

    /**
     * Initialize WebRTC Manager
     * Đăng ký signaling events từ Socket
     */
    init() {
        this.isReady = true;
        console.log('[WebRTC] Manager initialized (Socket-sync mode, WebRTC-ready)');

        // Signaling event listeners — sẵn sàng cho WebRTC thật
        SocketClient.on('webrtc-offer', (data) => this.handleOffer(data));
        SocketClient.on('webrtc-answer', (data) => this.handleAnswer(data));
        SocketClient.on('webrtc-ice-candidate', (data) => this.handleIceCandidate(data));
    },

    /**
     * Set local media stream (từ MediaManager)
     * Khi nâng cấp WebRTC, stream này sẽ được gắn vào mỗi PeerConnection
     */
    setLocalStream(stream) {
        this.localStream = stream;
        console.log('[WebRTC] Local stream set:', stream ? stream.getTracks().length + ' tracks' : 'null');
    },

    /**
     * Create peer connection for a remote user
     * MVP: Chỉ lưu metadata. Khi nâng cấp: tạo RTCPeerConnection thật
     */
    createPeerConnection(peerId) {
        console.log('[WebRTC] Creating peer connection for', peerId);
        
        const pc = new RTCPeerConnection(this.config);
        
        // Thêm local tracks vào connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }
        
        // Nhận remote tracks
        pc.ontrack = (event) => {
            console.log('[WebRTC] Received remote track from', peerId);
            this.remoteStreams.set(peerId, event.streams[0]);
            this._attachRemoteStream(peerId, event.streams[0]);
        };
        
        // ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                SocketClient.socket.emit('webrtc-ice-candidate', {
                    target: peerId,
                    candidate: event.candidate
                });
            }
        };
        
        // Connection state
        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state with', peerId, ':', pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.removePeer(peerId);
            }
        };
        
        this.peerConnections.set(peerId, pc);
        return pc;
    },

    /**
     * Remove peer connection
     */
    removePeer(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (pc && pc.close) pc.close(); // RTCPeerConnection có .close()
        this.peerConnections.delete(peerId);
        this.remoteStreams.delete(peerId);
        
        // Remove video element
        const videoEl = document.querySelector(`video[data-peer-id="${peerId}"]`);
        if (videoEl) {
            videoEl.srcObject = null;
        }
        console.log('[WebRTC] Removed peer:', peerId);
    },

    /**
     * Attach remote stream to video element
     * Sẵn sàng cho khi bật WebRTC thật
     */
    _attachRemoteStream(peerId, stream) {
        const videoEl = document.querySelector(`video[data-peer-id="${peerId}"]`);
        if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play().catch(() => {});
            console.log('[WebRTC] Attached remote stream to video element for', peerId);
        }
        
        const audioEl = document.querySelector(`audio.member-audio[data-member-id="${peerId}"]`);
        if (audioEl) {
            audioEl.srcObject = stream;
            audioEl.play().catch(() => {});
            console.log('[WebRTC] Attached remote stream to audio element for', peerId);
        }
    },

    // === Signaling Handlers (sẵn sàng cho WebRTC thật) ===

    async handleOffer(data) {
        console.log('[WebRTC] Received offer from', data.from);
        let pc = this.peerConnections.get(data.from);
        if (!pc) pc = this.createPeerConnection(data.from);
        
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            SocketClient.socket.emit('webrtc-answer', {
                target: data.from,
                answer: answer
            });
        } catch (err) {
            console.error('[WebRTC] Error handling offer from', data.from, err);
        }
    },

    async handleAnswer(data) {
        console.log('[WebRTC] Received answer from', data.from);
        const pc = this.peerConnections.get(data.from);
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (err) {
                console.error('[WebRTC] Error setting remote description for answer from', data.from, err);
            }
        }
    },

    async handleIceCandidate(data) {
        console.log('[WebRTC] Received ICE candidate from', data.from);
        const pc = this.peerConnections.get(data.from);
        if (pc && data.candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
                console.error('[WebRTC] Error adding ICE candidate from', data.from, err);
            }
        }
    },

    /**
     * Initiate connection to a new peer (called when user joins room)
     */
    async connectToPeer(peerId) {
        console.log('[WebRTC] Connecting to peer:', peerId);
        const pc = this.createPeerConnection(peerId);
        
        if (pc) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                SocketClient.socket.emit('webrtc-offer', {
                    target: peerId,
                    offer: offer
                });
            } catch (err) {
                console.error('[WebRTC] Error creating offer for', peerId, err);
            }
        }
    },

    /**
     * Add a track to all active peer connections
     */
    addTrackToAllPeers(track, stream) {
        console.log('[WebRTC] Adding track to all peers:', track.kind);
        this.peerConnections.forEach((pc, peerId) => {
            const senders = pc.getSenders();
            const alreadyAdded = senders.some(sender => sender.track === track);
            if (!alreadyAdded) {
                try {
                    pc.addTrack(track, stream);
                    this.renegotiate(peerId);
                } catch (err) {
                    console.error('[WebRTC] Error adding track to peer', peerId, err);
                }
            }
        });
    },

    /**
     * Renegotiate connection with a peer
     */
    async renegotiate(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            try {
                console.log('[WebRTC] Renegotiating connection with', peerId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                SocketClient.socket.emit('webrtc-offer', {
                    target: peerId,
                    offer: offer
                });
            } catch (err) {
                console.error('[WebRTC] Error during renegotiation with', peerId, err);
            }
        }
    },

    /**
     * Close all connections
     */
    closeAll() {
        this.peerConnections.forEach((pc, peerId) => {
            if (pc && pc.close) pc.close();
        });
        this.peerConnections.clear();
        this.remoteStreams.clear();
        this.localStream = null;
        console.log('[WebRTC] All connections closed');
    },

    /**
     * Get connection count
     */
    getPeerCount() {
        return this.peerConnections.size;
    }
};
