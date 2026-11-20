// Regenerates phase evidence: runs every catalog scenario through the real CLI and writes
// docs/proof/<phase>/<id>/{scenario.json,inputs.json,out.jsonl} + docs/proof/<phase>/RESULTS.md (default phase-4).
// Never edit the outputs by hand — rerun `npm run proof` at the tag to reproduce.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { SCENARIOS } from '../tests/scenarios/catalog.js';

const phase = process.argv[2] || 'phase-4';
const root = join('docs', 'proof', phase);
mkdirSync(root, { recursive: true });
// remove only generated files (keep screens/ and anything hand-made like screenshots)
for (const f of readdirSync(root)) if (/^(AC|P\d_)\d+_|^determinism|^RESULTS\.md$/.test(f)) rmSync(join(root, f), { recursive: true, force: true });

const rows = [];
let fails = 0;
for (const sc of SCENARIOS) {
  const d = join(root, sc.id);
  mkdirSync(d, { recursive: true });
  const args = ['src/headless.js', '--seed', String(sc.seed ?? 1), '--night', String(sc.night ?? 1), '--ticks', String(sc.ticks), '--snapshot-every', String(sc.every ?? 10)];
  if (sc.scenario) {
    writeFileSync(join(d, 'scenario.json'), JSON.stringify(sc.scenario, null, 2));
    args.push('--scenario', join(d, 'scenario.json'));
  }
  if (sc.inputs) {
    writeFileSync(join(d, 'inputs.json'), JSON.stringify(sc.inputs, null, 2));
    args.push('--inputs', join(d, 'inputs.json'));
  }
  args.push('--out', join(d, 'out.jsonl'));
  execFileSync(process.execPath, args);
  const L = readFileSync(join(d, 'out.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const err = sc.check(L);
  if (err) fails++;
  const cmd = `node ${args.join(' ').replace(/\\/g, '/')}`;
  rows.push(`| ${sc.id} | ${sc.req} | \`${cmd}\` | ${JSON.stringify(L.at(-1)).replace(/\|/g, '\\|')} | ${err ? 'CHƯA ĐẠT: ' + err : 'ĐẠT'} |`);
}

// determinism + 21 600-tick budget evidence: every night, default level, run twice, hash outputs, time it
const det = [];
const immortal = join(root, 'determinism_immortal.json');
writeFileSync(immortal, JSON.stringify({ player: { flames: 1000000 } }));
for (const night of [1, 2, 3]) {
  const hashes = [];
  let ms = 0;
  for (const n of [1, 2]) {
    const out = join(root, `determinism_n${night}_run${n}.jsonl`);
    const t0 = performance.now();
    execFileSync(process.execPath, ['src/headless.js', '--seed', '2026', '--night', String(night), '--scenario', immortal, '--ticks', '21600', '--snapshot-every', '600', '--out', out]);
    ms = Math.max(ms, performance.now() - t0);
    hashes.push(createHash('sha256').update(readFileSync(out)).digest('hex'));
  }
  const ok = hashes[0] === hashes[1] && ms <= 30000;
  if (!ok) fails++;
  det.push(`| ${night} | \`${hashes[0].slice(0, 16)}…\` | \`${hashes[1].slice(0, 16)}…\` | ${ms.toFixed(0)} ms | ${ok ? 'ĐẠT' : 'CHƯA ĐẠT'} |`);
}

const md = `# Bằng chứng ${phase} (tự sinh bởi \`npm run proof\`)

Sinh lúc: ${new Date().toISOString()} · Node ${process.version} · ${process.platform}/${process.arch}

Mỗi dòng: một tiêu chí nghiệm thu, chạy qua **CLI headless thật**; input/output nằm trong thư mục cùng tên.

| ID | Yêu cầu | Lệnh | Dòng end | Kết quả |
|---|---|---|---|---|
${rows.join('\n')}

## Tính tất định và thời gian chạy một Đêm đầy đủ

Mỗi Đêm chạy 2 lần \`--seed 2026 --ticks 21600\` (mọi thứ ngẫu nhiên bật, Mây không thể chết để chạy đủ 21 600 tick); so sha256 và đo thời gian (yêu cầu ≤ 30 s).

| Đêm | run1 sha256 | run2 sha256 | Thời gian chậm nhất | Kết quả |
|---|---|---|---|---|
${det.join('\n')}

Tổng: ${SCENARIOS.length + 3 - fails}/${SCENARIOS.length + 3} đạt.
`;
writeFileSync(join(root, 'RESULTS.md'), md);
console.log(md);
process.exit(fails ? 1 : 0);
