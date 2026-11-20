// Browser front-end: menu → night intro → play → result → next night → Bình Minh → leaderboard.
// Ticket-04: ?bench (benchmark scene), leaderboard, key remapping, captions, reduced motion, large text.
// Renders the shared Sim (src/core/sim.js). No gameplay rules here; GUI-only extras never touch the Sim.
import * as THREE from 'three';
import { Sim, createBenchSim } from '../src/core/sim.js';
import { addEntry, validateName, isoWithOffset, sortEntries } from '../src/core/leaderboard.js';
import { TUNING as T, RULES as R } from '../src/core/tuning.js';
import { NIGHTS } from '../src/core/maps.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / R.tick_rate;
const qs = new URLSearchParams(location.search);

// ---------- standard palette ----------
const C = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lampOn: '#FFB347', lampCore: '#FFE9B0', lampOff: '#5B5F6E', moteCore: '#FFF6C2', moteGlow: '#FFE58A',
  shadeBody: '#120A1A', shadeRim: '#7A3CFF', shadeStun: '#3A3450', cloth: '#E8E2D0', scarf: '#C8102E',
  gold: '#F2C14E', drifter: '#8FA3B8', danger: '#FF5A5F', ui: '#F5F1E6',
  // Ticket-03 colour-blind mode
  cbRim: '#00B3FF', cbDanger: '#FFFFFF',
};

// ---------- settings (persisted) ----------
// Ticket-04: every action is remappable (KeyboardEvent.code), persisted with the other settings
const ACTIONS = { up: 'Đi lên', down: 'Đi xuống', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác', pulse: 'Tỏa Sáng', pause: 'Tạm dừng' };
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'KeyP' };
const settings = { volume: 0.7, sens: 1, cb: false, reduceMotion: false, largeText: false, keys: { ...DEFAULT_KEYS } };
try {
  const saved = JSON.parse(localStorage.getItem('ddl-settings') || '{}');
  Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } });
} catch { /* storage unavailable */ }
const keyName = (code) => (code || '?').replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Shift phải').replace('Space', 'Space');
const duplicateKeys = () => {
  const seen = {};
  const dup = new Set();
  for (const [a, c] of Object.entries(settings.keys)) (seen[c] ? (dup.add(a), dup.add(seen[c])) : (seen[c] = a));
  return dup;
};
const saveSettings = () => {
  try {
    localStorage.setItem('ddl-settings', JSON.stringify(settings));
  } catch { /* ignore */ }
};
const audio = new Audio(settings.volume);
const applyCb = () => {
  document.body.classList.toggle('cb', !!settings.cb);
  document.body.classList.toggle('large', !!settings.largeText); // UI text ×1.25
};
applyCb();

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.Fog(C.fog, 25, 110);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const ambient = new THREE.AmbientLight('#ffffff', 0.15);
const moon = new THREE.DirectionalLight('#9fb4ff', 0.25);
moon.position.set(-30, 60, 20);
scene.add(ambient, moon);
const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshLambertMaterial({ color: C.sea }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -6;
scene.add(sea);

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = {
  grass: mat(C.grass), sand: mat(C.sand), wood: mat(C.wood), gold: mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.4 }),
  scarf: mat(C.scarf), cloth: mat(C.cloth), skin: mat('#f1c9a0'),
  mote: new THREE.MeshBasicMaterial({ color: C.moteCore }),
  moteGlow: new THREE.MeshBasicMaterial({ color: C.moteGlow, transparent: true, opacity: 0.35, depthWrite: false }),
};
const G = { mote: new THREE.SphereGeometry(0.12, 8, 6), moteGlow: new THREE.SphereGeometry(0.28, 8, 6), shade: new THREE.SphereGeometry(0.8, 14, 10) };

// ---------- world building per night ----------
let world = null;
function buildWorld(map) {
  if (world) scene.remove(world);
  world = new THREE.Group();
  const add = (geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    world.add(o);
    return o;
  };
  const island = (r, cx, cz) => {
    add(new THREE.CylinderGeometry(r, r - 1.5, 3, 56), M.grass, cx, -1.5, cz);
    add(new THREE.CylinderGeometry(r + 0.6, r - 3, 2.4, 56), M.sand, cx, -1.9, cz);
  };
  if (map.night === 1) island(40, 0, 0);
  if (map.night === 2) {
    island(28, 0, 0);
    island(28, 70, 0);
    add(new THREE.BoxGeometry(18, 0.3, 4), M.wood, 35, -0.15, 0); // bamboo bridge, no rails
    for (let x = 26.5; x < 44; x += 1.2) add(new THREE.BoxGeometry(0.25, 0.08, 4.1), mat('#4f3622'), x, 0.02, 0);
  }
  if (map.night === 3) {
    island(45, 0, 0);
    // tier 1: half annulus r 12–24, z > 0, Y 0..3
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, 0, Math.PI, false);
    sh.absarc(0, 0, 12, Math.PI, 0, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 40 }), M.grass);
    t1.rotation.x = Math.PI / 2;
    t1.position.y = 3;
    world.add(t1);
    add(new THREE.CylinderGeometry(8, 8, 6, 40), M.grass, 0, 3, 0); // tier 2
    add(new THREE.CylinderGeometry(2, 2.2, 8, 20), M.wood, 0, 10, 0); // bell tower
    add(new THREE.ConeGeometry(2.8, 2, 20), mat('#7a2e1d'), 0, 15, 0);
    add(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold, 0, 12.4, 0).rotation.x = Math.PI;
    for (const a of [30, 150]) {
      const ra = (a * Math.PI) / 180;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, Math.hypot(6, 3)), M.sand);
      ramp.position.set(27 * Math.cos(ra), 1.5 - 0.12, 27 * Math.sin(ra));
      ramp.lookAt(24 * Math.cos(ra), 3 - 0.12, 24 * Math.sin(ra));
      world.add(ramp);
    }
  }
  for (const pad of map.pads) {
    add(new THREE.CylinderGeometry(R.pad_radius, R.pad_radius, 0.12, 24), mat(C.scarf, { emissive: C.scarf, emissiveIntensity: 0.3 }), pad.pos[0], pad.pos[1] + 0.06, pad.pos[2]);
    add(new THREE.TorusGeometry(R.pad_radius, 0.07, 6, 24), M.gold, pad.pos[0], pad.pos[1] + 0.14, pad.pos[2]).rotation.x = Math.PI / 2;
  }
  // decorative rocks (deterministic layout, GUI only)
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39996;
    const d = 6 + ((i * 37) % 30);
    const x = Math.cos(a) * d + (map.night === 2 && i % 2 ? 70 : 0);
    const z = Math.sin(a) * d;
    const h = map.ground(x, z);
    if (h === null || h === 8) continue;
    add(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.2), mat(i % 2 ? '#3d4a3a' : '#4a4058'), x, h + 0.15, z);
  }
  scene.add(world);
}

