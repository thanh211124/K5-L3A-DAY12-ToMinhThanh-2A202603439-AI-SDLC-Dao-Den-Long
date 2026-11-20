# AGENTS.md — Đảo Đèn Lồng (Tô Minh Thành · 2A202603439)

3D game (Three.js in browser) + headless CLI that follows **Test Contract v1.0** (spec: `docs/notes/phase-1.md`, lab board Phase tab).

## Commands
- Tests (must be green before you finish): `npm test`
- Regenerate evidence: `npm run proof` (writes `docs/proof/phase-<n>/`, never hand-edit outputs)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every 10]`
- Game: `npm start` → http://localhost:8080/

## Layout
- `src/core/` pure deterministic logic (no DOM, no `Math.random`, no `Date`). `sim.js` = rules, `tuning.js` = all numbers.
- `src/headless.js` CLI only (args, exit codes 0/1/2, file IO).
- `web/` rendering + input only. **No gameplay rules in `web/`**; GUI-only extras must not change headless output.
- `tests/scenarios/catalog.js` = acceptance criteria (one scenario per AC), used by tests AND proof.

## Rules
- Any number change: edit `src/core/tuning.js` AND `game.contract.json` together (test enforces equality).
- Follow contract tick model: step k reads input k, events get `tick = k+1`; snapshot every N from tick 0; `end` line last.
- Don't invent requirements: quote the ticket. Ambiguity → add an assumption to `docs/notes/phase-<n>.md`.
- New requirement → add a scenario to the catalog first, watch it fail, then implement.
- Never weaken/skip a test silently; if a new ticket invalidates it, change it and note why in the phase notes.
- Keep commits small; no secrets / `.env`.
