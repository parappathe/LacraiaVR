// Liga as regras (sim.js) à tela, ao Quest (controles e mãos) e ao mouse/teclado.
import * as THREE from '../vendor/three/three.module.js';
import { Game, DT, DOME, LIVES, LIFE_PENALTY, QUEEN, DRAGON, SPIDER, elOf, wrapDeg } from './sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD } from './levels.js';
import { makeRobot } from './robot.js';
import { buildWorld, SegView, MushView, ShotView, buildSpider, buildFlea, buildScorpion, buildCrown, buildWeaver, buildDragonHead, buildSlingshot, buildReticle, orientOnDome, domeBasis, Particles, THEMES } from './scene.js';
import { Panel, Label, C as UI } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave, rankOf, addScore } from './save.js';

const save = loadSave();
const sfx = new Sfx();
sfx.on = save.sound;
sfx.musicOn = save.music;
const IS_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIDES = ['left', 'right'];
const HAND_COLOR = ['#5affd8', '#ffd25a'];
const BOSS_NAME = { queen: 'Rainha', weaver: 'Tecelã', dragon: 'Dragão' };
const DEG = Math.PI / 180;

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_QUEST ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildWorld();
const { scene } = world;
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.03, 80);
const rig = new THREE.Group();          // VR: referência do óculos (recentralizar põe a cabeça em x = 0, z = 0)
scene.add(rig);
rig.add(camera);
const PC_CAM = new THREE.Vector3(0, 1.6, 0);
const view = { yaw: 0, pitch: 14 };     // PC: para onde a câmera olha (graus)

const segView = new SegView(scene);
const mushView = new MushView(scene);
const shotView = new ShotView(scene, world.glowTex);
const particles = new Particles(scene);
const spider = buildSpider(); spider.group.visible = false; scene.add(spider.group);
const flea = buildFlea(); flea.group.visible = false; scene.add(flea.group);
const scorp = buildScorpion(); scorp.group.visible = false; scene.add(scorp.group);
const crown = buildCrown(); crown.group.visible = false; scene.add(crown.group);
const weaver = buildWeaver(); weaver.group.visible = false; scene.add(weaver.group);
const dragon = buildDragonHead(); dragon.group.visible = false; scene.add(dragon.group);
const slings = HAND_COLOR.map(c => buildSlingshot(c));
for (const s of slings) { s.group.visible = false; scene.add(s.group); }
const reticles = HAND_COLOR.map(c => buildReticle(c, world.glowTex));
for (const r of reticles) { r.visible = false; scene.add(r); }

// menus e placas
const panel = new Panel(0.9);
const fpsLabel = new Label(0.12);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);
const msgLabel = new Label(0.9, 1024, 128);     // avisos (VR), seguem a cabeça devagar
scene.add(msgLabel.mesh);
msgLabel.mesh.visible = false;

// ---------- Estado ----------
let app = 'menu';            // 'menu' | 'playing' | 'paused' | 'done' | 'initials'
let mode = 'level';          // 'level' (fase avulsa) | 'arcade' (fliperama: as 12 seguidas)
let level = 0;
let game = null;
let robot = makeRobot();
let demo = true;             // no menu o robô joga sozinho, ao fundo, sem som
let msg = null;
let doneTimer = 0;
let lastResult = null, newRecord = false;
const arcade = { score: 0, lives: LIVES, rank: -1, over: false, letters: [0, 0, 0], slot: 0 };

const unlocked = (i) => i === 0 || !!save.done[i - 1];
const nextLevel = () => { let n = 0; while (n < LEVELS.length - 1 && save.done[n]) n++; return n; };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function newGame(lv, opts = {}) {
  level = clamp(lv, 0, LEVELS.length - 1);
  const L = LEVELS[level];
  game = new Game(level, opts);
  world.setTheme(L.world, game.arc);
  robot.reset();
  acc = 0;
  sfx.setSong(L.world, !demo);
}

function startLevel(lv, m = mode) {
  mode = m;
  demo = false;
  arcade.counted = false;
  newGame(lv, { seed: Math.floor(Math.random() * 1e6), lives: mode === 'arcade' ? arcade.lives : LIVES });
  app = 'playing';
  doneTimer = 0;
  panel.hide();
  const L = LEVELS[level], W = WORLDS[L.world];
  const head = level % LEVELS_PER_WORLD === 0 ? `${W.name}. ${W.hint}` : L.boss ? `Chefe: ${L.name}!` : `Fase ${level + 1}: ${L.name}`;
  showMsg(head, 5, '#eef6ff');
  if (L.boss === 'queen') later.push({ t: time + 5.2, fn: () => showMsg(`Quebre os gomos blindados: a coroa só racha com ${QUEEN.expose} gomos ou menos`, 4, '#ffd24a') });
  if (L.boss === 'weaver') later.push({ t: time + 5.2, fn: () => showMsg('A Tecelã só leva dano com os olhos abertos', 4, '#5affff') });
  if (L.boss === 'dragon') later.push({ t: time + 5.2, fn: () => showMsg('Só a cabeça do Dragão leva dano. Siga o som dela!', 4, '#5af0ff') });
  sfx.coin();
  updateHint();
}

function startArcade() {
  arcade.score = 0; arcade.lives = LIVES; arcade.rank = -1; arcade.over = false;
  startLevel(0, 'arcade');
}

function togglePause() {
  if (app === 'playing') { app = 'paused'; showScreen('pause'); }
  else if (app === 'paused') { app = 'playing'; panel.hide(); }
  sfx.setSong(LEVELS[level].world, app === 'playing');
  updateHint();
}

function goMenu() {
  app = 'menu';
  demo = true;
  newGame(nextLevel(), { seed: Math.floor(Math.random() * 1e6) });
  showScreen('main');
  updateHint();
}

function showMsg(text, t = 2, color = '#d4ff5a') { msg = { text, t, color }; }
const pad6 = (n) => String(Math.max(0, Math.round(n))).padStart(6, '0');
const totalStars = () => Object.values(save.done).reduce((s, d) => s + (d.stars || 0), 0);