// ---------- entity factories ----------
function makeLantern(l) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), M.wood);
  post.position.y = 1.5;
  const bodyMat = new THREE.MeshLambertMaterial({ color: C.lampOff, emissive: C.lampOff, emissiveIntensity: 0.2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), bodyMat);
  body.scale.y = 1.3;
  body.position.y = 3.6;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: C.lampCore }));
  core.position.y = 3.6;
  core.visible = false;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 12), mat('#7a2e1d'));
  cap.position.y = 4.7;
  const light = new THREE.PointLight(C.lampOn, 0, 26, 1.4);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: C.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  // Ticket-03: fuel bar above lit lanterns; torn paper patch on unlit (shape cue, not only colour)
  // bar group faces the camera; fill sits in front of its background (local +z), anchored at the left edge
  const barG = new THREE.Group();
  barG.position.y = 5.4;
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.32), new THREE.MeshBasicMaterial({ color: '#1a1f3d' }));
  const barMat = new THREE.MeshBasicMaterial({ color: C.lampOn });
  const barGeo = new THREE.PlaneGeometry(2.0, 0.2);
  barGeo.translate(1.0, 0, 0);
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(-1.0, 0, 0.02);
  barG.add(barBg, bar);
  const tear = new THREE.Mesh(new THREE.CircleGeometry(0.28, 5), new THREE.MeshBasicMaterial({ color: '#15182a', side: THREE.DoubleSide }));
  tear.position.set(0.25, 3.55, 0.73);
  tear.rotation.z = 0.7;
  g.add(post, body, core, cap, light, ring, barG, tear);
  g.position.set(...l.pos);
  g.userData = { bodyMat, body, core, light, ring, bar, barG, barMat, tear };
  return g;
}
function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 1.1, 12), M.cloth);
  body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.08, 6, 14), M.scarf);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), M.skin);
  head.position.y = 1.35;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 20), M.sand); // nón lá
  hat.position.y = 1.75;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: C.lampOn }));
  lamp.position.set(0.68, 1.2, 0);
  const light = new THREE.PointLight(C.lampOn, 6, 10, 1.6);
  light.position.copy(lamp.position);
  g.add(body, scarf, head, hat, lamp, light);
  return g;
}
function makeMote() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(G.mote, M.mote), new THREE.Mesh(G.moteGlow, M.moteGlow));
  return g;
}
function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: C.shadeBody });
  const rimMat = new THREE.MeshBasicMaterial({ color: C.shadeRim, side: THREE.BackSide });
  const body = new THREE.Mesh(G.shade, bodyMat);
  const rim = new THREE.Mesh(G.shade, rimMat);
  rim.scale.setScalar(1.08);
  body.scale.y = rim.scale.y = 1.15;
  const eyeMat = new THREE.MeshBasicMaterial({ color: C.shadeRim });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.25, 0.2, 0.72);
  e2.position.set(0.25, 0.2, 0.72);
  g.add(rim, body, e1, e2);
  g.userData = { bodyMat, rimMat, eyeMat };
  return g;
}
function makeDrifter() {
  const geo = new THREE.PlaneGeometry(0.45, 2.4, 1, 12);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  m.userData.base = geo.attributes.position.array.slice();
  return m;
}
function makeCharm() {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.5, 0.75, 0.05);
  g.add(new THREE.Mesh(geo, mat(C.scarf, { emissive: C.scarf, emissiveIntensity: 0.4 })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: C.gold })));
  return g;
}

// ---------- game state ----------
let sim = null, ents = null, phase = 'menu', night = 1, totalScore = 0, nightsWon = 0, campaignSeed = Date.now() & 0x7fffffff, acc = 0, camYaw = 0, lastCountdown = 99, windWarned = false;
let shake = 0, rebinding = null, bench = null, shadeAlert = null;
const lowWarned = new Set();
const keys = new Set();
const latched = { jump: false, interact: false, pulse: false, dash: false };
const OSTORIES = {
  1: 'Đêm nay sương đen nuốt cả bến thuyền. Gom đom đóm, thắp lại năm ngọn đèn — Bóng Mực sợ ánh sáng hơn con sợ chúng đấy, Mây ạ.',
  2: 'Đảo Cau có hai nửa, nối nhau bằng cây cầu tre của ông. Cẩn thận Gió Lạc — chúng thích đom đóm của con lắm. Nhớ nhặt Bùa Gió trên cầu.',
  3: 'Đảo Chuông cao nhất vùng. Leo dốc, nhảy bục lên tháp chuông, và giữ chặt nón — gió ở đây mạnh lắm. Đêm cuối rồi, bình minh đang chờ con.',
};

