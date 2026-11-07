// Regras da Lacraia do Céu: cúpula em faixas, lacraias de gomos, cogumelos, estilingues de luz,
// aranha, pulga, escorpião e os três chefes. Sem navegador e sem Three.js (os testes rodam no Node).
//
// Coordenadas em metros: chão em y = 0, o jogador em x = 0, z = 0 olhando para -z. Tudo o que
// anda fica na superfície de uma cúpula de raio DOME.R com centro em DOME.c (perto da cabeça).
// A cúpula é uma grade: colunas de 6° de azimute (az 0 = frente, 90 = direita) e fileiras de 4° de
// elevação, da fileira 0 (46° para cima) até a fileira da mordida (BITE_ROW, 10° para baixo).
import { dirFrom, add, sub, mul, len, norm, dist, Rng } from './vec.js';
import { LEVELS, WORLDS, starsFor } from './levels.js';

export const DT = 1 / 120;
export const DOME = { c: [0, 1.4, 0], R: 4.5, rows: 15, el0: 46, elStep: 4, colDeg: 6 };
export const BITE_ROW = DOME.rows - 1;          // lacraia que chega aqui morde
export const SHOT = { speed: 24, cool: 0.3, life: 1.0 };
export const LIVES = 3;
export const LIFE_PENALTY = 20;
export const MUSH_HP = 3;
export const RESPITE = 2.2;                     // depois de uma mordida, até as lacraias voltarem
export const HIT_R = { seg: 0.25, head: 0.28, mush: 0.2, spider: 0.4, flea: 0.26, scorp: 0.34, weaver: 0.62 };
export const SCORE = {
  body: 10, head: 100, mush: 5, flea: 200, scorp: 1000, spider: [300, 600, 900], crack: 5, baby: 20,
  crown: 200, queen: 2500, weaverHit: 150, weaver: 3000, dragonHit: 150, dragonTail: 50, dragon: 4000,
};
export const QUEEN = { len: 14, maxLen: 16, hp: 3, crown: 8, expose: 4, speed: 4.6, growEvery: 3 };
export const WEAVER = { row: 2.2, speed: 10, hp: 30, closed: 4.0, open: 2.0, babyEvery: 7, babyLen: 5, babySpeed: 5.5, webEvery: 6, margin: 18 };
export const DRAGON = { len: 22, hp: 24, fleeEvery: 4, away: 1.6, tailHp: 2, speed: 5.2, boltEvery: 5, bolts: 2, speedUp: 0.3 };
export const SPIDER = { dur: 9, span: 120, hop: 0.75, amp: 12, low: BITE_ROW - 0.8, eatRows: [9, 13] };
export const FLEA = { speed: 3.2, fast: 7, hp: 2, drop: 0.3 };
export const SCORP = { speed: 13, rows: [2, 8] };

export const elOf = (row) => DOME.el0 - row * DOME.elStep;
export const rowOfEl = (el) => (DOME.el0 - el) / DOME.elStep;
export const wrapDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
export function domePos(az, el, r = DOME.R) {
  const d = dirFrom(az, el);
  return [DOME.c[0] + d[0] * r, DOME.c[1] + d[1] * r, DOME.c[2] + d[2] * r];
}
const mod = (a, n) => ((a % n) + n) % n;

