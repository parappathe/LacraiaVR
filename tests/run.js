// Testes automáticos: node tests/run.js (ou npm test). Não tocam som nem usam navegador.
import { norm, sub, len, dist, dirFrom, azElOf } from '../js/vec.js';
import { Game, DT, DOME, BITE_ROW, SHOT, LIVES, MUSH_HP, RESPITE, SCORE, QUEEN, WEAVER, DRAGON, SPIDER, FLEA, elOf, domePos, wrapDeg } from '../js/sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD, starsFor } from '../js/levels.js';
import { makeRobot, HUMAN } from '../js/robot.js';

let fails = 0, count = 0;
function ok(cond, msg) {
  count++;
  if (!cond) { fails++; console.log('  FALHOU:', msg); }
}
const near = (a, b, e) => Math.abs(a - b) <= e;
const off = { hands: [{ on: false }, { on: false }] };
const run = (g, sec, inp = off) => { const evs = []; for (let i = 0; i < Math.round(sec / DT); i++) { g.step(typeof inp === 'function' ? inp(g) : inp); evs.push(...g.events); } return evs; };
// jogo vazio: sem cogumelos, sem ondas, sem inimigos (para montar cenas)
function empty(level = 0, opts = {}) {
  const g = new Game(level, { mush: 0, ...opts });
  g.waves = []; g.wave = 0; g.timers = { spider: Infinity, flea: Infinity, scorp: Infinity };
  g.checkEnd = () => {};
  return g;
}
const chain = (g, len, col, row, dir, props = { speed: 6 }) => {
  const c = g.makeChain(Array.from({ length: len }, () => ({ hp: 1 })), props, col, row, dir);
  return c;
};
// atira da cabeça do jogador direto num ponto da cúpula
const HEAD = [0, 1.6, 0];
function shootAt(g, P, hand = 1) {
  const inp = { hands: [{ on: false }, { on: false }] };
  inp.hands[hand] = { on: true, p: HEAD, d: norm(sub(P, HEAD)), fire: true };
  g.hands[hand].cool = 0;
  g.step(inp);
  const evs = [...g.events];
  for (let i = 0; i < 40 && g.shots.length; i++) { g.step(off); evs.push(...g.events); }
  return evs;
}
const settle = (c) => { c.segs.forEach(s => { s.hidden = false; }); };

console.log('Cúpula e grade');
{
  for (const [az, el] of [[0, 0], [90, 10], [-135, -10]]) {
    const r = azElOf(dirFrom(az, el));
    ok(near(r.az, az, 1e-6) && near(r.el, el, 1e-6), `azimute/elevação ida e volta (${az}, ${el})`);
  }
  ok(near(len(sub(domePos(30, 20), DOME.c)), DOME.R, 1e-9), 'pontos da cúpula ficam no raio');
  ok(elOf(0) === DOME.el0 && elOf(BITE_ROW) < 0, 'fileiras de cima para baixo, a da mordida abaixo do olho');
  const g1 = new Game(0), g2 = new Game(4), g3 = new Game(8);
  ok(g1.arc >= 150 && g1.arc <= 170 && !g1.wrap, `mundo 1 com arco de ~160° (${g1.arc})`);
  ok(g2.arc > g1.arc && !g2.wrap, `mundo 2 mais largo (${g2.arc})`);
  ok(g3.arc === 360 && g3.wrap, 'mundo 3 dá a volta toda');
  for (const g of [g1, g2, g3]) for (let c = 0; c < g.cols; c++) ok(g.colOfAz(g.azOf(c)) === c, `coluna ${c} ida e volta (arco ${g.arc})`);
  ok(wrapDeg(190) === -170 && wrapDeg(-190) === 170, 'ângulo dá a volta');
}

