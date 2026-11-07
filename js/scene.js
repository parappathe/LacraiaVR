// Cena 3D: o céu de cada mundo (cúpula pintada em canvas, chão e cenário em volta), a faixa onde
// a lacraia anda, o letreiro do placar, gomos, cogumelos e teias instanciados, aranha, pulga,
// escorpião, chefes, tiros, estilingues e partículas.
// Desempenho de Quest: sem sombras, sem pós-processamento, coisas repetidas em InstancedMesh e
// partículas num só Points.
import * as THREE from '../vendor/three/three.module.js';
import { DOME, BITE_ROW, elOf, domePos } from './sim.js';

const DEG = Math.PI / 180;

// ---------- temas dos mundos ----------
export const THEMES = [
  { // Jardim de Vagalumes: noite azul-esverdeada, capim alto, flores gigantes e vagalumes
    name: 'jardim', sky: ['#020814', '#0a2a3a', '#1a4a3a'], fog: '#06141a', bg: '#020814',
    hemi: ['#a8d8ff', '#1a3a20', 1.25], sun: ['#d8f0ff', 0.9], ground: ['#1a3a1c', '#26502a'],
    seg: ['#7aff5a', '#ffe45a'], head: '#ff8a3a', mush: ['#5affd8', '#ff7ae0', '#ffd25a'], poison: '#b04aff',
    accent: '#d4ff5a', accent2: '#5affd8', edge: '#5aff8a',
  },
  { // Gruta de Cristal: rocha roxa, cristais que brilham, estalactites
    name: 'gruta', sky: ['#0a0418', '#24123a', '#3a1a4a'], fog: '#0c0618', bg: '#0a0418',
    hemi: ['#d0b8ff', '#201030', 1.3], sun: ['#e0d0ff', 0.8], ground: ['#2a1e38', '#3a2a4a'],
    seg: ['#5ad8ff', '#ff5ab8'], head: '#ffe45a', mush: ['#9a7aff', '#5ad8ff', '#ff9ad8'], poison: '#5aff6a',
    accent: '#ff5ab8', accent2: '#5ad8ff', edge: '#b88aff',
  },
  { // Céu de Tempestade: nuvens pesadas, raios, chão de nuvem
    name: 'tempestade', sky: ['#04060c', '#141c2e', '#2a3448'], fog: '#0a0e18', bg: '#04060c',
    hemi: ['#c0d0ff', '#1a1e2a', 1.35], sun: ['#e8f0ff', 1.0], ground: ['#3a4256', '#4a5468'],
    seg: ['#ff5a5a', '#ffb83a'], head: '#5af0ff', mush: ['#e8f0ff', '#8ad0ff', '#ffe45a'], poison: '#ff3aa8',
    accent: '#5af0ff', accent2: '#ffe45a', edge: '#8ab0ff',
  },
];

