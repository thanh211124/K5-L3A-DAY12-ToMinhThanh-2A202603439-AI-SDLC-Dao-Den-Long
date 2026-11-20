#!/usr/bin/env node
// Builds the GitHub Release asset: a self-contained static web build (no CDN, no npm needed to PLAY).
//   npm run build  ->  dist/dao-den-long-v1.0.0-web/  +  dist/dao-den-long-v1.0.0-web.zip (or .tar.gz)
// Play: unzip, then serve the folder with any static server, e.g. `python3 -m http.server 8080` or `npx serve`,
// and open http://localhost:8080/ . (ES modules need http://, not file://.) The leaderboard falls back to localStorage.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;
const NAME = `dao-den-long-v${VERSION}-web`;
const OUT = join('dist', NAME);
rmSync('dist', { recursive: true, force: true });
mkdirSync(join(OUT, 'vendor'), { recursive: true });
cpSync('web', join(OUT, 'web'), { recursive: true });
cpSync(join('src', 'core'), join(OUT, 'src', 'core'), { recursive: true });
if (!existsSync('node_modules/three/build/three.module.js')) throw new Error('run `npm install` first');
cpSync('node_modules/three/build/three.module.js', join(OUT, 'vendor', 'three.module.js'));
cpSync('node_modules/three/LICENSE', join(OUT, 'vendor', 'THREE-LICENSE'));
for (const f of ['LICENSE', 'CREDITS.md', 'CHANGELOG.md']) cpSync(f, join(OUT, f));
const html = join(OUT, 'web', 'index.html');
writeFileSync(html, readFileSync(html, 'utf8').replace('"/node_modules/three/build/three.module.js"', '"../vendor/three.module.js"'));
writeFileSync(join(OUT, 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=web/"><a href="web/">Đảo Đèn Lồng</a>\n');
writeFileSync(
  join(OUT, 'README.txt'),
  `Đảo Đèn Lồng v${VERSION} — static web build (Tô Minh Thành · 2A202603439)\n\n` +
    '1. Unzip this folder.\n2. Inside it run ONE of:  python3 -m http.server 8080   |   npx serve -l 8080\n3. Open http://localhost:8080/ in Chrome, Edge, Firefox or Safari.\n\n' +
    'Leaderboard is kept in the browser (localStorage) in this build. For the on-disk leaderboard, headless mode,\n' +
    'benchmark and soak test, use the source release: git clone, npm install, npm start (see README.md in the repo).\n',
);
// archive (zip where available, else tar.gz)
let archive = `${NAME}.zip`;
try {
  execFileSync('tar', ['-a', '-c', '-f', archive, NAME], { cwd: 'dist' });
} catch {
  archive = `${NAME}.tar.gz`;
  execFileSync('tar', ['-czf', archive, NAME], { cwd: 'dist' });
}
console.log(`built dist/${NAME}/ and dist/${archive}`);
