// Retro Audio Engine (Lo-Fi Procedural Ambient & Authentic 8-bit SFX)
class RetroAudioManager {
    constructor() {
        this.ctx = null;
        this.isEnabled = false;
        this.bgmTimer = null;
        this.bgmStep = 0;
        this.masterGain = null;
        this.bgmGain = null;
        this.sfxGain = null;
        this.filter = null;
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        // Lowpass filter for warm Lo-Fi retro texture
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(1100, this.ctx.currentTime);

        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

        // BGM Gain Node
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

        // SFX Gain Node
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

        // Audio graph
        this.bgmGain.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    enable() {
        this.init();
        this.resume();
        this.isEnabled = true;
        this.startLoFiBgm();
        this.playBlip(620, 0.06);
    }

    disable() {
        this.isEnabled = false;
        this.stopLoFiBgm();
    }

    // Play 8-bit retro blip
    playBlip(freq = 520, duration = 0.05, type = 'square') {
        if (!this.isEnabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Play pitch-shifting toggle sound
    playToggle(isDark) {
        if (!this.isEnabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        const startFreq = isDark ? 350 : 650;
        const endFreq = isDark ? 650 : 350;

        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // 8-bit Fanfare for Quest Complete / CV Download
    playFanfare() {
        if (!this.isEnabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const notes = [
            { f: 523.25, t: 0.00, d: 0.09 }, // C5
            { f: 659.25, t: 0.09, d: 0.09 }, // E5
            { f: 783.99, t: 0.18, d: 0.09 }, // G5
            { f: 1046.50, t: 0.27, d: 0.35 }  // C6 (held)
        ];

        notes.forEach(({ f, t, d }) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(f, now + t);

            gain.gain.setValueAtTime(0.22, now + t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now + t);
            osc.stop(now + t + d);
        });
    }

    // Procedural Lo-Fi Ambient BGM
    startLoFiBgm() {
        if (this.bgmTimer) return;

        // Warm 7th chord progressions (Hz)
        // Cmaj7 -> Am7 -> Dm7 -> G7
        const chords = [
            [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3 (Cmaj7)
            [110.00, 130.81, 164.81, 196.00], // A2, C3, E3, G3 (Am7)
            [146.83, 174.61, 220.00, 261.63], // D3, F3, A3, C4 (Dm7)
            [98.00, 123.47, 146.83, 174.61]   // G2, B2, D3, F3 (G7)
        ];

        // Lo-fi melodic pentatonic pool (Hz)
        const melodyPool = [
            329.63, 392.00, 440.00, 523.25, 587.33, 659.25 // E4, G4, A4, C5, D5, E5
        ];

        const beatDuration = 0.9; // ~67 BPM chilled lo-fi tempo
        this.bgmStep = 0;

        const scheduleBeat = () => {
            if (!this.isEnabled || !this.ctx) return;
            const now = this.ctx.currentTime;
            const chordIndex = Math.floor((this.bgmStep % 16) / 4);
            const stepInBar = this.bgmStep % 4;

            // Play chord on first beat of bar
            if (stepInBar === 0) {
                const chord = chords[chordIndex];
                chord.forEach(freq => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now);

                    gain.gain.setValueAtTime(0.001, now);
                    gain.gain.linearRampToValueAtTime(0.05, now + 0.3);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + (beatDuration * 3.8));

                    osc.connect(gain);
                    gain.connect(this.bgmGain);

                    osc.start(now);
                    osc.stop(now + (beatDuration * 3.8));
                });
            }

            // Play gentle melodic note occasionally
            if (stepInBar === 1 || stepInBar === 3 || Math.random() > 0.45) {
                const note = melodyPool[Math.floor(Math.random() * melodyPool.length)];
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(note, now);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.045, now + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + beatDuration * 0.9);

                osc.connect(gain);
                gain.connect(this.bgmGain);

                osc.start(now);
                osc.stop(now + beatDuration * 0.9);
            }

            this.bgmStep++;
        };

        scheduleBeat();
        this.bgmTimer = setInterval(scheduleBeat, beatDuration * 1000);
    }

    stopLoFiBgm() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const soundToggle = document.getElementById('soundToggle');
    const soundIcon = document.getElementById('soundIcon');
    const audioMgr = new RetroAudioManager();

    // Default Theme: Light Mode (or restore saved preference)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
    } else {
        html.setAttribute('data-theme', 'light');
    }

    // Theme Toggle Handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        audioMgr.playToggle(newTheme === 'dark');

        // Glitch effect on container
        const container = document.querySelector('.container');
        container.style.opacity = '0.5';
        setTimeout(() => container.style.opacity = '1', 100);
    });

    // Audio / Sound Toggle Handler
    const updateSoundUI = (enabled) => {
        if (enabled) {
            soundToggle.classList.add('sound-active');
            soundIcon.querySelector('use').setAttribute('href', 'assets/icons/sprite.svg#icon-sound-on');
        } else {
            soundToggle.classList.remove('sound-active');
            soundIcon.querySelector('use').setAttribute('href', 'assets/icons/sprite.svg#icon-sound-off');
        }
    };

    const savedSound = localStorage.getItem('sound_enabled');
    if (savedSound === 'true') {
        const autoResumeAudio = () => {
            audioMgr.enable();
            updateSoundUI(true);
            document.removeEventListener('click', autoResumeAudio);
        };
        document.addEventListener('click', autoResumeAudio);
    }

    soundToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audioMgr.isEnabled) {
            audioMgr.disable();
            updateSoundUI(false);
            localStorage.setItem('sound_enabled', 'false');
        } else {
            audioMgr.enable();
            updateSoundUI(true);
            localStorage.setItem('sound_enabled', 'true');
        }
    });

    // Tab Navigation Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            audioMgr.playBlip(560, 0.05);

            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
                targetPanel.scrollTop = 0; // Reset scroll to top on tab switch
            }
        });
    });

    // Collapsible Logic
    const collapsibleHeaders = document.querySelectorAll('.collapsible-heading');
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', () => {
            audioMgr.playBlip(480, 0.05);

            const content = header.nextElementSibling;
            const icon = header.querySelector('.toggle-icon');
            const isOpen = content.classList.contains('open');

            if (!isOpen) {
                content.classList.add('open');
                if (icon) icon.textContent = '-';
            } else {
                content.classList.remove('open');
                if (icon) icon.textContent = '+';
            }
        });
    });

    // CV Download Victory Chime
    const cvDownloadBtn = document.getElementById('cvDownloadBtn');
    if (cvDownloadBtn) {
        cvDownloadBtn.addEventListener('click', () => {
            audioMgr.playFanfare();
        });
    }
});

window.addEventListener('load', () => {
    const progress = document.querySelector('.loading-progress');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Simulate loading progress
    setTimeout(() => {
        if (progress) progress.style.width = '100%';
    }, 100);

    // Unblur and hide loading after progress finishes
    setTimeout(() => {
        document.body.classList.add('loaded');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }, 1200);
});
