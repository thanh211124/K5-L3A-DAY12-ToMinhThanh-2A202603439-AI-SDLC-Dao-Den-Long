// Unit tests for pure logic (no process spawn).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim, r3 } from '../src/core/sim.js';
import { NIGHTS } from '../src/core/maps.js';
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

test('maps: spawn point counts and lantern counts per night (Ticket-02 part 2)', () => {
  assert.deepEqual([1, 2, 3].map((n) => NIGHTS[n].moteSpawns.length), [24, 24, 30]);
  assert.deepEqual([1, 2, 3].map((n) => NIGHTS[n].shadeSpawns.length), [12, 16, 16]);
  assert.deepEqual([1, 2, 3].map((n) => NIGHTS[n].lanterns.length), [5, 6, 7]);
  // angle convention: point = (r cos a, y, r sin a); night 3 tier-1 points must lie on tier 1 (z > 0, Y = 3)
  for (const p of NIGHTS[3].moteSpawns) assert.equal(NIGHTS[3].ground(p[0], p[2]), p[1], `ground under ${p}`);
  for (const p of [...NIGHTS[1].moteSpawns, ...NIGHTS[2].moteSpawns]) assert.equal(NIGHTS[1 + (p[0] > 40 ? 1 : 0)].ground(p[0], p[2]) ?? NIGHTS[2].ground(p[0], p[2]), 0);
});

test('night 3 terrain: tiers, ramps, tower, void', () => {
  const g = NIGHTS[3].ground;
  assert.equal(g(0, 1), 8); // tower
  assert.equal(g(0, 5), 6); // tier 2
  assert.equal(g(0, 18), 3); // tier 1 (z > 0)
  assert.equal(g(0, -18), 0); // z < 0 half has no tier 1
  assert.equal(g(27 * Math.cos(Math.PI / 6), 27 * Math.sin(Math.PI / 6)), 1.5); // mid ramp
  assert.equal(g(0, 46), null);
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
