// Zero-dependency static server for the browser build. `npm start` -> http://localhost:8080/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve('.');
const PORT = Number(process.env.PORT) || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') {
    res.writeHead(302, { Location: '/web/' });
    return res.end();
  }
  let path = normalize(join(ROOT, url));
  if (!path.startsWith(ROOT)) {
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
}).listen(PORT, () => console.log(`Đảo Đèn Lồng: mở http://localhost:${PORT}/ trên trình duyệt (Ctrl+C để dừng)`));
