// FPS benchmark at 1280x720 (Ticket-02 DoD: >= 30 FPS average).
// Needs `npm start` running and a local Chrome/Chromium. Usage:
//   CHROME="/path/to/chrome" node tools/fps-bench.js [seconds=20] [nights=1,2,3] [--headless]
// Opens each night with ?night=N&autostart&fps, lets it run, then reads document.body.dataset.fpsAvg over CDP.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir, cpus, platform } from 'node:os';
import { join } from 'node:path';

const secs = Number(process.argv[2]) || 20;
const nights = (process.argv[3] || '1,2,3').split(',').map(Number);
const headless = process.argv.includes('--headless');
const CHROME = process.env.CHROME || (platform() === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : platform() === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const BASE = process.env.GAME_URL || 'http://localhost:8080/web/';
const port = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-fps-'))}`, '--window-size=1280,720', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--ignore-gpu-blocklist'];
if (headless) args.push('--headless=new');
const chrome = spawn(CHROME, [...args, 'about:blank'], { stdio: 'ignore' });

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) (pending.get(d.id)(d.result), pending.delete(d.id));
  };
  return { send: (method, params = {}) => new Promise((r) => (pending.set(++id, r), ws.send(JSON.stringify({ id, method, params })))), close: () => ws.close() };
}

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch { /* not up yet */ }
  }
  const page = targets.find((t) => t.type === 'page');
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const rows = [];
  for (const n of nights) {
    await c.send('Page.navigate', { url: `${BASE}?night=${n}&autostart&fps` });
    await sleep(secs * 1000);
    const r = await c.send('Runtime.evaluate', { expression: 'JSON.stringify({avg: document.body.dataset.fpsAvg, last: document.body.dataset.fps, tick: document.body.dataset.tick, gl: (()=>{const g=document.querySelector("canvas").getContext("webgl2");const e=g&&g.getExtension("WEBGL_debug_renderer_info");return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):"?"})()})', returnByValue: true });
    const v = JSON.parse(r.result.value);
    rows.push({ night: n, avg_fps: Number(v.avg), last_fps: Number(v.last), sim_ticks: Number(v.tick), renderer: v.gl });
  }
  c.close();
  const out = { date: new Date().toISOString(), resolution: '1280x720', seconds_per_night: secs, headless, cpu: cpus()[0].model, platform: `${platform()} ${process.arch}`, node: process.version, rows, pass: rows.every((r) => r.avg_fps >= 30) };
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = out.pass ? 0 : 1;
} finally {
  chrome.kill();
}