export class Game {
  constructor(level, opts = {}) {
    this.level = level;
    this.L = LEVELS[level];
    this.W = WORLDS[this.L.world];
    this.rng = new Rng(opts.seed ?? 1);
    this.cols = Math.round(this.W.arc / DOME.colDeg);
    this.arc = this.cols * DOME.colDeg;
    this.wrap = this.arc >= 360;
    this.lives = opts.lives ?? LIVES;
    this.startLives = this.lives;
    this.t = 0;
    this.score = 0;
    this.events = [];
    this.phase = 'play';     // 'play' | 'won' | 'lost'
    this.result = null;
    this.nextId = 1;
    this.mush = new Map();   // casa -> { col, row, hp, poison, web }
    this.chains = [];
    this.shots = [];
    this.spider = null; this.flea = null; this.scorp = null; this.weaver = null;
    this.hands = [{ cool: 0 }, { cool: 0 }];
    this.boss = this.L.boss || null;
    this.waves = this.boss === 'queen' ? [{ queen: true }] : this.boss === 'dragon' ? [{ dragon: true }] : this.L.waves;
    this.wave = 0;
    this.waveT = opts.startDelay ?? 1.5;
    this.respite = 0;
    this.pending = null;
    this.timers = {
      spider: this.L.spider ? this.L.spider[0] : Infinity,
      flea: this.L.flea ? this.L.flea[0] : Infinity,
      scorp: this.L.scorp ? this.L.scorp[0] : Infinity,
    };
    this.growT = QUEEN.growEvery;
    this.boltT = DRAGON.boltEvery;
    this.kills = 0;
    this.shotsFired = 0; this.shotsHit = 0;
    this.placeMushrooms(opts.mush ?? this.L.mush);
    if (this.boss === 'weaver') {
      this.weaver = { id: this.nextId++, az: 0, dir: this.rng.sign(), hp: WEAVER.hp, maxHp: WEAVER.hp, cyc: 0, open: false, babyT: 4, webT: 3 };
    }
  }

  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  emit(e) { this.events.push(e); }

  // ---------- grade ----------
  key(col, row) { return row * 1000 + col; }
  azOf(col) { return -this.arc / 2 + (col + 0.5) * DOME.colDeg; }
  colOfAz(az) {
    const c = Math.floor((wrapDeg(az) + this.arc / 2) / DOME.colDeg);
    return this.wrap ? mod(c, this.cols) : c;
  }
  cellPos(col, row) { return domePos(this.azOf(col), elOf(row)); }
  mushAt(col, row) { return this.mush.get(this.key(col, row)); }
  addMush(col, row, extra = {}) {
    if (row < 0 || row >= BITE_ROW || col < 0 || col >= this.cols) return null;
    const k = this.key(col, row);
    if (this.mush.has(k)) return this.mush.get(k);
    const m = { id: this.nextId++, col, row, hp: MUSH_HP, maxHp: MUSH_HP, poison: false, web: false, ...extra };
    this.mush.set(k, m);
    return m;
  }
  placeMushrooms(n) {
    let tries = 0;
    while (this.mush.size < n && tries++ < n * 30) {
      const row = 1 + Math.floor(this.rng.next() * (BITE_ROW - 2));
      const col = Math.floor(this.rng.next() * this.cols);
      if (!this.wrap && (col === 0 || col === this.cols - 1) && this.rng.next() < 0.6) continue;
      this.addMush(col, row);
    }
  }

  // ---------- lacraias ----------
  // regra da cabeça (pura: usada também pelo robô para prever o caminho)
  headStep(h) {
    const out = { col: h.col, row: h.row, dir: h.dir, dive: h.dive, seam: h.seam };
    if (h.dive) { out.row++; return out; }
    let nc = h.col + h.dir;
    if (this.wrap) {
      if (nc < 0 || nc >= this.cols) {
        if (!h.seam) { out.row++; out.seam = true; return out; }   // volta completa: desce uma fileira
        nc = mod(nc, this.cols);
      }
    } else if (nc < 0 || nc >= this.cols) { out.row++; out.dir = -h.dir; return out; }
    out.seam = false;
    const m = this.mushAt(nc, h.row);
    if (m) {
      out.row++;
      if (m.poison) out.dive = true;           // cogumelo envenenado: mergulha direto para baixo
      else out.dir = -h.dir;
      return out;
    }
    out.col = nc;
    return out;
  }

