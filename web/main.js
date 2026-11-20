// Browser front-end: renders the shared Sim (src/core/sim.js) with Three.js. No gameplay rules live here.
import * as THREE from 'three';
import { Sim } from '../src/core/sim.js';
import { TUNING as T, WORLD } from '../src/core/tuning.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / WORLD.tick_rate;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const FOG_DARK = new THREE.Color('#120c2a');
const FOG_WARM = new THREE.Color('#3a2a3a');
scene.background = FOG_DARK.clone();
scene.fog = new THREE.Fog(FOG_DARK.clone(), 18, 75);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight('#6a5acd', '#1a1030', 0.35);
scene.add(hemi);
const moon = new THREE.DirectionalLight('#9fb4ff', 0.35);
moon.position.set(-30, 50, 20);
scene.add(moon);

// island + cloud sea
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 3, 3, 64), new THREE.MeshStandardMaterial({ color: '#2c3b2e', roughness: 1 }));
island.position.y = -1.5;
scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(220, 48), new THREE.MeshStandardMaterial({ color: '#2a2550', roughness: 1 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -4;
scene.add(sea);
// a few rocks / bushes for orientation (decor only, deterministic layout)
for (let i = 0; i < 40; i++) {
  const a = i * 2.39996;
  const d = 8 + ((i * 37) % 30);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + (i % 3) * 0.3), new THREE.MeshStandardMaterial({ color: i % 2 ? '#3d4a3a' : '#4a4058', roughness: 1 }));
  rock.position.set(Math.sin(a) * d, 0.2, Math.cos(a) * d);
  scene.add(rock);
}

// ---------- factories ----------
function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), new THREE.MeshStandardMaterial({ color: '#4b3621' }));
  post.position.y = 1.5;
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#3a2d55', emissive: '#2a1a40', emissiveIntensity: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), bodyMat);
  body.scale.y = 1.3;
  body.position.y = 3.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 12), new THREE.MeshStandardMaterial({ color: '#7a2e1d' }));
  cap.position.y = 4.7;
  const light = new THREE.PointLight('#ffb347', 0, 22, 1.6);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(post, body, cap, light, ring);
  g.userData = { bodyMat, light, ring };
  scene.add(g);
  return g;
}

function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 1.1, 12), new THREE.MeshStandardMaterial({ color: '#3f6fb5' }));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: '#f1c9a0' }));
  head.position.y = 1.35;
  // nón lá
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24), new THREE.MeshStandardMaterial({ color: '#e8d39a' }));
  hat.position.y = 1.75;
  // đèn lồng nhỏ treo trên vành nón
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), new THREE.MeshBasicMaterial({ color: '#333' }));
  string.position.set(0.68, 1.42, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9a2e', emissiveIntensity: 2 }));
  lamp.position.set(0.68, 1.2, 0);
  const light = new THREE.PointLight('#ffb347', 1.2, 9, 1.8);
  light.position.copy(lamp.position);
  g.add(body, head, hat, string, lamp, light);
  scene.add(g);
  return g;
}

const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const moteMat = new THREE.MeshStandardMaterial({ color: '#fff3a0', emissive: '#ffd34d', emissiveIntensity: 2.5 });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#2a0f3d', emissive: '#4b1670', emissiveIntensity: 0.5, transparent: true, opacity: 0.92 });
  const blob = new THREE.Mesh(shadeGeo, mat);
  blob.scale.set(1, 1.15, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#d9b8ff' });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.25, 0.2, 0.7);
  e2.position.set(0.25, 0.2, 0.7);
  g.add(blob, e1, e2);
  g.userData = { mat };
  scene.add(g);
  return g;
}

// ---------- audio (GUI-only creativity: tiny WebAudio chimes) ----------
let actx = null;
let muted = false;
function tone(freq, dur = 0.18, type = 'sine', vol = 0.12) {
  if (muted) return;
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch { /* audio unavailable */ }
}
const SFX = {
  mote_picked: () => tone(880 + Math.random() * 120, 0.12),
  deposit: () => tone(523, 0.25, 'triangle'),
  lantern_lit: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.15), i * 90)),
  pulse: () => tone(330, 0.4, 'sawtooth', 0.06),
  player_hit: () => tone(140, 0.35, 'square', 0.08),
  shade_spawned: () => tone(110, 0.6, 'sine', 0.08),
};