// ---------- Menus ----------
function showScreen(name) {
  const vr = renderer.xr.isPresenting;
  placePanel();
  panel.show((p) => {
    if (name === 'main') {
      p.title('Lacraia do Céu', 76, 72);
      p.text('Derrube a lacraia que desce pela cúpula com o estilingue de luz.', 512, 136, { size: 26, color: UI.dim });
      const next = nextLevel();
      p.button(save.done[0] ? `Continuar: fase ${next + 1}` : 'Começar', () => startLevel(next, 'level'), 262, 172, 500, 86, { size: 38 });
      p.button('Fliperama (as 12 seguidas)', () => startArcade(), 262, 272, 500, 74, { size: 30 });
      p.button('Escolher fase', () => showScreen('levels'), 262, 360, 245, 70, { size: 28 });
      p.button('Recordes', () => showScreen('scores'), 517, 360, 245, 70, { size: 28 });
      p.button('Como jogar', () => showScreen('help'), 262, 444, 500, 66, { size: 28 });
      const opt = (label, key, x, after) => p.button(`${label}: ${save[key] ? 'sim' : 'não'}`, () => { save[key] = !save[key]; storeSave(save); after?.(); showScreen('main'); }, x, 526, 220, 60, { size: 24 });
      opt('Som', 'sound', 152, () => sfx.setOn(save.sound));
      opt('Música', 'music', 402, () => sfx.setMusic(save.music));
      opt('FPS', 'fps', 652);
      p.text(`Estrelas: ${totalStars()} de ${LEVELS.length * 3}${save.scores[0] ? `   ·   Recorde: ${save.scores[0].name} ${save.scores[0].score}` : ''}`, 512, 622, { size: 25, color: UI.star });
      p.text(vr ? 'Aponte e aperte o gatilho para escolher' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR"', 512, 670, { size: 21, color: UI.dim });
    } else if (name === 'levels') {
      p.title('Escolher fase', 56, 48);
      WORLDS.forEach((W, w) => {
        const y = 100 + w * 190;
        p.text(`${W.name} (${W.arc}°)`, 512, y + 6, { size: 26, bold: true, color: ['#7aff5a', '#ff5ab8', '#5af0ff'][w] });
        for (let k = 0; k < LEVELS_PER_WORLD; k++) {
          const i = w * LEVELS_PER_WORLD + k, L = LEVELS[i], d = save.done[i];
          p.tile(112 + k * 205, y + 26, 190, 140, { num: i + 1, name: L.boss ? `Chefe: ${L.name}` : L.name, stars: d?.stars || 0, done: !!d, locked: !unlocked(i), master: !!L.boss, action: () => startLevel(i, 'level') });
        }
      });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 652, 300, 56, { size: 28 });
    } else if (name === 'scores') {
      p.title('Recordes do fliperama', 60, 50);
      if (!save.scores.length) p.text('Ninguém ainda. Jogue o Fliperama: as 12 fases seguidas!', 512, 300, { size: 28, color: UI.dim });
      save.scores.forEach((e, i) => {
        const y = 130 + i * 56, hl = mode === 'arcade' && arcade.over && i === arcade.rank;
        p.text(`${i + 1}.`, 250, y, { size: 34, bold: true, color: hl ? UI.edge : UI.dim, align: 'right' });
        p.text(e.name, 300, y, { size: 38, bold: true, color: hl ? UI.edge : UI.text, align: 'left' });
        p.text(pad6(e.score), 620, y, { size: 38, bold: true, color: hl ? UI.edge : UI.star, align: 'right' });
        p.text(e.level >= 13 ? 'zerou!' : `fase ${e.level}`, 660, y, { size: 26, color: UI.dim, align: 'left' });
      });
      p.button('Fliperama', () => startArcade(), 262, 588, 245, 80, { size: 30 });
      p.button('Voltar', () => showScreen('main'), 517, 588, 245, 80, { size: 30 });
    } else if (name === 'help') {
      p.title('Como jogar', 56);
      const rows = vr ? [
        'Cada mão tem um estilingue de luz: aponte e aperte o gatilho.',
        'Gomo acertado vira cogumelo e a lacraia se divide em duas.',
        'Bateu num cogumelo ou na borda, ela desce uma fileira e volta.',
        'Se uma lacraia chegar na linha vermelha lá embaixo, ela morde.',
      ] : [
        'O mouse mira e o clique atira (segure para continuar atirando).',
        'A e D (ou arrastar com o botão direito) giram a vista.',
        'Gomo acertado vira cogumelo e a lacraia se divide em duas.',
        'Se uma lacraia chegar na linha vermelha lá embaixo, ela morde.',
      ];
      rows.forEach((t, i) => p.text(t, 50, 112 + i * 46, { size: 24, align: 'left' }));
      const sp = [
        ['Cabeça: 100 pontos, gomo: 10', '#ff8a3a'], ['Cogumelo: 3 tiros', '#5affd8'],
        ['Aranha: pula embaixo; se atravessar, morde', '#ff3a8a'], ['Pulga: cai deixando cogumelos', '#ffe45a'],
        ['Escorpião: envenena cogumelos', '#c05aff'], ['Envenenado: a lacraia mergulha', '#b04aff'],
      ];
      sp.forEach(([t, c], i) => p.text(t, 70 + (i % 2) * 460, 316 + Math.floor(i / 2) * 50, { size: 22, align: 'left', color: c }));
      p.text(`Chefes na 4ª fase de cada mundo. Estrelas pelo tempo (cada vida perdida = +${LIFE_PENALTY} s).`, 512, 552, { size: 22, color: UI.dim });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 600, 300, 76);
    } else if (name === 'pause') {
      p.title('Pausa', 64);
      p.text(`Fase ${level + 1}: ${LEVELS[level].name}${mode === 'arcade' ? '  ·  fliperama' : ''}`, 512, 122, { size: 28, color: UI.dim });
      p.button('Continuar', () => togglePause(), 262, 160, 500, 84);
      p.button(mode === 'arcade' ? 'Recomeçar o fliperama' : 'Recomeçar a fase', () => (mode === 'arcade' ? startArcade() : startLevel(level)), 262, 258, 500, 80, { size: 30 });
      p.button('Recentralizar', () => { recenter(); togglePause(); }, 262, 352, 245, 80, { size: 28, locked: !vr });
      p.button('Como jogar', () => showScreen('help'), 517, 352, 245, 80, { size: 28 });
      p.button(`Som: ${save.sound ? 'sim' : 'não'}`, () => { save.sound = !save.sound; storeSave(save); sfx.setOn(save.sound); showScreen('pause'); }, 262, 446, 245, 72, { size: 26 });
      p.button(`Música: ${save.music ? 'sim' : 'não'}`, () => { save.music = !save.music; storeSave(save); sfx.setMusic(save.music); showScreen('pause'); }, 517, 446, 245, 72, { size: 26 });
      p.button('Menu principal', () => goMenu(), 262, 560, 500, 80);
    } else if (name === 'done') {
      const r = lastResult, d = save.done[level], L = LEVELS[level];
      if (r.won) {
        p.title(newRecord ? 'Céu limpo! Recorde!' : 'Céu limpo!', 66, 54);
        p.stars(r.stars, 512, 140, 74);
        p.text(`Tempo ${r.time.toFixed(0)} s  ·  vidas perdidas ${r.livesLost}  ·  pontaria ${Math.round(r.accuracy * 100)}%`, 512, 212, { size: 28 });
        p.text(`Pontos ${r.score}  (bônus ${r.bonus})`, 512, 256, { size: 34, bold: true, color: UI.edge });
        p.text(`3 estrelas até ${L.par[0]} s · 2 até ${L.par[1]} s (cada vida perdida = +${LIFE_PENALTY} s)`, 512, 298, { size: 21, color: UI.dim });
        if (d) p.text(`Melhor: ${d.stars} estrela${d.stars === 1 ? '' : 's'} · ${d.score} pontos`, 512, 332, { size: 22, color: UI.dim });
      } else {
        p.title(mode === 'arcade' ? 'Fim de jogo' : 'Acabaram as vidas', 70, 58);
        p.text(L.boss ? `O chefe ainda tinha ${game.left} de vida` : `Faltaram ${game.left} gomos`, 512, 160, { size: 32, color: UI.red });
        p.text('Dica: acerte as cabeças mais baixas primeiro e não deixe a aranha atravessar.', 512, 214, { size: 24 });
      }
      if (mode === 'arcade') {
        p.text(`Fliperama: ${pad6(arcade.score)} pontos  ·  vidas ${arcade.lives}`, 512, 384, { size: 30, bold: true, color: UI.star });
        if (r.won && level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'arcade'), 262, 420, 500, 92, { size: 38 });
        else p.button('Recordes', () => showScreen('scores'), 262, 420, 500, 92, { size: 38 });
        p.button('Menu principal', () => goMenu(), 262, 540, 500, 78);
      } else {
        if (level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'level'), 262, 372, 500, 90, { size: 36, locked: !unlocked(level + 1) });
        else if (r.won) p.text('Você limpou os três céus!', 512, 416, { size: 34, bold: true, color: UI.edge });
        p.button(r.won ? 'Repetir' : 'Tentar de novo', () => startLevel(level, 'level'), 262, 478, 245, 80);
        p.button('Fases', () => showScreen('levels'), 517, 478, 245, 80);
        p.button('Menu principal', () => goMenu(), 262, 576, 500, 78);
      }
    } else if (name === 'initials') {
      p.title('Novo recorde!', 70, 60);
      p.text(`${pad6(arcade.score)} pontos  ·  ${arcade.rank + 1}º lugar`, 512, 140, { size: 34, bold: true, color: UI.star });
      p.text('Escolha suas 3 letras', 512, 190, { size: 26, color: UI.dim });
      for (let k = 0; k < 3; k++) {
        const x = 292 + k * 160;
        p.button('▲', () => { arcade.letters[k] = (arcade.letters[k] + 1) % LETTERS.length; showScreen('initials'); }, x, 220, 120, 70, { size: 36 });
        p.text(LETTERS[arcade.letters[k]], x + 60, 345, { size: 96, bold: true, color: k === arcade.slot && !vr ? UI.star : UI.edge });
        p.button('▼', () => { arcade.letters[k] = (arcade.letters[k] + LETTERS.length - 1) % LETTERS.length; showScreen('initials'); }, x, 400, 120, 70, { size: 36 });
      }
      p.button('Gravar', () => {
        const nm = arcade.letters.map(i => LETTERS[i]).join('');
        save.name = nm;
        addScore(save, nm, arcade.score, arcade.reached);
        storeSave(save);
        app = 'done';
        updateHint();
        showScreen('scores');
      }, 262, 520, 500, 90, { size: 40 });
      p.text(vr ? 'Aponte e aperte o gatilho' : 'Teclado: digite as letras (Enter grava)', 512, 650, { size: 22, color: UI.dim });
    }
  });
}

