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
  await ev('(__game.sim.lanterns.forEach((l)=>{l.lit=true;l.deposited=10}), true)');
  await sleep(1500);
  const dawn = await ev("document.getElementById('card').innerText");
  check('Winning night 3 shows Bình Minh with total score', dawn.includes('Bình Minh') && dawn.includes('Tổng điểm'), dawn.replace(/\n/g, ' | '));
  ws.close();
} finally {
  chrome.kill();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} UI checks passed`);
process.exitCode = fails ? 1 : 0;