// ---------- game state ----------
let sim, lanternObjs, player, moteObjs, shadeObjs, orbiters, pulseFx, phase, acc, camYaw;
const keys = new Set();
const latched = { jump: false, interact: false, pulse: false };

function newGame() {
  for (const o of [...(lanternObjs || []), ...(moteObjs ? moteObjs.values() : []), ...(shadeObjs ? shadeObjs.values() : []), ...(orbiters || [])]) scene.remove(o);
  if (player) scene.remove(player);
  sim = new Sim({ seed: (Date.now() & 0x7fffffff) });
  lanternObjs = sim.lanterns.map(() => makeLantern());
  player = makePlayer();
  moteObjs = new Map();
  shadeObjs = new Map();
  orbiters = [];
  pulseFx = null;
  acc = 0;
  camYaw = 0;
  phase = 'ready';
  showCard(`<h1>Đảo Đèn Lồng</h1><p><b>Đêm 1 – Đảo Bến.</b> Sương đen đã nuốt ánh sáng. Giúp <b>Mây</b> gom đom đóm và thắp lại <b>5 Đèn Lồng Lớn</b> trước bình minh.</p>
  <p>Mỗi đèn cần <b>${T.lantern_cost}</b> đom đóm. Mang tối đa <b>${T.carry_capacity}</b>. Tỏa sáng tốn <b>${T.pulse_cost}</b> đom đóm, làm choáng Bóng Mực.<br/>Bóng Mực sợ đèn đã thắp — đứng gần đèn sáng là an toàn.</p>
  <p><kbd>WASD</kbd> đi · <kbd>Chuột</kbd>/<kbd>←</kbd><kbd>→</kbd> camera · <kbd>Space</kbd> nhảy · <kbd>E</kbd> nạp đèn · <kbd>F</kbd> tỏa sáng</p>
  <p><b>Nhấn Enter hoặc bấm chuột để bắt đầu</b></p>`);
}

function showCard(html) {
  $('card').innerHTML = html;
  $('overlay').classList.remove('hidden');
}

function start() {
  if (phase !== 'ready') return;
  phase = 'playing';
  $('overlay').classList.add('hidden');
  tone(659, 0.3, 'triangle');
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'enter') start();
  if (k === 'r') newGame();
  if (k === 'm') muted = !muted;
  if (k === ' ') latched.jump = true;
  if (k === 'e') latched.interact = true;
  if (k === 'f') latched.pulse = true;
  if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
$('overlay').addEventListener('click', () => (phase === 'ready' ? start() : phase === 'over' ? newGame() : null));
let dragging = false;
renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (dragging) camYaw -= e.movementX * 0.3;
});

function readInput() {
  // Contract space: move=[x,z]; at yaw 0 the camera looks along +Z, so screen-right is -X.
  let x = 0, z = 0;
  if (keys.has('w') || keys.has('arrowup')) z += 1;
  if (keys.has('s') || keys.has('arrowdown')) z -= 1;
  if (keys.has('a')) x += 1;
  if (keys.has('d')) x -= 1;
  const inp = {
    move: [x, z],
    cam_yaw_deg: camYaw,
    jump: keys.has(' ') || latched.jump,
    interact: keys.has('e') || latched.interact,
    pulse: keys.has('f') || latched.pulse,
  };
  latched.jump = latched.interact = latched.pulse = false;
  return inp;
}