console.log('Fases');
{
  ok(LEVELS.length === 12 && WORLDS.length === 3, '12 fases em 3 mundos');
  LEVELS.forEach((L, i) => {
    ok(L.world === Math.floor(i / LEVELS_PER_WORLD), `fase ${i + 1} no mundo certo`);
    ok(!!L.boss === (i % 4 === 3), `fase ${i + 1}: chefe só na 4ª de cada mundo`);
    ok(L.par[0] < L.par[1], `fase ${i + 1}: limites de estrelas em ordem`);
    const g = new Game(i);
    ok(g.mush.size >= L.mush * 0.9, `fase ${i + 1}: cogumelos espalhados (${g.mush.size})`);
    ok([...g.mush.values()].every(m => m.row >= 1 && m.row < BITE_ROW && m.col >= 0 && m.col < g.cols), `fase ${i + 1}: cogumelos dentro da cúpula`);
    ok(L.boss || (L.waves.length >= 1 && L.waves.every(w => w.len >= 1 && w.speed > 0 && w.speed <= 8)), `fase ${i + 1}: ondas válidas`);
    for (const k of ['spider', 'flea', 'scorp']) if (L[k]) ok(L[k][0] > 0 && L[k][1] > 4, `fase ${i + 1}: tempo do inimigo ${k}`);
  });
  ok(starsFor(0, 1) === 3 && starsFor(0, LEVELS[0].par[0] + 1) === 2 && starsFor(0, 9999) === 1, 'estrelas pelo tempo');
}

console.log('Lacraia: movimento');
{
  // anda de lado
  const g = empty();
  const c = chain(g, 3, 10, 2, 1); settle(c);
  run(g, 1 / 6 + DT);
  ok(c.segs[0].col === 11 && c.segs[0].row === 2, 'a cabeça anda uma casa por passo');
  run(g, 2 / 6);
  ok(c.segs[1].col === c.segs[0].col - 1 && c.segs[2].col === c.segs[0].col - 2, 'os gomos seguem a cabeça');
  // cogumelo: desce e vira
  const g2 = empty();
  g2.addMush(13, 2);
  const c2 = chain(g2, 1, 11, 2, 1);
  run(g2, 2 / 6 + DT);
  ok(c2.segs[0].row === 3 && c2.segs[0].dir === -1 && c2.segs[0].col === 12, 'bateu no cogumelo: desce uma fileira e inverte');
  // borda do arco
  const g3 = empty();
  const c3 = chain(g3, 1, g3.cols - 1, 4, 1);
  run(g3, 1 / 6 + DT);
  ok(c3.segs[0].row === 5 && c3.segs[0].dir === -1, 'bateu na borda: desce e inverte');
  // volta completa (360°): na costura de trás desce e segue no mesmo sentido
  const g4 = empty(8);
  const c4 = chain(g4, 1, g4.cols - 1, 4, 1);
  run(g4, 1 / 6 + DT);
  ok(c4.segs[0].row === 5 && c4.segs[0].dir === 1, '360°: na costura desce sem inverter');
  run(g4, 1 / 6);
  ok(c4.segs[0].col === 0 && c4.segs[0].row === 5, '360°: atravessa para o outro lado');
  // cogumelo envenenado: mergulha reto
  const g5 = empty();
  const c5 = chain(g5, 1, 10, 3, 1);
  g5.addMush(11, 3).poison = true;
  run(g5, 3 / 6 + DT);
  ok(c5.segs[0].dive && c5.segs[0].col === 10 && c5.segs[0].row === 6, 'envenenado: mergulha direto para baixo');
  // previsão do robô bate com o caminho de verdade
  const g6 = empty();
  for (const [cc, r] of [[15, 2], [8, 3], [14, 4]]) g6.addMush(cc, r);
  const c6 = chain(g6, 5, 11, 2, 1); settle(c6);
  const pred = [0.3, 0.9, 1.7].map(t => ({ t, p: g6.predictSeg(c6, 3, t) }));
  let tt = 0, worst = 0;
  for (const { t, p } of pred) { run(g6, t - tt); tt = t; worst = Math.max(worst, dist(p, g6.segPos(c6, c6.segs[3]))); }
  ok(worst < 0.05, `previsão do caminho de um gomo (erro ${worst.toFixed(3)} m)`);
}