function placePanel() {
  if (renderer.xr.isPresenting) {
    if (panel.mesh.parent !== scene) scene.add(panel.mesh);
    panel.mesh.scale.setScalar(1);
    const e = new THREE.Euler().setFromQuaternion(xrHeadQuat(), 'YXZ');
    const head = xrHeadPos();
    panel.mesh.position.set(head.x - Math.sin(e.y) * 1.1, head.y - 0.05, head.z - Math.cos(e.y) * 1.1);
    panel.mesh.rotation.set(0, e.y, 0);
    return;
  }
  if (panel.mesh.parent !== camera) camera.add(panel.mesh);
  const half = THREE.MathUtils.degToRad(camera.fov / 2);
  const visH = 2 * 0.8 * Math.tan(half), visW = visH * camera.aspect;
  panel.mesh.position.set(0, 0, -0.8);
  panel.mesh.rotation.set(0, 0, 0);
  panel.mesh.scale.setScalar(Math.min(1, visW * 0.94 / 0.9, visH * 0.92 / 0.633));
}

function finishLevel() {
  const r = game.result;
  lastResult = r;
  const prev = save.done[level];
  newRecord = false;
  if (r.won) {
    newRecord = !!prev && r.score > prev.score;
    save.done[level] = { stars: Math.max(r.stars, prev?.stars || 0), score: Math.max(r.score, prev?.score || 0), time: Math.min(r.time, prev?.time ?? 1e9) };
    storeSave(save);
  }
  if (mode === 'arcade') {
    arcade.score += r.score;
    arcade.counted = true;
    arcade.lives = r.lives + (r.won && LEVELS[level].boss ? 1 : 0);
    arcade.reached = r.won ? level + 2 : level + 1;   // fase onde parou (13 = zerou)
    if (!r.won || level === LEVELS.length - 1) {
      arcade.over = true;
      arcade.rank = rankOf(save, arcade.score);
      if (arcade.rank >= 0) {
        arcade.letters = [...(save.name || 'AAA')].map(ch => Math.max(0, LETTERS.indexOf(ch)));
        arcade.slot = 0;
        app = 'initials';
        showScreen('initials');
        for (let k = 0; k < r.stars; k++) setTimeout(() => sfx.star(k), 300 + k * 220);
        updateHint();
        return;
      }
    }
  }
  app = 'done';
  showScreen('done');
  for (let k = 0; k < r.stars; k++) setTimeout(() => sfx.star(k), 300 + k * 220);
  updateHint();
}

// ---------- Controles do VR ----------
const ctrls = [];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  rig.add(ctrl);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xd4ff5a }));
  laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, laser, source: null, side: null, prevButtons: [], hoverIndex: -1, trigger: false };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => { entry.source = e.data; entry.side = e.data.handedness; });
  ctrl.addEventListener('disconnected', () => { entry.source = null; entry.side = null; entry.trigger = false; });
  ctrl.addEventListener('selectstart', () => { entry.trigger = true; onSelect(entry); });
  ctrl.addEventListener('selectend', () => { entry.trigger = false; });
}
const entryFor = (side) => ctrls.find(e => e.side === side && e.source);
function pulse(side, v, ms) {
  try { entryFor(side)?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(clamp(v, 0, 1), ms); } catch { /* sem vibração */ }
}
const both = (v, ms) => { pulse('left', v, ms); pulse('right', v, ms); };

function onSelect(entry) {
  sfx.unlock();
  if (panel.visible && entry.hoverIndex >= 0) { const a = panel.actionAt(entry.hoverIndex); if (a) { sfx.click(); a(); } }
}
function pollButtons() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp || e.source.hand) continue;
    const b = gp.buttons.map(x => x.pressed);
    if (b[5] && !e.prevButtons[5] && (app === 'playing' || app === 'paused')) togglePause();   // B ou Y
    e.prevButtons = b;
  }
}

