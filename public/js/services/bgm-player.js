/**
 * bgm-player.js - Background Music Player Service
 * Trình phát nhạc nền hỗ trợ tập trung
 */

const BGMPlayer = {
    audio: null,
    currentTrack: null,
    isPlaying: false,
    volume: 50,

    // Task 15: Use external streaming URLs to save space and avoid copyright issues
    tracks: [
        { id: 1, name: 'Lo-fi Chill', icon: '🎵', src: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', duration: '∞' },
        { id: 2, name: 'Mưa nhẹ', icon: '🌧️', src: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_22dbf9e9d6.mp3?filename=soft-rain-ambient-111154.mp3', duration: '∞' },
        { id: 3, name: 'Tiếng sóng biển', icon: '🌊', src: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_25501865c3.mp3?filename=ocean-waves-112906.mp3', duration: '∞' },
        { id: 4, name: 'Rừng & Chim hót', icon: '🌲', src: 'https://cdn.pixabay.com/download/audio/2022/11/22/audio_deb1a2bbda.mp3?filename=forest-with-small-river-birds-and-nature-field-recording-118445.mp3', duration: '∞' },
        { id: 5, name: 'Piano nhẹ nhàng', icon: '🎹', src: 'https://cdn.pixabay.com/download/audio/2022/07/25/audio_2209772c5b.mp3?filename=relaxing-piano-music-117551.mp3', duration: '∞' },
        { id: 6, name: 'Quán cà phê', icon: '☕', src: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_515234db03.mp3?filename=coffee-shop-ambient-110025.mp3', duration: '∞' },
    ],

    /**
     * Initialize audio player
     */
    init() {
        this.audio = new Audio();
        this.audio.loop = true;

        // Load volume from settings
        const settings = UserStorage.getSettings();
        this.volume = settings.bgmVolume || 50;
        this.audio.volume = this.volume / 100;

        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this._updateUI();
        });
    },

    /**
     * Play a track
     */
    play(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return;

        this.currentTrack = track;

        if (track.src) {
            this.audio.src = track.src;
            this.audio.play().catch(err => {
                console.warn('[BGM] Cannot play:', err.message);
                showToast('⚠️ Không thể phát nhạc');
            });
            this.isPlaying = true;
        } else {
            // No source available - mock mode
            this.isPlaying = true;
            showToast('🎵 Đang phát: ' + track.name + ' (demo)');
        }

        this._updateUI();
    },

    /**
     * Toggle play/pause
     */
    toggle() {
        if (!this.currentTrack) {
            // Play first track
            this.play(this.tracks[0].id);
            return;
        }

        if (this.isPlaying) {
            this.pause();
        } else {
            this.resume();
        }
    },

    /**
     * Pause playback
     */
    pause() {
        if (this.audio && this.audio.src) {
            this.audio.pause();
        }
        this.isPlaying = false;
        this._updateUI();
    },

    /**
     * Resume playback
     */
    resume() {
        if (this.audio && this.audio.src) {
            this.audio.play().catch(() => {});
        }
        this.isPlaying = true;
        this._updateUI();
    },

    /**
     * Set volume (0-100)
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(100, value));
        if (this.audio) {
            this.audio.volume = this.volume / 100;
        }

        // Save to settings
        const settings = UserStorage.getSettings();
        settings.bgmVolume = this.volume;
        UserStorage.saveSettings(settings);

        this._updateUI();
    },

    /**
     * Stop playback
     */
    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.isPlaying = false;
        this.currentTrack = null;
        this._updateUI();
    },

    /**
     * Update UI elements
     */
    _updateUI() {
        // Update toggle button
        const toggleBtn = document.getElementById('bgm-toggle-btn');
        if (toggleBtn) {
            toggleBtn.textContent = this.isPlaying ? '⏸️' : '🎵';
            toggleBtn.classList.toggle('playing', this.isPlaying);
        }

        // Update track list active state
        document.querySelectorAll('.bgm-track').forEach(el => {
            const trackId = parseInt(el.dataset.trackId);
            el.classList.toggle('active', this.currentTrack && this.currentTrack.id === trackId);
        });

        // Update volume display
        const volumeValue = document.getElementById('bgm-volume-value');
        if (volumeValue) volumeValue.textContent = this.volume + '%';

        const volumeSlider = document.getElementById('bgm-volume-slider');
        if (volumeSlider) volumeSlider.value = this.volume;

        // Update now playing
        const nowPlaying = document.getElementById('bgm-now-playing');
        if (nowPlaying) {
            if (this.isPlaying && this.currentTrack) {
                nowPlaying.innerHTML = '<span class="now-playing-dot"></span> Đang phát: ' + this.currentTrack.name;
                nowPlaying.style.display = 'flex';
            } else {
                nowPlaying.style.display = 'none';
            }
        }
    }
};