console.log('Estilingue e tiros');
{
  const g = empty();
  const evs = run(g, 1, { hands: [{ on: true, p: HEAD, d: [0, 0, -1], fire: true }, { on: false }] });
  const shots = evs.filter(e => e.type === 'shot').length;
  ok(shots >= 4 && shots <= Math.ceil(1 / SHOT.cool) + 1, `cadência limitada (${shots} tiros em 1 s)`);
  ok(evs.some(e => e.type === 'miss'), 'tiro que não acerta nada some na cúpula');
  const g2 = empty();
  const e2 = run(g2, 1, { hands: [{ on: true, p: HEAD, d: [0, 0, -1], fire: true }, { on: true, p: HEAD, d: [0.2, 0, -1], fire: true }] });
  ok(e2.filter(e => e.type === 'shot' && e.hand === 1).length >= 4, 'as duas mãos atiram');
  ok(e2.filter(e => e.type === 'shot').length >= 8, 'duas mãos = o dobro de tiros');
  const g3 = empty();
  g3.step({ hands: [{ on: true, p: HEAD, d: [0, 0, -1], fire: false }, { on: false }] });
  ok(!g3.shots.length, 'sem gatilho não atira');
}

console.log('Acertos');
{
  // gomo vira cogumelo e divide a lacraia
  const g = empty();
  const c = chain(g, 6, 12, 3, 1); settle(c);
  for (let k = 1; k < 6; k++) { c.segs[k].col = 12 - k; c.segs[k].pc = 12 - k; c.segs[k].pr = 3; }
  c.segs[0].pr = 3;
  const target = c.segs[2];
  const evs = shootAt(g, g.segPos(c, target));
  ok(evs.some(e => e.type === 'seg-hit' && !e.head), 'acertou um gomo');
  ok(!!g.mushAt(target.col, target.row) || !!g.mushAt(target.pc, target.pr), 'o gomo virou cogumelo');
  ok(g.chains.length === 2 && g.chains.some(ch => ch.segs.length === 2) && g.chains.some(ch => ch.segs.length === 3), 'a lacraia se dividiu em duas');
  ok(g.score === SCORE.body + 0, `pontos do gomo (${g.score})`);
  const g2 = empty();
  const c2 = chain(g2, 1, 12, 3, 1);
  c2.segs[0].pr = 3;
  shootAt(g2, g2.segPos(c2, c2.segs[0]));
  ok(!g2.chains.length && g2.score === SCORE.head, 'cabeça vale mais');
  // cogumelo: 3 tiros, encolhe
  const g3 = empty();
  const m = g3.addMush(10, 6);
  shootAt(g3, g3.cellPos(10, 6)); shootAt(g3, g3.cellPos(10, 6));
  ok(m.hp === MUSH_HP - 2 && g3.mushAt(10, 6), 'cogumelo perde vida a cada tiro');
  const e3 = shootAt(g3, g3.cellPos(10, 6));
  ok(!g3.mushAt(10, 6) && e3.some(e => e.type === 'mush-break'), `cogumelo some com ${MUSH_HP} tiros`);
}

console.log('Mordida e vidas');
{
  const g = empty();
  g.waves = [{ len: 4, speed: 6 }]; g.wave = 1;
  const c = chain(g, 4, 10, BITE_ROW - 1, 1);
  g.addMush(11, BITE_ROW - 1);
  const evs = run(g, 0.3);
  ok(evs.some(e => e.type === 'bite') && g.lives === LIVES - 1, 'lacraia que chega embaixo morde: perde vida');
  ok(!g.chains.length && g.pending?.length === 1, 'as lacraias saem da cúpula');
  run(g, RESPITE + 0.1);
  ok(g.chains.length === 1 && g.chains[0].segs.length === 4 && g.chains[0].segs[0].row <= 1, 'e voltam lá de cima com os mesmos gomos');
  void c;
  const g2 = empty();
  g2.lives = 1;
  chain(g2, 1, 10, BITE_ROW - 1, 1);
  g2.addMush(11, BITE_ROW - 1);
  run(g2, 0.3);
  ok(g2.phase === 'lost' && !g2.result.won, 'sem vidas perde a fase');
  // vencer: todas as ondas acabaram
  const g3 = new Game(0, { mush: 0 });
  g3.waves = [{ len: 1, speed: 4 }];
  run(g3, 1.6);
  ok(g3.chains.length === 1, 'onda entra');
  const c3 = g3.chains[0];
  c3.segs[0].pr = c3.segs[0].row;
  shootAt(g3, g3.segPos(c3, c3.segs[0]));
  ok(g3.phase === 'won' && g3.result.won && g3.result.stars >= 1, 'acabaram as lacraias: venceu');
}