// ---------- VR: sessão e recentralizar ----------
let recenterIn = 0;
function xrHeadPos() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()) : camera.getWorldPosition(new THREE.Vector3()); }
function xrHeadQuat() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldQuaternion(new THREE.Quaternion()) : camera.getWorldQuaternion(new THREE.Quaternion()); }
function recenter() {
  if (!renderer.xr.isPresenting) return;
  // põe a cabeça no centro da cúpula (x = 0, z = 0) olhando para a frente (-z); a altura fica
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
  if (panel.visible) placePanel();
}
renderer.xr.addEventListener('sessionstart', () => {
  recenterIn = 6;
  camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  if (panel.visible) setTimeout(placePanel, 150);
  updateHint();
});
renderer.xr.addEventListener('sessionend', () => {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  for (const s of slings) if (s.group.parent !== scene) scene.add(s.group);
  if (panel.visible) placePanel();
  onResize();
  updateHint();
});

// ---------- Mouse e teclado (PC) ----------
const mouse = { ndc: new THREE.Vector2(0, 0), x: window.innerWidth / 2, y: window.innerHeight / 2, has: false, down: false, rdown: false, lx: 0, ly: 0 };
const keys = {};
const raycaster = new THREE.Raycaster();
const canvas = renderer.domElement;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  setMouse(e);
  if (e.button === 2) { mouse.rdown = true; mouse.lx = e.clientX; mouse.ly = e.clientY; return; }
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const a = panel.actionAt(panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv));
    if (a) { sfx.click(); a(); }
    return;
  }
  if (e.button === 0) mouse.down = true;
});
window.addEventListener('pointerup', (e) => { if (e.button === 2) mouse.rdown = false; if (e.button === 0) mouse.down = false; });
canvas.addEventListener('pointermove', (e) => {
  if (mouse.rdown && !renderer.xr.isPresenting) {
    view.yaw = wrapDeg(view.yaw + (e.clientX - mouse.lx) * 0.25);
    view.pitch = clamp(view.pitch - (e.clientY - mouse.ly) * 0.2, -15, 60);
    mouse.lx = e.clientX; mouse.ly = e.clientY;
  }
  setMouse(e);
});
function setMouse(e) {
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.has = true;
}
window.addEventListener('blur', () => { mouse.down = mouse.rdown = false; for (const k in keys) keys[k] = false; });
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (app === 'initials') {
    // digitar as letras do recorde no teclado
    if (/^[a-z0-9]$/.test(k)) { arcade.letters[arcade.slot] = LETTERS.indexOf(k.toUpperCase()); arcade.slot = (arcade.slot + 1) % 3; showScreen('initials'); }
    else if (k === 'backspace') { arcade.slot = (arcade.slot + 2) % 3; showScreen('initials'); }
    else if (k === 'enter') panel.buttons.at(-1)?.action?.();
    return;
  }
  keys[k] = true;
  if (e.repeat) return;
  if (k === 'escape' || k === 'p') { if (app === 'playing' || app === 'paused') togglePause(); return; }
  if (k === 'f') { save.fps = !save.fps; storeSave(save); return; }
  if (k === ' ' && app === 'playing') mouse.down = true;
});
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); keys[k] = false; if (k === ' ') mouse.down = false; });
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (panel.visible) placePanel();
}
window.addEventListener('resize', onResize);

function updatePcCamera(dt) {
  if (renderer.xr.isPresenting) return;
  const turn = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  view.yaw = wrapDeg(view.yaw + turn * 100 * dt);
  const lift = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
  view.pitch = clamp(view.pitch + lift * 60 * dt, -15, 60);
  camera.position.copy(PC_CAM);
  camera.rotation.set(view.pitch * DEG, -view.yaw * DEG, 0, 'YXZ');
}

// ponto da cúpula onde um raio bate (para mirar e para as miras do VR)
const _C = new THREE.Vector3(...DOME.c);
function rayDome(o, d) {
  const oc = _v.copy(o).sub(_C);
  const b = oc.dot(d), c = oc.lengthSq() - DOME.R * DOME.R;
  const t = -b + Math.sqrt(Math.max(0, b * b - c));
  return o.clone().addScaledVector(d, t);
}

// ---------- Entrada para o jogo ----------
const pcHands = [new THREE.Vector3(), new THREE.Vector3()];
function pcInput() {
  raycaster.setFromCamera(mouse.ndc, camera);
  const target = rayDome(raycaster.ray.origin, raycaster.ray.direction);
  const right = _v2.set(1, 0, 0).applyQuaternion(camera.quaternion);
  return {
    hands: [0, 1].map((i) => {
      const p = pcHands[i].copy(camera.position).addScaledVector(right, i ? 0.2 : -0.2).add(new THREE.Vector3(0, -0.28, 0));
      const d = target.clone().sub(p).normalize();
      return { on: true, p: p.toArray(), d: d.toArray(), fire: mouse.down && app === 'playing' };
    }),
  };
}
function vrInput() {
  return {
    hands: [0, 1].map((i) => {
      const e = entryFor(SIDES[i]);
      if (!e) return { on: false };
      e.ctrl.getWorldPosition(_v);
      e.ctrl.getWorldQuaternion(_q);
      const d = _v2.set(0, 0, -1).applyQuaternion(_q);
      return { on: true, p: [_v.x, _v.y, _v.z], d: [d.x, d.y, d.z], fire: e.trigger && app === 'playing' && !panel.visible };
    }),
  };
}
let lastInput = { hands: [{ on: false }, { on: false }] };
function buildInput() {
  if (dev.autoplay || demo) return robot.step(game);
  if (app !== 'playing') return { hands: [{ on: false }, { on: false }] };
  return renderer.xr.isPresenting ? vrInput() : pcInput();
}

// estilingues: no VR presos aos controles; no PC e no robô, no mundo na pose da entrada
function placeSlings(vr) {
  for (let i = 0; i < 2; i++) {
    const S = slings[i], g = S.group;
    if (vr && !dev.autoplay && !demo) {
      const e = entryFor(SIDES[i]);
      g.visible = !!e && app !== 'menu';
      if (e && g.parent !== e.ctrl) { e.ctrl.add(g); g.position.set(0, -0.02, 0.02); g.quaternion.identity(); }
      S.beam.visible = app === 'playing';
      continue;
    }
    if (g.parent !== scene) scene.add(g);
    const h = lastInput.hands[i];
    g.visible = !!h?.on && (app === 'playing' || app === 'paused' || (demo && !vr) || dev.autoplay);
    if (!g.visible) continue;
    g.position.set(...h.p);
    _q.setFromUnitVectors(_v.set(0, 0, -1), _v2.set(...h.d));
    g.quaternion.copy(_q);
    S.beam.visible = false;
  }
}
function placeReticles(vr) {
  for (let i = 0; i < 2; i++) {
    const h = lastInput.hands[i];
    const show = vr && app === 'playing' && h?.on && !dev.autoplay;
    reticles[i].visible = !!show;
    if (!show) continue;
    reticles[i].position.copy(rayDome(new THREE.Vector3(...h.p), new THREE.Vector3(...h.d)));
  }
}

