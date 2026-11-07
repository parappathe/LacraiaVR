// Robô jogador com limites humanos: reage 0,3 s depois que uma coisa aparece, vira o corpo no
// máximo 150°/s, cada mão só aponta até 75° para o lado de onde o corpo está virado e gira no
// máximo 260°/s, erra a mira em até 1,4° e só atira quando a mão está apontada. Prevê para onde o
// alvo vai (o tiro leva uns 0,2 s até a cúpula) e escolhe o que é mais perigoso primeiro.
// Usado pelos testes (calibra as estrelas) e pelo dev.autoplay. Sem navegador.
import { add, sub, mul, norm, dot, cross, len, angle, rotateToward, any_perp, azElOf, DEG, Rng } from './vec.js';
import { DOME, SHOT, SPIDER, QUEEN, BITE_ROW, wrapDeg, domePos, elOf } from './sim.js';

export const HUMAN = {
  reaction: 0.3,     // s
  bodyTurn: 150,     // °/s
  aimSpeed: 260,     // °/s
  reach: 75,         // ° para cada lado de onde o corpo está virado
  aimErr: 1.6,       // °
  fireTol: 1.1,      // °
  leadErr: 0.3,      // erro de até 30% em quanto adiantar a mira de um alvo que anda
  settle: 0.45,      // s para firmar a mira depois de trocar de alvo
  head: [0, 1.6, 0],
};

export function makeRobot(opts = {}) { return new Robot(opts); }

class Robot {
  constructor(opts) {
    this.h = { ...HUMAN, ...opts };
    this.rng = new Rng(opts.seed ?? 11);
    this.reset();
  }
  reset() {
    this.face = 0;
    this.hands = [0, 1].map(() => ({ d: [0, 0, -1], target: null, jit: [0, 0, 0], since: 0, lead: 1 }));
    this.seen = new Map();
    this.claims = [];     // { key, until }
    this.lastT = -1;
    this.focus = null; this.focusSince = 0;
  }

  handPos(i) {
    const a = this.face * DEG, x = i ? 0.22 : -0.22, z = -0.3;
    return [this.h.head[0] + Math.cos(a) * x - Math.sin(a) * z, this.h.head[1] - 0.35, this.h.head[2] + Math.sin(a) * x + Math.cos(a) * z];
  }

  // Lista do que dá para atirar: chave, prioridade (menor = mais urgente), vida e posição futura.
  targets(g) {
    const out = [];
    for (const c of g.chains) c.segs.forEach((s, i) => {
      if (s.hidden || c.away > 0) return;
      if (c.queen && i === 0 && c.segs.length > QUEEN.expose) return;   // coroa ainda protegida
      if (c.dragon && i !== 0 && i !== c.segs.length - 1) return;
      const rowsLeft = BITE_ROW - s.row;
      let prio = rowsLeft * 0.6 + (i === 0 ? 0 : 0.4) + i * 0.02;
      if (i === 0 && s.dive) prio -= 6;
      if (c.queen) prio = i === 0 ? 0.5 : 2 + i * 0.05;
      if (c.dragon) prio = i === 0 ? 0.5 : 9;
      out.push({ key: s.id, prio, hp: s.hp, pos: (dt) => g.predictSeg(c, i, dt) });
    });
    if (g.spider) {
      const sp = g.spider, prog = sp.t / SPIDER.dur;
      out.push({ key: sp.id, prio: 1 + (1 - prog) * 4, hp: 1, pos: (dt) => g.spiderPos(sp, sp.t + dt) });
    }
    if (g.scorp) { const s = g.scorp; out.push({ key: s.id, prio: 3, hp: 1, pos: (dt) => g.scorpPos(s, dt) }); }
    if (g.flea) { const f = g.flea; out.push({ key: f.id, prio: 6, hp: f.hp, pos: (dt) => g.fleaPos(f, dt) }); }
    if (g.weaver && g.weaver.hp > 0) {
      const w = g.weaver, openIn = g.weaverOpenIn(w);
      if (openIn < 0.25) out.push({ key: w.id, prio: 0.5, hp: w.hp, pos: (dt) => g.weaverPos(w, dt) });
    }
    for (const m of g.mush.values()) if (m.poison) {
      const p = g.cellPos(m.col, m.row);
      out.push({ key: m.id, prio: 7 + (BITE_ROW - m.row) * 0.05, hp: m.hp, pos: () => p });
    }
    return out;
  }

