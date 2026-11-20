// Screenshot helper over CDP: open a URL, optionally run JS to stage a situation, wait, capture one or more PNGs.
//   node tools/shot.js <url> <out.png[,out2.png,...]> [--eval "<js>"] [--wait ms] [--every ms]
// Needs `npm start` + Chrome (CHROME=... to override). Staging via __game is for evidence of visuals only.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

const [url, outs] = process.argv.slice(2);
const opt = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const evalJs = opt('--eval', '');
const wait = Number(opt('--wait', 2500));
const every = Number(opt('--every', 500));
const CHROME = process.env.CHROME || (platform() === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : platform() === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const port = 9600 + Math.floor(Math.random() * 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-shot-'))}`, '--headless=new', '--window-size=1280,720', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch { /* starting */ }
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(2000);
  if (evalJs) console.log('eval →', JSON.stringify((await send('Runtime.evaluate', { expression: evalJs, returnByValue: true })).result.value));
  await sleep(wait);
  for (const [i, out] of outs.split(',').entries()) {
    if (i) await sleep(every);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(out, Buffer.from(r.data, 'base64'));
    console.log('saved', out);
  }
  ws.close();
} finally {
  chrome.kill();
}