// ---------- Raios do menu ----------
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3();
const crossEl = document.getElementById('cross');
function updateMenuRays() {
  const vr = renderer.xr.isPresenting;
  let hover = -1;
  for (const e of ctrls) {
    e.hoverIndex = -1;
    e.laser.visible = false;
    if (!vr || !e.source || !panel.visible) continue;
    e.ctrl.getWorldPosition(rayOrigin);
    e.ctrl.getWorldQuaternion(_q);
    rayDir.set(0, 0, -1).applyQuaternion(_q);
    raycaster.set(rayOrigin, rayDir);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.visible = true;
    e.laser.scale.z = hit ? hit.distance : 1.2;
    e.hoverIndex = panel.pick(hit?.uv);
    if (e.hoverIndex >= 0) hover = e.hoverIndex;
  }
  const aiming = !vr && app === 'playing' && !dev.autoplay;
  crossEl.style.display = aiming ? 'block' : 'none';
  if (aiming) { crossEl.style.left = mouse.x + 'px'; crossEl.style.top = mouse.y + 'px'; }
  if (!vr && panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    hover = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
    canvas.style.cursor = hover >= 0 && panel.actionAt(hover) ? 'pointer' : 'default';
  } else if (!vr) canvas.style.cursor = aiming ? 'none' : 'default';
  if (panel.visible) panel.setHover(hover);
}

// ---------- HUD ----------
const hintEl = document.getElementById('hint');
const hudEl = document.getElementById('hud');
const msgEl = document.getElementById('msg');
const fpsEl = document.getElementById('fps');
function updateHint() {
  if (renderer.xr.isPresenting) { hintEl.textContent = ''; return; }
  hintEl.innerHTML = app === 'playing'
    ? '<span>Mouse: mira · clique (ou espaço): atira · A/D ou botão direito arrastando: gira a vista · Esc: pausa</span>'
    : app === 'initials' ? '<span>Digite as 3 letras e aperte Enter</span>' : '<span>Clique nas opções do painel</span>';
}
function bossBar() {
  const L = LEVELS[level];
  if (!L.boss) return null;
  let hp = 0, max = 1;
  if (L.boss === 'weaver') { hp = game.weaver.hp; max = game.weaver.maxHp; }
  else { hp = game.left; max = L.boss === 'queen' ? QUEEN.crown : DRAGON.hp; }
  return { hp, max };
}
function updateBoard() {
  if (!game) return;
  if (app === 'menu') {
    const best = save.scores[0];
    world.setBoard([
      { text: 'LACRAIA DO CÉU', x: 30, size: 54, color: '#d4ff5a' },
      { text: best ? `${best.name} ${pad6(best.score)}` : 'INSIRA FICHA', x: 994, align: 'right', size: 44, color: '#ff7ae0' },
    ]);
    return;
  }
  const score = mode === 'arcade' ? arcade.score + (arcade.counted ? 0 : game.score) : game.score;
  const L = LEVELS[level];
  let left = `FASE ${level + 1}`;
  const bb = bossBar();
  if (bb) { const k = Math.round(10 * bb.hp / bb.max); left = `${BOSS_NAME[L.boss].toUpperCase()} ${'■'.repeat(clamp(k, 0, 10))}${'□'.repeat(clamp(10 - k, 0, 10))}`; }
  world.setBoard([
    { text: left, x: 26, size: bb ? 38 : 54, color: L.boss ? '#ff7ae0' : '#5affd8' },
    { text: pad6(score), x: 610, align: 'center', size: 70, color: '#d4ff5a' },
    { text: '♥'.repeat(Math.max(0, game.lives)), x: 1000, align: 'right', size: 56, color: '#ff5a6a' },
  ]);
}
function updateHud(dt) {
  const vr = renderer.xr.isPresenting;
  const playing = (app === 'playing' || app === 'done' || app === 'paused') && !!game && !demo;
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  updateBoard();
  if (!vr) {
    msgLabel.mesh.visible = false;
    hudEl.style.display = playing ? 'block' : 'none';
    if (playing) {
      const L = LEVELS[level], bb = bossBar();
      const sp = game.spider ? Math.round(100 * game.spider.t / SPIDER.dur) : -1;
      const html = `<b>${level + 1}. ${L.name}</b><br><em>${WORLDS[L.world].name}${mode === 'arcade' ? ' · fliperama' : ''}</em>`
        + `<div>Tempo ${Math.floor(game.result?.time ?? game.t)} s · vidas ${'♥'.repeat(Math.max(0, game.lives))}</div>`
        + (bb ? `<div style="color:#ff7ae0">${BOSS_NAME[L.boss]}: ${bb.hp} de vida</div>` : `<div>Faltam ${game.left} gomos</div>`)
        + (L.boss === 'queen' ? `<div style="color:#ffd24a">${(game.chains.find(c => c.queen)?.segs.length ?? 0) > QUEEN.expose ? `Coroa protegida: deixe a Rainha com ${QUEEN.expose} gomos` : 'Coroa exposta: acerte a cabeça!'}</div>` : '')
        + (L.boss === 'weaver' ? `<div style="color:${game.weaver.open ? '#5affff' : '#9cb4d0'}">${game.weaver.open ? 'Olhos abertos: acerte a Tecelã!' : 'Olhos fechados'}</div>` : '')
        + (sp >= 0 ? `<div style="color:#ff3a8a">Aranha atravessando: ${sp}%</div>` : '')
        + (game.respite > 0 ? '<div style="color:#ff5a6a">Mordida! As lacraias voltam lá de cima</div>' : '');
      if (hudEl.dataset.last !== html) { hudEl.innerHTML = html; hudEl.dataset.last = html; }
    }
    const mtxt = msg && playing ? msg.text : '';
    if (msgEl.dataset.last !== mtxt) { msgEl.textContent = mtxt; msgEl.style.color = msg?.color || '#fff'; msgEl.dataset.last = mtxt; }
    msgEl.style.display = mtxt ? 'block' : 'none';
    return;
  }
  hudEl.style.display = msgEl.style.display = 'none';
  msgLabel.mesh.visible = playing && !!msg;
  if (!playing) return;
  const hp = xrHeadPos(), hq = xrHeadQuat();
  const fwd = _v.set(0, 0, -1).applyQuaternion(hq);
  const up = _v2.set(0, 1, 0).applyQuaternion(hq);
  const k = Math.min(1, dt * 2.5);
  const tgt = hp.clone().addScaledVector(fwd, 1.4).addScaledVector(up, -0.3);
  msgLabel.mesh.position.lerp(tgt, msgLabel.mesh.visible ? k : 1);
  msgLabel.mesh.lookAt(hp);
  if (msg) msgLabel.set([{ text: msg.text, size: 0.62, color: msg.color, bold: false }]);
}