// ---------- texturas desenhadas no canvas ----------
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (() => { let s = 4321; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

// céu equiretangular: gradiente, estrelas e o que for do mundo (nuvens, rochas, flores ao longe)
function skyTexture(th) {
  return canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.45, th.sky[1]); gr.addColorStop(0.62, th.sky[2]); gr.addColorStop(1, th.sky[0]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (th.name === 'jardim') {
      for (let i = 0; i < 1400; i++) { const y = rnd() * h * 0.55; g.fillStyle = `rgba(255,255,240,${0.2 + rnd() * 0.8})`; g.fillRect(rnd() * w, y, rnd() < 0.08 ? 3 : 1.5, rnd() < 0.08 ? 3 : 1.5); }
      // lua e via láctea
      g.fillStyle = '#fff8d8'; g.beginPath(); g.arc(w * 0.62, h * 0.18, 34, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,248,216,0.12)'; g.beginPath(); g.arc(w * 0.62, h * 0.18, 70, 0, 7); g.fill();
      for (let i = 0; i < 900; i++) { const x = rnd() * w, y = h * 0.25 + Math.sin(x / w * Math.PI * 2) * h * 0.1 + (rnd() - 0.5) * 60; g.fillStyle = `rgba(200,255,230,${rnd() * 0.25})`; g.fillRect(x, y, 2, 2); }
      // morros e árvores no horizonte
      g.fillStyle = '#04120c';
      g.beginPath(); g.moveTo(0, h * 0.6);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.56 - Math.abs(Math.sin(x * 0.004) * 50) - Math.abs(Math.sin(x * 0.017)) * 18);
      g.lineTo(w, h); g.lineTo(0, h); g.fill();
    } else if (th.name === 'gruta') {
      // rocha com veios e cristais cintilando
      for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${120 + rnd() * 80},${60 + rnd() * 60},${160 + rnd() * 80},0.12)`; g.lineWidth = 2 + rnd() * 6; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.bezierCurveTo(x + 60, y + 20, x + 100, y - 30, x + 180, y + 10); g.stroke(); }
      for (let i = 0; i < 500; i++) { const x = rnd() * w, y = rnd() * h * 0.8; const c = ['#5ad8ff', '#ff5ab8', '#b88aff', '#ffffff'][i % 4]; g.fillStyle = c; g.globalAlpha = 0.3 + rnd() * 0.6; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 2, y); g.lineTo(x, y + 5); g.lineTo(x - 2, y); g.fill(); }
      g.globalAlpha = 1;
      // estalactites penduradas no alto
      g.fillStyle = '#140a24';
      for (let x = 0; x < w; x += 22 + rnd() * 30) { const l = 30 + rnd() * 110; g.beginPath(); g.moveTo(x - 10, 0); g.lineTo(x, l); g.lineTo(x + 10, 0); g.fill(); }
    } else {
      // nuvens pesadas em camadas
      for (let i = 0; i < 400; i++) { const x = rnd() * w, y = h * (0.05 + rnd() * 0.55), r = 30 + rnd() * 110; const v = 30 + rnd() * 50; g.fillStyle = `rgba(${v},${v + 8},${v + 26},0.18)`; g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.7, 0, 0, 7); g.fill(); }
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(220,230,255,${rnd() * 0.5})`; g.fillRect(rnd() * w, rnd() * h * 0.5, 1.5, 1.5); }
      // brilho de raio distante
      for (let k = 0; k < 5; k++) { const x = rnd() * w, y = h * 0.4; const gl = g.createRadialGradient(x, y, 0, x, y, 160); gl.addColorStop(0, 'rgba(160,190,255,0.25)'); gl.addColorStop(1, 'rgba(160,190,255,0)'); g.fillStyle = gl; g.fillRect(x - 160, y - 160, 320, 320); }
    }
  });
}