  makeChain(data, props, col, row, dir) {
    const segs = data.map((d, i) => ({
      id: this.nextId++, col, row, pc: col, pr: row - (i === 0 ? 1 : 0), dir, dive: false, seam: false,
      hp: d.hp, maxHp: d.maxHp ?? d.hp, hidden: i > 0,
    }));
    const c = { id: this.nextId++, segs, speed: props.speed, acc: 0, queen: !!props.queen, dragon: !!props.dragon, baby: !!props.baby, armored: !!props.armored, hits: props.hits || 0 };
    this.clearEntry(col, row);
    this.chains.push(c);
    return c;
  }
  clearEntry(col, row) {   // abre espaço na entrada
    for (let dc = -1; dc <= 1; dc++) { const cc = this.wrap ? mod(col + dc, this.cols) : col + dc; this.mush.delete(this.key(cc, row)); }
  }
  // a lacraia inteira some e volta a sair da toca em outro lugar lá em cima (fuga do Dragão)
  reenter(c) {
    const e = this.entry();
    c.segs.forEach((g, i) => { g.id = this.nextId++; g.col = g.pc = e.col; g.row = 0; g.pr = i === 0 ? -1 : 0; g.dir = e.dir; g.dive = false; g.seam = false; g.hidden = i > 0; });
    c.acc = 0;
    this.clearEntry(e.col, 0);
  }
  entry() {
    if (this.wrap) return { col: Math.floor(this.rng.next() * this.cols), dir: this.rng.sign() };
    const col = 3 + Math.floor(this.rng.next() * (this.cols - 6));
    return { col, dir: this.rng.sign() };
  }
  spawnWave(w) {
    if (w.queen) {
      const data = [{ hp: QUEEN.crown }, ...Array.from({ length: QUEEN.len - 1 }, () => ({ hp: QUEEN.hp }))];
      const e = this.entry();
      this.makeChain(data, { speed: QUEEN.speed, queen: true, armored: true }, e.col, 0, e.dir);
    } else if (w.dragon) {
      const data = [{ hp: DRAGON.hp }, ...Array.from({ length: DRAGON.len - 2 }, () => ({ hp: Infinity })), { hp: DRAGON.tailHp }];
      const e = this.entry();
      this.makeChain(data, { speed: DRAGON.speed, dragon: true }, e.col, 0, e.dir);
    } else {
      const e = this.entry();
      this.makeChain(Array.from({ length: w.len }, () => ({ hp: 1 })), { speed: w.speed }, e.col, 0, e.dir);
      for (let k = 0; k < (w.heads || 0); k++) {
        const e2 = this.entry();
        this.makeChain([{ hp: 1 }], { speed: w.speed * 1.1 }, e2.col, 0, e2.dir);
      }
    }
    this.emit({ type: 'wave', n: this.wave });
  }

  advance(c) {
    const s = c.segs;
    const old = s.map(g => ({ col: g.col, row: g.row, dir: g.dir }));
    const h = s[0];
    const n = this.headStep(h);
    h.pc = h.col; h.pr = h.row;
    h.col = n.col; h.row = n.row; h.dir = n.dir; h.dive = n.dive; h.seam = n.seam;
    for (let i = 1; i < s.length; i++) {
      const g = s[i];
      g.pc = g.col; g.pr = g.row;
      g.col = old[i - 1].col; g.row = old[i - 1].row; g.dir = old[i - 1].dir;
    }
    const firstHidden = s.findIndex(g => g.hidden);
    if (firstHidden > 0) s[firstHidden].hidden = false;
    this.emit({ type: 'tick', id: c.id, p: this.segPos(c, h) });
    if (h.row >= BITE_ROW) { this.bite(c); return false; }
    return true;
  }

  // posição na tela de um gomo (interpola entre a casa anterior e a atual)
  segAzEl(c, g, f = c.acc) {
    const a0 = this.azOf(g.pc), a1 = this.azOf(g.col);
    const az = a0 + wrapDeg(a1 - a0) * f;
    const el = elOf(g.pr + (g.row - g.pr) * f);
    return { az, el };
  }
  segPos(c, g, f) { const { az, el } = this.segAzEl(c, g, f); return domePos(az, el); }

  // Caminho futuro de um gomo: posição daqui a dt segundos se nada mudar (o robô usa).
  predictSeg(c, i, dt) {
    const p = c.acc + c.speed * dt;
    const n = Math.floor(p), f = p - n;
    const cellAt = (k) => {   // casa do gomo i depois de k passos (k = -1: casa anterior)
      if (k < 0) return { col: c.segs[i].pc, row: c.segs[i].pr };
      if (k <= i) { const g = c.segs[i - k]; return { col: g.col, row: g.row }; }
      let h = { ...c.segs[0] };
      for (let j = 0; j < k - i; j++) h = this.headStep(h);
      return { col: h.col, row: h.row };
    };
    const A = cellAt(n - 1), B = cellAt(n);
    const a0 = this.azOf(A.col), a1 = this.azOf(B.col);
    return domePos(a0 + wrapDeg(a1 - a0) * f, elOf(A.row + (B.row - A.row) * f));
  }