// ---------- Eventos do jogo -> som, vibração, avisos, efeitos ----------
let tickIds = new Set(), tickN = 0;
function handleEvents(evs) {
  const quiet = demo;
  const th = THEMES[LEVELS[level].world];
  for (const ev of evs) {
    switch (ev.type) {
      case 'shot': if (!quiet) { sfx.shot(ev.p); pulse(SIDES[ev.hand], 0.25, 18); } break;
      case 'miss': particles.burst(ev.p, '#ffffff', 4, 0.6, 0.25, 0.04, 0); if (!quiet) sfx.miss(ev.p); break;
      case 'tick': if (!quiet && tickIds.has(ev.id)) sfx.tick(ev.p, tickN++); break;
      case 'seg-hit':
        particles.burst(ev.p, ev.head ? th.head : th.seg[0], 22, 1.6, 0.7, 0.07, 0.6);
        if (!quiet) sfx.segHit(ev.p, ev.head);
        break;
      case 'pop': particles.burst(ev.p, th.seg[1], 10, 1.2, 0.6, 0.06, 0.4); break;
      case 'mush-hit': if (!quiet) sfx.mushHit(ev.p); break;
      case 'mush-break': particles.burst(ev.p, ev.poison ? th.poison : th.mush[0], 14, 1, 0.6, 0.06, 0.4); if (!quiet) sfx.mushBreak(ev.p, ev.poison); break;
      case 'crack': particles.burst(ev.p, '#ffffff', 8, 1, 0.4, 0.05, 0); if (!quiet) sfx.crack(ev.p); break;
      case 'ping': particles.burst(ev.p, '#ffe45a', 6, 1, 0.3, 0.04, 0); if (!quiet) { sfx.ping(ev.p); if (ev.boss && !msg) showMsg(LEVELS[level].boss === 'queen' ? `Coroa protegida: quebre gomos até sobrarem ${QUEEN.expose}` : 'Protegida! Espere os olhos abrirem', 1.6, '#ffe45a'); } break;
      case 'split': if (!quiet) sfx.split(ev.p); break;
      case 'spider-in': if (!quiet) { sfx.spiderIn(ev.p); showMsg('Aranha! Acerte antes que ela atravesse', 2, '#ff3a8a'); } break;
      case 'hop': if (!quiet) sfx.hop(ev.p); break;
      case 'eat': particles.burst(ev.p, th.mush[1], 8, 0.8, 0.4, 0.05, 0); if (!quiet) sfx.eat(ev.p); break;
      case 'spider-hit': particles.burst(ev.p, '#ff3a8a', 30, 2, 0.8, 0.08, 0.5); if (!quiet) { sfx.spiderHit(ev.p); showMsg(`Aranha! +${ev.pts}`, 1.4, '#ff3a8a'); } break;
      case 'spider-bite': if (!quiet) { sfx.bite(); both(0.9, 250); showMsg(game.lives > 0 ? 'A aranha mordeu! -1 vida' : 'A aranha mordeu!', 2.2, '#ff5a6a'); } break;
      case 'flea-in': if (!quiet) sfx.fleaIn(ev.p); break;
      case 'drop': if (!quiet) sfx.drop(ev.p); break;
      case 'flea-hit': particles.burst(ev.p, '#ffe45a', 20, 1.5, 0.6, 0.06, 0.5); if (!quiet) { sfx.spiderHit(ev.p); showMsg(`Pulga! +${ev.pts}`, 1.2, '#ffe45a'); } break;
      case 'scorp-in': if (!quiet) { sfx.scorpIn(ev.p); showMsg('Escorpião! Ele envenena cogumelos', 2, '#c05aff'); } break;
      case 'scorp-hit': particles.burst(ev.p, '#c05aff', 30, 2, 0.8, 0.08, 0.5); if (!quiet) { sfx.spiderHit(ev.p); showMsg(`Escorpião! +${ev.pts}`, 1.4, '#c05aff'); } break;
      case 'poison': particles.burst(ev.p, th.poison, 8, 0.6, 0.6, 0.06, 0); if (!quiet) sfx.poison(ev.p); break;
      case 'bite':
        particles.burst(ev.p, '#ff5a5a', 40, 2, 0.9, 0.08, 0.5);
        if (!quiet) { sfx.bite(); both(1, 400); showMsg(game.lives > 0 ? 'Mordida! -1 vida. As lacraias voltam lá de cima' : 'Mordida!', 2.4, '#ff5a6a'); }
        break;
      case 'return': if (!quiet && ev.dragon) { sfx.roar(ev.p); showMsg('O Dragão voltou! Procure a cabeça', 1.8, '#5af0ff'); } break;
      case 'wave': if (!quiet) { sfx.wave(); if (ev.n > 0) showMsg(`Onda ${ev.n + 1}!`, 1.4, '#d4ff5a'); } break;
      case 'crown-hit': particles.burst(ev.p, '#ffd24a', 16, 1.4, 0.5, 0.06, 0); if (!quiet) { sfx.crownHit(ev.p); both(0.4, 40); } break;
      case 'grow': particles.burst(ev.p, '#ffd24a', 10, 0.8, 0.5, 0.05, 0); if (!quiet) sfx.grow(ev.p); break;
      case 'boss-hit': particles.burst(ev.p, ev.kind === 'dragon' ? '#5af0ff' : '#5affff', 18, 1.6, 0.6, 0.07, 0); if (!quiet) { sfx.bigHit(ev.p); both(0.4, 40); } flashBoss = 0.2; break;
      case 'flee': particles.burst(ev.p, '#c0d0ff', 50, 2.5, 1, 0.1, -0.5); if (!quiet) { sfx.flee(ev.p); showMsg('O Dragão se assustou e sumiu nas nuvens!', 2, '#5af0ff'); } break;
      case 'tail': particles.burst(ev.p, '#c0d0ff', 16, 1.2, 0.6, 0.07, 0); if (!quiet) sfx.segHit(ev.p, false); break;
      case 'bolt':
        for (const c of ev.cells) { world.lightning(c); particles.burst(c, '#e8f4ff', 20, 2, 0.5, 0.06, 0); }
        if (!quiet) { sfx.bolt(ev.cells[0]); both(0.3, 80); }
        break;
      case 'weaver-open': if (!quiet) { sfx.open(ev.p); showMsg('Olhos abertos: agora!', 1.2, '#5affff'); } break;
      case 'weaver-close': if (!quiet) sfx.close(ev.p); break;
      case 'baby': particles.burst(ev.p, '#5ad8ff', 14, 1, 0.5, 0.05, 0); if (!quiet) sfx.baby(ev.p); break;
      case 'web': if (!quiet) sfx.web(ev.p); break;
      case 'boss-down':
        for (let k = 0; k < 6; k++) later.push({ t: time + k * 0.18, fn: () => particles.burst(ev.p.map(v => v + (Math.random() - 0.5) * 0.8), ['#d4ff5a', '#ff7ae0', '#5af0ff'][k % 3], 40, 3, 1, 0.09, 0.3) });
        if (!quiet) { sfx.bossDown(ev.p); both(0.8, 300); showMsg(`${BOSS_NAME[ev.kind]} derrotad${ev.kind === 'dragon' ? 'o' : 'a'}!`, 3, '#d4ff5a'); }
        break;
      case 'won': if (!quiet) { sfx.won(); doneTimer = 2.2; showMsg('Céu limpo!', 2.2, '#d4ff5a'); } break;
      case 'lost': if (!quiet) { sfx.lost(); both(1, 400); doneTimer = 2.5; showMsg('Acabaram as vidas...', 2.5, '#ff5a6a'); } break;
    }
  }
}

