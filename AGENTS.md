# AGENTS.md — Đảo Đèn Lồng (Tô Minh Thành · 2A202603439)

3D game (Three.js in browser) + headless CLI that follows **Test Contract v1.3** (Ticket-02, -03, -04). Specs/assumptions: `docs/notes/phase-<n>.md`; design decisions: `docs/adr/`.

## Commands
- Tests (must be green before you finish; Stop hook enforces): `npm test`
- Evidence: `npm run proof` → `docs/proof/phase-4/` (never hand-edit outputs; old phase folders stay as they were at their tag)
- Headless: `node src/headless.js --seed 1 --night <1|2|3> --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every 10]`
- Game: `npm start` → http://localhost:8080/ · UI checks (needs Chrome + `npm start`): `node tools/ui-smoke.js`, `node tools/shot.js <url> <png> --eval <js>`
- Bench: `node tools/bench.js --seed 42 --duration 30 --out bench.json` · Soak: `node --expose-gc --jitless --no-expose-wasm tools/soak.js --seed 7 --nights 10 --out soak.json`
- Leaderboard export: `node tools/serve.js --export-leaderboard out.json` · Release zip: `npm run build`

## Layout
- `src/core/` pure deterministic logic (no DOM, no `Math.random`, no `Date`).
  `tuning.js` = TUNING (contract keys) + RULES (other standard numbers) · `maps.js` = 3 nights, `ground(x,z)` (null = void) · `sim.js` = rules.
- `src/headless.js` CLI only (args, exit codes 0/1/2, IO). `src/core/runner.js` writes JSONL.
- `web/` rendering, input, audio, menus only. **No gameplay rules in `web/`**; GUI extras must not change headless output.
- `tests/scenarios/catalog.js` = acceptance criteria (one scenario per AC), used by tests AND proof.

## Rules
- Standard numbers come from Ticket-02 — never "tune" them. Any number change: edit `tuning.js` AND `game.contract.json` together.
- `sim.step` follows the ticket's 12-step tick order (comment at top of `sim.js`). Don't reorder. Fuel decay/drain/out = step 2b.
- Lantern fuel is an **integer count of 1/60 units** (`R.fuel_unit`); never store fuel as a float; round only in snapshots/events.
- Safe zone = `sim.hasZone(l)` (lit AND fuel >= 30), not `l.lit`. Win is decided only at dawn (`winThreshold`); no early win.
- Change request that replaces a rule: save the red test list first (`docs/proof/phase-N/old-tests-before-update.txt`), fix/remove each test with a reason in the notes, write an ADR in `docs/adr/`, list breaking changes in `CHANGELOG.md`.
- Pause: `tick` advances, `sim_tick`/timers/spawns frozen. Event tick = loop tick.
- All "within r" checks: `d <= r + EPS` (float drift broke pads once).
- Timers set in step k must produce exactly N ticks of effect — check off-by-one with `every: 1` scenarios.
- New rule → scenario first (expected values derived from the ticket, not from current output), watch it fail, implement, then **mutation-check** it (change the number, the test must go red).
- Don't invent requirements: quote the ticket. Ambiguity → assumption row in `docs/notes/phase-<n>.md`.
- A ticket that invalidates an old test: change it and log why in the phase notes (§ "Thay đổi so với Phase …"). Never skip silently.
- Edit files with the Edit tool, not shell/Python string patches (one broke a template literal; long bash heredocs broke on quotes; a Python read/write flipped line endings). If a script is needed, Write it to the scratchpad and run it with newline='' I/O.
- Benchmark scene = `createBenchSim()` + `sim.flags` (all false by default). Never let bench/GUI switches change headless output.
- Rewriting a UI file? Re-run `tools/ui-smoke.js`: earlier phases' UI checks caught a lost colour-blind rule once.
- Never game a metric (e.g. warm up before measuring soak). If a threshold is missed, measure why, choose a documented config, and publish both numbers.
- Small commits; no secrets / `.env`; tag `phase-N` as soon as the phase's time is up.
