#!/usr/bin/env node
// Zero-dependency game server. `npm start` (= node tools/serve.js) -> http://localhost:8080/
//   node tools/serve.js --export-leaderboard out.json   -> writes {"entries":[...]} (top 10, ranked) and exits
// The local leaderboard lives on disk in data/leaderboard.json (override with LEADERBOARD_FILE); the browser
// reads/writes it through GET/POST /api/leaderboard. Three.js is served from node_modules (installed by `npm install`).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry, sortEntries, MAX_ENTRIES } from '../src/core/leaderboard.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LB_FILE = resolve(process.env.LEADERBOARD_FILE || join(ROOT, 'data', 'leaderboard.json'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

export function loadBoard(file = LB_FILE) {
  try {
    const d = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(d.entries) ? sortEntries(d.entries).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}
async function saveBoard(entries) {
  await mkdir(dirname(LB_FILE), { recursive: true });
  const tmp = `${LB_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  await rename(tmp, LB_FILE); // atomic replace: a crash never leaves a half-written board
}

export function startServer(port = Number(process.env.PORT) || 8080, { quiet = false } = {}) {
  let queue = Promise.resolve();
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/api/leaderboard') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ entries: loadBoard() }));
      }
      if (req.method === 'POST') {
        let body = '';
        for await (const c of req) {
          body += c;
          if (body.length > 10000) break;
        }
        // serialize writes so two quick submits cannot lose each other
        queue = queue.then(async () => {
          try {
            const entries = addEntry(loadBoard(), JSON.parse(body));
            await saveBoard(entries);
            res.writeHead(200, { 'Content-Type': MIME['.json'] });
            res.end(JSON.stringify({ entries }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': MIME['.json'] });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return queue;
      }
      res.writeHead(405);
      return res.end();
    }
    if (url === '/') {
      res.writeHead(302, { Location: '/web/' });
      return res.end();
    }
    let path = normalize(join(ROOT, url));
    if (!path.startsWith(ROOT) || path.startsWith(join(ROOT, 'data'))) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    if (url.endsWith('/')) path = join(path, 'index.html');
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((r) =>
    server.listen(port, () => {
      if (!quiet) console.log(`Đảo Đèn Lồng: mở http://localhost:${server.address().port}/ trên trình duyệt (Ctrl+C để dừng)`);
      r(server);
    }),
  );
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf('--export-leaderboard');
  if (i > 0) {
    const out = process.argv[i + 1];
    if (!out) {
      process.stderr.write('usage: node tools/serve.js --export-leaderboard out.json\n');
      process.exit(1);
    }
    writeFileSync(out, JSON.stringify({ entries: loadBoard() }, null, 2) + '\n');
    console.log(`exported ${loadBoard().length} entries from ${existsSync(LB_FILE) ? LB_FILE : '(empty board)'} to ${out}`);
    process.exit(0);
  }
  if (!existsSync(join(ROOT, 'node_modules', 'three'))) console.warn('⚠ node_modules/three not found — run `npm install` first.');
  startServer();
}
