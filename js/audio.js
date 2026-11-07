// Sons sintetizados na hora (sem arquivos), com áudio 3D (PannerNode HRTF): a cabeça de cada
// lacraia faz "tic-tic" no lugar dela da cúpula a cada passo, a aranha, a pulga e o escorpião têm
// som próprio, e há uma musiquinha por mundo (pode desligar no menu).
// Só começa depois de um clique, tecla ou da entrada no VR (regra do navegador).
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// músicas: [baixo (16 passos, nota MIDI ou 0), melodia (16 passos), passos por segundo, timbre da
// melodia, timbre do baixo, eco, bateria]
const SONGS = [
  // Jardim de Vagalumes: pentatônica leve, sininhos
  [[48, 0, 0, 55, 0, 0, 52, 0, 45, 0, 0, 52, 0, 0, 50, 0], [76, 0, 79, 81, 0, 84, 0, 81, 79, 0, 76, 0, 74, 0, 72, 0], 6, 'triangle', 'sine', false, false],
  // Gruta de Cristal: notas de cristal com eco
  [[40, 0, 0, 0, 43, 0, 0, 0, 38, 0, 0, 0, 35, 0, 0, 0], [88, 0, 0, 83, 0, 0, 86, 0, 0, 79, 0, 0, 83, 0, 81, 0], 5, 'sine', 'triangle', true, false],
  // Céu de Tempestade: menor e tocada, baixo serrilhado e bumbo
  [[33, 33, 0, 33, 36, 0, 33, 0, 31, 31, 0, 31, 38, 0, 36, 0], [69, 72, 76, 72, 69, 72, 77, 76, 67, 71, 74, 71, 69, 0, 64, 0], 8, 'square', 'sawtooth', false, true],
];

