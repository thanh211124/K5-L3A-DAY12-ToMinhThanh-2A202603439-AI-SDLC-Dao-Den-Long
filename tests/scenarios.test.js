// Runs every acceptance scenario through the REAL headless CLI (child process), then checks the JSONL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENARIOS } from './scenarios/catalog.js';

const dir = mkdtempSync(join(tmpdir(), 'ddl-'));

export function runCli(sc) {
  const args = ['src/headless.js', '--seed', String(sc.seed ?? 1), '--night', '1', '--ticks', String(sc.ticks)];
  if (sc.scenario) {
    const f = join(dir, `${sc.id}.scenario.json`);
    writeFileSync(f, JSON.stringify(sc.scenario));
    args.push('--scenario', f);
  }
  if (sc.inputs) {
    const f = join(dir, `${sc.id}.inputs.json`);
    writeFileSync(f, JSON.stringify(sc.inputs));
    args.push('--inputs', f);
  }
  const out = join(dir, `${sc.id}.jsonl`);
  args.push('--out', out);
  execFileSync(process.execPath, args);
  return readFileSync(out, 'utf8');
}

for (const sc of SCENARIOS) {
  test(`${sc.id}: ${sc.req}`, () => {
    const text = runCli(sc);
    const lines = text.trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.at(-1).type, 'end', 'last line must be end');
    const err = sc.check(lines);
    assert.equal(err, null, err ?? '');
  });
}
