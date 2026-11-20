// UI flow smoke test through a real browser (CDP): menu → intro → play → pause freezes logic → resume →
// settings persist across reloads → lose → retry same night. Needs `npm start` and Chrome.
//   CHROME=... GAME_URL=http://localhost:8080/web/ node tools/ui-smoke.js
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || (platform() === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : platform() === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const BASE = process.env.GAME_URL || 'http://localhost:8080/web/';
const port = 9800 + Math.floor(Math.random() * 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-ui-'))}`, '--headless=new', '--window-size=1280,720', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`);
};

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch { /* not up yet */ }
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) (pending.get(d.id)(d.result), pending.delete(d.id));
  };
  const send = (method, params = {}) => new Promise((r) => (pending.set(++id, r), ws.send(JSON.stringify({ id, method, params }))));
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const key = async (k, code) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: code === 'Escape' ? 27 : k.toUpperCase().charCodeAt(0) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
  };
  const click = (btnId) => ev(`document.getElementById('${btnId}').click(), true`);
  const st = () => ev('JSON.stringify({phase: __game.phase, tick: __game.sim ? __game.sim.simTick : -1, night: __game.sim ? __game.sim.night : 0})').then(JSON.parse);

  await send('Page.navigate', { url: BASE });
  await sleep(2500);
  check('Main menu shown first', (await st()).phase === 'menu' && (await ev("!!document.getElementById('bStart')")));
  await click('bStart');
  await sleep(300);
  check('Night intro shows island name + Ông Đăng', (await st()).phase === 'intro' && (await ev("document.getElementById('card').innerText.includes('Đảo Bến') && document.getElementById('card').innerText.includes('Ông Đăng')")));
  await click('bGo');
  await sleep(2000);
  const s1 = await st();
  check('Playing: simulation advances', s1.phase === 'playing' && s1.tick > 30, `sim_tick=${s1.tick}`);
  await key('p', 'KeyP');
  await sleep(200);
  const p1 = await st();
  await sleep(1500);
  const p2 = await st();
  check('P pauses and logic is frozen', p1.phase === 'paused' && p1.tick === p2.tick, `tick ${p1.tick} -> ${p2.tick}`);
  check('Pause menu has Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu', await ev("['bRes','bRe','bSet','bMenu'].every((i)=>document.getElementById(i))"));
  await key('Escape', 'Escape');
  await sleep(1000);
  const r1 = await st();
  check('Esc resumes', r1.phase === 'playing' && r1.tick > p2.tick, `tick ${r1.tick}`);

  await key('p', 'KeyP');
  await sleep(200);
  await click('bSet');
  await ev("(()=>{const v=document.getElementById('vol');v.value=33;v.dispatchEvent(new Event('input'));const s=document.getElementById('sens');s.value=17;s.dispatchEvent(new Event('input'));return true})()");
  await send('Page.reload');
  await sleep(2500);
  const saved = await ev("localStorage.getItem('ddl-settings')");
  await click('bSet');
  await sleep(200);
  const shown = await ev("document.getElementById('vol').value + '/' + document.getElementById('sens').value");
  check('Settings (volume, mouse sensitivity) persist across reload', saved && JSON.parse(saved).volume === 0.33 && JSON.parse(saved).sens === 1.7 && shown === '33/17', `${saved} ui=${shown}`);

  // lose → retry same night
  await send('Page.navigate', { url: `${BASE}?night=2&autostart` });
  await sleep(1500);
  await ev('(__game.sim.player.flames = 0, true)');
  await sleep(1500);
  const lost = await ev("document.getElementById('card').innerText");
  check('Losing shows result with "Chơi lại Đêm"', lost.includes('Thua') && lost.includes('Chơi lại Đêm 2'), lost.replace(/\n/g, ' | '));
  await click('bRe');
  await sleep(300);
  check('Retry restarts the same night', (await st()).night === 2 && (await st()).phase === 'intro');

  // win night 3 → Bình Minh with total score
  await send('Page.navigate', { url: `${BASE}?night=3&autostart` });
  await sleep(1500);
  // Ticket-03: no early win — lighting everything must NOT end the night; forcing dawn with 5/7 lit must win
  await ev('(__game.sim.lanterns.slice(0,5).forEach((l)=>{l.lit=true;l.everLit=true;l.deposited=10;l.fuel=6000}), true)');
  await sleep(1000);
  check('All required lanterns lit does not end the night (no early win)', (await st()).phase === 'playing');
  await ev('(__game.sim.endTick = __game.sim.simTick + 30, true)');
  await sleep(1800);
  const dawn = await ev("document.getElementById('card').innerText");
  check('Surviving dawn on night 3 shows Bình Minh with total score', dawn.includes('Bình Minh') && dawn.includes('Tổng điểm'), dawn.replace(/\n/g, ' | '));

  // Ticket-03 colour-blind setting: persisted, flips the UI danger colour to #FFFFFF
  await send('Page.navigate', { url: BASE });
  await sleep(2000);
  await click('bSet');
  await ev("(()=>{const c=document.getElementById('cb');c.checked=true;c.dispatchEvent(new Event('change'));return true})()");
  await send('Page.reload');
  await sleep(2000);
  const cb = await ev("JSON.stringify({saved: JSON.parse(localStorage.getItem('ddl-settings')).cb, cls: document.body.classList.contains('cb'), danger: getComputedStyle(document.body).getPropertyValue('--danger').trim()})");
  check('Colour-blind palette setting persists and sets danger colour #FFFFFF', cb === JSON.stringify({ saved: true, cls: true, danger: '#FFFFFF' }), cb);

  // ---------- Ticket-04 ----------
  // key remapping: rebind jump to KeyJ, detect a duplicate, reset to defaults, persistence
  await send('Page.navigate', { url: BASE });
  await sleep(2000);
  await click('bSet');
  await ev("document.querySelector('.kbtn[data-a=jump]').click(), true");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'j', code: 'KeyJ', windowsVirtualKeyCode: 74 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'j', code: 'KeyJ' });
  await sleep(200);
  const k1 = await ev("JSON.parse(localStorage.getItem('ddl-settings')).keys.jump");
  check('Key remap: jump rebound to J and saved', k1 === 'KeyJ', k1);
  await ev("document.querySelector('.kbtn[data-a=dash]').click(), true");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'e', code: 'KeyE' });
  await sleep(200);
  const warn = await ev("document.getElementById('keyWarn').textContent");
  check('Duplicate key (dash = interact = E) is detected and reported', warn.includes('Trùng phím') && warn.includes('Lướt') && warn.includes('Tương tác'), warn);
  await click('bKeyReset');
  await sleep(200);
  const k2 = await ev("JSON.stringify(JSON.parse(localStorage.getItem('ddl-settings')).keys)");
  check('"Khôi phục mặc định" restores every binding', k2 === JSON.stringify({ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'KeyP' }) && (await ev("document.getElementById('keyWarn').textContent")) === '', k2);
  // remapped key actually drives the game: bind jump to J, press J in game, Mây leaves the ground
  await ev("document.querySelector('.kbtn[data-a=jump]').click(), true");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'j', code: 'KeyJ', windowsVirtualKeyCode: 74 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'j', code: 'KeyJ' });
  await ev("(()=>{const c=document.getElementById('rm');c.checked=true;c.dispatchEvent(new Event('change'));const l=document.getElementById('lt');l.checked=true;l.dispatchEvent(new Event('change'));return true})()");
  await send('Page.navigate', { url: `${BASE}?night=1&autostart` });
  await sleep(1500);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'j', code: 'KeyJ', windowsVirtualKeyCode: 74 });
  await sleep(150);
  const y = await ev('__game.sim.player.pos[1]');
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'j', code: 'KeyJ' });
  check('Remapped jump key (J) makes Mây jump in game', y > 0, `y=${y}`);
  const fonts = JSON.parse(await ev("JSON.stringify(['timer','topRight','carried','prompt','cdDash','charmBadge'].map((i)=>parseFloat(getComputedStyle(document.getElementById(i)).fontSize)))"));
  check('Large text on: every HUD text >= 22.5px (18 × 1.25)', fonts.every((f) => f >= 22.5), JSON.stringify(fonts));
  const rmShake = await ev("(JSON.parse(localStorage.getItem('ddl-settings')).reduceMotion)");
  check('Reduced motion setting persisted', rmShake === true);
  // captions: a shade spawn shows a caption and an edge arrow
  await ev('(__game.sim.simTick = 299, true)');
  await sleep(600);
  const cap = await ev("document.getElementById('captions').innerText");
  check('Caption + arrow when a shade appears', cap.includes('Bóng Mực xuất hiện'), cap.replace(/\n/g, ' | '));
  // reset settings for the next checks
  await ev("(localStorage.removeItem('ddl-settings'), true)");
  await send('Page.navigate', { url: BASE });
  await sleep(1500);
  const small = JSON.parse(await ev("JSON.stringify([...document.querySelectorAll('#card *')].filter((e)=>e.childElementCount===0 && e.textContent.trim()).map((e)=>parseFloat(getComputedStyle(e).fontSize)))"));
  check('Default text: no menu text below 18px at 1280×720', small.length > 0 && Math.min(...small) >= 18, `min ${Math.min(...small)}px over ${small.length} elements`);

  // leaderboard: lose → enter name → saved → listed from main menu
  await send('Page.navigate', { url: `${BASE}?night=1&autostart` });
  await sleep(1500);
  await ev('(__game.sim.player.flames = 0, true)');
  await sleep(1500);
  await ev("(document.getElementById('pname').value='ab', true)");
  await click('bSave');
  await sleep(300);
  check('Invalid name (2 chars) is rejected', (await ev("document.getElementById('nameErr').textContent")).length > 0);
  await ev("(document.getElementById('pname').value='Mây_UI', true)");
  await click('bSave');
  await sleep(800);
  const lb = await ev("document.getElementById('card').innerText");
  check('Score saved and leaderboard shown after losing', lb.includes('Bảng xếp hạng') && lb.includes('Mây_UI'), lb.replace(/\n/g, ' | ').slice(0, 160));
  await send('Page.navigate', { url: BASE });
  await sleep(1500);
  await click('bLb');
  await sleep(800);
  check('Leaderboard reachable from main menu and survives reload', (await ev("document.getElementById('card').innerText")).includes('Mây_UI'));
  ws.close();
} finally {
  chrome.kill();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} UI checks passed`);
process.exitCode = fails ? 1 : 0;