function groundTexture(th) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = th.ground[0]; g.fillRect(0, 0, w, h);
    if (th.name === 'jardim') {
      for (let i = 0; i < 2600; i++) { g.strokeStyle = rnd() < 0.5 ? th.ground[1] : '#0e2410'; g.lineWidth = 1.5; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y - 6 - rnd() * 8); g.stroke(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = ['#ff7ae0', '#ffd25a', '#ffffff'][i % 3]; g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 2, 0, 7); g.fill(); }
    } else if (th.name === 'gruta') {
      for (let i = 0; i < 70; i++) { g.fillStyle = rnd() < 0.5 ? th.ground[1] : '#1e142a'; g.beginPath(); const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 40; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; g.lineTo(x + Math.cos(a) * r * (0.7 + rnd() * 0.5), y + Math.sin(a) * r * (0.7 + rnd() * 0.5)); } g.fill(); }
      for (let i = 0; i < 160; i++) { g.fillStyle = ['#5ad8ff', '#ff5ab8'][i % 2]; g.globalAlpha = 0.5; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      g.globalAlpha = 1;
    } else {
      for (let i = 0; i < 160; i++) { const v = 70 + rnd() * 70; g.fillStyle = `rgba(${v},${v + 6},${v + 22},0.3)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 50, 10 + rnd() * 26, 0, 0, 7); g.fill(); }
    }
  }, [3, 3]);
}

function capTexture() {   // chapéu do cogumelo em tons de cinza (a cor vem de cada instância)
  return canvasTex(128, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#9a9a9a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(8 + (i * 37) % w, 10 + (i * 23) % (h * 0.6), 6, 4, 0, 0, 7); g.fill(); }
  });
}
function segTexture() {   // listras do gomo
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, 6, w, 5);
  });
}
function webTexture() {
  return canvasTex(128, 128, (g, w) => {
    g.strokeStyle = 'rgba(230,250,255,0.95)'; g.lineWidth = 2;
    const c = w / 2;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 62, c + Math.sin(a) * 62); g.stroke(); }
    for (let r = 12; r < 62; r += 12) { g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI * 2; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.stroke(); }
  });
}
export function glowTexture() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

// base de orientação num ponto da cúpula: out (para fora), east (az crescendo), north (para cima)
const _o = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3();
export function domeBasis(az, el) {
  const a = az * DEG, e = el * DEG;
  _o.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  _e.set(Math.cos(a), 0, Math.sin(a));
  _n.crossVectors(_e, _o);   // aponta para cima pela cúpula
  return { out: _o, east: _e, north: _n };
}

// ---------- mundo ----------
export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#000', 12, 40);
  const hemi = new THREE.HemisphereLight('#fff', '#333', 1.3);
  const sun = new THREE.DirectionalLight('#fff', 1.0);
  sun.position.set(0.5, 3, 1.5);
  scene.add(hemi, sun);
  const glowTex = glowTexture();
  const C = new THREE.Vector3(...DOME.c);

  const themes = THEMES.map((th) => {
    const g = new THREE.Group();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), new THREE.MeshBasicMaterial({ map: skyTexture(th), side: THREE.BackSide, fog: false, toneMapped: false }));
    sky.position.set(0, 1.4, 0);
    g.add(sky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshLambertMaterial({ map: groundTexture(th) }));
    ground.rotation.x = -Math.PI / 2;
    g.add(ground);
    // tapetinho onde o jogador fica
    const mat = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: th.accent, transparent: true, opacity: 0.5, toneMapped: false }));
    mat.rotation.x = -Math.PI / 2; mat.position.y = 0.01;
    g.add(mat);
    const dummy = new THREE.Object3D();
    if (th.name === 'jardim') {
      // capim alto em volta e flores gigantes fora da cúpula
      const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 1, 4), new THREE.MeshLambertMaterial({ color: '#1e5a2a' }), 420);
      for (let i = 0; i < 420; i++) {
        const a = rnd() * Math.PI * 2, r = 5.4 + rnd() * 6;
        dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        const hgt = 0.3 + rnd() * 0.7; dummy.scale.set(1, hgt, 1); dummy.position.y = hgt / 2;
        dummy.rotation.set((rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3);
        dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix);
      }
      g.add(blades);
      const stemM = new THREE.MeshLambertMaterial({ color: '#2a6a2a' });
      const petalCols = ['#ff7ae0', '#ffd25a', '#7ad8ff', '#ff9a5a'];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + 0.3, r = 8 + (k % 3) * 1.6, hgt = 3 + (k % 4) * 0.9;
        const f = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, hgt, 6), stemM); stem.position.y = hgt / 2; f.add(stem);
        const petM = new THREE.MeshBasicMaterial({ color: petalCols[k % 4], toneMapped: false });
        for (let p = 0; p < 6; p++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 6), petM); pt.scale.set(1, 0.25, 0.55); const pa = p / 6 * Math.PI * 2; pt.position.set(Math.cos(pa) * 0.45, hgt, Math.sin(pa) * 0.45); pt.rotation.y = -pa; f.add(pt); }
        const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff4a0', toneMapped: false })); ctr.position.y = hgt; f.add(ctr);
        f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        f.lookAt(0, hgt, 0); f.rotateX(-0.5);
        g.add(f);
      }
    } else if (th.name === 'gruta') {
      // estalagmites e cristais que brilham em volta
      const rockM = new THREE.MeshLambertMaterial({ color: '#2a1e3a', flatShading: true });
      const rocks = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1, 6), rockM, 60);
      for (let i = 0; i < 60; i++) {
        const a = rnd() * Math.PI * 2, r = 8 + rnd() * 6, hgt = 0.6 + rnd() * 1.6;
        dummy.position.set(Math.cos(a) * r, hgt / 2, Math.sin(a) * r); dummy.scale.set(0.6 + rnd(), hgt, 0.6 + rnd()); dummy.rotation.set(0, rnd() * 3, 0);
        dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
      }
      g.add(rocks);
      const crys = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), 90);
      const cc = new THREE.Color();
      for (let i = 0; i < 90; i++) {
        const a = rnd() * Math.PI * 2, r = 5.2 + rnd() * 7;
        dummy.position.set(Math.cos(a) * r, 0.1 + rnd() * 0.2, Math.sin(a) * r); dummy.scale.set(0.4 + rnd() * 0.5, 0.8 + rnd() * 1.2, 0.4 + rnd() * 0.5); dummy.rotation.set((rnd() - 0.5) * 0.8, rnd() * 3, (rnd() - 0.5) * 0.8);
        dummy.updateMatrix(); crys.setMatrixAt(i, dummy.matrix);
        crys.setColorAt(i, cc.set(['#5ad8ff', '#ff5ab8', '#b88aff'][i % 3]));
      }
      g.add(crys);
      g.userData.crys = crys;
    } else {
      // mar de nuvens em volta e para-raios
      const puffM = new THREE.MeshLambertMaterial({ color: '#4a5468', transparent: true, opacity: 0.92 });
      const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), puffM, 120);
      for (let i = 0; i < 120; i++) {
        const a = rnd() * Math.PI * 2, r = 5.6 + rnd() * 8;
        dummy.position.set(Math.cos(a) * r, -0.2 + rnd() * 0.5, Math.sin(a) * r); const s = 0.8 + rnd() * 1.8; dummy.scale.set(s * 1.6, s * 0.6, s);
        dummy.rotation.set(0, rnd() * 3, 0); dummy.updateMatrix(); puffs.setMatrixAt(i, dummy.matrix);
      }
      g.add(puffs);
      g.userData.puffs = puffs;
      const rodM = new THREE.MeshLambertMaterial({ color: '#8a90a0' });
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2 + 0.8, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 4, 6), rodM);
        rod.position.set(Math.cos(a) * 7, 2, Math.sin(a) * 7); g.add(rod);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#5af0ff', toneMapped: false })); tip.position.set(Math.cos(a) * 7, 4.05, Math.sin(a) * 7); g.add(tip);
      }
    }
    g.visible = false;
    scene.add(g);
    return g;
  });

  // ---------- faixa da cúpula: bordas do arco e a linha da mordida ----------
  const field = new THREE.Group();
  scene.add(field);
  const edgeM = new THREE.MeshBasicMaterial({ color: '#5aff8a', transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false });
  const biteM = new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false });
  const topM = new THREE.MeshBasicMaterial({ color: '#5aff8a', transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false });
  function arcLine(az0, az1, el, m, w = 0.035) {
    const pts = [];
    const n = Math.max(8, Math.round(Math.abs(az1 - az0) / 3));
    for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(...domePos(az0 + (az1 - az0) * i / n, el, DOME.R + 0.02)));
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, w, 5, false), m);
  }
  function meridian(az, el0, el1, m) {
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(...domePos(az, el0 + (el1 - el0) * i / 12, DOME.R + 0.02)));
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.04, 5, false), m);
  }
  let fieldKey = '';
  function setField(arc) {
    if (fieldKey === arc) return;
    fieldKey = arc;
    for (const c of field.children.slice()) { c.geometry.dispose(); field.remove(c); }
    const full = arc >= 360;
    const a0 = full ? -180 : -arc / 2, a1 = full ? 180 : arc / 2;
    const elBite = elOf(BITE_ROW - 0.5), elTop = elOf(-0.5);
    field.add(arcLine(a0, a1, elBite, biteM, 0.03));
    field.add(arcLine(a0, a1, elTop, topM, 0.02));
    if (!full) { field.add(meridian(a0, elBite, elTop, edgeM)); field.add(meridian(a1, elBite, elTop, edgeM)); }
  }

  // ---------- letreiro do placar: um console aos pés do jogador, inclinado para ele ----------
  const marquee = new THREE.Group();
  const W = 1.5;
  const frameM = new THREE.MeshLambertMaterial({ color: '#141c2a' });
  marquee.add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.36, 0.08), frameM));
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024; boardCanvas.height = 128;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.3), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  board.position.z = 0.041;
  marquee.add(board);
  const NB = 30;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), NB);
  for (let k = 0; k < NB; k++) {
    const m = new THREE.Matrix4();
    if (k < 14) m.setPosition(-W / 2 + 0.06 + k * (W - 0.12) / 13, 0.17, 0.05);
    else if (k < 28) m.setPosition(W / 2 - 0.06 - (k - 14) * (W - 0.12) / 13, -0.17, 0.05);
    else m.setPosition((k === 28 ? -1 : 1) * (W / 2 - 0.02), 0, 0.05);
    bulbs.setMatrixAt(k, m);
    bulbs.setColorAt(k, new THREE.Color('#d4ff5a'));
  }
  marquee.add(bulbs);
  const legM = new THREE.MeshLambertMaterial({ color: '#141c2a' });
  for (const x of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), legM); leg.position.set(x, -0.4, -0.05); leg.rotation.x = -0.9; marquee.add(leg); }
  marquee.position.set(0, 0.55, -1.35);
  marquee.rotation.x = -0.9;
  scene.add(marquee);

  // relâmpago (Céu de Tempestade)
  const boltM = new THREE.LineBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0, toneMapped: false });
  const boltGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 10 }, () => new THREE.Vector3()));
  const boltLine = new THREE.Line(boltGeo, boltM);
  boltLine.frustumCulled = false;
  scene.add(boltLine);

  let cur = -1, flashT = 0;
  const world = {
    scene, themes, marquee, glowTex, field,
    setTheme(i, arc) {
      setField(arc);
      if (i === cur) return;
      cur = i;
      const th = THEMES[i];
      themes.forEach((g, k) => { g.visible = k === i; });
      scene.background = new THREE.Color(th.bg);
      scene.fog.color.set(th.fog);
      hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
      sun.color.set(th.sun[0]); sun.intensity = th.sun[1];
      edgeM.color.set(th.edge); topM.color.set(th.edge);
    },
    get theme() { return THEMES[cur]; },
    // raio: linha em zigue-zague até o ponto e um clarão na luz
    lightning(p) {
      const pos = boltGeo.attributes.position;
      const top = new THREE.Vector3(p[0] * 2.2, 14, p[2] * 2.2), end = new THREE.Vector3(...p);
      for (let k = 0; k < 10; k++) {
        const f = k / 9;
        const v = top.clone().lerp(end, f);
        if (k > 0 && k < 9) v.add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9));
        pos.setXYZ(k, v.x, v.y, v.z);
      }
      pos.needsUpdate = true;
      flashT = 0.35;
    },
    update(dt, time) {
      const g = themes[cur];
      flashT = Math.max(0, flashT - dt);
      boltM.opacity = flashT > 0 ? Math.min(1, flashT * 5) * (Math.sin(time * 90) > -0.3 ? 1 : 0.2) : 0;
      if (cur >= 0) hemi.intensity = THEMES[cur].hemi[2] + flashT * 4;
      if (g?.userData.crys) g.userData.crys.material.color.setScalar(0.75 + 0.25 * Math.sin(time * 1.3));
      if (g?.userData.puffs) g.userData.puffs.rotation.y = time * 0.01;
      const c = new THREE.Color();
      for (let k = 0; k < NB; k++) {
        const on = (Math.floor(time * 6) + k) % 3 === 0;
        c.set(on ? THEMES[cur]?.accent || '#d4ff5a' : '#1a2a2a');
        bulbs.setColorAt(k, c);
      }
      bulbs.instanceColor.needsUpdate = true;
    },
    board: { last: '' },
    setBoard(lines) {
      const key = JSON.stringify(lines);
      if (key === this.board.last) return;
      this.board.last = key;
      const g = boardCanvas.getContext('2d'), w = 1024, h = 128;
      g.fillStyle = '#04080e'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 4; x < w; x += 8) for (let y = 4; y < h; y += 8) g.fillRect(x, y, 3, 3);
      g.textBaseline = 'middle';
      for (const l of lines) {
        g.font = `bold ${l.size || 54}px monospace`;
        g.textAlign = l.align || 'left';
        g.fillStyle = l.color || '#d4ff5a';
        g.shadowColor = l.color || '#d4ff5a'; g.shadowBlur = 12;
        g.fillText(l.text, l.x, l.y ?? h / 2);
      }
      g.shadowBlur = 0;
      boardTex.needsUpdate = true;
    },
  };
  void C;
  return world;
}

// ---------- gomos das lacraias ----------
// items: [{ az, el, fwd: Vector3 (direção do movimento), head, color, eye, crown, glow }]
export class SegView {
  constructor(scene, cap = 160) {
    this.cap = cap;
    this.body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 16, 10), new THREE.MeshLambertMaterial({ map: segTexture() }), cap);
    this.legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.035, 0.035), new THREE.MeshLambertMaterial({ color: '#1a1410' }), cap);
    this.eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 80);
    this.pupils = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#000000' }), 80);
    this.antenna = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 4), new THREE.MeshLambertMaterial({ color: '#1a1410' }), 80);
    for (const m of [this.body, this.legs, this.eyes, this.pupils, this.antenna]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); }
    this.body.setColorAt(0, new THREE.Color());
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.c = new THREE.Color();
    this.X = new THREE.Vector3(); this.Y = new THREE.Vector3(); this.Z = new THREE.Vector3(); this.tmp = new THREE.Vector3();
  }
  basis(it) {
    const b = domeBasis(it.az, it.el);
    this.Y.copy(b.out).negate();                 // para dentro (para o jogador)
    this.Z.copy(it.fwd).addScaledVector(this.Y, -it.fwd.dot(this.Y));
    if (this.Z.lengthSq() < 1e-6) this.Z.copy(b.east);
    this.Z.normalize();
    this.X.crossVectors(this.Y, this.Z);
    this.m.makeBasis(this.X, this.Y, this.Z);
    return b;
  }
  update(items, time) {
    let n = 0, ne = 0, na = 0;
    for (const it of items) {
      if (n >= this.cap) break;
      this.p.set(...domePos(it.az, it.el, DOME.R - 0.02));
      this.basis(it);
      const r = it.head ? 1.18 : 1;
      const wob = 1 + 0.06 * Math.sin(time * 10 + n * 0.9);
      this.m.scale(this.s.set(r * wob, r * 0.85, r / wob));
      this.m.setPosition(this.p);
      this.body.setMatrixAt(n, this.m);
      this.c.set(it.color);
      if (it.glow) this.c.lerp(new THREE.Color('#ffffff'), it.glow);
      this.body.setColorAt(n, this.c);
      // perninhas que mexem
      this.basis(it);
      this.tmp.copy(this.Z).multiplyScalar(0.05 * Math.sin(time * 16 + n * 1.3));
      this.m.setPosition(this.tmp.add(this.p).addScaledVector(this.Y, -0.02));
      this.legs.setMatrixAt(n, this.m);
      if (it.head && ne < 78) {
        for (const sx of [-1, 1]) {
          this.tmp.copy(this.p).addScaledVector(this.Y, 0.15).addScaledVector(this.Z, 0.1).addScaledVector(this.X, sx * 0.09);
          this.m.identity().setPosition(this.tmp); this.eyes.setMatrixAt(ne, this.m);
          this.tmp.addScaledVector(this.Y, 0.04).addScaledVector(this.Z, 0.01);
          this.m.identity().setPosition(this.tmp); this.pupils.setMatrixAt(ne, this.m);
          ne++;
          // antenas
          this.basis(it);
          const tilt = new THREE.Quaternion().setFromAxisAngle(this.X, 0.9 + 0.15 * Math.sin(time * 8 + sx));
          const q = new THREE.Quaternion().setFromRotationMatrix(this.m).premultiply(tilt);
          this.tmp.copy(this.p).addScaledVector(this.Z, 0.2).addScaledVector(this.X, sx * 0.07).addScaledVector(this.Y, 0.05);
          this.m.compose(this.tmp, q, this.s.set(1, 1, 1));
          this.antenna.setMatrixAt(na++, this.m);
        }
      }
      n++;
    }
    this.body.count = this.legs.count = n;
    this.eyes.count = this.pupils.count = ne;
    this.antenna.count = na;
    for (const m of [this.body, this.legs, this.eyes, this.pupils, this.antenna]) m.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }
}

// ---------- cogumelos e teias ----------
export class MushView {
  constructor(scene, cap = 260) {
    this.cap = cap;
    const capGeo = new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.scale(1, 0.7, 1); capGeo.translate(0, 0.08, 0);
    this.caps = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ map: capTexture(), toneMapped: false }), cap);
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.16, 8); stemGeo.translate(0, 0.0, 0);
    this.stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshLambertMaterial({ color: '#e8e0c8', emissive: '#403a30' }), cap);
    this.webs = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 40);
    for (const m of [this.caps, this.stems, this.webs]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); }
    this.caps.setColorAt(0, new THREE.Color());
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.c = new THREE.Color();
    this.up = new THREE.Vector3(0, 1, 0); this.Y = new THREE.Vector3();
    this.flash = new Map();
  }
  hit(id) { this.flash.set(id, 0.15); }
  update(list, game, theme, dt, time) {
    let n = 0, nw = 0;
    for (const [id, t] of this.flash) { if (t - dt <= 0) this.flash.delete(id); else this.flash.set(id, t - dt); }
    for (const m of list) {
      const az = game.azOf(m.col), el = elOf(m.row);
      const b = domeBasis(az, el);
      this.Y.copy(b.out).negate();
      if (m.web) {
        if (nw >= 40) continue;
        this.p.set(...domePos(az, el, DOME.R - 0.02));
        this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.Y);
        this.m.compose(this.p, this.q, this.s.set(1, 1, 1));
        this.webs.setMatrixAt(nw++, this.m);
        continue;
      }
      if (n >= this.cap) continue;
      const k = (0.55 + 0.45 * m.hp / m.maxHp) * (this.flash.has(m.id) ? 1.25 : 1);
      // em pé na cúpula: o cabo aponta para cima pela superfície, o perfil fica virado para o jogador
      this.p.set(...domePos(az, el, DOME.R - 0.06)).addScaledVector(b.north, -0.06 * k);
      this.m.makeBasis(b.east, b.north, b.out.clone().negate());
      this.q.setFromRotationMatrix(this.m);
      this.m.compose(this.p, this.q, this.s.set(k, k, k));
      this.caps.setMatrixAt(n, this.m);
      this.stems.setMatrixAt(n, this.m);
      const base = m.poison ? theme.poison : theme.mush[(m.col * 7 + m.row * 3) % theme.mush.length];
      this.c.set(base).multiplyScalar(0.8 + 0.2 * Math.sin(time * 2 + m.col + m.row * 1.7));
      if (m.poison) this.c.lerp(new THREE.Color('#000000'), 0.25 + 0.25 * Math.sin(time * 6 + m.col));
      if (this.flash.has(m.id)) this.c.set('#ffffff');
      this.caps.setColorAt(n, this.c);
      n++;
    }
    this.caps.count = this.stems.count = n;
    this.webs.count = nw;
    for (const m of [this.caps, this.stems, this.webs]) m.instanceMatrix.needsUpdate = true;
    if (this.caps.instanceColor) this.caps.instanceColor.needsUpdate = true;
  }
}

// ---------- bichos ----------
function orientOnDome(obj, az, el, fwd, r = DOME.R - 0.05) {
  const b = domeBasis(az, el);
  const Y = b.out.clone().negate();
  const Z = (fwd ? fwd.clone() : b.east.clone()).addScaledVector(Y, -(fwd ? fwd.dot(Y) : 0));
  if (Z.lengthSq() < 1e-6) Z.copy(b.east);
  Z.normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  obj.position.set(...domePos(az, el, r));
}
export { orientOnDome };

export function buildSpider() {
  const g = new THREE.Group();
  const furM = new THREE.MeshLambertMaterial({ color: '#3a2a4a' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), furM); body.scale.set(1, 0.7, 1.2); body.position.z = -0.12; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), furM); head.position.z = 0.16; g.add(head);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), new THREE.MeshBasicMaterial({ color: '#ff3a8a', toneMapped: false })); back.position.set(0, 0.13, -0.14); back.scale.set(1, 0.4, 1.4); g.add(back);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#ff3a3a', toneMapped: false });
  for (const [x, y] of [[-0.05, 0.08], [0.05, 0.08], [-0.09, 0.04], [0.09, 0.04]]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), eyeM); e.position.set(x, y, 0.27); g.add(e); }
  const legs = [];
  for (let k = 0; k < 8; k++) {
    const side = k < 4 ? -1 : 1, i = k % 4;
    const pivot = new THREE.Group(); pivot.position.set(side * 0.12, 0, 0.1 - i * 0.1);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.42, 5), furM);
    leg.rotation.z = side * 1.1; leg.position.set(side * 0.18, 0.06, 0);
    pivot.add(leg); g.add(pivot); legs.push({ pivot, side, i });
  }
  return { group: g, legs };
}

export function buildFlea() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#c8a03a' });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), m); b.scale.set(0.8, 1, 1.3); g.add(b);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 16), new THREE.MeshBasicMaterial({ color: '#ffe45a', toneMapped: false })); stripe.rotation.y = Math.PI / 2; g.add(stripe);
  const legM = new THREE.MeshLambertMaterial({ color: '#4a3a1a' });
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.3, 4), legM); l.position.set(sx * 0.12, 0.05, -0.08); l.rotation.set(0.9, 0, sx * 0.4); g.add(l); }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff5a3a', toneMapped: false })); eye.position.set(0, 0.06, 0.15); g.add(eye);
  return { group: g };
}

export function buildScorpion() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#6a2a8a' });
  const glow = new THREE.MeshBasicMaterial({ color: '#c05aff', toneMapped: false });
  for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12 - k * 0.015, 10, 8), m); s.position.z = 0.1 - k * 0.15; s.scale.set(1.2, 0.6, 1); g.add(s); }
  const tail = [];
  for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m); g.add(s); tail.push(s); }
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), glow); g.add(sting);
  for (const sx of [-1, 1]) { const cl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m); cl.position.set(sx * 0.14, 0, 0.28); cl.scale.set(1, 0.6, 1.5); g.add(cl); }
  return { group: g, tail, sting };
}

// Rainha: coroa que vai em cima da cabeça
export function buildCrown() {
  const g = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: '#ffd24a', emissive: '#a07000', emissiveIntensity: 0.6 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 14, 1, true), gold); g.add(band);
  for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), gold); const a = k / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.16, 0.09, Math.sin(a) * 0.16); g.add(sp); }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: '#ff3a8a', toneMapped: false })); gem.position.set(0, 0.03, 0.17); g.add(gem);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  shield.position.y = -0.18; g.add(shield);
  return { group: g, shield, gold };
}

// Tecelã de Cristal: aranhona de cristal com olhos que abrem
export function buildWeaver() {
  const g = new THREE.Group();
  const crysM = new THREE.MeshLambertMaterial({ color: '#8a6ad8', flatShading: true, emissive: '#2a1060' });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), crysM); body.scale.set(1, 0.7, 1.2); body.position.z = -0.25; g.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), crysM); head.position.z = 0.22; g.add(head);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#5affff', toneMapped: false });
  const eyes = [];
  for (const [x, y] of [[-0.1, 0.14], [0.1, 0.14], [-0.18, 0.06], [0.18, 0.06], [0, 0.2]]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeM); e.position.set(x, y, 0.44); g.add(e); eyes.push(e); }
  const lidM = new THREE.MeshLambertMaterial({ color: '#4a3a7a', flatShading: true });
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lidM); lid.position.set(0, 0.02, 0.24); lid.rotation.x = Math.PI / 2; g.add(lid);
  const legs = [];
  for (let k = 0; k < 8; k++) {
    const side = k < 4 ? -1 : 1, i = k % 4;
    const pivot = new THREE.Group(); pivot.position.set(side * 0.25, 0, 0.2 - i * 0.18);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.015, 0.9, 5), crysM);
    leg.rotation.z = side * 1.0; leg.position.set(side * 0.38, 0.12, 0);
    pivot.add(leg); g.add(pivot); legs.push({ pivot, side, i });
  }
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12), new THREE.MeshBasicMaterial({ color: '#b88aff', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(shell);
  return { group: g, eyes, lid, legs, shell, mat: crysM };
}

// Dragão da Tempestade: cabeça com chifres que vai na frente dos gomos
export function buildDragonHead() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#2a3a5a', emissive: '#0a1a3a' });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), m); skull.scale.set(1, 0.8, 1.3); g.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.3), m); snout.position.set(0, -0.02, 0.32); g.add(snout);
  const hornM = new THREE.MeshLambertMaterial({ color: '#e8e0c8' });
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.36, 6), hornM); h.position.set(sx * 0.18, 0.2, -0.12); h.rotation.set(-0.9, 0, sx * -0.4); g.add(h); }
  const eyeM = new THREE.MeshBasicMaterial({ color: '#5af0ff', toneMapped: false });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeM); e.position.set(sx * 0.14, 0.18, 0.22); g.add(e); }
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), new THREE.MeshBasicMaterial({ color: '#5af0ff', toneMapped: false, transparent: true, opacity: 0.7 })); beard.position.set(0, -0.15, 0.3); beard.rotation.x = Math.PI; g.add(beard);
  return { group: g, mat: m, eyeM };
}

// ---------- tiros, estilingues, mira ----------
export class ShotView {
  constructor(scene, glowTex, cap = 24) {
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.cap = cap; this.m = new THREE.Matrix4(); this.c = new THREE.Color();
  }
  update(shots, ahead, colors) {
    let n = 0;
    for (const s of shots) {
      if (n >= this.cap) break;
      this.m.makeTranslation(s.p[0] + s.v[0] * ahead, s.p[1] + s.v[1] * ahead, s.p[2] + s.v[2] * ahead);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.c.set(colors[s.hand]));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Estilingue: forquilha em Y com elástico de luz. A frente (para onde atira) é o -z local.
export function buildSlingshot(color) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#8a5a2a' });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.11, 8), wood); handle.position.set(0, -0.05, 0.02); g.add(handle);
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.08, 6), wood); arm.position.set(sx * 0.022, 0.03, 0.0); arm.rotation.z = -sx * 0.5; g.add(arm); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  band.position.set(0, 0.065, 0.02); band.rotation.set(Math.PI / 2, 0, 0); g.add(band);
  const stone = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false })); stone.position.set(0, 0.065, 0.06); g.add(stone);
  // feixe de mira curto (ajuda a apontar)
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 1, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }));
  beam.rotation.x = Math.PI / 2; beam.position.set(0, 0.065, -0.5); g.add(beam);
  return { group: g, band, stone, beam };
}

export function buildReticle(color, glowTex) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(0.18);
  s.renderOrder = 5;
  return s;
}

// ---------- partículas ----------
export class Particles {
  constructor(scene, cap = 1600) {
    this.cap = cap;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.s0 = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute vec3 pcolor; attribute float size; attribute float alpha; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC = pcolor; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(128.0, size * uScale / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = vA * (1.0 - d * 1.8); gl_FragColor = vec4(vC * a, a); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tmp = new THREE.Color();
  }
  spawn(x, y, z, vx, vy, vz, life, size, color, grav = 4) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
    this.tmp.set(color);
    this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.life[i] = this.max[i] = life; this.s0[i] = size; this.size[i] = size; this.alpha[i] = 1; this.grav[i] = grav;
  }
  burst(p, color, n, speed, life = 0.8, size = 0.04, grav = 4) {
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(p[0], p[1], p[2], Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, life * (0.5 + Math.random() * 0.6), size * (0.5 + Math.random()), color, grav);
    }
  }
  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= this.grav[i] * dt;
      for (let j = 0; j < 3; j++) { this.v[i * 3 + j] *= 1 - 0.8 * dt; this.p[i * 3 + j] += this.v[i * 3 + j] * dt; }
      if (this.p[i * 3 + 1] < 0.01) { this.p[i * 3 + 1] = 0.01; this.v[i * 3 + 1] *= -0.3; }
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = Math.min(1, f * 2);
      this.size[i] = this.s0[i] * (0.5 + 0.5 * f);
    }
    for (const a of ['position', 'size', 'alpha', 'pcolor']) this.geo.attributes[a].needsUpdate = true;
  }
}
