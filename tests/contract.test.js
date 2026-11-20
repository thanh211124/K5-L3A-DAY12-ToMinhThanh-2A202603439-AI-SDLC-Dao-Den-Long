// Contract-level checks: game.contract.json mirrors the code, CLI exit codes, output format, determinism.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TUNING } from '../src/core/tuning.js';

const dir = mkdtempSync(join(tmpdir(), 'ddl-c-'));
const cli = (args) => spawnSync(process.execPath, ['src/headless.js', ...args], { encoding: 'utf8' });
const file = (name, content) => {
  const f = join(dir, name);
  writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content));
  return f;
};

test('game.contract.json has required fields and tuning == src/core/tuning.js', () => {
  const c = JSON.parse(readFileSync('game.contract.json', 'utf8'));
  assert.equal(c.contract_version, '1.3');
  for (const k of ['bench_cmd', 'soak_cmd']) assert.equal(typeof c[k], 'string', k);
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof c[k], 'string', k);
  assert.deepEqual(c.tuning, TUNING);
  assert.equal(c.tuning.lantern_count_night1, 5);
});

test('default run: exit 0, snapshots every 10 ticks from 0, end line last, 3-decimal coords', () => {
  const out = join(dir, 'd.jsonl');
  const r = cli(['--seed', '3', '--night', '1', '--ticks', '95', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const L = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const snaps = L.filter((l) => l.type === 'snapshot');
  assert.deepEqual(snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  for (const s of snaps) {
    assert.equal(s.sim_tick, s.tick);
    for (const k of ['state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s, k);
    for (const v of [...s.player.pos, ...s.shades.flatMap((x) => x.pos)]) assert.equal(Math.round(v * 1000) / 1000, v);
  }
  assert.deepEqual(L.at(-1), { type: 'end', ticks: 95, state: L.at(-1).state, score: L.at(-1).score });
});

test('--snapshot-every is honoured', () => {
  const out = join(dir, 's.jsonl');
  assert.equal(cli(['--seed', '1', '--ticks', '100', '--snapshot-every', '50', '--out', out]).status, 0);
  const ticks = readFileSync(out, 'utf8').trim().split('\n').map(JSON.parse).filter((l) => l.type === 'snapshot').map((l) => l.tick);
  assert.deepEqual(ticks, [0, 50, 100]);
});

test('determinism: same seed/scenario/inputs -> identical bytes; different seed -> different', () => {
  const inputs = file('det.inputs.json', { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 37 }, { tick: 300, pulse: true }, { tick: 301, pulse: false }, { tick: 400, move: [-1, 0] }] });
  const run = (seed, name) => {
    const out = join(dir, name);
    assert.equal(cli(['--seed', String(seed), '--night', '1', '--inputs', inputs, '--ticks', '3000', '--out', out]).status, 0);
    return readFileSync(out, 'utf8');
  };
  const a = run(1234, 'a.jsonl');
  const b = run(1234, 'b.jsonl');
  const c = run(999, 'c.jsonl');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('malformed inputs / scenario -> exit 2 with stderr', () => {
  const cases = [
    ['--inputs', file('bad1.json', '{not json')],
    ['--inputs', file('bad2.json', { frames: [{ tick: 5 }, { tick: 5 }] })],
    ['--inputs', file('bad3.json', { frames: [{ tick: 0, move: 'up' }] })],
    ['--inputs', file('bad4.json', { nope: [] })],
    ['--scenario', file('bad5.json', { player: { pos: [0, 0] } })],
    ['--scenario', file('bad6.json', { lanterns: [{ id: 'L9' }] })],
    ['--scenario', file('bad7.json', '[1,2')],
  ];
  for (const extra of cases) {
    const r = cli(['--seed', '1', '--night', '1', '--ticks', '10', '--out', join(dir, 'x.jsonl'), ...extra]);
    assert.equal(r.status, 2, `${extra[1]} -> ${r.status}`);
    assert.ok(r.stderr.length > 0);
  }
});

test('bad CLI args -> non-zero exit with stderr', () => {
  for (const args of [['--ticks', '10', '--out', join(dir, 'y.jsonl')], ['--seed', 'abc', '--ticks', '1', '--out', 'x'], ['--seed', '1', '--night', '4', '--ticks', '1', '--out', 'x']]) {
    const r = cli(args);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.length > 0);
  }
});
