/**
 * Motor de audio 100% sintetizado con Web Audio API: cero assets externos,
 * cero problemas de licencias. El AudioContext se crea/reanuda en el primer
 * gesto del usuario (política de autoplay de los navegadores).
 */
export type SfxName =
  | 'shot' | 'missile' | 'explosion' | 'bigExplosion' | 'hit' | 'playerHit'
  | 'shieldHit' | 'pickup' | 'special' | 'roll' | 'alert' | 'bossWarning'
  | 'combo' | 'uiClick' | 'uiHover' | 'lifeLost' | 'lightning';

type MusicMood = 'menu' | 'combat' | 'boss' | 'victory' | 'defeat';

const SFX_THROTTLE: Partial<Record<SfxName, number>> = {
  shot: 0.045, hit: 0.03, explosion: 0.05, alert: 0.4, playerHit: 0.1,
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineOsc: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<SfxName, number>();
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private mood: MusicMood | null = null;
  private step = 0;
  private _muted = false;
  musicVolume = 0.55;
  sfxVolume = 0.8;

  get muted(): boolean {
    return this._muted;
  }

  /** Debe llamarse desde un gesto del usuario (clic/tecla). Idempotente. */
  unlock(): void {
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicVolume * 0.5;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxVolume;
        this.sfxGain.connect(this.master);
        this.noiseBuffer = this.makeNoise();
        this.applyMute();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.musicGain) this.musicGain.gain.value = music * 0.5;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.applyMute();
  }

  private applyMute(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Motor del avión: zumbido continuo que sube de tono con el turbo ─────────
  startEngineLoop(): void {
    if (!this.ctx || this.engineOsc) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 58;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.sfxGain!);
    osc.start();
    gain.gain.setTargetAtTime(0.055, this.ctx.currentTime, 0.4);
    this.engineOsc = { osc, gain, filter };
  }

  setEngineIntensity(turbo: boolean, moving: boolean): void {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const freq = turbo ? 108 : moving ? 76 : 58;
    const cutoff = turbo ? 520 : moving ? 330 : 240;
    this.engineOsc.osc.frequency.setTargetAtTime(freq, t, 0.15);
    this.engineOsc.filter.frequency.setTargetAtTime(cutoff, t, 0.15);
    this.engineOsc.gain.gain.setTargetAtTime(turbo ? 0.085 : 0.055, t, 0.2);
  }

  stopEngineLoop(): void {
    if (!this.ctx || !this.engineOsc) return;
    const { osc, gain } = this.engineOsc;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    osc.stop(this.ctx.currentTime + 0.5);
    this.engineOsc = null;
  }

  // ── Efectos ─────────────────────────────────────────────────────────────────
  play(name: SfxName): void {
    if (!this.ctx || !this.sfxGain) return;
    const throttle = SFX_THROTTLE[name];
    if (throttle) {
      const now = performance.now();
      const last = this.lastPlayed.get(name) ?? 0;
      if (now - last < throttle * 1000) return;
      this.lastPlayed.set(name, now);
    }
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shot':
        this.blip(880, 220, 0.07, 'square', 0.12, t);
        break;
      case 'missile':
        this.sweep(190, 560, 0.5, 'sawtooth', 0.14, t);
        this.noise(0.4, 900, 0.1, t);
        break;
      case 'explosion':
        this.noise(0.5, 420, 0.35, t);
        this.blip(130, 35, 0.4, 'triangle', 0.3, t);
        break;
      case 'bigExplosion':
        this.noise(1.3, 300, 0.5, t);
        this.blip(90, 24, 1.1, 'triangle', 0.42, t);
        this.blip(55, 20, 1.4, 'sine', 0.4, t + 0.1);
        break;
      case 'hit':
        this.blip(500, 180, 0.06, 'square', 0.1, t);
        break;
      case 'playerHit':
        this.noise(0.25, 800, 0.25, t);
        this.blip(220, 60, 0.3, 'sawtooth', 0.3, t);
        break;
      case 'shieldHit':
        this.blip(1200, 500, 0.18, 'sine', 0.22, t);
        break;
      case 'pickup':
        this.blip(620, 1240, 0.14, 'square', 0.16, t);
        this.blip(930, 1860, 0.16, 'square', 0.12, t + 0.07);
        break;
      case 'special':
        this.sweep(80, 1500, 0.8, 'sawtooth', 0.3, t);
        this.noise(0.9, 1600, 0.25, t + 0.1);
        break;
      case 'roll':
        this.sweep(420, 180, 0.25, 'sine', 0.15, t);
        break;
      case 'alert':
        this.blip(980, 980, 0.1, 'square', 0.16, t);
        this.blip(980, 980, 0.1, 'square', 0.16, t + 0.16);
        break;
      case 'bossWarning':
        for (let i = 0; i < 3; i++) this.blip(392, 311, 0.3, 'sawtooth', 0.26, t + i * 0.4);
        break;
      case 'combo':
        this.blip(784, 1568, 0.12, 'triangle', 0.2, t);
        break;
      case 'lifeLost':
        this.sweep(600, 120, 0.9, 'sawtooth', 0.25, t);
        break;
      case 'lightning':
        this.noise(0.6, 2400, 0.22, t);
        break;
      case 'uiClick':
        this.blip(700, 1050, 0.05, 'square', 0.1, t);
        break;
      case 'uiHover':
        this.blip(500, 520, 0.03, 'sine', 0.05, t);
        break;
    }
  }

  private blip(from: number, to: number, dur: number, type: OscillatorType, vol: number, t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private sweep(from: number, to: number, dur: number, type: OscillatorType, vol: number, t: number): void {
    this.blip(from, to, dur, type, vol, t);
  }

  private noise(dur: number, cutoff: number, vol: number, t: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer!;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.sfxGain!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ── Música: secuenciador por pasos con progresiones por estado ──────────────
  playMusic(mood: MusicMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.step = 0;
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx) this.scheduleMusicStep();
  }

  stopMusic(): void {
    this.mood = null;
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusicStep(): void {
    if (!this.ctx || !this.mood) return;
    const mood = this.mood;
    const bpm = mood === 'boss' ? 168 : mood === 'combat' ? 140 : mood === 'menu' ? 96 : 84;
    const stepDur = 60 / bpm / 2;
    this.musicStep(mood, this.step, stepDur);
    this.step++;
    // Victoria/derrota: fanfarria corta, sin bucle.
    if ((mood === 'victory' || mood === 'defeat') && this.step >= 16) {
      this.mood = null;
      return;
    }
    this.musicTimer = setTimeout(() => this.scheduleMusicStep(), stepDur * 1000);
  }

  private musicNote(freq: number, dur: number, vol: number, type: OscillatorType = 'triangle'): void {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private musicStep(mood: MusicMood, step: number, stepDur: number): void {
    const s = step % 16;
    // Escala menor de La (A, C, D, E, G) — tono arcade clásico.
    const bass = [110, 110, 130.81, 130.81, 98, 98, 123.47, 123.47];
    const lead = [440, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25];
    switch (mood) {
      case 'menu':
        if (s % 4 === 0) this.musicNote(bass[(s / 4) % 8], stepDur * 3, 0.16, 'triangle');
        if (s % 8 === 4) this.musicNote(lead[Math.floor(step / 8) % 8] / 2, stepDur * 4, 0.07, 'sine');
        break;
      case 'combat':
        if (s % 2 === 0) this.musicNote(bass[(s / 2) % 8], stepDur * 1.6, 0.18, 'sawtooth');
        if (s % 4 === 2) this.noise(0.05, 4000, 0.08, this.ctx!.currentTime);
        if (s % 8 === 0 || s % 8 === 3) this.musicNote(lead[Math.floor(step / 4) % 8], stepDur * 1.4, 0.07, 'square');
        break;
      case 'boss':
        this.musicNote(bass[s % 8] * (s % 4 === 3 ? 1.189 : 1), stepDur * 1.2, 0.2, 'sawtooth');
        if (s % 4 === 2) this.noise(0.06, 5000, 0.1, this.ctx!.currentTime);
        if (s % 2 === 1) this.musicNote(lead[(step + 3) % 8] * 0.749, stepDur, 0.06, 'square');
        break;
      case 'victory': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        if (s < 4) this.musicNote(notes[s], stepDur * 2.5, 0.2, 'triangle');
        if (s === 6) this.musicNote(1046.5, stepDur * 6, 0.22, 'triangle');
        break;
      }
      case 'defeat': {
        const notes = [392, 349.23, 311.13, 261.63];
        if (s % 3 === 0 && s / 3 < 4) this.musicNote(notes[s / 3], stepDur * 3.5, 0.18, 'triangle');
        break;
      }
    }
  }
}

export const audio = new AudioEngine();
