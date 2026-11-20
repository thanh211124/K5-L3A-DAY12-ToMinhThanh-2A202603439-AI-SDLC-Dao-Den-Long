#!/usr/bin/env node
// Headless runner — Test Contract v1.0 section B.
// node src/headless.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out <f.jsonl> [--snapshot-every 10]
import { readFileSync, writeFileSync } from 'node:fs';
import { FormatError } from './core/sim.js';
import { run } from './core/runner.js';

function fail(code, msg) {
  process.stderr.write(`headless: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = { snapshotEvery: 10 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    const need = () => {
      if (v === undefined) fail(1, `missing value for ${k}`);
      i++;
      return v;
    };
    const int = (s) => {
      if (!/^-?\d+$/.test(s)) fail(1, `${k} expects an integer, got "${s}"`);
      return parseInt(s, 10);
    };
    switch (k) {
      case '--seed': a.seed = int(need()); break;
      case '--night': a.night = int(need()); break;
      case '--scenario': a.scenario = need(); break;
      case '--inputs': a.inputs = need(); break;
      case '--ticks': a.ticks = int(need()); break;
      case '--out': a.out = need(); break;
      case '--snapshot-every': a.snapshotEvery = int(need()); break;
      default: fail(1, `unknown argument ${k}`);
    }
  }
  if (a.seed === undefined) fail(1, '--seed is required');
  if (a.ticks === undefined || a.ticks < 0) fail(1, '--ticks is required (>= 0)');
  if (!a.out) fail(1, '--out is required');
  if (a.night !== undefined && a.night !== 1) fail(1, `night ${a.night} not available (only 1)`);
  if (a.snapshotEvery <= 0) fail(1, '--snapshot-every must be > 0');
  return a;
}

function readJson(path, what) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    fail(2, `cannot read ${what} file ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(2, `${what} file is not valid JSON: ${e.message}`);
  }
}

{
  const a = parseArgs(process.argv.slice(2));
  const scenario = a.scenario ? readJson(a.scenario, 'scenario') : null;
  const inputs = a.inputs ? readJson(a.inputs, 'inputs') : null;
  let out;
  try {
    out = run({ seed: a.seed, scenario, inputs, ticks: a.ticks, snapshotEvery: a.snapshotEvery });
  } catch (e) {
    if (e instanceof FormatError) fail(2, `invalid scenario/inputs: ${e.message}`);
    fail(1, e.stack || String(e));
  }
  try {
    writeFileSync(a.out, out);
  } catch (e) {
    fail(1, `cannot write ${a.out}: ${e.message}`);
  }
}
