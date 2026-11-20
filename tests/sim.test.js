// Unit tests for pure logic (no process spawn).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim, defaultLanterns, r3 } from '../src/core/sim.js';
import { parseInputs } from '../src/core/inputs.js';
import { makeRng } from '../src/core/rng.js';

test('rng is deterministic per seed', () => {
  const a = makeRng(5), b = makeRng(5), c = makeRng(6);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, [c(), c(), c()]);
});

test('r3 rounds to 3 decimals and never returns -0', () => {
  assert.equal(r3(1.23456), 1.235);
  assert.ok(Object.is(r3(-0.0001), 0));
});

test('default lanterns: 5, L1 at (0,0,25), all on ring r=25', () => {
  const L = defaultLanterns();
  assert.equal(L.length, 5);
  assert.deepEqual(L[0].pos, [0, 0, 25]);
  for (const l of L) assert.ok(Math.abs(Math.hypot(l.pos[0], l.pos[2]) - 25) < 1e-2);
});

test('input timeline: absent fields keep previous values, edge-trigger handled by Sim', () => {
  const tl = parseInputs({ frames: [{ tick: 0, move: [1, 0], pulse: true }, { tick: 3, cam_yaw_deg: 90 }] });
  assert.deepEqual(tl.at(0).move, [1, 0]);
  assert.equal(tl.at(1).pulse, true);
  assert.equal(tl.at(3).cam_yaw_deg, 90);
  assert.deepEqual(tl.at(4).move, [1, 0]);
});

test('held pulse only fires once', () => {
  const s = new Sim({ scenario: { random_motes: false, random_shades: false, motes: [], shades: [], player: { carried: 10 } } });
  let pulses = 0;
  for (let i = 0; i < 400; i++) pulses += s.step({ pulse: true }).filter((e) => e.name === 'pulse').length;
  assert.equal(pulses, 1);
});

test('scenario shade ids: given ids kept, auto ids skip used ones', () => {
  const s = new Sim({ scenario: { random_shades: false, shades: [{ id: 'S1', pos: [5, 1, 5] }, { pos: [6, 1, 6] }] } });
  assert.deepEqual(s.shades.map((x) => x.id), ['S1', 'S2']);
});

test('time_left_s = duration - steps/60', () => {
  const s = new Sim({ scenario: { random_motes: false, random_shades: false } });
  for (let i = 0; i < 90; i++) s.step({});
  assert.equal(s.snapshot().time_left_s, 298.5);
});
