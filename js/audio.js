/**
 * audio.js
 * Motor de audio completo usando Web Audio API (sin archivos externos).
 * Genera música procedural tipo synthwave/cyberpunk + efectos de sonido.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = false;
    this.musicNodes = [];
    this.musicRunning = false;
    this.bpm = 128;
    this.beat = 60 / this.bpm;
    this._scheduleTimeout = null;
  }

  // ── Inicializa el contexto (requiere interacción del usuario) ────────────
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);

      // Reverb convolución simple
      this.reverb = this._createReverb();
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = 0.2;
      this.reverbGain.connect(this.masterGain);

      this.enabled = true;
    } catch(e) {
      console.warn('Web Audio API no disponible:', e);
    }
  }

  _createReverb() {
    const convolver = this.ctx.createConvolver();
    const rate = this.ctx.sampleRate;
    const length = rate * 1.5;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }

  toggle() {
    this.init();
    if (!this.enabled) return false;
    if (this.musicRunning) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return this.musicRunning;
  }

  // ── Oscilador con envolvente ─────────────────────────────────────────────
  _osc(freq, type, attack, hold, release, gainVal, destination, time) {
    if (!this.ctx || !this.enabled) return;
    const now = time || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gainVal, now + attack);
    g.gain.setValueAtTime(gainVal, now + attack + hold);
    g.gain.linearRampToValueAtTime(0, now + attack + hold + release);
    osc.connect(g);
    g.connect(destination || this.musicGain);
    osc.start(now);
    osc.stop(now + attack + hold + release + 0.01);
    return { osc, g };
  }

  // ── MÚSICA AMBIENTAL CYBERPUNK ───────────────────────────────────────────
  startMusic() {
    if (!this.ctx || !this.enabled || this.musicRunning) return;
    this.musicRunning = true;
    this._scheduleMusicLoop(0);
  }

  stopMusic() {
    this.musicRunning = false;
    if (this._scheduleTimeout) clearTimeout(this._scheduleTimeout);
    // Fade out
    if (this.musicGain) {
      this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
      setTimeout(() => {
        if (this.musicGain) this.musicGain.gain.value = 0.35;
      }, 600);
    }
  }

  _scheduleMusicLoop(offset) {
    if (!this.musicRunning) return;
    const t = this.ctx.currentTime + offset;
    const b = this.beat;

    // ── Bass line (patrón de 8 beats) ────────────────────────────────────
    const bassNotes = [55, 55, 73.4, 55, 65.4, 55, 61.7, 49];
    bassNotes.forEach((freq, i) => {
      const bt = t + i * b;
      this._osc(freq, 'sawtooth', 0.01, b * 0.55, 0.06, 0.18, this.musicGain, bt);
      // Sub bass
      this._osc(freq / 2, 'sine', 0.02, b * 0.4, 0.08, 0.12, this.musicGain, bt);
    });

    // ── Arpeggio de sintetizador ──────────────────────────────────────────
    const arpScale = [220, 277.2, 329.6, 440, 554.4, 659.3, 880];
    for (let i = 0; i < 16; i++) {
      const freq = arpScale[i % arpScale.length];
      const bt   = t + i * (b / 2);
      this._osc(freq, 'square', 0.005, b * 0.2, 0.04, 0.04, this.musicGain, bt);
    }

    // ── Pad atmosférico ───────────────────────────────────────────────────
    const padChords = [[110, 138.6, 164.8], [98, 123.5, 146.8]];
    padChords.forEach((chord, ci) => {
      chord.forEach(freq => {
        const bt = t + ci * 4 * b;
        const n  = this._osc(freq, 'sine', 0.5, 2.5 * b, 0.8, 0.05, null, bt);
        if (n) {
          n.g.connect(this.reverb);
          this.reverb.connect(this.reverbGain);
        }
      });
    });

    // ── Hi-hat ───────────────────────────────────────────────────────────
    for (let i = 0; i < 16; i++) {
      if (i % 2 !== 0) {
        this._synthNoise(t + i * (b / 2), 0.004, 0.015, 0.06);
      }
    }

    // ── Kick drum ────────────────────────────────────────────────────────
    [0, 2, 4, 6].forEach(beat => {
      this._synthKick(t + beat * b, 0.18);
    });

    // ── Snare ────────────────────────────────────────────────────────────
    [2, 6].forEach(beat => {
      this._synthSnare(t + beat * b, 0.12);
    });

    // Programa el siguiente loop (8 beats)
    const loopDuration = 8 * b * 1000;
    this._scheduleTimeout = setTimeout(() => this._scheduleMusicLoop(0), loopDuration - 80);
  }

  _synthKick(time, vol) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.35);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(time); osc.stop(time + 0.36);
  }

  _synthSnare(time, vol) {
    if (!this.ctx) return;
    const bufSize = this.ctx.sampleRate * 0.15;
    const buf  = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(time); src.stop(time + 0.15);
  }

  _synthNoise(time, attack, hold, vol) {
    if (!this.ctx) return;
    const bufSize = Math.floor(this.ctx.sampleRate * (attack + hold + 0.02));
    const buf  = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 8000;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + attack);
    g.gain.exponentialRampToValueAtTime(0.001, time + attack + hold);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(time); src.stop(time + attack + hold + 0.02);
  }

  // ── EFECTOS DE SONIDO ────────────────────────────────────────────────────

  playRescue() {
    if (!this.ctx || !this.enabled) return;
    // Acorde victorioso ascendente
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, i) => {
      setTimeout(() => {
        this._osc(f, 'sine', 0.01, 0.15, 0.2, 0.3, this.sfxGain);
        this._osc(f * 2, 'sine', 0.01, 0.08, 0.15, 0.1, this.sfxGain);
      }, i * 60);
    });
  }

  playDamage() {
    if (!this.ctx || !this.enabled) return;
    this._osc(80, 'sawtooth', 0.005, 0.05, 0.15, 0.4, this.sfxGain);
    this._synthNoise(this.ctx.currentTime, 0.002, 0.08, 0.3);
  }

  playMove() {
    if (!this.ctx || !this.enabled) return;
    const f = 200 + Math.random() * 100;
    this._osc(f, 'sine', 0.002, 0.015, 0.02, 0.06, this.sfxGain);
  }

  playRecharge() {
    if (!this.ctx || !this.enabled) return;
    [440, 550, 660, 880].forEach((f, i) => {
      const t = this.ctx.currentTime + i * 0.08;
      this._osc(f, 'triangle', 0.01, 0.06, 0.1, 0.2, this.sfxGain, t);
    });
  }

  playComplete() {
    if (!this.ctx || !this.enabled) return;
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((f, i) => {
      const t = this.ctx.currentTime + i * 0.14;
      this._osc(f, 'sine', 0.01, 0.1, 0.15, 0.35, this.sfxGain, t);
      this._osc(f / 2, 'sine', 0.01, 0.1, 0.15, 0.1, this.sfxGain, t);
    });
  }

  playFail() {
    if (!this.ctx || !this.enabled) return;
    const notes = [400, 350, 280, 200];
    notes.forEach((f, i) => {
      const t = this.ctx.currentTime + i * 0.15;
      this._osc(f, 'sawtooth', 0.01, 0.12, 0.12, 0.3, this.sfxGain, t);
    });
  }

  playMapGenerate() {
    if (!this.ctx || !this.enabled) return;
    for (let i = 0; i < 6; i++) {
      const t = this.ctx.currentTime + i * 0.04;
      const f = 300 + i * 80;
      this._osc(f, 'square', 0.005, 0.025, 0.04, 0.08, this.sfxGain, t);
    }
  }

  playDynamic() {
    if (!this.ctx || !this.enabled) return;
    this._osc(220, 'sawtooth', 0.005, 0.04, 0.08, 0.2, this.sfxGain);
  }
}

// Instancia global
window.audio = new AudioEngine();
