---
name: verify-headless
description: Verify a gameplay requirement through the real headless CLI and save evidence. Use when adding/changing a game rule, when a ticket adds a requirement, or before tagging a phase.
---

# Verify via headless + save evidence

1. Write the acceptance criterion as one sentence ("given X, doing Y gives event/snapshot Z at tick T").
2. Add an entry to `tests/scenarios/catalog.js`:
   `{ id: 'ACnn_name', req: '<quote of requirement>', ticks, seed?, scenario, inputs, check: (lines) => null | 'why it failed' }`
   - Expected numbers must come from `TUNING` (never copy the current output into the expectation).
   - Use `random_motes:false, random_shades:false` so only listed entities exist.
3. Run `npm test` → the new test should FAIL before the implementation (proves the check is real).
4. Implement in `src/core/` only, rerun `npm test` until green.
5. Run `npm run proof` (or `npm run proof -- phase-N`) → writes inputs, raw `out.jsonl` and `RESULTS.md` under `docs/proof/phase-N/`.
6. Visual requirement? `npm start` then screenshot:
   `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/phase-N/screens/<name>.png "http://localhost:8080/web/?autostart&lit=2"`
   Look at the image before claiming it shows the requirement.
7. Record the result (pass / not yet) in `docs/notes/phase-N.md` traceability table.