// ---------- events -> effects ----------
function onEvent(e) {
  SFX[e.name]?.();
  if (e.name === 'pulse') pulseFx = { t: 0, x: sim.player.pos[0], z: sim.player.pos[2], mesh: makePulseMesh() };
  if (e.name === 'game_over') {
    phase = 'over';
    const won = e.data.result === 'won';
    const why = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng!', dawn: 'Bình minh đến khi đảo còn tối…', no_flames: 'Ngọn lửa của Mây đã tắt…' }[e.data.reason];
    setTimeout(() => showCard(`<h1>${won ? 'Đảo đã sáng lại!' : 'Thua rồi'}</h1><p>${why}</p><p>Điểm: <b>${sim.score}</b> · Đèn ${sim.litCount}/5 · Lửa ${sim.player.flames}</p><p><b>Nhấn R hoặc bấm chuột để chơi lại</b></p>`), 600);
  }
}
function makePulseMesh() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  return m;
}

// ---------- sync sim -> scene ----------
function syncEntities(now) {
  const P = sim.player;
  player.position.set(P.pos[0], P.pos[1], P.pos[2]);
  const blink = P.invuln > 0 && Math.floor(now * 12) % 2 === 0;
  player.visible = !blink;

  // carried motes orbit the hat (visual only)
  while (orbiters.length < P.carried) {
    const m = new THREE.Mesh(moteGeo, moteMat);
    scene.add(m);
    orbiters.push(m);
  }
  while (orbiters.length > P.carried) scene.remove(orbiters.pop());
  orbiters.forEach((m, i) => {
    const a = now * 2 + (i * Math.PI * 2) / Math.max(1, orbiters.length);
    m.position.set(P.pos[0] + Math.cos(a) * 0.9, P.pos[1] + 2.1 + Math.sin(now * 3 + i) * 0.1, P.pos[2] + Math.sin(a) * 0.9);
  });

  const seen = new Set();
  for (const mo of sim.motes) {
    seen.add(mo.id);
    let o = moteObjs.get(mo.id);
    if (!o) {
      o = new THREE.Mesh(moteGeo, moteMat);
      scene.add(o);
      moteObjs.set(mo.id, o);
    }
    o.position.set(mo.pos[0], 0.6 + Math.sin(now * 2.5 + mo.pos[0]) * 0.2, mo.pos[2]);
  }
  for (const [id, o] of moteObjs) if (!seen.has(id)) (scene.remove(o), moteObjs.delete(id));

  seen.clear();
  for (const s of sim.shades) {
    seen.add(s.id);
    let o = shadeObjs.get(s.id);
    if (!o) shadeObjs.set(s.id, (o = makeShade()));
    o.position.set(s.pos[0], s.pos[1] + Math.sin(now * 3 + s.pos[2]) * 0.12, s.pos[2]);
    o.lookAt(P.pos[0], o.position.y, P.pos[2]);
    const stunned = s.stun > 0;
    o.userData.mat.opacity = stunned ? 0.45 : 0.92;
    o.userData.mat.emissive.set(stunned ? '#8a6fb0' : '#4b1670');
    o.rotation.z = stunned ? Math.sin(now * 10) * 0.3 : 0;
  }
  for (const [id, o] of shadeObjs) if (!seen.has(id)) (scene.remove(o), shadeObjs.delete(id));

  sim.lanterns.forEach((l, i) => {
    const o = lanternObjs[i];
    o.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const fill = l.lit ? 1 : l.deposited / T.lantern_cost;
    o.userData.bodyMat.emissive.set(l.lit ? '#ff9a2e' : fill > 0 ? '#8a4a2a' : '#2a1a40');
    o.userData.bodyMat.emissiveIntensity = l.lit ? 2.2 + Math.sin(now * 3 + i) * 0.2 : 0.6 + fill;
    o.userData.light.intensity = l.lit ? 40 : fill * 6;
    o.userData.ring.material.opacity = l.lit ? 0.35 : 0;
  });

  // island brightens as lanterns are lit (GUI-only creativity)
  const k = sim.litCount / sim.lanterns.length;
  hemi.intensity = 0.35 + k * 0.9;
  scene.fog.color.copy(FOG_DARK).lerp(FOG_WARM, k);
  scene.background.copy(scene.fog.color);

  if (pulseFx) {
    pulseFx.t += 1 / 60;
    const r = (pulseFx.t / 0.35) * T.pulse_radius;
    pulseFx.mesh.scale.setScalar(Math.max(0.01, r));
    pulseFx.mesh.position.set(pulseFx.x, 0.1, pulseFx.z);
    pulseFx.mesh.material.opacity = Math.max(0, 0.8 - pulseFx.t * 2);
    if (pulseFx.t > 0.4) (scene.remove(pulseFx.mesh), (pulseFx = null));
  }
}