function newCampaign() {
  campaignSeed = Date.now() & 0x7fffffff;
  totalScore = 0;
  nightsWon = 0;
}
function spawnEntities() {
  if (ents) for (const o of ents.all()) scene.remove(o);
  if (ents?.pulse) scene.remove(ents.pulse.mesh);
  ents = {
    player: makePlayer(), lanterns: sim.lanterns.map(makeLantern), motes: new Map(), shades: new Map(), drifters: new Map(),
    charms: sim.charms.map(() => makeCharm()), orbit: [], leaves: makeLeaves(), pulse: null,
    all() { return [this.player, ...this.lanterns, ...this.motes.values(), ...this.shades.values(), ...this.drifters.values(), ...this.charms, ...this.orbit, this.leaves]; },
  };
  scene.add(ents.player, ...ents.lanterns, ...ents.charms, ents.leaves);
}
function startNight(n, autostart = false) {
  night = n;
  const map = NIGHTS[n];
  buildWorld(map);
  scene.background.set(C.sky);
  sim = new Sim({ seed: campaignSeed + n - 1, night: n });
  spawnEntities();
  lowWarned.clear();
  shadeAlert = null;
  acc = 0;
  camYaw = 0;
  lastCountdown = 99;
  windWarned = false;
  $('moteBar').innerHTML = '';
  if (autostart) return play();
  phase = 'intro';
  $('hud').classList.add('hidden');
  showCard(`<h2>Đêm ${n} / 3</h2><h1>${map.name}</h1>
    <p class="quote">“${OSTORIES[n]}”<br/>— Ông Đăng, người giữ đèn già</p>
    <p>Giữ ít nhất <b>${sim.winThreshold}/${sim.lanterns.length}</b> đèn sáng tới bình minh (<b>${map.duration_s} giây</b>). Thắp đèn cần ${T.lantern_cost} đom đóm (thắp lại ${T.relight_cost}); đèn cạn dầu dần, nhấn E ở đèn đang sáng để châm dầu. Bóng Mực hút dầu đèn yếu!</p>
    <p>${keyName(settings.keys.interact)}: nạp/châm dầu · ${keyName(settings.keys.pulse)}: Tỏa Sáng · ${keyName(settings.keys.dash)}: lướt</p>
    <button id="bGo">Bắt đầu Đêm ${n} (Enter)</button>`);
  $('bGo').onclick = play;
}
function play() {
  phase = 'playing';
  hideCard();
  $('hud').classList.remove('hidden');
  audio.resume();
  audio.music(true);
}

