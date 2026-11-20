#!/usr/bin/env node
// Soak test (Ticket-04 §2): node --expose-gc tools/soak.js --seed 7 --nights 10 --out soak.json
// Runs N nights back-to-back in ONE process (night 1 → 2 → 3 → 1 …), night i uses seed + i, each until game over or
// its standard duration. Random input from a seeded RNG: new move direction every 30 ticks; each tick jump 5 %,
// dash 3 %, pulse 2 %, interact 10 %. mem_start = RSS after loading night 1; mem_end = RSS after resetting the last night.
import { writeFileSync } from 'node:fs';
import { Sim } from '../src/core/sim.js';
import { makeRng } from '../src/core/rng.js';
import { TUNING as T, RULES as R } from '../src/core/tuning.js';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const seed = parseInt(arg('--seed', '7'), 10);
const nights = parseInt(arg('--nights', '10'), 10);
const out = arg('--out', 'soak.json');
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  process.stderr.write('soak: --seed <int> --nights <int >= 1> --out <file>\n');
  process.exit(1);
}
const gc = () => globalThis.gc && (globalThis.gc(), globalThis.gc());
const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const DUR = { 1: T.night1_duration_s, 2: T.night2_duration_s, 3: T.night3_duration_s };

const t0 = performance.now();
const results = [];
const perNight = [];
let crashes = 0;
let memStart = null;
let sim = null;
for (let i = 1; i <= nights; i++) {
  const night = ((i - 1) % 3) + 1;
  const nightSeed = seed + i;
  try {
    sim = new Sim({ seed: nightSeed, night });
    if (i === 1) {
      gc();
      memStart = rssMb();
    }
    const rng = makeRng(nightSeed ^ 0x5eed);
    const maxTicks = Math.round(DUR[night] * R.tick_rate);
    let move = [0, 0];
    let ticks = 0;
    while (sim.state === 'playing' && ticks < maxTicks) {
      if (ticks % 30 === 0) {
        const a = rng() * Math.PI * 2;
        move = [Math.cos(a), Math.sin(a)];
      }
      sim.step({ move, cam_yaw_deg: 0, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1 });
      ticks++;
    }
    results.push(sim.state === 'playing' ? 'timeout' : sim.state);
    perNight.push({ night_index: i, night, seed: nightSeed, ticks, result: sim.state, reason: sim.result, score: sim.score, rss_mb: rssMb() });
  } catch (e) {
    crashes++;
    results.push('crash');
    perNight.push({ night_index: i, night, seed: nightSeed, error: String(e && e.stack ? e.stack.split('\n')[0] : e) });
  }
  sim = null; // reset: drop the night
}
gc();
const memEnd = rssMb();
const report = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round((performance.now() - t0) / 100) / 10,
  mem_ratio: memStart ? Math.round((memEnd / memStart) * 1000) / 1000 : null,
  pass: crashes === 0 && memStart !== null && memEnd <= 1.2 * memStart,
  gc_exposed: typeof globalThis.gc === 'function',
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  per_night: perNight,
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: report.duration_s, pass: report.pass }));
process.exit(0);