// ---------- Desenho das coisas do jogo ----------
let flashBoss = 0;
const segItems = [];
const _fwd = new THREE.Vector3();
function fwdOf(game, g, az, el) {
  const a0 = game.azOf(g.pc), a1 = game.azOf(g.col);
  const da = wrapDeg(a1 - a0), de = elOf(g.row) - elOf(g.pr);
  const b = domeBasis(az, el);
  _fwd.copy(b.east).multiplyScalar(da * Math.cos(el * DEG)).addScaledVector(b.north, de);
  if (_fwd.lengthSq() < 1e-6) _fwd.copy(b.east).multiplyScalar(g.dir || 1);
  return _fwd.normalize().clone();
}
function drawGame(ahead, dt) {
  const th = THEMES[LEVELS[level].world];
  segItems.length = 0;
  let queenHead = null, dragonHead = null;
  const heads = [];
  for (const c of game.chains) {
    if (c.away > 0) continue;
    const f = Math.min(1, c.acc + c.speed * ahead);
    c.segs.forEach((g, i) => {
      if (g.hidden) return;
      const { az, el } = game.segAzEl(c, g, f);
      const fwd = fwdOf(game, g, az, el);
      let color = i === 0 ? th.head : th.seg[i % 2];
      let glow = 0;
      if (c.queen) color = i === 0 ? '#ffd24a' : (i % 2 ? '#ff7ae0' : '#c05aff');
      if (c.dragon) { color = i === 0 ? '#2a3a5a' : (i === c.segs.length - 1 ? '#8ab0ff' : (i % 2 ? '#3a4660' : '#4a5670')); glow = c.dragon && i > 0 ? 0.08 + 0.08 * Math.sin(time * 6 - i * 0.6) : 0; }
      if (c.baby) color = i === 0 ? '#ffffff' : '#9ae8ff';
      if (g.hp > 1 && g.hp !== Infinity && !c.dragon && !(c.queen && i === 0)) color = new THREE.Color(color).multiplyScalar(0.55 + 0.15 * (g.maxHp - g.hp)).getStyle();
      const it = { az, el, fwd, head: i === 0 && !c.dragon, color, glow };
      segItems.push(it);
      if (i === 0) heads.push({ id: c.id, row: g.row, dragon: c.dragon });
      if (c.queen && i === 0) queenHead = { az, el, fwd, exposed: c.segs.length <= QUEEN.expose };
      if (c.dragon && i === 0) dragonHead = { az, el, fwd };
    });
  }
  heads.sort((a, b) => (b.dragon - a.dragon) || (b.row - a.row));
  tickIds = new Set(heads.slice(0, 2).map(h => h.id));
  segView.update(segItems, time);
  mushView.update(game.mush.values(), game, th, dt, time);
  shotView.update(game.shots, ahead, HAND_COLOR);
  flashBoss = Math.max(0, flashBoss - dt);

  crown.group.visible = !!queenHead;
  if (queenHead) {
    orientOnDome(crown.group, queenHead.az, queenHead.el, queenHead.fwd, DOME.R - 0.32);
    crown.shield.visible = !queenHead.exposed;
    crown.shield.material.opacity = 0.15 + 0.08 * Math.sin(time * 5);
    crown.gold.emissiveIntensity = flashBoss > 0 ? 2 : 0.6;
  }
  dragon.group.visible = !!dragonHead;
  if (dragonHead) {
    orientOnDome(dragon.group, dragonHead.az, dragonHead.el, dragonHead.fwd, DOME.R - 0.05);
    dragon.mat.emissive.set(flashBoss > 0 ? '#5af0ff' : '#0a1a3a');
  }
  const sp = game.spider;
  spider.group.visible = !!sp;
  if (sp) {
    const t = sp.t + ahead;
    const { az, el } = game.spiderAzEl(sp, t);
    const b = domeBasis(az, el);
    orientOnDome(spider.group, az, el, b.east.clone().multiplyScalar(sp.dir), DOME.R - 0.1);
    spider.legs.forEach(({ pivot, side, i }) => { pivot.rotation.y = Math.sin(time * 14 + i * 1.6 + (side > 0 ? 1 : 0)) * 0.35; });
    spider.group.scale.setScalar(1 + 0.15 * Math.max(0, t / SPIDER.dur - 0.6));
  }
  const fl = game.flea;
  flea.group.visible = !!fl;
  if (fl) {
    const az = game.azOf(fl.col), el = elOf(fl.row + fl.speed * ahead);
    const b = domeBasis(az, el);
    orientOnDome(flea.group, az, el, b.north.clone().negate(), DOME.R - 0.08);
  }
  const sc = game.scorp;
  scorp.group.visible = !!sc;
  if (sc) {
    const az = sc.az + sc.dir * 13 * ahead, el = elOf(sc.row);
    const b = domeBasis(az, el);
    orientOnDome(scorp.group, az, el, b.east.clone().multiplyScalar(sc.dir), DOME.R - 0.08);
    scorp.tail.forEach((s, k) => { const a = (k + 1) * 0.5 + Math.sin(time * 4) * 0.1; s.position.set(0, Math.sin(a) * 0.12 * (k + 1) * 0.6, -0.22 - Math.cos(a) * 0.08 * (k + 1)); });
    const last = scorp.tail[3].position;
    scorp.sting.position.set(0, last.y + 0.06, last.z + 0.06);
    scorp.sting.rotation.x = 2.4;
  }
  const w = game.weaver;
  weaver.group.visible = !!w && w.hp > 0;
  if (weaver.group.visible) {
    const P = game.weaverPos(w, ahead);
    const rel = [P[0] - DOME.c[0], P[1] - DOME.c[1], P[2] - DOME.c[2]];
    const az = Math.atan2(rel[0], -rel[2]) / DEG, el = Math.asin(clamp(rel[1] / DOME.R, -1, 1)) / DEG;
    const b = domeBasis(az, el);
    orientOnDome(weaver.group, az, el, b.north.clone().negate(), DOME.R - 0.25);
    const opening = 1 - Math.min(1, game.weaverOpenIn(w) / 0.6);
    weaver.lid.rotation.x = Math.PI / 2 + (w.open ? 1.6 : opening * 0.6);
    weaver.eyes.forEach(e => { e.visible = w.open || opening > 0.5; });
    weaver.shell.visible = !w.open;
    weaver.shell.material.opacity = 0.12 + 0.06 * Math.sin(time * 4);
    weaver.mat.emissive.set(flashBoss > 0 ? '#ffffff' : w.open ? '#3a2a8a' : '#2a1060');
    weaver.legs.forEach(({ pivot, side, i }) => { pivot.rotation.y = Math.sin(time * 3 + i + side) * 0.2; });
  }
}