console.log('Aranha, pulga e escorpião');
{
  const g = empty();
  chain(g, 1, 5, 0, 1, { speed: 0.01 });
  g.spawnSpider();
  const sp = g.spider;
  let minRow = 99, maxRow = -99;
  for (let t = 0; t < SPIDER.dur; t += 0.05) { const { el } = g.spiderAzEl(sp, t); const r = (DOME.el0 - el) / DOME.elStep; minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r); }
  ok(minRow >= 9 && maxRow < BITE_ROW, `aranha pula só na faixa de baixo (fileiras ${minRow.toFixed(1)} a ${maxRow.toFixed(1)})`);
  // come cogumelos
  const { az, el } = g.spiderAzEl(sp, 1.0);
  const col = g.colOfAz(az), row = Math.round((DOME.el0 - el) / DOME.elStep);
  g.addMush(col, row);
  const ev = run(g, 1.2);
  ok(ev.some(e => e.type === 'eat') && !g.mushAt(col, row), 'aranha come cogumelos');
  // acertar
  const e2 = shootAt(g, g.spiderPos(g.spider, g.spider.t + 0.25));
  ok(e2.some(e => e.type === 'spider-hit') && !g.spider, 'acertou a aranha');
  // se terminar o caminho, morde
  const g2 = empty();
  chain(g2, 1, 5, 0, 1, { speed: 0.01 });
  g2.spawnSpider();
  const e3 = run(g2, SPIDER.dur + 0.2);
  ok(e3.some(e => e.type === 'spider-bite') && g2.lives === LIVES - 1, 'aranha que atravessa morde');
  // pulga deixa cogumelos e aguenta 2 tiros
  const g3 = empty();
  chain(g3, 1, 5, 0, 1, { speed: 0.01 });
  g3.spawnFlea();
  g3.flea.drops = [3, 6, 9];
  const fc = g3.flea.col;
  run(g3, 2.2);
  ok(g3.mushAt(fc, 3) && g3.mushAt(fc, 6), 'pulga cai deixando cogumelos');
  const e4 = shootAt(g3, g3.fleaPos(g3.flea, 0.2));
  ok(g3.flea && g3.flea.hp === 1 && g3.flea.speed === FLEA.fast && e4.some(e => e.type === 'crack'), 'pulga acertada uma vez cai mais rápido');
  shootAt(g3, g3.fleaPos(g3.flea, 0.2));
  ok(!g3.flea, 'pulga some com 2 tiros');
  // escorpião envenena
  const g4 = empty();
  chain(g4, 1, 5, 0, 1, { speed: 0.01 });
  g4.spawnScorp();
  const sc = g4.scorp;
  const m = g4.addMush(g4.colOfAz(sc.az + sc.dir * 30), sc.row);
  run(g4, 3);
  ok(m.poison, 'escorpião envenena os cogumelos da fileira');
  if (g4.scorp) { shootAt(g4, g4.scorpPos(g4.scorp, 0.2)); ok(!g4.scorp, 'acertou o escorpião'); }
  else ok(true, 'escorpião já passou');
  // inimigos aparecem sozinhos na fase
  const g5 = new Game(10, { seed: 3 });
  const e5 = run(g5, 30);
  ok(e5.some(e => e.type === 'spider-in') && e5.some(e => e.type === 'flea-in') && e5.some(e => e.type === 'scorp-in'), 'aranha, pulga e escorpião aparecem na fase 11');
}

