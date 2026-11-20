---
name: verify-ui
description: Verify browser-only requirements (screens flow, pause, settings, HUD, palette, FPS) and save evidence. Use when changing web/ or when a ticket adds UI/perf requirements.
---

# Verify the GUI

Prereq: `PORT=8092 npm start` in the background (any free port) and Chrome installed (`CHROME=` to override path).

1. Static: `npm test` includes `tests/palette.test.js` (standard hex colours + ambient formula). Update STANDARD there if a ticket changes the palette.
2. Flow: `GAME_URL=http://localhost:8092/web/ node tools/ui-smoke.js | tee docs/proof/phase-N/ui-smoke.txt`
   - Add a `check(...)` there for every new screen/button/setting requirement. Forcing a state via `__game.sim` is OK for flow checks but must be disclosed in the notes.
3. FPS: `GAME_URL=http://localhost:8092/web/ node tools/fps-bench.js 20 1,2,3 | tee docs/proof/phase-N/fps.json` (headful, 1280×720, records CPU + GPU renderer string). Requirement: avg ≥ 30.
4. Screenshots: `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=5000 --screenshot=docs/proof/phase-N/screens/<name>.png "http://localhost:8092/web/?night=3&autostart&lit=3"`
   Open the PNG and check it really shows the requirement before citing it.
5. Things automation cannot judge (sound by ear, game feel) → mark "chưa kiểm chứng" in the notes and ask the human to play.