  split(c, i) {
    const front = c.segs.slice(0, i), back = c.segs.slice(i + 1);
    const idx = this.chains.indexOf(c);
    if (idx >= 0) this.chains.splice(idx, 1);
    if (front.length) { c.segs = front; this.chains.push(c); }
    if (back.length) {
      back[0].hidden = false; back[0].dive = false; back[0].seam = false;
      const nc = { id: this.nextId++, segs: back, speed: c.speed, acc: c.acc, queen: false, dragon: false, baby: c.baby, armored: c.armored, hits: 0 };
      this.chains.push(nc);
      this.emit({ type: 'split', id: nc.id, p: this.segPos(nc, back[0]) });
    }
  }

  killChain(c, pts) {
    for (const g of c.segs) if (!g.hidden) { this.score += pts; this.emit({ type: 'pop', p: this.segPos(c, g) }); }
    const i = this.chains.indexOf(c);
    if (i >= 0) this.chains.splice(i, 1);
  }

  damageSeg(c, i, p) {
    const g = c.segs[i];
    if (c.dragon) {
      if (i === 0) {
        g.hp--; c.hits++;
        this.score += SCORE.dragonHit;
        if (g.hp <= 0) { this.bossDown(p, 'dragon', SCORE.dragon); return; }
        this.emit({ type: 'boss-hit', kind: 'dragon', p, hp: g.hp });
        if (c.hits % DRAGON.fleeEvery === 0) {   // assustado: some nas nuvens e volta em outro lugar
          c.speed += DRAGON.speedUp;
          c.away = DRAGON.away;
          this.emit({ type: 'flee', p });
        }
      } else if (i === c.segs.length - 1 && c.segs.length > 1) {
        g.hp--;
        if (g.hp > 0) { this.emit({ type: 'crack', p }); return; }
        c.segs.pop();
        this.addMush(g.col, g.row);
        if (c.segs.length > 1) { const t = c.segs[c.segs.length - 1]; t.hp = DRAGON.tailHp; t.maxHp = DRAGON.tailHp; }
        this.score += SCORE.dragonTail;
        this.emit({ type: 'tail', p });
      } else this.emit({ type: 'ping', p });
      return;
    }
    if (c.queen) {
      // Rainha: a coroa só racha com o corpo curto; gomo quebrado some e o corpo se fecha
      if (i === 0 && c.segs.length > QUEEN.expose) { this.emit({ type: 'ping', p, boss: true }); return; }
      if (g.hp > 1) {
        g.hp--;
        this.score += i === 0 ? SCORE.crown : SCORE.crack;
        this.emit({ type: i === 0 ? 'crown-hit' : 'crack', p, hp: g.hp });
        return;
      }
      if (i === 0) { this.kills++; this.bossDown(p, 'queen', SCORE.queen); return; }
      this.kills++;
      this.score += SCORE.body * 3;
      c.segs.splice(i, 1);
      this.emit({ type: 'seg-hit', p, head: false, queen: true, left: c.segs.length });
      return;
    }
    if (g.hp > 1) {
      g.hp--;
      this.score += SCORE.crack;
      this.emit({ type: 'crack', p, hp: g.hp });
      return;
    }
    const head = i === 0;
    this.kills++;
    this.score += c.baby ? SCORE.baby : head ? SCORE.head : SCORE.body;
    this.emit({ type: 'seg-hit', p, head });
    if (!g.hidden) this.addMush(g.col, g.row);
    this.split(c, i);
  }

  bossDown(p, kind, pts) {
    this.score += pts;
    for (const c of this.chains.slice()) this.killChain(c, SCORE.body);
    this.chains = [];
    this.spider = this.flea = this.scorp = null;
    if (this.weaver) this.weaver.hp = 0;
    this.bossDead = true;
    this.emit({ type: 'boss-down', kind, p });
  }

