#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node tools/bench.js --seed 42 --duration 30 --out bench.json [--headless]
// Starts the local game server, opens Chrome/Chromium in a 1280x720 window (vsync and frame-rate cap disabled with
// --disable-gpu-vsync --disable-frame-rate-limit), loads /web/?bench (night 1, 200 wandering shades, 100 motes,
// L1–L3 lit, orbit camera), waits 3 s warm-up + duration, and writes bench.json. Exit code 0 on success.
// load_ms = time from this process start to the first frame of the bench scene.
// peak_mem_mb = peak RSS of the whole browser process tree (browser + GPU + renderer), sampled every ~2 s.
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir, platform, cpus, totalmem, type, release, arch } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { startServer } from './serve.js';

const PROCESS_START = performance.timeOrigin; // epoch ms when this Node process started
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const seed = parseInt(arg('--seed', '42'), 10);
const duration = Number(arg('--duration', '30'));
const out = arg('--out', 'bench.json');
const headless = process.argv.includes('--headless');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = promisify(execFile);

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const c = {
    win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  }[platform()] || [];
  return c.find((p) => existsSync(p)) || 'google-chrome';
}

async function treeRssMb(rootPid) {
  try {
    let rows;
    if (platform() === 'win32') {
      const { stdout } = await run('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress'], { maxBuffer: 1 << 26 });
      rows = JSON.parse(stdout).map((p) => [p.ProcessId, p.ParentProcessId, Number(p.WorkingSetSize) / 1024]);
    } else {
      const { stdout } = await run('ps', ['-A', '-o', 'pid=,ppid=,rss=']);
      rows = stdout.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
    }
    const kids = new Map();
    for (const [pid, ppid] of rows) kids.set(ppid, [...(kids.get(ppid) || []), pid]);
    const rss = new Map(rows.map(([pid, , kb]) => [pid, kb]));
    let total = 0;
    const stack = [rootPid];
    while (stack.length) {
      const p = stack.pop();
      total += rss.get(p) || 0;
      stack.push(...(kids.get(p) || []));
    }
    return total / 1024;
  } catch {
    return null;
  }
}

const server = await startServer(0, { quiet: true });
const port = server.address().port;
const dbg = 9200 + Math.floor(Math.random() * 500);
const flags = [`--remote-debugging-port=${dbg}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-bench-'))}`, '--window-size=1280,720', '--window-position=40,40', '--no-first-run', '--no-default-browser-check', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
if (headless) flags.push('--headless=new');
const chrome = spawn(findChrome(), [...flags, 'about:blank'], { stdio: 'ignore' });
let code = 0;
try {
  let targets;
  for (let i = 0; i < 100 && !targets; i++) {
    await sleep(100);
    try {
      targets = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json();
    } catch { /* starting */ }
  }
  if (!targets) throw new Error('could not start Chrome (set CHROME=/path/to/chrome)');
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) (pending.get(d.id)(d.result), pending.delete(d.id));
  };
  const send = (method, params = {}) => new Promise((r) => (pending.set(++id, r), ws.send(JSON.stringify({ id, method, params }))));
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/web/?bench&seed=${seed}&duration=${duration}` });
  let peak = 0;
  let result = null;
  const deadline = Date.now() + (duration + 60) * 1000;
  while (!result && Date.now() < deadline) {
    const m = await treeRssMb(chrome.pid);
    if (m) peak = Math.max(peak, m);
    const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__benchResult || null)', returnByValue: true });
    result = JSON.parse(r.result?.value || 'null');
    if (!result) await sleep(1500);
  }
  ws.close();
  if (!result) throw new Error('benchmark did not finish in time');
  const report = {
    contract_version: '1.3',
    avg_fps: result.avg_fps,
    p1_low_fps: result.p1_low_fps,
    frame_ms_p95: result.frame_ms_p95,
    frames: result.frames,
    load_ms: Math.round(result.first_frame_epoch_ms - PROCESS_START),
    peak_mem_mb: peak ? Math.round(peak) : null,
    vsync_off: true,
    renderer: `Three.js r${result.three} WebGL2 in ${headless ? 'headless ' : ''}Chrome (${result.gpu}); flags --disable-gpu-vsync --disable-frame-rate-limit`,
    os: `${type()} ${release()} ${arch()} · ${cpus()[0].model} · ${Math.round(totalmem() / 1073741824)} GB RAM`,
    seed,
    duration_s: duration,
    scene: { shades: result.shades, motes: result.motes, canvas: result.canvas },
    js_heap_peak_mb: result.js_heap_peak_mb,
    notes: 'peak_mem_mb = peak RSS (working set on Windows) summed over the Chrome process tree; frame times from requestAnimationFrame timestamps.',
    pass: result.avg_fps >= 60 && result.p1_low_fps >= 30 && Math.round(result.first_frame_epoch_ms - PROCESS_START) <= 10000,
  };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  process.stderr.write(`bench: ${e.message}\n`);
  code = 1;
} finally {
  chrome.kill();
  server.close();
}
process.exit(code);
