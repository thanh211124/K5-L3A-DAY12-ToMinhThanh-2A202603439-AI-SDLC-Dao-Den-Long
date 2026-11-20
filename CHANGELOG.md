# Changelog

## phase-1
- PRD-0: Night 1 playable (browser, Three.js), headless mode per Test Contract v1.0, 19 acceptance scenarios, proof generator, CI, Stop hook, verify-headless skill.

## phase-2 (Ticket-02, Contract v1.1)
- Standard numbers and standard maps for 3 nights (Đảo Bến, Đảo Cau, Đảo Chuông); sim rewritten to the mandatory 12-step tick order.
- New: dash, Gió Lạc (drifters), Bùa Gió (charms), launch pads, tiered terrain, falling + respawn, wind, pause; `--night 1|2|3`; v1.1 snapshot/scenario/events.
- GUI: menu → night intro (Ông Đăng) → play → result → next night → Bình Minh; pause menu; persisted settings; full HUD; standard palette; procedural music/SFX.
- Phase 1 acceptance tests re-baselined to the standard numbers (reasons in docs/notes/phase-2.md §3); 25 new Phase 2 scenarios; FPS bench and UI smoke tools.

## phase-3

Ticket-03 "Đèn cạn dầu" — Contract **v1.2**. Design: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md).

### ⚠ Breaking changes
- **Win condition replaced:** lighting every lantern no longer ends the night (`all_lit` removed). The night ends only at dawn or when flames reach 0; win iff alive and lit lanterns ≥ ceil(0.6 × total) at the last tick → `game_over.reason = "dawn_survived"`.
- **Night durations:** 300/330/360 s → **240/270/300 s** (`night*_duration_s`).
- **Score formula replaced:** +5 per mote put into a lantern (was +10), +100 first light, **+40 relight**, pulse +5 (**+15 if the shade was draining**), dawn bonus per lit lantern `50 + floor(fuel)` + 50 per flame; **time bonus removed** (`per_second_left: 0`).
- **Lanterns can go out:** fuel 100 on light, −1/s; at 0 → `lantern_out`, `deposited = 0`. A lit lantern now accepts motes again (refuel). Relighting costs 5.
- **Safe zone only while fuel ≥ 30** (was: every lit lantern).
- **Shades:** new state `drain`; `wander` now heads to weak lanterns / unlit lanterns instead of roaming at random.
- **Carry capacity is dynamic:** `10 + 2 × successful_lights`, max 20 (`player.capacity` in snapshots).
- **Contract v1.2 schema:** tuning +8 keys; snapshot lantern +`fuel`, `ever_lit`, `relit_count`; player +`capacity`; scenario lantern `fuel`, `ever_lit`, player `successful_lights`, shade `target_lantern_id`; events +`refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` +`relight`.

### Added
- Fuel bar above lit lanterns, 1 Hz blink below 30, squashed/torn unlit lanterns; HUD shows carried/capacity and lanterns needed; "E — Châm dầu" prompt.
- Colour-blind setting (persisted): shade rim/eyes #00B3FF, UI danger #FFFFFF + ⚠.
- 16 P3 scenarios; old tests updated/removed with reasons (docs/notes/phase-3.md §3).