export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.last = {}; this.song = 0; this.playing = false; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.9 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.09 : 0;
      this.musicBus.connect(this.master);
      this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 50);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }
  setMusic(v) {
    this.musicOn = v;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(v ? 0.09 : 0, this.ctx.currentTime, 0.1);
  }
  setSong(i, playing) { this.song = i; this.playing = playing; }

  // sequenciador simples com antecedência (não depende do quadro da tela)
  schedule() {
    const c = this.ctx;
    if (!c) return;
    const [bass, arp, rate, arpType, bassType, echo, drums] = SONGS[this.song];
    const dt = 1 / rate;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.02;
    while (this.nextT < c.currentTime + 0.2) {
      const k = this.step % 16, t = this.nextT - c.currentTime;
      const mute = !this.playing;
      if (!mute && bass[k]) this.tone(NOTE(bass[k]), dt * 0.9, { type: bassType, vol: 0.8, at: t, bus: this.musicBus, attack: 0.01 });
      if (!mute && arp[k]) {
        this.tone(NOTE(arp[k]), dt * (echo ? 1.6 : 0.5), { type: arpType, vol: echo ? 0.3 : 0.2, at: t, bus: this.musicBus });
        if (echo) this.tone(NOTE(arp[k]), dt * 1.2, { type: arpType, vol: 0.1, at: t + dt * 1.5, bus: this.musicBus });
      }
      if (!mute && k % 4 === 0) this.noise(0.05, { vol: drums ? 0.45 : 0.25, freq: drums ? 4000 : 7000, q: 1, type: 'highpass', at: t, bus: this.musicBus });
      if (!mute && drums && k % 8 === 4) this.noise(0.12, { vol: 0.5, freq: 900, q: 0.8, at: t, bus: this.musicBus });
      if (!mute && drums && k % 8 === 0) this.tone(60, 0.15, { type: 'sine', vol: 0.9, slide: 0.5, at: t, bus: this.musicBus });
      this.step++;
      this.nextT += dt;
    }
  }

  setListener(p, f, u) {
    const L = this.ctx?.listener;
    if (!L) return;
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t);
      L.forwardX.setValueAtTime(f.x, t); L.forwardY.setValueAtTime(f.y, t); L.forwardZ.setValueAtTime(f.z, t);
      L.upX.setValueAtTime(u.x, t); L.upY.setValueAtTime(u.y, t); L.upZ.setValueAtTime(u.z, t);
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  out(pos, ref = 2, bus = null) {
    const c = this.ctx;
    if (bus) return bus;
    if (!pos) return this.master;
    const p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 50; p.rolloffFactor = 0.8;
    if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; }
    else p.setPosition(pos[0], pos[1], pos[2]);
    p.connect(this.master);
    return p;
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.005, pos = null, ref, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(pos, ref, bus));
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0, type = 'bandpass', pos = null, ref, slide = 0, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    if (!this.nbuf) {
      this.nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.nbuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(pos, ref, bus));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  gate(key, gap) {
    const t = this.ctx?.currentTime ?? 0;
    if (t - (this.last[key] || -9) < gap) return false;
    this.last[key] = t;
    return true;
  }

  // ---------- jogo ----------
  shot(pos) {
    if (!this.ctx) return;
    this.tone(260, 0.12, { type: 'triangle', vol: 0.14, slide: 3.2, pos, ref: 0.5 });
    this.noise(0.06, { vol: 0.12, freq: 3200, q: 2, pos, ref: 0.5 });
  }
  miss(pos) { if (this.gate('miss', 0.08)) this.tone(1400, 0.08, { type: 'sine', vol: 0.03, slide: 0.6, pos, ref: 3 }); }
  // passinho da cabeça da lacraia (o som que diz onde ela está)
  tick(pos, k) {
    if (!this.ctx) return;
    this.noise(0.035, { vol: 0.32, freq: 2600 + (k % 2) * 900, q: 4, pos, ref: 2.5 });
    this.tone(k % 2 ? 190 : 150, 0.04, { type: 'square', vol: 0.05, pos, ref: 2.5 });
  }
  segHit(pos, head) {
    if (!this.ctx) return;
    this.tone(head ? 880 : 620, 0.14, { type: 'square', vol: 0.16, slide: 0.5, pos, ref: 3 });
    this.noise(0.14, { vol: 0.35, freq: 1400, q: 0.9, pos, ref: 3 });
    if (head) this.tone(1320, 0.18, { type: 'triangle', vol: 0.1, at: 0.05, pos, ref: 3 });
  }
  mushHit(pos) { if (this.gate('mush', 0.04)) this.noise(0.08, { vol: 0.28, freq: 500, q: 1, type: 'lowpass', pos, ref: 3 }); }
  mushBreak(pos, poison) {
    this.noise(0.25, { vol: 0.35, freq: poison ? 1800 : 900, q: 0.8, pos, ref: 3 });
    this.tone(poison ? 300 : 520, 0.2, { type: 'sine', vol: 0.1, slide: 1.8, pos, ref: 3 });
  }
  crack(pos) { this.tone(200, 0.1, { type: 'square', vol: 0.15, slide: 0.7, pos, ref: 3 }); this.noise(0.1, { vol: 0.25, freq: 700, q: 1, pos, ref: 3 }); }
  ping(pos) { if (this.gate('ping', 0.06)) { this.tone(1900, 0.22, { type: 'sine', vol: 0.12, pos, ref: 3 }); this.tone(2850, 0.15, { type: 'sine', vol: 0.05, pos, ref: 3 }); } }
  split(pos) { if (this.gate('split', 0.1)) this.tone(440, 0.15, { type: 'triangle', vol: 0.08, slide: 1.5, pos, ref: 3 }); }
  spiderIn(pos) { [0, 0.12, 0.24].forEach((at, i) => this.tone(700 - i * 120, 0.08, { type: 'square', vol: 0.12, at, pos, ref: 3 })); }
  hop(pos) { if (this.gate('hop', 0.2)) { this.tone(160, 0.12, { type: 'triangle', vol: 0.2, slide: 2.2, pos, ref: 3 }); this.noise(0.05, { vol: 0.15, freq: 3000, q: 3, pos, ref: 3 }); } }
  spiderHit(pos) { [84, 88, 91].forEach((n, i) => this.tone(NOTE(n), 0.12, { type: 'square', vol: 0.12, at: i * 0.06, pos, ref: 3 })); this.noise(0.2, { vol: 0.3, freq: 1200, q: 0.8, pos, ref: 3 }); }
  bite() {
    this.noise(0.5, { vol: 0.7, freq: 500, q: 0.6, type: 'lowpass' });
    [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'square', vol: 0.12, at: 0.1 + i * 0.14, slide: 0.95 }));
  }
  fleaIn(pos) { this.tone(2400, 0.9, { type: 'sine', vol: 0.06, slide: 0.35, pos, ref: 3 }); }
  drop(pos) { if (this.gate('drop', 0.1)) this.tone(300, 0.08, { type: 'triangle', vol: 0.08, slide: 0.6, pos, ref: 3 }); }
  scorpIn(pos) { for (let k = 0; k < 6; k++) this.noise(0.04, { vol: 0.25, freq: 5000, q: 5, at: k * 0.06, pos, ref: 3 }); }
  poison(pos) { if (this.gate('poison', 0.15)) this.tone(240, 0.3, { type: 'sawtooth', vol: 0.06, slide: 0.7, pos, ref: 3 }); }
  eat(pos) { if (this.gate('eat', 0.1)) this.noise(0.1, { vol: 0.25, freq: 800, q: 2, pos, ref: 3 }); }
  bigHit(pos) { this.tone(160, 0.3, { type: 'sawtooth', vol: 0.25, slide: 0.6, pos, ref: 4 }); this.noise(0.3, { vol: 0.4, freq: 600, q: 0.8, pos, ref: 4 }); }
  crownHit(pos) { this.tone(1100, 0.25, { type: 'triangle', vol: 0.18, slide: 0.8, pos, ref: 4 }); this.tone(1650, 0.2, { type: 'sine', vol: 0.08, pos, ref: 4 }); }
  bossDown(pos) {
    for (let k = 0; k < 4; k++) this.noise(0.6, { vol: 0.5, freq: 700, q: 0.7, type: 'lowpass', at: k * 0.2, pos, ref: 4 });
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.3, { type: 'square', vol: 0.12, at: 0.9 + i * 0.09 }));
  }
  open(pos) { this.tone(500, 0.4, { type: 'sine', vol: 0.12, slide: 2, pos, ref: 4 }); }
  close(pos) { this.tone(900, 0.3, { type: 'sine', vol: 0.08, slide: 0.5, pos, ref: 4 }); }
  baby(pos) { [0, 0.08, 0.16].forEach((at) => this.tone(1200, 0.05, { type: 'square', vol: 0.06, at, pos, ref: 3 })); }
  web(pos) { this.noise(0.4, { vol: 0.15, freq: 6000, q: 6, slide: 0.5, pos, ref: 3 }); }
  bolt(pos) {
    this.noise(0.12, { vol: 0.6, freq: 5000, q: 0.6, pos, ref: 5 });
    this.noise(1.4, { vol: 0.6, freq: 260, q: 0.5, type: 'lowpass', at: 0.08, pos, ref: 5 });
  }
  flee(pos) { this.tone(200, 0.8, { type: 'sawtooth', vol: 0.2, slide: 3, pos, ref: 4 }); this.noise(0.8, { vol: 0.3, freq: 1500, q: 0.5, slide: 3, pos, ref: 4 }); }
  roar(pos) { this.tone(90, 0.9, { type: 'sawtooth', vol: 0.3, slide: 0.7, pos, ref: 5 }); this.noise(0.9, { vol: 0.35, freq: 400, q: 0.6, type: 'lowpass', pos, ref: 5 }); }
  grow(pos) { if (this.gate('grow', 0.5)) this.tone(330, 0.25, { type: 'triangle', vol: 0.08, slide: 1.4, pos, ref: 3 }); }
  wave() { [72, 79].forEach((n, i) => this.tone(NOTE(n), 0.16, { type: 'triangle', vol: 0.1, at: i * 0.1 })); }
  coin() { [83, 88].forEach((n, i) => this.tone(NOTE(n), i ? 0.4 : 0.08, { type: 'square', vol: 0.12, at: i * 0.08 })); }
  won() { [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'square', vol: 0.12, at: i * 0.12 })); }
  lost() { [67, 66, 65, 64, 52].forEach((n, i) => this.tone(NOTE(n), i === 4 ? 0.8 : 0.25, { type: 'square', vol: 0.12, at: i * 0.22 })); }
  click() { this.tone(880, 0.05, { vol: 0.07, type: 'square' }); }
  star(n) { this.tone(NOTE(84 + n * 4), 0.3, { vol: 0.12, type: 'triangle' }); }
}
