/**
 * media.js - Camera & Microphone manager
 * Quản lý truy cập camera/microphone qua Web API
 */

const MediaManager = {
    localStream: null,
    cameraOn: false,
    micOn: false,

    /**
     * Check if browser supports getUserMedia
     */
    isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },

    /**
     * Request camera permission and get video stream
     */
    async requestCamera() {
        if (!this.isSupported()) {
            throw new Error('Trình duyệt không hỗ trợ truy cập camera');
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            this.localStream = stream;
            this.cameraOn = true;
            return stream;
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw new Error('Bạn đã từ chối quyền truy cập camera (Có thể bị chặn từ OS).');
            } else if (err.name === 'NotFoundError') {
                throw new Error('Không tìm thấy camera trên thiết bị.');
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                throw new Error('Camera đang bị ứng dụng khác sử dụng (VD: Zoom, Teams). Hãy đóng chúng và thử lại.');
            } else {
                throw new Error('Không thể truy cập camera: ' + err.message);
            }
        }
    },

    /**
     * Request microphone permission and get audio stream
     */
    async requestMicrophone() {
        if (!this.isSupported()) {
            throw new Error('Trình duyệt không hỗ trợ truy cập microphone');
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true // Sử dụng thiết bị mặc định của hệ điều hành
            });

            // If we already have a stream, add audio track to it
            if (this.localStream) {
                stream.getAudioTracks().forEach(track => {
                    this.localStream.addTrack(track);
                });
            } else {
                this.localStream = stream;
            }

            this.micOn = true;
            return stream;
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw new Error('Bạn đã từ chối quyền truy cập microphone.');
            } else if (err.name === 'NotFoundError') {
                throw new Error('Không tìm thấy microphone trên thiết bị.');
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                throw new Error('Microphone đang bị ứng dụng khác sử dụng.');
            } else {
                throw new Error('Không thể truy cập microphone: ' + err.message);
            }
        }
    },

    /**
     * Request both camera and microphone
     */
    async requestAll() {
        if (!this.isSupported()) {
            throw new Error('Trình duyệt không hỗ trợ truy cập media');
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            this.localStream = stream;
            this.cameraOn = true;
            this.micOn = true;
            return stream;
        } catch (err) {
            // Try video only
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                this.localStream = videoStream;
                this.cameraOn = true;
                console.warn('[Media] Microphone not available, video only');
                return videoStream;
            } catch {
                throw new Error('Không thể truy cập camera và microphone. Hãy kiểm tra các ứng dụng đang chạy ngầm.');
            }
        }
    },

    /**
     * Toggle camera on/off
     */
    toggleCamera() {
        if (!this.localStream) return false;

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length === 0) return false;

        this.cameraOn = !this.cameraOn;
        videoTracks.forEach(track => {
            track.enabled = this.cameraOn;
        });

        return this.cameraOn;
    },

    /**
     * Toggle microphone on/off
     */
    toggleMic() {
        if (!this.localStream) return false;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) return false;

        this.micOn = !this.micOn;
        audioTracks.forEach(track => {
            track.enabled = this.micOn;
        });

        return this.micOn;
    },

    /**
     * Set microphone to muted (for auto-mute feature)
     */
    muteMic() {
        if (!this.localStream) return;
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => { track.enabled = false; });
        this.micOn = false;
    },

    /**
     * Stop all tracks and release resources
     */
    stopAll() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.cameraOn = false;
        this.micOn = false;
    },

    /**
     * Get current stream
     */
    getStream() {
        return this.localStream;
    },

    /**
     * Check camera permission status
     */
    async checkCameraPermission() {
        try {
            const result = await navigator.permissions.query({ name: 'camera' });
            return result.state; // 'granted', 'denied', 'prompt'
        } catch {
            return 'unknown';
        }
    },

    /**
     * Check microphone permission status
     */
    async checkMicPermission() {
        try {
            const result = await navigator.permissions.query({ name: 'microphone' });
            return result.state;
        } catch {
            return 'unknown';
        }
    }
};