  step(g) {
    const H = this.h, t = g.t;
    const dt = this.lastT < 0 ? 1 / 120 : Math.max(0, t - this.lastT);
    this.lastT = t;
    this.claims = this.claims.filter(c => c.until > t);
    const list = this.targets(g);
    const alive = new Set();
    for (const o of list) { alive.add(o.key); if (!this.seen.has(o.key)) this.seen.set(o.key, t); }
    for (const k of this.seen.keys()) if (!alive.has(k)) this.seen.delete(k);
    const vis = list.filter(o => t - this.seen.get(o.key) >= H.reaction);
    const claimed = (k) => this.claims.filter(c => c.key === k).length;

    const hp0 = this.handPos(0);
    const azOfPos = (p) => azElOf(sub(p, H.head)).az;
    // uma coisa de cada vez (como gente): as duas mãos miram no mesmo alvo; trocar de alvo
    // custa o tempo de firmar a mira de novo. Fica no alvo atual se ele ainda for quase o melhor.
    const scoreOf = (o) => {
      const p = o.pos(0.2);
      const turn = Math.abs(wrapDeg(azOfPos(p) - this.face)) / 90;
      const aim = angle(this.hands[0].d, sub(p, hp0)) / (60 * DEG);
      return o.prio + turn * 1.2 + aim * 0.5;
    };
    let best = null, bs = Infinity, cur = null;
    for (const o of vis) {
      if (claimed(o.key) >= o.hp) continue;
      const s = scoreOf(o);
      if (o.key === this.focus) cur = { o, s };
      if (s < bs) { bs = s; best = o; }
    }
    if (cur && cur.s <= bs + 1.0) best = cur.o;
    if (best && best.key !== this.focus) { this.focus = best.key; this.focusSince = t; }
    if (!best) this.focus = null;
    const goals = [best, best];
    // o corpo vira para o alvo da primeira mão
    const lead = best;
    if (lead) {
      const want = azOfPos(lead.pos(0.2));
      const d = wrapDeg(want - this.face);
      const mx = H.bodyTurn * dt;
      this.face = wrapDeg(this.face + Math.max(-mx, Math.min(mx, d)));
    }
    const hands = [0, 1].map((i) => {
      const hand = this.hands[i], p = this.handPos(i), o = goals[i];
      let want = [Math.sin(this.face * DEG), 0.25, -Math.cos(this.face * DEG)];
      let fire = false;
      if (o) {
        if (hand.target !== o.key) { hand.target = o.key; hand.jit = this.jitter(); hand.lead = this.leadK(); }
        let P = o.pos(0.2);
        for (let k = 0; k < 3; k++) { const tf = Math.max(0, len(sub(P, p)) - 0.08) / SHOT.speed; P = o.pos((tf + 0.01) * hand.lead); }
        want = norm(add(norm(sub(P, p)), hand.jit));
        const rel = wrapDeg(azElOf(want).az - this.face);
        const inReach = Math.abs(rel) <= H.reach;
        if (!inReach) {
          const az = this.face + Math.sign(rel) * H.reach, el = azElOf(want).el;
          want = norm([Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG)]);
        }
        hand.d = rotateToward(hand.d, want, H.aimSpeed * DEG * dt);
        if (inReach && t - this.focusSince >= H.settle && angle(hand.d, want) < H.fireTol * DEG && g.hands[i].cool <= 0) {
          fire = true;
          const tf = len(sub(P, p)) / SHOT.speed;
          this.claims.push({ key: o.key, until: t + tf + 0.05 });
          hand.jit = this.jitter(); hand.lead = this.leadK();
        }
      } else {
        hand.target = null;
        hand.d = rotateToward(hand.d, norm(want), H.aimSpeed * DEG * dt);
      }
      return { on: true, p, d: hand.d.slice(), fire };
    });
    return { hands };
  }

  leadK() { return 1 + (this.rng.next() * 2 - 1) * this.h.leadErr; }
  jitter() {
    const a = this.rng.next() * Math.PI * 2, r = Math.sqrt(this.rng.next()) * this.h.aimErr * DEG;
    const u = [Math.cos(a) * r, Math.sin(a) * r, (this.rng.next() - 0.5) * r];
    return u;
  }
}

export { DOME, domePos, elOf, cross, dot, any_perp };
