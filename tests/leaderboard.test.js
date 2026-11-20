// Ticket-04 §3 local leaderboard: rules, disk persistence through the server API, export CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateName, addEntry, isoWithOffset, MAX_ENTRIES } from '../src/core/leaderboard.js';

const e = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 42, ...extra });

test('name: 3–12 chars of letters/digits/_ ; Vietnamese with diacritics accepted', () => {
  for (const ok of ['Mây', 'abc', 'Tô_Minh_Thành'.slice(0, 12), 'a_1', 'ĐènLồng2026']) assert.equal(validateName(ok), null, ok);
  for (const bad of ['ab', 'abcdefghijklm', 'has space', 'semi;colon', '', 'tên-gạch']) assert.notEqual(validateName(bad), null, bad);
});

test('achieved_at is ISO 8601 with an explicit offset', () => {
  assert.match(isoWithOffset(new Date('2026-11-20T09:05:09Z')), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
});

test('ranking: score desc, ties -> earlier achieved_at first, keep top 10', () => {
  let b = [];
  b = addEntry(b, e('late_tie', 500, '2026-11-20T10:00:00+07:00'));
  b = addEntry(b, e('early_tie', 500, '2026-11-20T09:00:00+07:00'));
  b = addEntry(b, e('top', 900, '2026-11-20T11:00:00+07:00'));
  assert.deepEqual(b.map((x) => x.name), ['top', 'early_tie', 'late_tie']);
  for (let i = 0; i < 12; i++) b = addEntry(b, e(`p${String(i).padStart(2, '0')}`, 100 + i, '2026-11-20T12:00:00+07:00'));
  assert.equal(b.length, MAX_ENTRIES);
  assert.equal(b.at(-1).score, 105); // 900, 500, 500, then 111..105
  assert.deepEqual(Object.keys(b[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
  assert.throws(() => addEntry(b, e('x', 1, '2026-11-20T12:00:00+07:00')));
  assert.throws(() => addEntry(b, e('okname', 1, '2026-11-20 12:00')));
  assert.throws(() => addEntry(b, e('okname', 1, '2026-11-20T12:00:00+07:00', { nights_won: 4 })));
});

test('server stores the board on disk; it survives a restart; export CLI prints it in order', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
  const file = join(dir, 'leaderboard.json');
  process.env.LEADERBOARD_FILE = file;
  const { startServer } = await import(`../tools/serve.js?lb=${Date.now()}`);
  const server = await startServer(0, { quiet: true });
  const base = `http://127.0.0.1:${server.address().port}/api/leaderboard`;
  const post = (x) => fetch(base, { method: 'POST', body: JSON.stringify(x) });
  assert.equal((await post(e('Mây', 300, '2026-11-20T10:00:00+07:00', { nights_won: 2 }))).status, 200);
  assert.equal((await post(e('thanh_01', 700, '2026-11-20T10:01:00+07:00', { nights_won: 3 }))).status, 200);
  assert.equal((await post(e('no', 1, '2026-11-20T10:02:00+07:00'))).status, 400);
  server.close();
  // "restart": a brand-new process reads the same file
  const out = join(dir, 'out.json');
  const r = spawnSync(process.execPath, ['tools/serve.js', '--export-leaderboard', out], { encoding: 'utf8', env: { ...process.env, LEADERBOARD_FILE: file } });
  assert.equal(r.status, 0, r.stderr);
  const exported = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(exported.entries.map((x) => [x.name, x.score, x.nights_won]), [['thanh_01', 700, 3], ['Mây', 300, 2]]);
  delete process.env.LEADERBOARD_FILE;
});