  bite(c) {
    const p = this.segPos(c, c.segs[0]);
    this.emit({ type: 'bite', p });
    // todas as lacraias voltam para cima com os gomos que tinham
    this.pending = this.chains.map(ch => ({ props: { speed: ch.speed, queen: ch.queen, dragon: ch.dragon, baby: ch.baby, armored: ch.armored, hits: ch.hits }, data: ch.segs.map(g => ({ hp: g.hp, maxHp: g.maxHp })) }));
    this.chains = [];
    this.spider = this.flea = this.scorp = null;
    for (const m of this.mush.values()) m.poison = false;
    this.respite = RESPITE;
    this.loseLife();
  }
  loseLife() {
    this.lives--;
    this.emit({ type: 'lost-life', lives: this.lives });
    if (this.lives <= 0) this.finish(false);
  }

  // ---------- inimigos ----------
  spawnSpider() {
    const span = Math.min(SPIDER.span, this.arc - 12);
    let az0, dir = this.rng.sign();
    if (this.wrap) az0 = this.rng.range(-180, 180);
    else az0 = dir > 0 ? -this.arc / 2 + 4 : this.arc / 2 - 4;
    const hops = Math.ceil(SPIDER.dur / SPIDER.hop) + 1;
    const amps = Array.from({ length: hops }, () => SPIDER.amp * (0.35 + 0.65 * this.rng.next()));
    this.spider = { id: this.nextId++, az0, dir, span, t: 0, amps };
    this.emit({ type: 'spider-in', p: this.spiderPos(this.spider, 0) });
  }
  spiderAzEl(s, t) {
    const az = s.az0 + s.dir * s.span * Math.min(1, t / SPIDER.dur);
    const k = Math.floor(t / SPIDER.hop), f = t / SPIDER.hop - k;
    const el = elOf(SPIDER.low) + (s.amps[Math.min(k, s.amps.length - 1)] || 0) * Math.sin(Math.PI * f);
    return { az, el };
  }
  spiderPos(s, t = s.t) { const { az, el } = this.spiderAzEl(s, t); return domePos(az, el); }

  spawnFlea() {
    const col = Math.floor(this.rng.next() * this.cols);
    const drops = [];
    for (let r = 1; r < BITE_ROW - 1; r++) if (this.rng.next() < FLEA.drop) drops.push(r);
    this.flea = { id: this.nextId++, col, row: -0.5, hp: FLEA.hp, speed: FLEA.speed, drops, last: -1 };
    this.emit({ type: 'flea-in', p: this.fleaPos(this.flea) });
  }
  fleaPos(f, dt = 0) { return domePos(this.azOf(f.col), elOf(f.row + f.speed * dt)); }

  spawnScorp() {
    const row = SCORP.rows[0] + Math.floor(this.rng.next() * (SCORP.rows[1] - SCORP.rows[0] + 1));
    const dir = this.rng.sign();
    let az, span;
    if (this.wrap) { az = this.rng.range(-180, 180); span = 200; } else { az = dir > 0 ? -this.arc / 2 - 3 : this.arc / 2 + 3; span = this.arc + 6; }
    this.scorp = { id: this.nextId++, row, az, dir, left: span };
    this.emit({ type: 'scorp-in', p: this.scorpPos(this.scorp) });
  }
  scorpPos(s, dt = 0) { return domePos(s.az + s.dir * SCORP.speed * dt, elOf(s.row)); }

  weaverPos(w = this.weaver, dt = 0) {
    const lim = this.arc / 2 - WEAVER.margin;
    let az = w.az + w.dir * WEAVER.speed * dt;
    if (az > lim) az = 2 * lim - az; else if (az < -lim) az = -2 * lim - az;
    return domePos(az, elOf(WEAVER.row));
  }
  weaverOpenIn(w = this.weaver) {   // segundos até abrir (0 se aberta)
    const per = WEAVER.closed + WEAVER.open, ph = w.cyc % per;
    return ph >= WEAVER.closed ? 0 : WEAVER.closed - ph;
  }