console.log('Chefes');
{
  // Rainha: coroa aguenta 5, gomos blindados aguentam 2, cresce
  const g = new Game(3, { mush: 0, seed: 2 });
  g.timers.spider = Infinity;
  run(g, 1.6);
  const q = g.chains.find(c => c.queen);
  ok(q && q.segs.length === QUEEN.len && q.segs[0].hp === QUEEN.crown, 'Rainha entra com a coroa');
  run(g, 3);
  const n0 = q.segs.length;
  run(g, QUEEN.growEvery);
  ok(q.segs.length === Math.min(QUEEN.maxLen, n0 + 1), 'Rainha cresce um gomo de tempos em tempos');
  const body = q.segs.find((s, i) => i > 2 && !s.hidden);
  const bi = q.segs.indexOf(body);
  g.damageSeg(q, bi, [0, 0, 0]);
  ok(body.hp === QUEEN.hp - 1 && g.chains.length === 1, 'gomo blindado só racha no primeiro tiro');
  const len0 = q.segs.length;
  for (let k = 1; k < QUEEN.hp; k++) g.damageSeg(q, bi, [0, 0, 0]);
  ok(q.segs.length === len0 - 1 && g.chains.length === 1, 'gomo quebrado some e a Rainha não se divide');
  g.events = []; g.damageSeg(q, 0, [0, 0, 0]);
  ok(g.events.some(e => e.type === 'ping') && q.segs[0].hp === QUEEN.crown, 'coroa protegida enquanto o corpo é comprido');
  q.segs.length = QUEEN.expose;
  for (let k = 0; k < QUEEN.crown - 1; k++) g.damageSeg(q, 0, [0, 0, 0]);
  ok(g.phase === 'play' && q.segs[0].hp === 1, 'com o corpo curto a coroa racha');
  g.damageSeg(q, 0, [0, 0, 0]);
  g.step(off);
  ok(g.phase === 'won', 'coroa quebrada: Rainha derrotada');
  // Tecelã: fechada não leva dano, aberta leva; solta filhotes e teia
  const gw = new Game(7, { mush: 0, seed: 2 });
  gw.timers.spider = Infinity;
  gw.weaver.cyc = 0; run(gw, 0.1);
  const e1 = shootAt(gw, gw.weaverPos(gw.weaver, 0.2));
  ok(e1.some(e => e.type === 'ping') && gw.weaver.hp === WEAVER.hp, 'Tecelã fechada não leva dano');
  gw.weaver.cyc = WEAVER.closed + 0.05; run(gw, DT);
  ok(gw.weaver.open, 'Tecelã abre os olhos');
  shootAt(gw, gw.weaverPos(gw.weaver, 0.2));
  ok(gw.weaver.hp === WEAVER.hp - 1, 'Tecelã aberta leva dano');
  const e2 = run(gw, WEAVER.babyEvery + WEAVER.webEvery);
  ok(e2.some(e => e.type === 'baby') && gw.chains.some(c => c.baby), 'Tecelã solta filhotes de lacraia');
  ok(e2.some(e => e.type === 'web') && [...gw.mush.values()].some(m => m.web), 'Tecelã solta teia');
  gw.weaver.hp = 1; gw.weaver.open = true; gw.weaver.cyc = WEAVER.closed + 0.1;
  shootAt(gw, gw.weaverPos(gw.weaver, 0.2));
  ok(gw.phase === 'won' && !gw.chains.length, 'Tecelã derrotada leva os filhotes junto');
  // Dragão: corpo não leva dano, cauda encurta, cabeça derruba; raios envenenam
  const gd = new Game(11, { mush: 0, seed: 2 });
  gd.timers = { spider: Infinity, flea: Infinity, scorp: Infinity };
  run(gd, 1.6);
  const d = gd.chains.find(c => c.dragon);
  ok(d && d.segs.length === DRAGON.len, 'Dragão entra com o corpo comprido');
  run(gd, 4);
  const mid = Math.floor(d.segs.length / 2);
  const evb = []; gd.events = []; gd.damageSeg(d, mid, [0, 0, 0]); evb.push(...gd.events);
  ok(evb.some(e => e.type === 'ping') && d.segs.length === DRAGON.len, 'corpo do Dragão não leva dano');
  for (let k = 0; k < DRAGON.tailHp; k++) gd.damageSeg(d, d.segs.length - 1, [0, 0, 0]);
  ok(d.segs.length === DRAGON.len - 1, 'cauda do Dragão quebra e ele encurta');
  const e3 = run(gd, DRAGON.boltEvery + 0.1);
  ok(e3.some(e => e.type === 'bolt') && [...gd.mush.values()].some(m => m.poison), 'raios do Dragão envenenam cogumelos');
  gd.events = [];
  for (let k = 0; k < DRAGON.fleeEvery; k++) gd.damageSeg(d, 0, [0, 0, 0]);
  ok(gd.events.some(e => e.type === 'flee') && d.away > 0, 'Dragão foge para as nuvens depois de umas batidas');
  const e4 = run(gd, DRAGON.away + 0.1);
  ok(e4.some(e => e.type === 'return') && !(d.away > 0) && d.segs[0].row <= 1, 'e volta lá em cima em outro lugar');
  for (let k = DRAGON.fleeEvery; k < DRAGON.hp; k++) gd.damageSeg(d, 0, [0, 0, 0]);
  gd.step(off);
  ok(gd.phase === 'won', 'cabeça do Dragão derrubada vence');
}

