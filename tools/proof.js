// Regenerates Phase 1 evidence: runs every catalog scenario through the real CLI and writes
// docs/proof/phase-1/<id>/{scenario.json,inputs.json,out.jsonl} + docs/proof/phase-1/RESULTS.md.
// Never edit the outputs by hand — rerun `npm run proof` at the tag to reproduce.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { SCENARIOS } from '../tests/scenarios/catalog.js';

const phase = process.argv[2] || 'phase-2';
const root = join('docs', 'proof', phase);
mkdirSync(root, { recursive: true });
// remove only generated files (keep screens/ and anything hand-made like screenshots)
for (const f of readdirSync(root)) if (/^AC\d+_|^determinism_run|^RESULTS\.md$/.test(f)) rmSync(join(root, f), { recursive: true, force: true });

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

// determinism evidence: run the default level twice with the same seed and hash both outputs
const hashes = [];
for (const n of [1, 2]) {
  const out = join(root, `determinism_run${n}.jsonl`);
  execFileSync(process.execPath, ['src/headless.js', '--seed', '2026', '--night', '1', '--ticks', '3600', '--out', out]);
  hashes.push(createHash('sha256').update(readFileSync(out)).digest('hex'));
}
const detOk = hashes[0] === hashes[1];
if (!detOk) fails++;

const md = `# Bằng chứng Phase 1 (tự sinh bởi \`npm run proof\`)

Sinh lúc: ${new Date().toISOString()} · Node ${process.version} · ${process.platform}/${process.arch}

Mỗi dòng: một tiêu chí nghiệm thu, chạy qua **CLI headless thật**; input/output nằm trong thư mục cùng tên.

| ID | Yêu cầu | Lệnh | Dòng end | Kết quả |
|---|---|---|---|---|
${rows.join('\n')}

## Tính tất định

Chạy 2 lần \`--seed 2026 --night 1 --ticks 3600\` (màn mặc định, có sinh ngẫu nhiên):

- run1 sha256: \`${hashes[0]}\`
- run2 sha256: \`${hashes[1]}\`
- Kết quả: **${detOk ? 'ĐẠT (giống hệt)' : 'CHƯA ĐẠT'}**

Tổng: ${SCENARIOS.length + 1 - fails}/${SCENARIOS.length + 1} đạt.
`;
writeFileSync(join(root, 'RESULTS.md'), md);
console.log(md);
process.exit(fails ? 1 : 0);