  // ---------- passo ----------
  // input: { hands: [{ on, p: [x,y,z], d: [dx,dy,dz] (unitário), fire: bool }, ...] }
  step(input) {
    this.events = [];
    if (this.over) { this.t += DT; return; }
    this.t += DT;
    this.updateHands(input?.hands || []);
    this.updateShots();
    if (this.over) return;

    if (this.respite > 0) {
      this.respite -= DT;
      if (this.respite <= 0 && this.pending) {
        for (const pc of this.pending) { const e = this.entry(); this.makeChain(pc.data, pc.props, e.col, 0, e.dir); }
        this.pending = null;
        this.emit({ type: 'return' });
      }
    } else {
      // ondas
      if (!this.chains.length && this.wave < this.waves.length) {
        this.waveT -= DT;
        if (this.waveT <= 0) { this.spawnWave(this.waves[this.wave]); this.wave++; this.waveT = 1.5; }
      }
      // lacraias
      for (const c of this.chains.slice()) {
        if (!this.chains.includes(c)) continue;
        if (c.away > 0) {
          c.away -= DT;
          if (c.away <= 0) { this.reenter(c); this.emit({ type: 'return', p: this.segPos(c, c.segs[0]), dragon: c.dragon }); }
          continue;
        }
        c.acc += c.speed * DT;
        while (c.acc >= 1) {
          c.acc -= 1;
          if (!this.advance(c)) break;
        }
        if (this.respite > 0 || this.over) break;
      }
      if (this.over) return;
      if (this.respite <= 0) this.updateEnemies();
    }
    this.checkEnd();
  }

  updateHands(list) {
    for (let i = 0; i < 2; i++) {
      const H = this.hands[i], inp = list[i];
      H.cool = Math.max(0, H.cool - DT);
      if (!inp?.on || !inp.fire || H.cool > 0) continue;
      const d = norm(inp.d);
      this.shots.push({ id: this.nextId++, hand: i, p: add(inp.p, mul(d, 0.08)), v: mul(d, SHOT.speed), t: 0 });
      H.cool = SHOT.cool;
      this.shotsFired++;
      this.emit({ type: 'shot', hand: i, p: inp.p.slice() });
    }
  }

