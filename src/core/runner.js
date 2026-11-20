// Runs a full headless session and returns JSONL text (Test Contract v1.1 section E).
import { Sim } from './sim.js';
import { parseInputs, InputTimeline } from './inputs.js';

export function run({ seed, night = 1, scenario = null, inputs = null, ticks, snapshotEvery = 10 }) {
  const sim = new Sim({ seed, night, scenario });
  const timeline = inputs ? parseInputs(inputs) : new InputTimeline();
  const lines = [JSON.stringify(sim.snapshot()), JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night } })];
  for (let k = 0; k < ticks && sim.state === 'playing'; k++) {
    for (const e of sim.step(timeline.at(k))) lines.push(JSON.stringify(e));
    if (sim.tick % snapshotEvery === 0) lines.push(JSON.stringify(sim.snapshot()));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: sim.tick, state: sim.state, score: sim.score }));
  return lines.join('\n') + '\n';
}
