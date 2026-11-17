// Marisol Bay — all sound is synthesised with WebAudio. No audio files, no network.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.ambientStarted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _noiseBuffer(seconds = 1) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  shot() { this._noise(0.18, 0.5, 1800, 'highpass'); this._blip(160, 0.12, 'square', 0.25, 60); }
  hit() { this._blip(220, 0.08, 'triangle', 0.25, 140); }
  pickup() { this._blip(660, 0.1, 'sine', 0.3, 990); this._blip(990, 0.14, 'sine', 0.25, 1320); }
  cash() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 'triangle', 0.28), i * 90)); }
  denied() { this._blip(180, 0.2, 'sawtooth', 0.2, 120); }
  crash() { this._noise(0.4, 0.5, 500); this._blip(90, 0.3, 'sine', 0.4, 40); }
  horn() { this._blip(370, 0.25, 'sawtooth', 0.18, 370); this._blip(466, 0.25, 'sawtooth', 0.12, 466); }
  missionStart() { [392, 523, 659].forEach((f, i) => setTimeout(() => this._blip(f, 0.2, 'triangle', 0.3), i * 110)); }
  missionDone() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this._blip(f, 0.22, 'triangle', 0.3), i * 100)); }
  busted() { [330, 262, 196].forEach((f, i) => setTimeout(() => this._blip(f, 0.35, 'sawtooth', 0.22), i * 220)); }

  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    // soft ocean wash: looped filtered noise, slowly breathing
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(4);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
  }

  engine(on, speedRatio = 0) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (!on && this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* already stopped */ }
      this.engineOsc = null;
      this.engineGain = null;
      return;
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + speedRatio * 130;
      this.engineGain.gain.value = 0.05 + speedRatio * 0.06;
    }
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 800;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.frequency.value = 0.5;
      const lg = this.ctx.createGain();
      lg.gain.value = 220;
      this.sirenLfo.connect(lg);
      lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    }
    if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
      this.sirenLfo = null;
    }
  }
}