  updateShots() {
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const s = this.shots[k];
      s.t += DT;
      s.p = add(s.p, mul(s.v, DT));
      const rel = sub(s.p, DOME.c);
      if (len(rel) >= DOME.R) {
        this.shots.splice(k, 1);
        this.impact(add(DOME.c, mul(norm(rel), DOME.R)), s);
        if (this.over) return;
      } else if (s.t > SHOT.life) this.shots.splice(k, 1);
    }
  }

  // o tiro chegou à cúpula: acerta a coisa mais perto do ponto (dentro do raio dela)
  impact(P, shot) {
    let best = null, bd = 1;
    const test = (pos, r, what) => { const d = dist(P, pos) / r; if (d < bd) { bd = d; best = what; } };
    for (const c of this.chains) if (!(c.away > 0)) c.segs.forEach((g, i) => { if (!g.hidden) test(this.segPos(c, g), i === 0 ? HIT_R.head : HIT_R.seg, { kind: 'seg', c, i }); });
    for (const m of this.mush.values()) test(this.cellPos(m.col, m.row), HIT_R.mush * (0.6 + 0.4 * m.hp / m.maxHp), { kind: 'mush', m });
    if (this.spider) test(this.spiderPos(this.spider), HIT_R.spider, { kind: 'spider' });
    if (this.flea) test(this.fleaPos(this.flea), HIT_R.flea, { kind: 'flea' });
    if (this.scorp) test(this.scorpPos(this.scorp), HIT_R.scorp, { kind: 'scorp' });
    if (this.weaver && this.weaver.hp > 0) test(this.weaverPos(), HIT_R.weaver, { kind: 'weaver' });
    if (!best) { this.emit({ type: 'miss', p: P, hand: shot.hand }); return; }
    this.shotsHit++;
    switch (best.kind) {
      case 'seg': this.damageSeg(best.c, best.i, P); break;
      case 'mush': {
        const m = best.m;
        m.hp--;
        if (m.hp <= 0) { this.mush.delete(this.key(m.col, m.row)); this.score += SCORE.mush; this.emit({ type: 'mush-break', p: P, poison: m.poison, web: m.web }); }
        else this.emit({ type: 'mush-hit', p: P, poison: m.poison });
        break;
      }
      case 'spider': {
        const { el } = this.spiderAzEl(this.spider, this.spider.t);
        const r = rowOfEl(el);
        const pts = r > BITE_ROW - 1.6 ? SCORE.spider[2] : r > BITE_ROW - 2.6 ? SCORE.spider[1] : SCORE.spider[0];
        this.score += pts;
        this.spider = null;
        this.emit({ type: 'spider-hit', p: P, pts });
        break;
      }
      case 'flea':
        this.flea.hp--;
        if (this.flea.hp <= 0) { this.score += SCORE.flea; this.flea = null; this.emit({ type: 'flea-hit', p: P, pts: SCORE.flea }); }
        else { this.flea.speed = FLEA.fast; this.emit({ type: 'crack', p: P }); }
        break;
      case 'scorp':
        this.score += SCORE.scorp; this.scorp = null;
        this.emit({ type: 'scorp-hit', p: P, pts: SCORE.scorp });
        break;
      case 'weaver': {
        const w = this.weaver;
        if (!w.open) { this.emit({ type: 'ping', p: P, boss: true }); break; }
        w.hp--;
        this.score += SCORE.weaverHit;
        if (w.hp <= 0) this.bossDown(P, 'weaver', SCORE.weaver);
        else this.emit({ type: 'boss-hit', kind: 'weaver', p: P, hp: w.hp });
        break;
      }
    }
  }

  updateEnemies() {
    const L = this.L;
    for (const k of ['spider', 'flea', 'scorp']) {
      if (!L[k] || this[k]) continue;
      this.timers[k] -= DT;
      if (this.timers[k] <= 0 && this.chains.length) {
        this.timers[k] = L[k][1] * (0.8 + 0.4 * this.rng.next());
        if (k === 'spider') this.spawnSpider(); else if (k === 'flea') this.spawnFlea(); else this.spawnScorp();
      }
    }
    // aranha: pula na faixa de baixo, come cogumelos; se terminar o caminho, morde
    const sp = this.spider;
    if (sp) {
      sp.t += DT;
      const { az, el } = this.spiderAzEl(sp, sp.t);
      const row = Math.round(rowOfEl(el)), col = this.colOfAz(az);
      if (row >= SPIDER.eatRows[0] && row <= SPIDER.eatRows[1]) {
        const m = this.mushAt(col, row);
        if (m) { this.mush.delete(this.key(col, row)); this.emit({ type: 'eat', p: this.cellPos(col, row) }); }
      }
      if (Math.floor(sp.t / SPIDER.hop) !== Math.floor((sp.t - DT) / SPIDER.hop)) this.emit({ type: 'hop', p: this.spiderPos(sp) });
      if (sp.t >= SPIDER.dur) {
        this.spider = null;
        this.emit({ type: 'spider-bite', p: domePos(az, el) });
        this.loseLife();
        if (this.over) return;
      }
    }
    // pulga: cai reta deixando cogumelos
    const f = this.flea;
    if (f) {
      f.row += f.speed * DT;
      const r = Math.floor(f.row);
      if (r !== f.last && r >= 0) {
        f.last = r;
        if (f.drops.includes(r) && !this.mushAt(f.col, r)) { this.addMush(f.col, r); this.emit({ type: 'drop', p: this.cellPos(f.col, r) }); }
      }
      if (f.row >= BITE_ROW) this.flea = null;
    }
    // escorpião: atravessa e envenena os cogumelos da fileira dele
    const s = this.scorp;
    if (s) {
      const step = SCORP.speed * DT;
      s.az += s.dir * step; s.left -= step;
      const m = this.mushAt(this.colOfAz(s.az), s.row);
      if (m && !m.poison && !m.web) { m.poison = true; this.emit({ type: 'poison', p: this.cellPos(m.col, m.row) }); }
      if (s.left <= 0) this.scorp = null;
    }
    // chefes
    if (this.boss === 'queen') {
      const q = this.chains.find(c => c.queen);
      if (q) {
        this.growT -= DT;
        if (this.growT <= 0) {
          this.growT = QUEEN.growEvery;
          if (q.segs.length < QUEEN.maxLen) {
            const t = q.segs[q.segs.length - 1];
            q.segs.push({ ...t, id: this.nextId++, hp: QUEEN.hp, maxHp: QUEEN.hp, hidden: t.hidden });
            this.emit({ type: 'grow', p: this.segPos(q, t) });
          }
        }
      }
    }
    const w = this.weaver;
    if (w && w.hp > 0) {
      const lim = this.arc / 2 - WEAVER.margin;
      w.az += w.dir * WEAVER.speed * DT;
      if (w.az > lim) { w.az = 2 * lim - w.az; w.dir = -1; } else if (w.az < -lim) { w.az = -2 * lim - w.az; w.dir = 1; }
      w.cyc += DT;
      const wasOpen = w.open;
      w.open = this.weaverOpenIn(w) === 0;
      if (w.open !== wasOpen) this.emit({ type: w.open ? 'weaver-open' : 'weaver-close', p: this.weaverPos() });
      w.babyT -= DT;
      if (w.babyT <= 0) {
        w.babyT = WEAVER.babyEvery;
        const col = this.colOfAz(w.az);
        this.makeChain(Array.from({ length: WEAVER.babyLen }, () => ({ hp: 1 })), { speed: WEAVER.babySpeed, baby: true }, col, Math.ceil(WEAVER.row) + 1, this.rng.sign());
        this.emit({ type: 'baby', p: this.weaverPos() });
      }
      w.webT -= DT;
      if (w.webT <= 0) {
        w.webT = WEAVER.webEvery;
        const col = this.colOfAz(w.az);
        for (let r = 5; r <= 7; r++) this.addMush(col, r, { web: true, hp: 1, maxHp: 1 });
        this.emit({ type: 'web', p: this.cellPos(col, 6) });
      }
    }
    if (this.boss === 'dragon' && this.chains.some(c => c.dragon)) {
      this.boltT -= DT;
      if (this.boltT <= 0) {
        this.boltT = DRAGON.boltEvery;
        const cells = [];
        for (let k = 0; k < DRAGON.bolts; k++) {
          const col = Math.floor(this.rng.next() * this.cols), row = 2 + Math.floor(this.rng.next() * 9);
          const m = this.mushAt(col, row) || this.addMush(col, row);
          if (m) { m.poison = true; m.web = false; cells.push(this.cellPos(col, row)); }
        }
        this.emit({ type: 'bolt', cells });
      }
    }
  }

  checkEnd() {
    if (this.over) return;
    if (this.boss === 'weaver') { if (this.weaver.hp <= 0) this.finish(true); return; }
    if (this.bossDead || (this.wave >= this.waves.length && !this.chains.length && !this.pending && this.respite <= 0)) this.finish(true);
  }

  get left() {   // gomos que faltam (ou vida do chefe)
    if (this.boss === 'weaver') return this.weaver.hp;
    if (this.boss === 'dragon') { const d = this.chains.find(c => c.dragon) || this.pending?.find(p => p.props.dragon); return d ? (d.segs ? d.segs[0].hp : d.data[0].hp) : 0; }
    if (this.boss === 'queen') { const q = this.chains.find(c => c.queen) || this.pending?.find(p => p.props.queen); return q ? (q.segs ? q.segs[0].hp : q.data[0].hp) : 0; }
    let n = 0;
    for (const c of this.chains) n += c.segs.length;
    for (const p of this.pending || []) n += p.data.length;
    for (let w = this.wave; w < this.waves.length; w++) n += this.waves[w].len + (this.waves[w].heads || 0);
    return n;
  }

  finish(won) {
    this.phase = won ? 'won' : 'lost';
    const livesLost = Math.max(0, this.startLives - this.lives);
    const eff = this.t + livesLost * LIFE_PENALTY;
    const stars = won ? starsFor(this.level, eff) : 0;
    const bonus = won ? Math.max(0, this.lives) * 500 + Math.max(0, Math.round((this.L.par[1] - this.t) * 10)) : 0;
    this.score += bonus;
    this.result = { won, time: this.t, livesLost, eff, stars, score: this.score, bonus, lives: Math.max(0, this.lives), kills: this.kills, accuracy: this.shotsFired ? this.shotsHit / this.shotsFired : 0 };
    this.emit({ type: won ? 'won' : 'lost' });
  }
}

export { LEVELS, WORLDS };