function updateCamera() {
  if (keys.has('arrowleft')) camYaw += 2;
  if (keys.has('arrowright')) camYaw -= 2;
  const th = (camYaw * Math.PI) / 180;
  const P = sim.player.pos;
  camera.position.set(P[0] - Math.sin(th) * 9, P[1] + 5.5, P[2] - Math.cos(th) * 9);
  camera.lookAt(P[0], P[1] + 1.5, P[2]);
}

function updateHud() {
  const P = sim.player;
  $('flames').innerHTML = 'Lửa ' + Array.from({ length: Math.max(T.flames, P.flames) }, (_, i) => `<span class="${i < P.flames ? 'on' : 'off'}">●</span>`).join('');
  $('carried').textContent = `${P.carried}/${T.carry_capacity}`;
  $('lit').textContent = `${sim.litCount}/${sim.lanterns.length}`;
  const t = Math.ceil(sim.timeLeftS);
  $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('score').textContent = sim.score;
  const ready = P.cooldown === 0 && P.carried >= T.pulse_cost;
  $('pulse').className = 'chip' + (ready ? '' : ' cd');
  $('pulse').textContent = ready ? 'Tỏa sáng [F] sẵn sàng' : P.carried < T.pulse_cost ? 'Tỏa sáng: cần đom đóm' : `Tỏa sáng: ${(P.cooldown / 60).toFixed(1)}s`;

  let prompt = '';
  const near = sim.lanterns.filter((l) => !l.lit && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= T.interact_radius)[0];
  if (near) prompt = P.carried > 0 ? `Nhấn E để nạp đèn ${near.id} (${near.deposited}/${T.lantern_cost})` : `Đèn ${near.id} cần ${T.lantern_cost - near.deposited} đom đóm`;
  $('prompt').textContent = phase === 'playing' ? prompt : '';

  // compass to nearest unlit lantern when carrying enough (GUI-only helper)
  const unlit = sim.lanterns.filter((l) => !l.lit);
  if (phase === 'playing' && unlit.length && P.carried > 0) {
    const l = unlit.reduce((a, b) => (Math.hypot(a.pos[0] - P.pos[0], a.pos[2] - P.pos[2]) < Math.hypot(b.pos[0] - P.pos[0], b.pos[2] - P.pos[2]) ? a : b));
    const d = Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]);
    $('compass').textContent = `Đèn gần nhất ${l.id}: ${d.toFixed(0)} m`;
  } else $('compass').textContent = '';
}

// ---------- main loop: fixed 60 Hz simulation, render every frame ----------
let last = performance.now();
function frame(nowMs) {
  const dt = Math.min(0.1, (nowMs - last) / 1000);
  last = nowMs;
  if (phase === 'playing') {
    acc += dt;
    while (acc >= STEP && phase === 'playing') {
      acc -= STEP;
      for (const e of sim.step(readInput())) onEvent(e);
    }
  }
  const now = nowMs / 1000;
  syncEntities(now);
  updateCamera();
  updateHud();
  renderer.render(scene, camera);
  document.body.dataset.tick = sim.steps; // lets headless-browser smoke checks see the loop advance
  requestAnimationFrame(frame);
}
newGame();
// ?autostart skips the title card; ?lit=N pre-lights N lanterns (screenshots only, never used by headless)
const qs = new URLSearchParams(location.search);
if (qs.has('lit')) sim.lanterns.slice(0, Number(qs.get('lit'))).forEach((l) => ((l.lit = true), (l.deposited = T.lantern_cost)));
if (qs.has('autostart')) start();
requestAnimationFrame(frame);
window.__game = { get sim() { return sim; } }; // debug hook for screenshots / manual checks