// partículas do ambiente: vagalumes, brilhos de cristal e chuva
function ambient(dt) {
  const w = LEVELS[level].world;
  if (w === 0) {
    if (Math.random() < dt * 14) { const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 6; particles.spawn(Math.cos(a) * r, 0.3 + Math.random() * 2.5, Math.sin(a) * r, (Math.random() - 0.5) * 0.3, 0.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.3, 2 + Math.random() * 2, 0.05, Math.random() < 0.7 ? '#d4ff5a' : '#ffe45a', -0.02); }
  } else if (w === 1) {
    if (Math.random() < dt * 10) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6; particles.spawn(Math.cos(a) * r, 0.2 + Math.random() * 3, Math.sin(a) * r, 0, 0.05, 0, 1 + Math.random(), 0.06, ['#5ad8ff', '#ff5ab8', '#b88aff'][Math.floor(Math.random() * 3)], 0); }
  } else {
    for (let k = 0; k < 3; k++) if (Math.random() < dt * 30) { const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 7; particles.spawn(Math.cos(a) * r, 6, Math.sin(a) * r, 0.3, -7, 0, 0.9, 0.03, '#8ab0ff', 0); }
  }
}

// ---------- Botão de VR ----------
const vrBtn = document.getElementById('vr');
async function setupVR() {
  const okXR = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!okXR) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) {
      vrBtn.textContent = 'Erro ao entrar em VR';
      console.error(err);
    }
  };
}
setupVR();

// ---------- Laço principal ----------
let acc = 0, lastT = performance.now(), time = 0;
let fpsFrames = 0, fpsTime = 0;
const later = [];
const _lf = new THREE.Vector3(), _lu = new THREE.Vector3();

function tick(dt) {
  time += dt;
  const vr = renderer.xr.isPresenting;
  if (recenterIn > 0 && --recenterIn === 0) recenter();
  pollButtons();
  rig.updateMatrixWorld(true);
  updatePcCamera(dt);
  camera.updateMatrixWorld(true);

  const running = app === 'playing' || app === 'done' || app === 'menu' || app === 'initials';
  if (running) {
    acc += dt;
    const n = Math.min(12, Math.floor(acc / DT));
    for (let i = 0; i < n; i++) {
      lastInput = buildInput();
      game.step(lastInput);
      handleEvents(game.events);
    }
    acc -= n * DT;
    if (n === 0 && !(dev.autoplay || demo) && app === 'playing') lastInput = renderer.xr.isPresenting ? vrInput() : pcInput();
    if (demo && game.over) newGame(Math.floor(Math.random() * LEVELS.length), { seed: Math.floor(Math.random() * 1e6) });
  } else acc = 0;
  if (app === 'playing' && doneTimer > 0) { doneTimer -= dt; if (doneTimer <= 0) finishLevel(); }
  for (let i = later.length - 1; i >= 0; i--) if (time >= later[i].t) { const f = later[i].fn; later.splice(i, 1); f(); }

  // visual
  const ahead = app === 'paused' ? 0 : acc;
  drawGame(ahead, app === 'paused' ? 0 : dt);
  placeSlings(vr);
  placeReticles(vr);
  if (app !== 'paused') {
    for (const s of game.shots) particles.spawn(s.p[0], s.p[1], s.p[2], 0, 0, 0, 0.18, 0.03, HAND_COLOR[s.hand], 0);
    ambient(dt);
    particles.update(dt);
  }
  particles.mat.uniforms.uScale.value = vr ? 800 : renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  world.update(app === 'paused' ? 0 : dt, time);
  updateHud(dt);
  updateMenuRays();

  if (sfx.ctx) {
    const hq = xrHeadQuat();
    sfx.setListener(xrHeadPos(), _lf.set(0, 0, -1).applyQuaternion(hq), _lu.set(0, 1, 0).applyQuaternion(hq));
  }

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
  }
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  tick(dt);
  renderer.render(scene, camera);
}

// ---------- Depuração (console do navegador) ----------
// dev.loadLevel(5)      abre a fase 5 (1 a 12)
// dev.autoplay = true   o robô joga (limites humanos)
// dev.advance(20)       avança 20 s de jogo na hora, sem esperar a animação
// dev.state()           resumo: tela, fase, vidas, pontos, lacraias, inimigos, chefe
// dev.snapshot()        imagem da tela (JPEG em data URL)
// dev.arcade()          começa o fliperama
// dev.resetSave()       apaga progresso e recordes
const dev = {
  _auto: false,
  get autoplay() { return this._auto; },
  set autoplay(v) { this._auto = !!v; robot.reset(); updateHint(); },
  loadLevel(n) { startLevel(clamp(n, 1, LEVELS.length) - 1, 'level'); return this.state(); },
  arcade() { startArcade(); return this.state(); },
  advance(sec, step = 1 / 72) {
    const frames = Math.round(sec / step);
    for (let i = 0; i < frames; i++) tick(step);
    lastT = performance.now();
    renderer.render(scene, camera);
    return this.state();
  },
  state() {
    return {
      tela: app, modo: mode, fase: level + 1, nome: LEVELS[level].name, mundo: WORLDS[LEVELS[level].world].name, arco: game.arc,
      tempo: +game.t.toFixed(1), vidas: game.lives, pontos: game.score, fliperama: mode === 'arcade' ? arcade.score : null,
      lacraias: game.chains.map(c => ({ gomos: c.segs.length, cabeca: [c.segs[0].col, c.segs[0].row], velocidade: c.speed, rainha: c.queen || undefined, dragao: c.dragon || undefined })),
      faltam: game.left, onda: `${game.wave} de ${game.waves.length}`, cogumelos: game.mush.size,
      aranha: game.spider ? +(game.spider.t / SPIDER.dur).toFixed(2) : null, pulga: !!game.flea, escorpiao: !!game.scorp,
      chefe: game.weaver ? { vida: game.weaver.hp, aberta: game.weaver.open } : null,
      resultado: game.result, salvo: save.done[level] || null,
    };
  },
  snapshot(w = 960) {
    renderer.render(scene, camera);
    const src = renderer.domElement, c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * src.height / src.width);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  },
  resetSave() { save.done = {}; save.scores = []; storeSave(save); },
};
window.dev = dev;
window.lacraia = { dev, get game() { return game; }, save, sfx, robot, startLevel, startArcade, goMenu, camera, scene, renderer, view };

goMenu();
renderer.setAnimationLoop(frame);
