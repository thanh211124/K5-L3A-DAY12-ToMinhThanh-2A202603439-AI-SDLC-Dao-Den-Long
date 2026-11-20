// Runs a full headless session and returns JSONL text (Test Contract v1.0 section E).
import { Sim } from './sim.js';
import { parseInputs, InputTimeline } from './inputs.js';

export function run({ seed, scenario = null, inputs = null, ticks, snapshotEvery = 10 }) {
  const sim = new Sim({ seed, scenario });
  const timeline = inputs ? parseInputs(inputs) : new InputTimeline();
  const lines = [JSON.stringify(sim.snapshot())];
  for (let k = 0; k < ticks && sim.state === 'playing'; k++) {
    for (const e of sim.step(timeline.at(k))) lines.push(JSON.stringify(e));
    if (sim.steps % snapshotEvery === 0) lines.push(JSON.stringify(sim.snapshot()));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: sim.steps, state: sim.state, score: sim.score }));
  return lines.join('\n') + '\n';
}
