// Ticket-04: soak command contract + benchmark scene definition (logic side; the FPS run itself needs a browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBenchSim } from '../src/core/sim.js';

test('soak: 3 nights in one process, schema + thresholds', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'ddl-soak-')), 'soak.json');
  const r = spawnSync(process.execPath, ['--expose-gc', '--jitless', '--no-expose-wasm', 'tools/soak.js', '--seed', '7', '--nights', '3', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(s.nights, 3);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 3);
  for (const k of ['mem_start_mb', 'mem_end_mb', 'duration_s']) assert.equal(typeof s[k], 'number', k);
  assert.deepEqual(s.per_night.map((n) => [n.night, n.seed]), [[1, 8], [2, 9], [3, 10]]);
});

test('soak is deterministic per seed (same results twice)', () => {
  const run = () => {
    const out = join(mkdtempSync(join(tmpdir(), 'ddl-soak2-')), 's.json');
    spawnSync(process.execPath, ['--jitless', '--no-expose-wasm', 'tools/soak.js', '--seed', '11', '--nights', '3', '--out', out]);
    return JSON.parse(readFileSync(out, 'utf8')).per_night.map((n) => [n.ticks, n.result, n.score]);
  };
  assert.deepEqual(run(), run());
});

test('bench scene: 200 wandering shades, 100 motes, L1–L3 lit at 100, no damage/pickup/decay/spawn/end, seeded', () => {
  const a = createBenchSim(42);
  const b = createBenchSim(42);
  const s0 = a.snapshot();
  assert.equal(s0.shades.length, 200);
  assert.ok(s0.shades.every((x) => x.state === 'wander'));
  assert.equal(s0.motes_active, 100);
  assert.deepEqual(s0.lanterns.map((l) => [l.id, l.lit, l.fuel]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.ok(s0.shades.every((x) => Math.hypot(x.pos[0], x.pos[2]) <= 40));
  assert.deepEqual(JSON.stringify(b.snapshot()), JSON.stringify(s0));
  for (let i = 0; i < 20000; i++) a.step({}); // > night 1 duration: night must not end
  const s1 = a.snapshot();
  assert.equal(s1.state, 'playing');
  assert.equal(s1.shades.length, 200);
  assert.equal(s1.motes_active, 100);
  assert.equal(s1.player.flames, 3);
  assert.deepEqual(s1.lanterns.slice(0, 3).map((l) => l.fuel), [100, 100, 100]);
  assert.ok(s1.shades.some((x, i) => x.pos[0] !== s0.shades[i].pos[0]), 'shades still move');
});