// ---------- screens ----------
function showCard(html) {
  $('card').innerHTML = html;
  $('screen').classList.remove('hidden');
}
function hideCard() {
  $('screen').classList.add('hidden');
}
function menu() {
  phase = 'menu';
  newCampaign();
  $('hud').classList.add('hidden');
  audio.music(false);
  showCard(`<h1>Đảo Đèn Lồng</h1><p>Mây, người giữ đèn nhỏ tuổi đội nón lá, phải thắp lại đèn của ba hòn đảo trước bình minh.</p>
    <button id="bStart">Bắt đầu hành trình</button>
    <button class="sec" id="bN2">Chơi Đêm 2</button><button class="sec" id="bN3">Chơi Đêm 3</button>
    <button class="sec" id="bLb">Bảng xếp hạng</button>
    <button class="sec" id="bSet">Cài đặt</button>
    <p class="hint">${['up', 'left', 'down', 'right'].map((a) => keyName(settings.keys[a])).join('')} đi · chuột kéo / ← → camera · ${keyName(settings.keys.jump)} nhảy · ${keyName(settings.keys.dash)} lướt · ${keyName(settings.keys.interact)} nạp đèn · ${keyName(settings.keys.pulse)} tỏa sáng · Esc/${keyName(settings.keys.pause)} tạm dừng</p>`);
  $('bLb').onclick = () => leaderboardScreen();
  $('bStart').onclick = () => startNight(1);
  $('bN2').onclick = () => startNight(2);
  $('bN3').onclick = () => startNight(3);
  $('bSet').onclick = () => settingsScreen(menu);
}
function pause() {
  if (phase !== 'playing') return;
  phase = 'paused'; // logic stops completely: the frame loop only steps the Sim while phase === 'playing'
  audio.music(false);
  showCard(`<h1>Tạm dừng</h1><button id="bRes">Tiếp tục</button><button class="sec" id="bRe">Chơi lại Đêm</button>
    <button class="sec" id="bSet">Cài đặt</button><button class="sec" id="bMenu">Về menu</button>`);
  $('bRes').onclick = resume;
  $('bRe').onclick = () => startNight(night);
  $('bSet').onclick = () => settingsScreen(() => { phase = 'playing'; pause(); });
  $('bMenu').onclick = menu;
}
function resume() {
  if (phase !== 'paused') return;
  play();
}
function settingsScreen(back) {
  const prev = phase;
  phase = 'settings';
  showCard(`<h1>Cài đặt</h1>
    <label>Âm lượng: <b id="vVal">${Math.round(settings.volume * 100)}</b>%</label><input id="vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}">
    <label>Độ nhạy chuột: <b id="sVal">${settings.sens.toFixed(1)}</b></label><input id="sens" type="range" min="2" max="30" value="${Math.round(settings.sens * 10)}">
    <label><input id="cb" type="checkbox" ${settings.cb ? 'checked' : ''}> Bảng màu dễ phân biệt (mù màu)</label>
    <label><input id="rm" type="checkbox" ${settings.reduceMotion ? 'checked' : ''}> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
    <label><input id="lt" type="checkbox" ${settings.largeText ? 'checked' : ''}> Chữ lớn (×1.25)</label>
    <h2>Phím điều khiển</h2>
    <div id="keymap"></div>
    <p id="keyWarn" class="warn"></p>
    <button class="sec" id="bKeyReset">Khôi phục mặc định</button>
    <button id="bBack">Quay lại</button>`);
  const renderKeys = () => {
    const dup = duplicateKeys();
    $('keymap').innerHTML = Object.entries(ACTIONS)
      .map(([a, label]) => `<div class="krow${dup.has(a) ? ' dup' : ''}"><span>${label}</span><button class="sec kbtn" data-a="${a}">${rebinding === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button></div>`)
      .join('');
    $('keyWarn').textContent = dup.size ? `⚠ Trùng phím: ${[...dup].map((a) => ACTIONS[a]).join(', ')}. Hãy đổi một trong các phím bị trùng.` : '';
    document.querySelectorAll('.kbtn').forEach((b) => (b.onclick = () => ((rebinding = b.dataset.a), renderKeys())));
  };
  renderKeys();
  settingsScreen.renderKeys = renderKeys;
  $('bKeyReset').onclick = () => {
    settings.keys = { ...DEFAULT_KEYS };
    rebinding = null;
    saveSettings();
    renderKeys();
  };
  $('rm').onchange = (e) => ((settings.reduceMotion = e.target.checked), saveSettings());
  $('lt').onchange = (e) => ((settings.largeText = e.target.checked), applyCb(), saveSettings());
  $('cb').onchange = (e) => {
    settings.cb = e.target.checked;
    applyCb();
    saveSettings();
  };
  $('vol').oninput = (e) => {
    settings.volume = e.target.value / 100;
    $('vVal').textContent = e.target.value;
    audio.setVolume(settings.volume);
    saveSettings();
  };
  $('sens').oninput = (e) => {
    settings.sens = e.target.value / 10;
    $('sVal').textContent = settings.sens.toFixed(1);
    saveSettings();
  };
  $('bBack').onclick = () => {
    rebinding = null;
    if (duplicateKeys().size) return ($('keyWarn').textContent = '⚠ Còn phím bị trùng — sửa trước khi quay lại.');
    return prev === 'menu' ? menu() : back();
  };
}
function result(won, reason) {
  phase = 'result';
  audio.music(false);
  if (won) (totalScore += sim.score), nightsWon++; // total = sum of the nights won
  const why = { dawn_survived: `Bình minh lên, ${sim.litCount} ngọn đèn vẫn sáng!`, dawn: `Bình minh tới mà chỉ ${sim.litCount}/${sim.lanterns.length} đèn sáng (cần ${sim.winThreshold})…`, no_flames: 'Ngọn Lửa của Mây đã tắt…' }[reason];
  if (won && night === 3) {
    phase = 'dawn';
    $('hud').classList.add('hidden');
    scene.background.set('#f6b98a');
    showCard(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng trở lại. Ông Đăng mỉm cười: “Giỏi lắm, người giữ đèn.”</p>
      <h2>Tổng điểm: ${totalScore}</h2>${nameForm()}<button class="sec" id="bMenu">Về menu</button>`);
    bindNameForm();
    $('bMenu').onclick = () => { scene.background.set(C.sky); menu(); };
    return;
  }
  showCard(`<h1>${won ? 'Đêm ' + night + ' đã sáng!' : 'Thua rồi'}</h1><p>${why}</p>
    <p>Điểm Đêm: <b>${sim.score}</b> · Đèn ${sim.litCount}/${sim.lanterns.length} · Lửa ${sim.player.flames}<br/>Tổng điểm: <b>${totalScore}</b></p>
    ${won ? '' : nameForm()}
    ${won ? `<button id="bNext">Đêm kế tiếp</button>` : `<button id="bRe">Chơi lại Đêm ${night}</button>`}<button class="sec" id="bMenu">Về menu</button>`);
  if (!won) bindNameForm();
  if (won) $('bNext').onclick = () => startNight(night + 1);
  else $('bRe').onclick = () => startNight(night);
  $('bMenu').onclick = menu;
}

// ---------- leaderboard (Ticket-04 §3): stored on disk by the local server; localStorage fallback for the static build ----------
async function loadBoard() {
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (r.ok) return (await r.json()).entries;
  } catch { /* static hosting */ }
  try {
    return sortEntries(JSON.parse(localStorage.getItem('ddl-leaderboard') || '[]')).slice(0, 10);
  } catch {
    return [];
  }
}
async function saveScore(entry) {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', body: JSON.stringify(entry) });
    if (r.ok) return (await r.json()).entries;
    if (r.status === 400) throw new Error((await r.json()).error);
  } catch (e) {
    if (e instanceof Error && !/fetch|network/i.test(e.message) && e.name !== 'TypeError') throw e;
  }
  const entries = addEntry(await loadBoard(), entry);
  localStorage.setItem('ddl-leaderboard', JSON.stringify(entries));
  return entries;
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function nameForm() {
  return `<div class="nameform"><label for="pname">Lưu điểm ${totalScore} (${nightsWon} Đêm thắng) — nhập tên 3–12 ký tự:</label>
    <input id="pname" maxlength="12" autocomplete="off" placeholder="vd: May_01 hoặc Mây"><button id="bSave">Lưu vào bảng xếp hạng</button><p id="nameErr" class="warn"></p></div>`;
}
function bindNameForm() {
  $('pname').addEventListener('keydown', (e) => e.stopPropagation());
  $('bSave').onclick = async () => {
    const name = $('pname').value.trim();
    const bad = validateName(name);
    if (bad) return ($('nameErr').textContent = bad);
    try {
      const entries = await saveScore({ name, score: totalScore, nights_won: nightsWon, achieved_at: isoWithOffset(), seed: campaignSeed });
      leaderboardScreen(entries, name);
    } catch (err) {
      $('nameErr').textContent = err.message;
    }
  };
}
async function leaderboardScreen(entries = null, highlight = null) {
  phase = 'leaderboard';
  const list = entries || (await loadBoard());
  showCard(`<h1>Bảng xếp hạng</h1>
    <table class="lb"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Thời điểm</th></tr>
    ${list.map((e, i) => `<tr class="${e.name === highlight ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}</td><td>${esc(e.achieved_at.slice(0, 16).replace('T', ' '))}</td></tr>`).join('') || '<tr><td colspan="5">Chưa có ai — hãy là người đầu tiên!</td></tr>'}
    </table><button id="bMenu">Về menu</button>`);
  $('bMenu').onclick = () => { scene.background.set(C.sky); menu(); };
}

// ---------- captions / visual cues (Ticket-04 §4) ----------
const captionsShown = new Map();
function caption(key, text, ms = 3000) {
  const box = $('captions');
  let el = captionsShown.get(key);
  if (!el) {
    el = document.createElement('div');
    el.className = 'cap';
    box.appendChild(el);
    captionsShown.set(key, el);
  }
  el.textContent = text;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.remove(), captionsShown.delete(key)), ms);
}
function flash(color) {
  if (settings.reduceMotion) return; // reduced motion: no screen flashes
  const f = $('flash');
  f.style.background = color;
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}

// ---------- input (remappable, Ticket-04 §4) ----------
const actionOf = (code) => Object.keys(settings.keys).find((a) => settings.keys[a] === code);
addEventListener('keydown', (e) => {
  if (rebinding) {
    e.preventDefault();
    if (e.code !== 'Escape') settings.keys[rebinding] = e.code;
    rebinding = null;
    saveSettings();
    settingsScreen.renderKeys?.();
    return;
  }
  if (e.target && e.target.tagName === 'INPUT') return;
  const act = actionOf(e.code);
  if (e.code === 'Escape' || act === 'pause') return phase === 'playing' ? pause() : phase === 'paused' ? resume() : null;
  if (e.key === 'Enter' && phase === 'intro') return play();
  keys.add(e.code);
  if (act === 'jump' || act === 'interact' || act === 'pulse' || act === 'dash') latched[act] = true;
  if (e.code === 'F3') $('fps').classList.toggle('hidden');
  if (phase === 'playing' && (act || e.code.startsWith('Arrow') || e.code === 'F3')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  pause();
});
let dragging = false;
renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (dragging && phase === 'playing') camYaw -= e.movementX * 0.25 * settings.sens;
});
function readInput() {
  // contract space: at yaw 0 the camera looks along +Z, so screen-right is -X
  const K = settings.keys;
  const held = (a) => keys.has(K[a]);
  let x = 0, z = 0;
  if (held('up') || keys.has('ArrowUp')) z += 1;
  if (held('down') || keys.has('ArrowDown')) z -= 1;
  if (held('left')) x += 1;
  if (held('right')) x -= 1;
  const inp = {
    move: [x, z], cam_yaw_deg: camYaw,
    jump: held('jump') || latched.jump, interact: held('interact') || latched.interact,
    pulse: held('pulse') || latched.pulse, dash: held('dash') || latched.dash,
  };
  latched.jump = latched.interact = latched.pulse = latched.dash = false;
  return inp;
}

// ---------- events → effects ----------
function onEvent(e) {
  const sfx = { mote_picked: 'pick', lantern_lit: 'lit', pulse: 'pulse', player_hit: 'hit', dash: 'dash', shade_spawned: 'shade', charm_picked: 'charm', drifter_steal: 'steal', deposit: 'deposit' }[e.name];
  if (sfx) audio.sfx(sfx);
  if (e.name === 'pulse') (ents.pulse = { t: 0, x: sim.player.pos[0], y: sim.player.pos[1], z: sim.player.pos[2], mesh: pulseMesh() }), flash('rgba(255,233,176,.35)');
  if (e.name === 'player_hit') {
    if (!settings.reduceMotion) shake = 0.35; // camera shake (off with reduced motion)
    flash(settings.cb ? 'rgba(255,255,255,.35)' : 'rgba(255,90,95,.35)');
    caption('hit', e.data.by === 'fall' ? '⚠ Mây rơi khỏi đảo! −1 Ngọn Lửa' : `⚠ Bị Bóng Mực chạm! −1 Ngọn Lửa, rơi ${e.data.dropped} đom đóm`);
  }
  if (e.name === 'shade_spawned') {
    caption('shade', '⚠ Bóng Mực xuất hiện!');
    shadeAlert = { id: e.data.id, until: performance.now() + 4000 };
  }
  if (e.name === 'lantern_out') caption('out' + e.data.lantern_id, `Đèn ${e.data.lantern_id} đã tắt — thắp lại cần ${T.relight_cost} đom đóm`);
  if (e.name === 'drifter_steal') caption('steal', `Gió Lạc cướp ${e.data.amount} đom đóm!`);
  if (e.name === 'game_over') {
    audio.sfx(e.data.result === 'won' ? 'win' : 'lose');
    setTimeout(() => result(e.data.result === 'won', e.data.reason), 700);
  }
}
function pulseMesh() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, opacity: 0.5, depthWrite: false }));
  scene.add(m);
  return m;
}
function makeLeaves() {
  const n = 60;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#7fae6a', size: 0.25 }));
  pts.visible = false;
  return pts;
}

// ---------- sync sim → scene ----------
function syncMap(map, list, make, upd) {
  const seen = new Set();
  for (const it of list) {
    seen.add(it.id);
    let o = map.get(it.id);
    if (!o) {
      o = make(it);
      map.set(it.id, o);
      scene.add(o);
    }
    upd(o, it);
  }
  for (const [id, o] of map) if (!seen.has(id)) (scene.remove(o), map.delete(id));
}
function sync(now) {
  const P = sim.player;
  ents.player.position.set(...P.pos);
  ents.player.rotation.y = Math.atan2(P.facing[0], P.facing[1]);
  ents.player.visible = P.respawn === 0 && !(P.invuln > 0 && Math.floor(now * 12) % 2 === 0);

  while (ents.orbit.length < P.carried) {
    const m = makeMote();
    scene.add(m);
    ents.orbit.push(m);
  }
  while (ents.orbit.length > P.carried) scene.remove(ents.orbit.pop());
  ents.orbit.forEach((m, i) => {
    const a = now * 2 + (i * Math.PI * 2) / ents.orbit.length;
    m.position.set(P.pos[0] + Math.cos(a) * 0.9, P.pos[1] + 2.15, P.pos[2] + Math.sin(a) * 0.9);
  });

  syncMap(ents.motes, sim.motes, makeMote, (o, m) => {
    o.position.set(m.pos[0], m.pos[1] + 0.6 + Math.sin(now * 2.5 + m.pos[0]) * 0.15, m.pos[2]);
    o.visible = !(m.kind === 'dropped' && m.ttl < 120 && Math.floor(now * 8) % 2 === 0);
  });
  syncMap(ents.shades, sim.shades, makeShade, (o, s) => {
    o.position.set(s.pos[0], s.pos[1] + Math.sin(now * 3 + s.pos[2]) * 0.1, s.pos[2]);
    o.lookAt(P.pos[0], o.position.y, P.pos[2]);
    const stunned = s.state === 'stunned';
    const rimC = settings.cb ? C.cbRim : C.shadeRim; // Ticket-03 colour-blind: rim + eyes #00B3FF
    o.userData.bodyMat.color.set(stunned ? C.shadeStun : C.shadeBody);
    o.userData.rimMat.color.set(stunned ? C.shadeStun : rimC);
    o.userData.eyeMat.color.set(rimC);
    o.scale.setScalar(s.state === 'spawning' ? Math.max(0.2, 1 - s.st / R.shade_spawning_ticks) : 1);
    o.rotation.z = stunned ? Math.sin(now * 10) * 0.3 : 0;
  });
  syncMap(ents.drifters, sim.drifters, makeDrifter, (o, d) => {
    o.visible = d.state !== 'removed';
    o.position.set(...d.pos);
    o.rotation.y = now * 1.5;
    o.material.opacity = d.state === 'flee' ? 0.45 : 0.9;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, o.userData.base[i * 3] + Math.sin(now * 6 + p.getY(i) * 2) * 0.25);
    p.needsUpdate = true;
  });
  sim.charms.forEach((c, i) => {
    const o = ents.charms[i];
    o.visible = c.available;
    o.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(now * 2) * 0.15, c.pos[2]);
    o.rotation.y = now * 1.6;
  });
  const blinkOff = Math.floor(now * 2) % 2 === 1; // 1 Hz slow blink
  sim.lanterns.forEach((l, i) => {
    const u = ents.lanterns[i].userData;
    const fuel = l.fuel / R.fuel_unit;
    const low = l.lit && fuel < T.low_fuel_threshold;
    const dim = low && blinkOff;
    const fill = l.lit ? 1 : l.deposited / sim.costOf(l);
    u.bodyMat.color.set(l.lit ? C.lampOn : C.lampOff);
    u.bodyMat.emissive.set(l.lit ? C.lampOn : fill > 0 ? '#8a5a2a' : C.lampOff);
    u.bodyMat.emissiveIntensity = l.lit ? (dim ? 0.25 : 1) : 0.2 + fill * 0.6;
    u.core.visible = l.lit && !dim;
    u.light.intensity = l.lit ? (dim ? 12 : 60) : fill * 8;
    u.ring.material.opacity = sim.hasZone(l) ? 0.35 : 0; // ring only while the lantern still protects
    u.body.scale.set(1, l.lit ? 1.3 : 1.3 * 0.8, 1); // unlit: squashed 20%
    u.body.position.y = l.lit ? 3.6 : 3.45;
    u.tear.visible = !l.lit;
    u.barG.visible = l.lit && !dim;
    u.bar.scale.x = Math.max(0.001, fuel / T.fuel_max);
    u.barMat.color.set(low ? (settings.cb ? C.cbDanger : C.danger) : C.lampOn);
    u.barG.lookAt(camera.position);
  });
  // caption once each time a lantern drops below 30 fuel
  for (const l of sim.lanterns) {
    const low = l.lit && l.fuel < T.low_fuel_threshold * R.fuel_unit;
    if (low && !lowWarned.has(l.id) && phase === 'playing') caption('low' + l.id, `⚠ Đèn ${l.id} sắp cạn dầu (${Math.floor(l.fuel / R.fuel_unit)}) — Bóng Mực sẽ tới hút!`, 4000);
    if (low) lowWarned.add(l.id);
    else lowWarned.delete(l.id);
  }
  // ambient light grows with progress: 0.15 + 0.55 × lit/total (Ticket-02)
  ambient.intensity = 0.15 + 0.55 * (sim.litCount / sim.lanterns.length);

  if (ents.pulse) {
    const fx = ents.pulse;
    fx.t += 1 / 60;
    fx.mesh.position.set(fx.x, fx.y + R.pulse_center_dy, fx.z);
    fx.mesh.scale.setScalar(Math.max(0.01, (fx.t / 0.3) * T.pulse_radius));
    fx.mesh.material.opacity = Math.max(0, 0.5 - fx.t * 1.4);
    if (fx.t > 0.35) (scene.remove(fx.mesh), (ents.pulse = null));
  }

  // wind: warn 2 s before (leaves + sound), leaves blow during the gust
  const windSoon = sim.windEnabled && !sim.wind.active && sim.simTick > 0 && sim.simTick % R.wind_every >= R.wind_every - 120;
  $('windWarn').style.display = windSoon ? 'block' : 'none';
  if (windSoon && !windWarned) {
    caption('wind', '🍃 Gió sắp thổi (2 giây)…', 2500);
    audio.sfx('wind');
    windWarned = true;
  }
  if (!windSoon) windWarned = false;
  const lv = ents.leaves;
  lv.visible = windSoon || sim.wind.active;
  if (lv.visible) {
    const a = sim.wind.active ? (sim.wind.dir * Math.PI) / 180 : now * 0.5;
    const p = lv.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = (now * (sim.wind.active ? 6 : 2) + i * 0.37) % 12;
      p.setXYZ(i, P.pos[0] + Math.cos(a) * (k - 6) + Math.sin(i * 7.1) * 4, P.pos[1] + 0.5 + ((i * 13) % 30) / 10, P.pos[2] + Math.sin(a) * (k - 6) + Math.cos(i * 3.3) * 4);
    }
    p.needsUpdate = true;
  }
}

function updateCamera(nowMs) {
  if (phase === 'bench') {
    // benchmark camera: circle r = 30 m at Y = 15 around (0,0,0), start at 0° = (30,15,0), CCW seen from above, 15 s per lap
    const t = bench.firstFrame === null ? 0 : (nowMs - bench.firstFrame) / 1000;
    const a = (t / 15) * Math.PI * 2;
    camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a));
    camera.lookAt(0, 0, 0);
    return;
  }
  if (phase === 'playing') {
    if (keys.has('arrowleft')) camYaw += 2 * settings.sens;
    if (keys.has('arrowright')) camYaw -= 2 * settings.sens;
  }
  const th = (camYaw * Math.PI) / 180;
  const P = sim.player.pos;
  const y = Math.max(P[1], -2);
  camera.position.set(P[0] - Math.sin(th) * 9, y + 5.5, P[2] - Math.cos(th) * 9);
  camera.lookAt(P[0], y + 1.5, P[2]);
  if (shake > 0 && !settings.reduceMotion) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - 0.02);
  }
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const v3 = new THREE.Vector3();
function updateHud() {
  const P = sim.player;
  $('flames').innerHTML = Array.from({ length: Math.max(T.flames, P.flames) }, (_, i) => `<span class="${i < P.flames ? 'on' : 'off'}">●</span>`).join('');
  const tl = Math.ceil(sim.timeLeftS);
  $('timer').textContent = (tl <= 30 && settings.cb ? '⚠ ' : '') + fmt(tl);
  $('timer').className = tl <= 30 ? 'danger' : '';
  if (phase === 'playing' && tl <= 10 && tl < lastCountdown && tl > 0) {
    audio.sfx('tick'); // last-10-s countdown (sound + caption)
    caption('last10', `⏳ ${tl} giây cuối tới bình minh!`, 1100);
  }
  lastCountdown = tl;
  $('lit').textContent = `${sim.litCount}/${sim.lanterns.length} (cần ${sim.winThreshold})`;
  $('score').textContent = totalScore + sim.score;
  const cap = sim.capacity;
  if ($('moteBar').children.length !== cap) $('moteBar').innerHTML = '<i></i>'.repeat(cap);
  [...$('moteBar').children].forEach((c, i) => c.classList.toggle('on', i < P.carried));
  $('carried').textContent = `${P.carried}/${cap}`;
  const dashP = P.charm > 0 ? 0 : P.dashCd / R.dash_cd_ticks;
  $('cdDash').style.setProperty('--p', dashP);
  $('cdDash').classList.toggle('off', dashP > 0);
  const pulseP = P.pulseCd / R.pulse_cd_ticks;
  $('cdPulse').style.setProperty('--p', pulseP);
  $('cdPulse').classList.toggle('off', pulseP > 0 || P.carried < T.pulse_cost);
  $('charmBadge').textContent = P.charm > 0 ? `Bùa Gió ${(P.charm / 60).toFixed(1)}s` : '';

  const near = sim.nearestLantern(P.pos, (l) => (!l.lit || l.fuel < T.fuel_max * R.fuel_unit) && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= T.interact_radius);
  $('prompt').textContent = !near || phase !== 'playing' ? '' : near.lit ? `E — Châm dầu (${Math.floor(near.fuel / R.fuel_unit)}/${T.fuel_max})` : `E — Nạp ánh sáng (${near.deposited}/${sim.costOf(near)})`;

  // arrow to the nearest unlit lantern when it is off-screen
  const arrow = $('arrow');
  arrow.style.display = 'none';
  const unlit = sim.lanterns.filter((l) => !l.lit);
  if (unlit.length) {
    const dist = (l) => Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]);
    const l = unlit.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
    v3.set(l.pos[0], l.pos[1] + 3.6, l.pos[2]).project(camera);
    const behind = v3.z > 1;
    let x = behind ? -v3.x : v3.x;
    let y = behind ? -v3.y : v3.y;
    if (behind || Math.abs(x) > 1 || Math.abs(y) > 1) {
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m;
      y /= m;
      arrow.style.display = 'block';
      arrow.style.left = `${((x * 0.9 + 1) / 2) * innerWidth - 15}px`;
      arrow.style.top = `${((1 - y * 0.85) / 2) * innerHeight - 15}px`;
      arrow.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    }
  }
  // edge arrow toward a newly spawned shade (visual cue that goes with the caption)
  const sa = $('shadeArrow');
  sa.style.display = 'none';
  const sh = shadeAlert && performance.now() < shadeAlert.until && sim.shades.find((s) => s.id === shadeAlert.id);
  if (sh) {
    v3.set(sh.pos[0], sh.pos[1], sh.pos[2]).project(camera);
    const behind = v3.z > 1;
    let x = behind ? -v3.x : v3.x;
    let y = behind ? -v3.y : v3.y;
    const m = Math.max(Math.abs(x), Math.abs(y), 1);
    x /= m;
    y /= m;
    sa.style.display = 'block';
    sa.style.left = `${((x * 0.92 + 1) / 2) * innerWidth - 18}px`;
    sa.style.top = `${((1 - y * 0.88) / 2) * innerHeight - 18}px`;
    sa.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
  }
}

// ---------- loop: fixed 60 Hz simulation, render every frame ----------
let last = performance.now();
const fps = { frames: 0, t0: performance.now(), samples: [] };
function frame(nowMs) {
  const dt = Math.min(0.1, (nowMs - last) / 1000);
  last = nowMs;
  if (phase === 'bench') benchFrame(nowMs);
  if (sim && (phase === 'playing' || phase === 'bench')) {
    acc += dt;
    let prevGrounded = sim.player.grounded;
    while (acc >= STEP && (phase === 'playing' || phase === 'bench') && sim.state === 'playing') {
      acc -= STEP;
      if (phase === 'bench') {
        sim.step({}); // no player input in the benchmark
        continue;
      }
      for (const e of sim.step(readInput())) onEvent(e);
      if (prevGrounded && !sim.player.grounded && sim.player.vel[1] >= R.jump_speed - 1) audio.sfx(sim.player.launch ? 'pad' : 'jump');
      prevGrounded = sim.player.grounded;
    }
  }
  if (sim) {
    sync(nowMs / 1000);
    updateCamera(nowMs);
    if (phase !== 'bench') updateHud();
  }
  renderer.render(scene, camera);
  fps.frames++;
  if (nowMs - fps.t0 >= 1000) {
    const f = (fps.frames * 1000) / (nowMs - fps.t0);
    fps.samples.push(f);
    $('fps').textContent = `${f.toFixed(0)} FPS`;
    document.body.dataset.fps = f.toFixed(1);
    document.body.dataset.fpsAvg = (fps.samples.reduce((a, b) => a + b, 0) / fps.samples.length).toFixed(1);
    fps.frames = 0;
    fps.t0 = nowMs;
  }
  document.body.dataset.tick = sim ? sim.simTick : 0;
  requestAnimationFrame(frame);
}

// ---------- benchmark mode (Ticket-04 §1): ?bench&seed=42&duration=30 — driven by tools/bench.js ----------
function startBench(seed, duration) {
  phase = 'bench';
  hideCard();
  $('hud').classList.add('hidden');
  buildWorld(NIGHTS[1]);
  sim = createBenchSim(seed);
  spawnEntities();
  bench = { seed, duration, firstFrame: null, firstFrameEpoch: null, prev: null, dts: [], heapPeak: 0, done: false };
}
function benchFrame(nowMs) {
  const b = bench;
  if (b.done) return;
  if (b.firstFrame === null) {
    b.firstFrame = nowMs;
    b.firstFrameEpoch = performance.timeOrigin + nowMs;
    b.prev = nowMs;
    return;
  }
  const t = nowMs - b.firstFrame;
  const dt = nowMs - b.prev;
  b.prev = nowMs;
  if (t <= 3000) return; // 3 s warm-up, not measured
  b.dts.push(dt);
  if (performance.memory) b.heapPeak = Math.max(b.heapPeak, performance.memory.usedJSHeapSize);
  if (t >= 3000 + b.duration * 1000) {
    b.done = true;
    const N = b.dts.length;
    const sum = b.dts.reduce((a, c) => a + c, 0);
    const sorted = [...b.dts].sort((a, c) => a - c);
    const k = Math.max(1, Math.ceil(0.01 * N));
    const worst = sorted.slice(N - k);
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    window.__benchResult = {
      frames: N,
      avg_fps: Math.round(((1000 * N) / sum) * 10) / 10,
      p1_low_fps: Math.round((1000 / (worst.reduce((a, c) => a + c, 0) / k)) * 10) / 10,
      frame_ms_p95: Math.round(sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)] * 100) / 100,
      first_frame_epoch_ms: b.firstFrameEpoch,
      js_heap_peak_mb: b.heapPeak ? Math.round(b.heapPeak / 1048576) : null,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      three: THREE.REVISION,
      shades: sim.shades.length,
      motes: sim.motes.length,
      canvas: `${renderer.domElement.width}x${renderer.domElement.height}`,
    };
  }
}

// ?night=N&autostart → straight into a night (screenshots / FPS bench); ?lit=K pre-lights K lanterns (screenshots only)
if (qs.has('bench')) startBench(Number(qs.get('seed') ?? 42), Number(qs.get('duration') ?? 30));
else if (qs.has('night')) {
  startNight(Number(qs.get('night')) || 1, qs.has('autostart'));
  // screenshots only: ?lit=K lights K lanterns (full fuel), ?low makes the first one low on fuel, ?cb forces colour-blind mode
  if (qs.has('lit')) sim.lanterns.slice(0, Number(qs.get('lit'))).forEach((l) => Object.assign(l, { lit: true, everLit: true, deposited: T.lantern_cost, fuel: T.fuel_max * R.fuel_unit }));
  if (qs.has('low')) sim.lanterns[0].fuel = 20 * R.fuel_unit;
  if (qs.has('cb')) (settings.cb = true), applyCb();
} else menu();
if (!qs.has('fps')) $('fps').classList.add('hidden');
requestAnimationFrame(frame);
window.__game = { get sim() { return sim; }, get phase() { return phase; } };
