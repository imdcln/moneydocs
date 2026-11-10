"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function useRetroAudio() {
  const [isEnabled, setIsEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const bgmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bgmStepRef = useRef<number>(0);

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current;
    if (typeof window === "undefined") return null;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    // Warm Lo-Fi retro filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1100, ctx.currentTime);
    filterRef.current = filter;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
    masterGainRef.current = masterGain;

    // BGM Gain
    const bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(0.18, ctx.currentTime);
    bgmGainRef.current = bgmGain;

    // SFX Gain
    const sfxGain = ctx.createGain();
    sfxGain.gain.setValueAtTime(0.25, ctx.currentTime);
    sfxGainRef.current = sfxGain;

    // Audio routing
    bgmGain.connect(filter);
    filter.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    return ctx;
  }, []);

  const resumeCtx = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  // Play retro 8-bit blip SFX
  const playBlip = useCallback((freq = 520, duration = 0.05, type: OscillatorType = "square") => {
    if (!isEnabled || !audioCtxRef.current) return;
    resumeCtx();
    const ctx = audioCtxRef.current;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      if (sfxGainRef.current) {
        osc.connect(gain);
        gain.connect(sfxGainRef.current);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      }
    } catch {
      // Audio play catch
    }
  }, [isEnabled, resumeCtx]);

  // Play pitch-shifting toggle sound
  const playToggle = useCallback((isDark: boolean) => {
    if (!isEnabled || !audioCtxRef.current) return;
    resumeCtx();
    const ctx = audioCtxRef.current;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      const startFreq = isDark ? 350 : 650;
      const endFreq = isDark ? 650 : 350;

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      if (sfxGainRef.current) {
        osc.connect(gain);
        gain.connect(sfxGainRef.current);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Ignore
    }
  }, [isEnabled, resumeCtx]);

  // 8-bit Fanfare for Quest Complete / CV Download
  const playFanfare = useCallback(() => {
    if (!isEnabled || !audioCtxRef.current) return;
    resumeCtx();
    const ctx = audioCtxRef.current;

    try {
      const now = ctx.currentTime;
      const notes = [
        { f: 523.25, t: 0.0, d: 0.09 }, // C5
        { f: 659.25, t: 0.09, d: 0.09 }, // E5
        { f: 783.99, t: 0.18, d: 0.09 }, // G5
        { f: 1046.5, t: 0.27, d: 0.35 }, // C6
      ];

      notes.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(f, now + t);

        gain.gain.setValueAtTime(0.22, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

        if (sfxGainRef.current) {
          osc.connect(gain);
          gain.connect(sfxGainRef.current);
          osc.start(now + t);
          osc.stop(now + t + d);
        }
      });
    } catch {
      // Ignore
    }
  }, [isEnabled, resumeCtx]);

  // Procedural Lo-Fi Ambient BGM
  const stopLoFiBgm = useCallback(() => {
    if (bgmTimerRef.current) {
      clearInterval(bgmTimerRef.current);
      bgmTimerRef.current = null;
    }
  }, []);

  const startLoFiBgm = useCallback(() => {
    if (bgmTimerRef.current || !audioCtxRef.current) return;

    const chords = [
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
      [110.0, 130.81, 164.81, 196.0], // Am7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [98.0, 123.47, 146.83, 174.61], // G7
    ];

    const melodyPool = [329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const beatDuration = 0.9;
    bgmStepRef.current = 0;

    const scheduleBeat = () => {
      const ctx = audioCtxRef.current;
      if (!ctx || !bgmGainRef.current) return;

      try {
        const now = ctx.currentTime;
        const chordIndex = Math.floor((bgmStepRef.current % 16) / 4);
        const stepInBar = bgmStepRef.current % 4;

        if (stepInBar === 0) {
          const chord = chords[chordIndex];
          chord.forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.05, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + beatDuration * 3.8);

            if (bgmGainRef.current) {
              osc.connect(gain);
              gain.connect(bgmGainRef.current);
              osc.start(now);
              osc.stop(now + beatDuration * 3.8);
            }
          });
        }

        if (stepInBar === 1 || stepInBar === 3 || Math.random() > 0.45) {
          const note = melodyPool[Math.floor(Math.random() * melodyPool.length)];
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(note, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.045, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + beatDuration * 0.9);

          if (bgmGainRef.current) {
            osc.connect(gain);
            gain.connect(bgmGainRef.current);
            osc.start(now);
            osc.stop(now + beatDuration * 0.9);
          }
        }

        bgmStepRef.current++;
      } catch {
        // Ignore audio playback exceptions
      }
    };

    scheduleBeat();
    bgmTimerRef.current = setInterval(scheduleBeat, beatDuration * 1000);
  }, []);

  const toggleSound = useCallback(() => {
    if (isEnabled) {
      setIsEnabled(false);
      stopLoFiBgm();
      if (typeof window !== "undefined") {
        localStorage.setItem("sound_enabled", "false");
      }
    } else {
      initAudio();
      resumeCtx();
      setIsEnabled(true);
      startLoFiBgm();
      if (typeof window !== "undefined") {
        localStorage.setItem("sound_enabled", "true");
      }
    }
  }, [isEnabled, initAudio, resumeCtx, startLoFiBgm, stopLoFiBgm]);

  useEffect(() => {
    const saved = localStorage.getItem("sound_enabled");
    if (saved === "true") {
      const handleFirstClick = () => {
        initAudio();
        resumeCtx();
        setIsEnabled(true);
        startLoFiBgm();
        window.removeEventListener("click", handleFirstClick);
      };
      window.addEventListener("click", handleFirstClick);
      return () => {
        window.removeEventListener("click", handleFirstClick);
      };
    }
  }, [initAudio, resumeCtx, startLoFiBgm]);

  useEffect(() => {
    return () => {
      stopLoFiBgm();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
    };
  }, [stopLoFiBgm]);

  return {
    isEnabled,
    toggleSound,
    playBlip,
    playToggle,
    playFanfare,
  };
}
