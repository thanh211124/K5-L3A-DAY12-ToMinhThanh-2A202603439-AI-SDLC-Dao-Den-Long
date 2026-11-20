// Contract v1.1 specific checks: new snapshot fields, nights 2/3 determinism, 21 600-tick budget, new scenario validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ddl-v11-'));
const cli = (args) => spawnSync(process.execPath, ['src/headless.js', ...args], { encoding: 'utf8' });
const file = (name, obj) => {
  const f = join(dir, name);
  writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return f;
};
const lines = (f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('snapshot has every v1.1 field with the right types', () => {
  const out = join(dir, 'f.jsonl');
  assert.equal(cli(['--seed', '1', '--night', '3', '--ticks', '20', '--out', out]).status, 0);
  const s = lines(out)[0];
  for (const k of ['tick', 'sim_tick', 'night', 'state', 'time_left_s', 'score', 'wind', 'player', 'lanterns', 'shades', 'motes_active', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
  assert.deepEqual(Object.keys(s.wind).sort(), ['active', 'dir_deg']);
  for (const k of ['pos', 'vel', 'grounded', 'flames', 'carried', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, `player.${k}`);
  for (const m of s.motes) assert.deepEqual(Object.keys(m).sort(), ['id', 'kind', 'pos', 'ttl_s']);
  for (const c of s.charms) assert.deepEqual(Object.keys(c).sort(), ['available', 'id', 'respawn_s']);
});

test('full nights (21 600 ticks, everything random, cannot die) finish in <= 30 s each and are deterministic', () => {
  const sc = file('immortal.json', { player: { flames: 1000000 } });
  const inputs = file('wander.json', { frames: [{ tick: 0, move: [0.4, 1] }, { tick: 600, move: [-1, 0.2], pulse: true }, { tick: 601, pulse: false }, { tick: 1500, move: [0, -1], dash: true }, { tick: 1501, dash: false }] });
  for (const night of [1, 2, 3]) {
    const outs = [];
    for (const n of [1, 2]) {
      const out = join(dir, `full${night}_${n}.jsonl`);
      const t0 = performance.now();
      const r = cli(['--seed', '77', '--night', String(night), '--scenario', sc, '--inputs', inputs, '--ticks', '21600', '--out', out]);
      const ms = performance.now() - t0;
      assert.equal(r.status, 0, r.stderr);
      assert.ok(ms <= 30000, `night ${night} took ${ms} ms`);
      outs.push(readFileSync(out, 'utf8'));
    }
    assert.equal(outs[0], outs[1], `night ${night} not deterministic`);
    const L = outs[0].trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(L.at(-1).ticks <= 21600, true);
  }
});

test('malformed v1.1 scenario fields -> exit 2', () => {
  const bad = [
    { shades: [{ pos: [1, 1, 1], state: 'angry' }] },
    { drifters: [{ pos: [1, 1] }] },
    { charms: [{ id: 'C9' }] },
    { player: { invuln_ticks: -1 } },
    { wind_enabled: 'yes' },
  ];
  bad.forEach((b, i) => {
    const r = cli(['--seed', '1', '--night', '2', '--scenario', file(`b${i}.json`, b), '--ticks', '5', '--out', join(dir, 'x.jsonl')]);
    assert.equal(r.status, 2, `${JSON.stringify(b)} -> ${r.status} ${r.stderr}`);
  });
  const r = cli(['--seed', '1', '--night', '1', '--inputs', file('bp.json', { frames: [{ tick: 0, pause: 'yes' }] }), '--ticks', '5', '--out', join(dir, 'y.jsonl')]);
  assert.equal(r.status, 2);
});