console.log('Robô (limites humanos) nas 12 fases');
{
  const SEEDS = [1, 2, 3, 4, 5];
  let total = 0;
  for (let lv = 0; lv < LEVELS.length; lv++) {
    const rs = [];
    let maxTurn = 0, maxAim = 0;
    for (const seed of SEEDS) {
      const g = new Game(lv, { seed });
      const robot = makeRobot({ seed: seed * 7 });
      let lastFace = null, lastD = null;
      while (!g.over && g.t < 400) {
        const inp = robot.step(g);
        if (lastFace !== null) maxTurn = Math.max(maxTurn, Math.abs(wrapDeg(robot.face - lastFace)) / DT);
        if (lastD) maxAim = Math.max(maxAim, Math.acos(Math.max(-1, Math.min(1, lastD[0] * inp.hands[0].d[0] + lastD[1] * inp.hands[0].d[1] + lastD[2] * inp.hands[0].d[2]))) * 180 / Math.PI / DT);
        lastFace = robot.face; lastD = inp.hands[0].d;
        g.step(inp);
      }
      rs.push(g.result || { won: false, eff: 999, stars: 0, livesLost: 9 });
    }
    ok(maxTurn <= HUMAN.bodyTurn + 1 && maxAim <= HUMAN.aimSpeed + 1, `fase ${lv + 1}: o robô respeita os limites de giro (${maxTurn.toFixed(0)}°/s, mira ${maxAim.toFixed(0)}°/s)`);
    const allWon = rs.every(r => r.won), minStars = Math.min(...rs.map(r => r.stars));
    ok(allWon, `fase ${lv + 1}: o robô vence com as ${SEEDS.length} sementes`);
    ok(minStars >= 2, `fase ${lv + 1}: o robô faz pelo menos 2 estrelas (${rs.map(r => r.stars).join(' ')})`);
    total += rs.reduce((s, r) => s + r.stars, 0);
    console.log(`  ${String(lv + 1).padStart(2)} ${LEVELS[lv].name.padEnd(22)} tempo efetivo ${rs.map(r => Math.round(r.eff)).join(' ').padEnd(22)} vidas perdidas ${rs.map(r => r.livesLost).join('')}  estrelas ${rs.map(r => r.stars).join('')}  (limites ${LEVELS[lv].par.join('/')})`);
  }
  console.log(`  média de estrelas do robô: ${(total / (SEEDS.length * LEVELS.length)).toFixed(2)}`);
}

console.log(fails ? `\n${fails} de ${count} testes falharam` : `\nTudo certo (${count} testes)`);
process.exit(fails ? 1 : 0);
