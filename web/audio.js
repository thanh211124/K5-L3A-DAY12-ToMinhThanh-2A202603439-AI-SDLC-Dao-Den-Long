// Procedural WebAudio: night music + SFX. No audio files (see CREDITS.md). Never used by the Sim/headless.
const PENTA = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3];

export class Audio {
  constructor(volume = 0.7) {
    this.volume = volume;
    this.ctx = null;
    this.master = null;
    this.musicOn = false;
    this.timer = null;
    this.step = 0;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }
  resume() {
    if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume();
  }
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  tone(freq, dur = 0.2, type = 'sine', vol = 0.15, when = 0, slide = 0) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noise(dur = 0.6, vol = 0.08, freq = 800) {
    if (!this.ensure()) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }
  sfx(name) {
    switch (name) {
      case 'pick': return this.tone(880 + Math.random() * 160, 0.12, 'sine', 0.12);
      case 'deposit': return this.tone(523, 0.2, 'triangle', 0.12);
      case 'lit': return [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.15, i * 0.09));
      case 'pulse': return this.tone(330, 0.45, 'sawtooth', 0.06, 0, 400);
      case 'hit': return this.tone(180, 0.35, 'square', 0.08, 0, -120);
      case 'jump': return this.tone(440, 0.15, 'sine', 0.08, 0, 300);
      case 'pad': return this.tone(330, 0.4, 'triangle', 0.1, 0, 600);
      case 'dash': return this.noise(0.18, 0.12, 2000);
      case 'shade': return this.tone(98, 0.7, 'sine', 0.12, 0, -30);
      case 'tick': return this.tone(1200, 0.06, 'square', 0.06);
      case 'wind': return this.noise(1.8, 0.1, 500);
      case 'charm': return [784, 988, 1175].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, i * 0.07));
      case 'steal': return this.tone(600, 0.3, 'sine', 0.08, 0, -300);
      case 'win': return [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.14, i * 0.14));
      case 'lose': return [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.12, i * 0.2));
      default:
    }
  }
  // quiet night music: soft drone + slow pentatonic arpeggio
  music(on) {
    if (on === this.musicOn) return;
    this.musicOn = on;
    clearInterval(this.timer);
    if (!on || !this.ensure()) return;
    this.timer = setInterval(() => {
      const n = PENTA[(this.step * 3 + (this.step >> 2)) % PENTA.length] / 2;
      this.tone(n, 1.4, 'sine', 0.035);
      if (this.step % 8 === 0) this.tone(65.4, 3.5, 'triangle', 0.03);
      this.step++;
    }, 600);
  }
}
