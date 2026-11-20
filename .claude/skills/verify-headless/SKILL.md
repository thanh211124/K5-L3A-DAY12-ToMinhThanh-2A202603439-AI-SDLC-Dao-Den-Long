---
name: verify-headless
description: Verify a gameplay requirement through the real headless CLI and save evidence. Use when adding/changing a game rule, when a ticket adds a requirement, or before tagging a phase.
---

# Verify via headless + save evidence

1. Write the acceptance criterion as one sentence ("given X, doing Y gives event/snapshot Z at tick T").
2. Add an entry to `tests/scenarios/catalog.js`:
   `{ id: 'P<phase>_nn_name', req: '<quote of requirement>', night?, ticks, seed?, every?, scenario, inputs, check: (lines) => null | 'why it failed' }`
   - Expected numbers come from the ticket / `TUNING` / `RULES`, never copied from current output.
   - Start from `empty` (all `random_*` false, `wind_enabled` false) so only listed entities exist.
   - Timing-sensitive rule? use `every: 1` and assert the exact first/last tick of the effect (off-by-one bugs hide here).
   - Buttons fire on false→true: use `press(tick, 'dash')` helper (sets true then false next tick).
3. `npm test` → the new test must FAIL before the implementation.
4. Implement in `src/core/` only; `npm test` until green.
5. Mutation check: temporarily change the rule's number in `tuning.js`; the new test must go red; restore.
6. `npm run proof` → inputs, raw `out.jsonl`, `RESULTS.md` (+ per-night determinism and 21 600-tick timing) in `docs/proof/phase-N/`.
7. Record pass / not yet in the traceability table of `docs/notes/phase-N.md`.
