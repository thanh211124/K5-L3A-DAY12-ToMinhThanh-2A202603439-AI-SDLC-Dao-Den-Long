// Acceptance scenarios (Contract v1.1). Each entry = one acceptance criterion checked through the REAL headless output.
// Used by tests/scenarios.test.js (CI) and tools/proof.js (evidence in docs/proof/phase-N/).
// AC01–AC19: Phase 1 criteria re-baselined to Ticket-02 standard numbers (docs/notes/phase-2.md §3) and Ticket-03 (docs/notes/phase-3.md §3).
// P2_xx: Phase 2 features. P3_xx: Ticket-03 change request (fuel, drain, dawn win, capacity, new score).
// Removed by Ticket-03 (reasons in docs/notes/phase-3.md §3): AC08_win_all_lit, P2_25_win_on_dawn_tick.
import { TUNING as T, RULES as R } from '../../src/core/tuning.js';

const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [], charms: [] };
const ev = (L, name) => L.filter((l) => l.type === 'event' && l.name === name);
const snap = (L, tick) => L.find((l) => l.type === 'snapshot' && l.tick === tick);
const snaps = (L) => L.filter((l) => l.type === 'snapshot');
const end = (L) => L[L.length - 1];
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
const xz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const expect = (cond, msg) => (cond ? null : msg);
const press = (tick, btn) => [{ tick, [btn]: true }, { tick: tick + 1, [btn]: false }];

export const SCENARIOS = [
  // ---------------- Phase 1 criteria (re-baselined) ----------------
  {
    id: 'AC01_move_speed', req: 'Chạy 6.0 m/s: move=[0,1], yaw 0 → 60 tick đi 6 m theo +Z',
    ticks: 60, scenario: empty, inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => { const p = snap(L, 60).player; return expect(near(p.pos[2], 6) && near(p.vel[2], 6), `pos ${p.pos} vel ${p.vel}`); },
  },
  {
    id: 'AC02_camera_yaw', req: 'Hướng đi theo cam_yaw_deg (90° → move [0,1] đi +X)',
    ticks: 60, scenario: empty, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] },
    check: (L) => { const p = snap(L, 60).player.pos; return expect(near(p[0], 6) && near(p[2], 0), `pos ${p}`); },
  },
  {
    id: 'AC03_diagonal_normalized', req: 'Vector move dài hơn 1 được chuẩn hóa',
    ticks: 60, scenario: empty, inputs: { frames: [{ tick: 0, move: [1, 1] }] },
    check: (L) => { const p = snap(L, 60).player.pos; return expect(near(Math.hypot(p[0], p[2]), 6), `dist ${Math.hypot(p[0], p[2])}`); },
  },
  {
    id: 'AC04_pickup_radius', req: 'Nhặt khi XZ ≤ 1.0 m (mote z=5 → tick 40); nhặt KHÔNG cộng điểm (điểm tính khi nạp)',
    ticks: 60, scenario: { ...empty, motes: [[0, 0, 5]] }, inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => { const e = ev(L, 'mote_picked'); return expect(e.length === 1 && e[0].tick === 40 && end(L).score === 0, `picked ${JSON.stringify(e)} score ${end(L).score}`); },
  },
  {
    id: 'AC05_carry_capacity', req: 'Không mang quá 10 đom đóm',
    ticks: 300, scenario: { ...empty, motes: Array.from({ length: 14 }, (_, i) => [0, 0, 2 + i]) }, inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => { const s = snaps(L).pop(); return expect(s.player.carried === 10 && s.motes_active === 4, `carried ${s.player.carried} left ${s.motes_active}`); },
  },
  {
    id: 'AC06_deposit_and_light', req: 'Nạp 10 trong bán kính 2 m → deposit + lantern_lit (relight false); điểm = 10×5 + 100 [Ticket-03 điểm]',
    ticks: 10, scenario: { ...empty, player: { pos: [0, 0, 23.5], carried: 10 } }, inputs: { frames: press(2, 'interact') },
    check: (L) => {
      const d = ev(L, 'deposit')[0]; const lit = ev(L, 'lantern_lit')[0];
      return expect(d && d.tick === 3 && d.data.amount === 10 && lit && lit.data.lantern_id === 'L1' && lit.data.relight === false && end(L).score === 150 && snap(L, 10).lanterns[0].fuel === 99.9 && snap(L, 10).player.capacity === 12, `deposit ${JSON.stringify(d)} score ${end(L).score}`);
    },
  },
  {
    id: 'AC07_partial_deposit', req: 'Nạp một phần, đèn nhớ tiến độ; ngoài 2 m thì không nạp',
    ticks: 20, scenario: { ...empty, player: { pos: [0, 0, 23.2], carried: 3 } },
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, move: [0, -1] }, { tick: 12, move: [0, 0], interact: true }] },
    check: (L) => { const d = ev(L, 'deposit'); return expect(d.length === 1 && d[0].data.deposited === 3 && snaps(L).pop().lanterns[0].deposited === 3 && !snaps(L).pop().lanterns[0].lit, `deposits ${JSON.stringify(d)}`); },
  },
  {
    id: 'AC09_pulse_stun_push', req: 'Tỏa Sáng: tốn 3, choáng 120 tick, đẩy 4 m trong 15 tick đầu, +5 điểm/con; con ngoài 5 m không bị',
    ticks: 140, scenario: { ...empty, player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [0, 1, -20] }] },
    inputs: { frames: [{ tick: 0, pulse: true }] },
    check: (L) => {
      const p = ev(L, 'pulse')[0];
      const s10 = snap(L, 10).shades[0]; const s20 = snap(L, 20).shades[0];
      const st120 = snap(L, 120).shades[0].state; const st130 = snap(L, 130).shades[0].state;
      return expect(p && p.tick === 1 && JSON.stringify(p.data.stunned_ids) === '["S1"]' && s10.pos[0] > 3 && s10.pos[0] < 7 && near(s20.pos[0], 7) && st120 === 'stunned' && st130 !== 'stunned' && end(L).score === 5 && snap(L, 10).player.carried === 0,
        `pulse ${JSON.stringify(p)} S1@10 ${s10.pos} @20 ${s20.pos} state@120 ${st120} @130 ${st130}`);
    },
  },
  {
    id: 'AC10_pulse_cooldown_and_cost', req: 'Hồi chiêu Tỏa Sáng 3 s; không đủ 3 đom đóm thì không kích hoạt',
    ticks: 500, scenario: { ...empty, player: { carried: 6 } },
    inputs: { frames: [...press(0, 'pulse'), ...press(100, 'pulse'), ...press(180, 'pulse'), ...press(400, 'pulse')] },
    check: (L) => { const t = ev(L, 'pulse').map((e) => e.tick); return expect(JSON.stringify(t) === '[1,181]', `pulse ticks ${JSON.stringify(t)}`); },
  },
  {
    id: 'AC11_hit_invuln_drop', req: 'Bị đánh: −1 lửa, rơi floor(mang/2) ra vành 1.5–2.5 m (TTL 480), bất tử 90 tick, Bóng lùi (recoil)',
    ticks: 200, every: 1, scenario: { ...empty, player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] },
    check: (L) => {
      const h = ev(L, 'player_hit'); const s10 = snap(L, 10);
      const dropped = s10.motes.filter((m) => m.kind === 'dropped');
      const ringOk = dropped.every((m) => { const d = xz(m.pos, [0, 0, 0]); return d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3; });
      return expect(h.length >= 2 && h[0].tick === 1 && h[0].data.flames === 2 && h[0].data.dropped === 2 && h[1].tick - h[0].tick === 90 && dropped.length === 2 && ringOk && near(dropped[0].ttl_s, 471 / 60) && s10.shades[0].state === 'recoil' && snap(L, 60).shades[0].state === 'recoil' && snap(L, 61).shades[0].state !== 'recoil' && near(snap(L, 61).shades[0].pos[0] - snap(L, 1).shades[0].pos[0], 2, 0.01),
        `hits ${JSON.stringify(h)} dropped ${JSON.stringify(dropped)} shade ${JSON.stringify(s10.shades[0])}`);
    },
  },
  {
    id: 'AC12_lose_no_flames', req: 'Hết Ngọn Lửa → lost/no_flames, dừng sớm',
    ticks: 600, scenario: { ...empty, player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }] },
    check: (L) => { const g = ev(L, 'game_over')[0]; return expect(g && g.data.reason === 'no_flames' && end(L).ticks === g.tick && end(L).state === 'lost', `game_over ${JSON.stringify(g)}`); },
  },
  {
    id: 'AC13_dawn', req: 'Hết giờ → lost/dawn; time_left_s giảm 1/60 mỗi sim tick',
    ticks: 600, scenario: { ...empty, time_left_s: 2 },
    check: (L) => { const g = ev(L, 'game_over')[0]; return expect(g && g.tick === 120 && g.data.reason === 'dawn' && snap(L, 60).time_left_s === 1, `game_over ${JSON.stringify(g)}`); },
  },
  {
    id: 'AC14_safe_radius', req: 'Đèn đã sáng chặn Bóng Mực ở mép 6 m; đứng ở đèn không bị chạm',
    ticks: 600, scenario: { ...empty, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ id: 'S1', pos: [0, 1, 14] }] },
    check: (L) => { const m = Math.min(...snaps(L).map((s) => xz(s.shades[0].pos, [0, 0, 25]))); return expect(m >= 6 - 1e-3 && ev(L, 'player_hit').length === 0 && snaps(L).some((s) => s.shades[0].state === 'chase'), `min ${m}`); },
  },
  {
    id: 'AC15_unlit_lantern_not_safe', req: 'Đèn chưa sáng không bảo vệ',
    ticks: 600, scenario: { ...empty, player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [0, 1, 14] }] },
    check: (L) => expect(ev(L, 'player_hit').length > 0, 'expected a hit'),
  },
  {
    id: 'AC16_fall_and_respawn', req: '[ĐỔI ở Ticket-02] Ra ngoài 40 m là rơi: Y<−10 → −1 lửa, mất hết đom đóm (lost), chờ 60 tick rồi hồi sinh ở (0,0,0) với bất tử',
    ticks: 700, scenario: { ...empty, player: { pos: [38, 0, 0], carried: 4 } }, inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 30, move: [0, 0] }] },
    every: 1,
    check: (L) => {
      const h = ev(L, 'player_hit'); const f = h[0];
      const at = f && snap(L, f.tick + 60); const before = f && snap(L, f.tick + 59);
      return expect(h.length === 1 && f.data.by === 'fall' && f.data.lost === 4 && f.data.dropped === 0 && f.data.flames === 2 && at && JSON.stringify(at.player.pos) === '[0,0,0]' && at.player.invuln === true && at.player.carried === 0 && JSON.stringify(before.player.pos) !== '[0,0,0]',
        `hits ${JSON.stringify(h)} respawn ${at && JSON.stringify(at.player)}`);
    },
  },
  {
    id: 'AC17_jump', req: 'Nhảy 7 m/s, trọng lực 20; chỉ ở cạnh false→true',
    ticks: 120, scenario: empty, inputs: { frames: [{ tick: 0, jump: true }] },
    check: (L) => { const y20 = snap(L, 20).player.pos[1]; const top = Math.max(...snaps(L).map((s) => s.player.pos[1])); return expect(y20 > 0.5 && top <= 7 * 7 / 40 + 0.01 && snap(L, 120).player.pos[1] === 0 && snap(L, 120).player.grounded, `y20 ${y20} top ${top}`); },
  },
  {
    id: 'AC18_default_level_night1', req: 'Đêm 1 chuẩn: 5 đèn đúng tọa độ, 20 đom đóm, Bóng Mực: 2 con tick 300 (spawning), +1 mỗi 480 tick',
    ticks: 800, seed: 42, scenario: { player: { flames: 99 } },
    check: (L) => {
      const s0 = L[0]; const sp = ev(L, 'shade_spawned');
      const posOk = JSON.stringify(s0.lanterns.map((l) => l.pos)) === JSON.stringify([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
      return expect(posOk && s0.motes_active === 20 && s0.shades.length === 0 && JSON.stringify(sp.map((e) => [e.tick, e.data.id])) === '[[300,"S1"],[300,"S2"],[780,"S3"]]' && snap(L, 310).shades.every((s) => s.state === 'spawning') && s0.night === 1 && s0.time_left_s === 240,
        `spawned ${JSON.stringify(sp)} motes ${s0.motes_active}`);
    },
  },
  {
    id: 'AC19_scenario_no_events', req: 'Dựng scenario không phát sự kiện gameplay/điểm (chỉ night_start)',
    ticks: 0, scenario: { ...empty, motes: [[0, 0, 0]], lanterns: [{ id: 'L1', lit: true }] },
    check: (L) => expect(L.length === 3 && L[0].type === 'snapshot' && L[1].name === 'night_start' && L[2].type === 'end' && L[2].score === 0, `lines ${JSON.stringify(L.map((l) => l.type + ':' + (l.name || '')))}`),
  },

  // ---------------- Phase 2 new features ----------------
  {
    id: 'P2_01_dash', req: 'Lướt 14 m/s × 12 tick theo hướng di chuyển; hồi chiêu 90 tick tính từ lúc bắt đầu',
    ticks: 120, scenario: empty, inputs: { frames: [{ tick: 0, move: [0, 1] }, ...press(10, 'dash'), ...press(50, 'dash'), ...press(95, 'dash'), ...press(100, 'dash')] }, // 95: 5 ticks before cooldown ends -> ignored
    check: (L) => {
      const t = ev(L, 'dash').map((e) => e.tick); const z30 = snap(L, 30).player.pos[2];
      return expect(JSON.stringify(t) === '[11,101]' && near(z30, 1 + 2.8 + 0.8), `dash ticks ${t} z@30 ${z30} (want 4.6)`);
    },
  },
  {
    id: 'P2_02_dash_facing_air', req: 'Đứng yên thì lướt theo hướng quay mặt (+Z lúc đầu); lướt trên không giữ nguyên độ cao',
    ticks: 40, every: 1, scenario: empty, inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, ...press(10, 'dash')] },
    check: (L) => {
      const y = [10, 15, 22].map((t) => snap(L, t).player.pos[1]);
      return expect(y[0] > 0 && y[0] === y[1] && y[1] === y[2] && near(snap(L, 22).player.pos[2], 2.8) && near(snap(L, 22).player.pos[0], 0), `y ${y} z22 ${snap(L, 22).player.pos}`);
    },
  },
  {
    id: 'P2_03_charm', req: 'Bùa Gió (Đêm 2, C1 tại (35,0,0)): nhặt → charm_picked 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, bùa hồi sau 2700 tick',
    night: 2, ticks: 70, scenario: { ...empty, player: { pos: [33, 0, 0] }, charms: [{ id: 'C1' }] },
    inputs: { frames: [{ tick: 0, move: [1, 0] }, ...press(30, 'dash'), ...press(35, 'dash'), ...press(50, 'dash'), { tick: 60, move: [0, 0] }] },
    check: (L) => {
      const c = ev(L, 'charm_picked')[0]; const s20 = snap(L, 20);
      return expect(c && c.tick === 10 && c.data.charm_id === 'C1' && c.data.charm_ticks === 600 && near(s20.player.vel[0], 7.2) && near(s20.player.charm_s, 590 / 60) && s20.charms[0].available === false && near(s20.charms[0].respawn_s, 2690 / 60) && JSON.stringify(ev(L, 'dash').map((e) => e.tick)) === '[31,51]',
        `charm ${JSON.stringify(c)} vel ${s20.player.vel} dash ${ev(L, 'dash').map((e) => e.tick)}`);
    },
  },
  {
    id: 'P2_04_charm_respawn', req: 'Bùa đã nhặt xuất hiện lại khi hết thời gian chờ',
    night: 3, ticks: 20, scenario: { ...empty, charms: [{ id: 'C1', available: false, respawn_ticks: 10 }, { id: 'C2' }] },
    check: (L) => expect(snap(L, 0).charms[0].available === false && snap(L, 10).charms[0].available === true && snap(L, 0).charms.length === 2, JSON.stringify(snap(L, 10).charms)),
  },
  {
    id: 'P2_05_drifter_steal', req: 'Gió Lạc: idle→chase khi mang ≥5 và ≤15 m, chạm ≤1.2 m cướp min(3, mang), flee 240 tick rồi removed; bất tử không ngăn, không mất lửa',
    night: 2, ticks: 300, scenario: { ...empty, player: { carried: 6, invuln_ticks: 300 }, drifters: [{ id: 'D1', pos: [5, 1.5, 0] }] },
    check: (L) => {
      const s = ev(L, 'drifter_steal')[0];
      const fleeAt = s && snap(L, Math.ceil((s.tick + 1) / 10) * 10).drifters[0];
      return expect(s && s.data.drifter_id === 'D1' && s.data.amount === 3 && s.data.carried === 3 && snap(L, 10).drifters[0].state === 'chase' && fleeAt.state === 'flee' && fleeAt.stolen === 3 && snap(L, 300).drifters[0].state === 'removed' && snap(L, 300).player.flames === 3 && snap(L, 300).player.carried === 3,
        `steal ${JSON.stringify(s)} @300 ${JSON.stringify(snap(L, 300).drifters)}`);
    },
  },
  {
    id: 'P2_06_pulse_drifter_chase', req: 'Tỏa Sáng trúng Gió Lạc đang chase → flee, không cướp',
    night: 2, ticks: 100, scenario: { ...empty, player: { carried: 8 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0] }] }, inputs: { frames: press(5, 'pulse') },
    check: (L) => expect(ev(L, 'drifter_steal').length === 0 && snap(L, 10).drifters[0].state === 'flee' && snap(L, 10).drifters[0].stolen === 0 && snap(L, 100).player.carried === 5, JSON.stringify(snap(L, 10).drifters)),
  },
  {
    id: 'P2_07_pulse_drifter_drop', req: 'Tỏa Sáng trúng Gió Lạc đang flee có mang đồ → thả lại toàn bộ (đom đóm rơi), biến mất sau 120 tick',
    night: 2, ticks: 140, scenario: { ...empty, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] }, inputs: { frames: [{ tick: 0, pulse: true }] },
    check: (L) => {
      const d = ev(L, 'drifter_drop')[0]; const dropped = snap(L, 10).motes.filter((m) => m.kind === 'dropped');
      return expect(d && d.tick === 1 && d.data.amount === 3 && dropped.length === 3 && snap(L, 120).drifters[0].state === 'flee' && snap(L, 130).drifters[0].state === 'removed', `drop ${JSON.stringify(d)} motes ${dropped.length}`);
    },
  },
  {
    id: 'P2_08_drifter_spawn', req: 'Gió Lạc sinh tại tick 1200 (Đêm 2/3), id D1; Đêm 1 không có',
    night: 2, ticks: 1210, scenario: { random_shades: false, random_motes: false, player: { flames: 99 } },
    check: (L) => expect(snap(L, 1190).drifters.length === 0 && snap(L, 1200).drifters.length === 1 && snap(L, 1200).drifters[0].id === 'D1', JSON.stringify(snap(L, 1200).drifters)),
  },
  {
    id: 'P2_09_launch_pad_night2', req: 'Bục nhảy Đêm 2: bắn lên 14 m/s + 24 m/s về tâm đảo kia, phím không ghi đè, đáp trong đảo B',
    night: 2, ticks: 150, scenario: { ...empty, player: { pos: [18.5, 0, 18] } }, inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => {
      const s = snap(L, 150).player; const mid = snap(L, 50).player;
      return expect(s.grounded && xz(s.pos, [70, 0, 0]) <= 28 && mid.pos[1] > 3 && ev(L, 'player_hit').length === 0, `end ${JSON.stringify(s)} mid ${JSON.stringify(mid)}`);
    },
  },
  {
    id: 'P2_10_bridge', req: 'Cầu tre Đêm 2 (x 26–44, z −2..2): đi qua sang đảo B không rơi',
    night: 2, ticks: 400, scenario: { ...empty, player: { pos: [20, 0, 0] } }, inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => { const p = snaps(L).pop().player; return expect(p.pos[0] > 55 && p.pos[1] === 0 && ev(L, 'player_hit').length === 0, JSON.stringify(p)); },
  },
  {
    id: 'P2_11_bridge_no_rail', req: 'Cầu không lan can: bước ra ngoài z>2 thì rơi',
    night: 2, ticks: 200, scenario: { ...empty, player: { pos: [35, 0, 0] } }, inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => { const h = ev(L, 'player_hit'); return expect(h.length === 1 && h[0].data.by === 'fall', JSON.stringify(h)); },
  },
  {
    id: 'P2_12_night3_cliff', req: 'Đêm 3: vách tầng 2 (r 8, Y 6) chặn, không đi lên được',
    night: 3, ticks: 600, scenario: empty, inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => { const p = snaps(L).pop().player.pos; return expect(p[1] === 0 && near(p[2], -8, 0.11) && L[0].player.pos[2] === -30, `pos ${p}`); },
  },
  {
    id: 'P2_13_night3_ramp', req: 'Đêm 3: dốc 30° đưa từ Y0 (r30) lên tầng 1 Y3 (r24)',
    night: 3, ticks: 150, scenario: { ...empty, player: { pos: [32 * Math.cos(Math.PI / 6), 0, 32 * Math.sin(Math.PI / 6)] } },
    inputs: { frames: [{ tick: 0, move: [-Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)] }, { tick: 120, move: [0, 0] }] },
    check: (L) => { const p = snap(L, 150).player; return expect(p.pos[1] === 3 && p.grounded && Math.hypot(p.pos[0], p.pos[2]) < 24, JSON.stringify(p)); },
  },
  {
    id: 'P2_14_night3_drop_tier', req: 'Đêm 3: bước ra mép tầng 1 thì rơi xuống tầng 0 (không tính là rơi khỏi đảo)',
    night: 3, ticks: 120, scenario: { ...empty, player: { pos: [0, 3, 22] } }, inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0] }] },
    check: (L) => { const p = snap(L, 120).player; return expect(p.pos[1] === 0 && p.grounded && ev(L, 'player_hit').length === 0, JSON.stringify(p)); },
  },
  {
    id: 'P2_15_night3_pad', req: 'Đêm 3: bục (0,3,13) bắn 12 m/s lên + 8 m/s về −Z → đáp tầng 2 (Y 6)',
    night: 3, ticks: 120, scenario: { ...empty, player: { pos: [0, 3, 14.5] } }, inputs: { frames: [{ tick: 0, move: [0, -1] }, { tick: 5, move: [0, 0] }] },
    check: (L) => { const p = snap(L, 120).player; return expect(p.pos[1] === 6 && p.grounded && Math.hypot(p.pos[0], p.pos[2]) <= 8, JSON.stringify(p)); },
  },
  {
    id: 'P2_16_night3_wind', req: 'Đêm 3: gió mỗi 30 s, kéo dài 5 s, đẩy 2 m/s (tổng 10 m) theo dir_deg',
    night: 3, ticks: 2110, scenario: { ...empty, wind_enabled: true },
    check: (L) => {
      const a = snap(L, 1800); const b = snap(L, 2100);
      const dx = b.player.pos[0] - a.player.pos[0]; const dz = b.player.pos[2] - a.player.pos[2];
      const th = (a.wind.dir_deg * Math.PI) / 180;
      return expect(snap(L, 1790).wind.active === false && a.wind.active && !b.wind.active && near(Math.hypot(dx, dz), 10, 0.01) && near(dx, 10 * Math.cos(th), 0.01) && near(dz, 10 * Math.sin(th), 0.01),
        `wind ${JSON.stringify(a.wind)} moved ${dx},${dz}`);
    },
  },
  {
    id: 'P2_17_pause', req: 'Tạm dừng: tick tăng, sim_tick/thời gian/di chuyển đứng yên, state "paused"; paused/resumed',
    ticks: 40, scenario: empty, inputs: { frames: [{ tick: 0, move: [0, 1] }, ...press(10, 'pause'), ...press(30, 'pause')] },
    check: (L) => {
      const p = ev(L, 'paused')[0]; const r = ev(L, 'resumed')[0]; const s20 = snap(L, 20); const s40 = snap(L, 40);
      return expect(p && p.tick === 11 && r && r.tick === 31 && s20.state === 'paused' && s20.sim_tick === 10 && near(s20.time_left_s, 240 - 10 / 60) && s40.sim_tick === 20 && near(s40.player.pos[2], 2) && end(L).ticks === 40,
        `paused ${JSON.stringify(p)} resumed ${JSON.stringify(r)} s20 ${s20.state}/${s20.sim_tick} s40 ${s40.sim_tick}/${s40.player.pos}`);
    },
  },
  {
    id: 'P2_18_shade_detect_giveup', req: 'Bóng Mực phát hiện ≤12 m → chase, bỏ đuổi >18 m → wander',
    ticks: 300, scenario: { ...empty, shades: [{ id: 'S1', pos: [0, 1, 11] }] }, inputs: { frames: [{ tick: 0, move: [0, -1] }] },
    check: (L) => expect(snap(L, 10).shades[0].state === 'chase' && snap(L, 300).shades[0].state === 'wander', `${snap(L, 10).shades[0].state} → ${snap(L, 300).shades[0].state}`),
  },
  {
    id: 'P2_19_safe_zone_evict', req: 'Bóng đang ở trong 6 m khi đèn vừa thắp bị đẩy ra mép trong ≤30 tick, không gây sát thương lúc đó',
    ticks: 200, scenario: { ...empty, player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ id: 'S1', pos: [2, 1, 24] }] }, inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      const d10 = xz(snap(L, 10).shades[0].pos, [0, 0, 25]); const d30 = xz(snap(L, 30).shades[0].pos, [0, 0, 25]);
      return expect(d10 > 2.2 && d10 < 6 && near(d30, 6, 0.01) && ev(L, 'player_hit').length === 0, `d10 ${d10} d30 ${d30} hits ${ev(L, 'player_hit').length}`);
    },
  },
  {
    id: 'P2_20_one_hit_per_tick', req: 'Tối đa 1 lần mất Ngọn Lửa mỗi tick (2 Bóng chạm cùng lúc)',
    ticks: 5, scenario: { ...empty, shades: [{ id: 'S2', pos: [0, 1, 0.5] }, { id: 'S1', pos: [0.5, 1, 0] }] },
    check: (L) => { const h = ev(L, 'player_hit'); return expect(h.length === 1 && h[0].data.flames === 2 && snap(L, 0) && L.find((l) => l.type === 'end') && true && snapshotStates(L), JSON.stringify(h)); },
  },
  {
    id: 'P2_21_fall_ignores_invuln', req: 'Rơi bỏ qua bất tử; hết lửa khi rơi → thua ngay (no_flames), không hồi sinh',
    ticks: 300, scenario: { ...empty, player: { pos: [39.5, 0, 0], flames: 1, invuln_ticks: 1000 } }, inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => { const g = ev(L, 'game_over')[0]; const h = ev(L, 'player_hit')[0]; return expect(h && h.data.by === 'fall' && g && g.tick === h.tick && g.data.reason === 'no_flames', `${JSON.stringify(h)} ${JSON.stringify(g)}`); },
  },
  {
    id: 'P2_22_mote_schedule', req: 'Đom đóm: 20 lúc đầu, +1 ở tick 240, 480…, chỉ vào điểm trống (Đêm 1 có 24 điểm → dừng ở 24)',
    ticks: 1200, seed: 3, scenario: { random_shades: false },
    check: (L) => {
      const n = [0, 230, 240, 480, 960, 1200].map((t) => snap(L, t).motes_active);
      return expect(JSON.stringify(n) === '[20,20,21,22,24,24]' && snap(L, 1200).motes.every((m) => m.kind === 'random' && m.ttl_s === null), `counts ${n}`);
    },
  },
  {
    id: 'P2_23_nights_2_3_setup', req: 'Đêm 3: 7 đèn, 300 s [Ticket-03, trước 360], đèn đúng tọa độ chuẩn',
    night: 3, ticks: 0, scenario: null,
    check: (L) => {
      const s = L[0];
      return expect(s.night === 3 && s.time_left_s === 300 && s.lanterns.length === 7 && JSON.stringify(s.lanterns[0].pos) === '[0,6,6]' && JSON.stringify(s.lanterns[6].pos) === '[-20,0,-35]' && s.motes_active === 20 && s.charms.length === 2 && s.wind.active === false && L[1].data.night === 3, JSON.stringify(s.lanterns.map((l) => l.pos)));
    },
  },
  {
    id: 'P2_24_night2_setup', req: 'Đêm 2: 6 đèn L1–L6 theo thứ tự chuẩn, 270 s [Ticket-03, trước 330], Bùa C1 tại cầu',
    night: 2, ticks: 0, scenario: null,
    check: (L) => { const s = L[0]; return expect(s.night === 2 && s.time_left_s === 270 && JSON.stringify(s.lanterns.map((l) => l.pos)) === JSON.stringify([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]) && s.charms.length === 1 && s.drifters.length === 0, JSON.stringify(s.lanterns)); },
  },

  // ---------------- Phase 3: Ticket-03 change request ----------------
  {
    id: 'P3_01_fuel_decay_out', req: 'Dầu hao 1/s; fuel ≤ 0 → lantern_out, deposited 0, ever_lit true, fuel 0',
    ticks: 100, every: 1, scenario: { ...empty, lanterns: [{ id: 'L1', lit: true, fuel: 1 }, { id: 'L2', lit: true }] },
    check: (L) => {
      const o = ev(L, 'lantern_out'); const a = snap(L, 60).lanterns[0];
      return expect(o.length === 1 && o[0].tick === 60 && o[0].data.lantern_id === 'L1' && snap(L, 30).lanterns[0].fuel === 0.5 && !a.lit && a.fuel === 0 && a.deposited === 0 && a.ever_lit === true && snap(L, 100).lanterns[1].fuel === 98.3,
        `out ${JSON.stringify(o)} L1@60 ${JSON.stringify(a)} L2@100 ${snap(L, 100).lanterns[1].fuel}`);
    },
  },
  {
    id: 'P3_02_refuel', req: 'Châm dầu đèn đang sáng: used = min(mang, ceil((100−fuel)/10)), fuel tối đa 100, +5/đom đóm, sự kiện refuel',
    ticks: 10, scenario: { ...empty, player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 55 }] }, inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      const r = ev(L, 'refuel');
      return expect(r.length === 1 && r[0].tick === 1 && r[0].data.amount === 5 && r[0].data.fuel === 100 && snap(L, 10).player.carried === 5 && end(L).score === 25 && ev(L, 'deposit').length === 0 && ev(L, 'lantern_lit').length === 0,
        `refuel ${JSON.stringify(r)} score ${end(L).score}`);
    },
  },
  {
    id: 'P3_03_relight', req: 'Đèn đã từng sáng thắp lại chỉ cần 5: lantern_lit relight true, +5×5 +40, relit_count 1, fuel 100, sức chứa 12',
    ticks: 10, scenario: { ...empty, player: { pos: [0, 0, 23.5], carried: 7 }, lanterns: [{ id: 'L1', ever_lit: true }] }, inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      const lit = ev(L, 'lantern_lit')[0]; const l1 = snap(L, 10).lanterns[0];
      return expect(lit && lit.data.relight === true && ev(L, 'deposit')[0].data.amount === 5 && end(L).score === 65 && l1.relit_count === 1 && l1.lit && l1.fuel === 99.9 && snap(L, 10).player.carried === 2 && snap(L, 10).player.capacity === 12,
        `lit ${JSON.stringify(lit)} L1 ${JSON.stringify(l1)} score ${end(L).score}`);
    },
  },
  {
    id: 'P3_04_capacity_growth', req: 'Sức chứa = 10 + 2 × successful_lights, tối đa 20',
    ticks: 400, scenario: { ...empty, player: { successful_lights: 7 }, motes: Array.from({ length: 25 }, (_, i) => [0, 0, 2 + i]) }, inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => { const p = snaps(L).pop().player; return expect(p.capacity === 20 && p.carried === 20 && L[0].player.capacity === 20, JSON.stringify(p)); },
  },
  {
    id: 'P3_05_drain', req: 'Bóng wander đứng ≤2 m đèn yếu (<30) → drain, hút 5/s + hao 1/s, fuel_drain mỗi 60 tick, hết dầu → lantern_out, bóng về wander',
    ticks: 320, scenario: { ...empty, lanterns: [{ id: 'L1', lit: true, fuel: 29 }], shades: [{ id: 'S1', pos: [0, 1, 23.5] }] },
    check: (L) => {
      const fd = ev(L, 'fuel_drain'); const o = ev(L, 'lantern_out')[0];
      return expect(snap(L, 10).shades[0].state === 'drain' && fd[0] && fd[0].tick === 61 && fd[0].data.shade_id === 'S1' && fd[0].data.lantern_id === 'L1' && fd[0].data.fuel === 23 && o && o.tick === 291 && snap(L, 300).shades[0].state === 'wander',
        `drain ${JSON.stringify(fd.slice(0, 2))} out ${JSON.stringify(o)} state@300 ${snap(L, 300).shades[0].state}`);
    },
  },
  {
    id: 'P3_06_drain_to_chase', req: 'Từ drain chỉ sang chase khi Mây vào trong 6 m (không phải 12 m)',
    ticks: 40, scenario: { ...empty, player: { pos: [0, 0, 15.5] }, lanterns: [{ id: 'L1', lit: true, fuel: 29 }], shades: [{ id: 'S1', pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }] },
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => expect(snap(L, 10).shades[0].state === 'drain' && snap(L, 30).shades[0].state === 'chase', `${snap(L, 10).shades[0].state} → ${snap(L, 30).shades[0].state}`),
  },
  {
    id: 'P3_07_refuel_evicts', req: 'Châm dầu lên ≥30 khi có Bóng trong 6 m → đẩy ra mép trong 30 tick, không sát thương',
    ticks: 200, scenario: { ...empty, player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [1, 1, 25], state: 'drain', target_lantern_id: 'L1' }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      const r = ev(L, 'refuel')[0]; const d30 = xz(snap(L, 30).shades[0].pos, [0, 0, 25]);
      return expect(r && r.data.amount === 9 && r.data.fuel === 100 && near(d30, 6, 0.01) && ev(L, 'player_hit').length === 0, `refuel ${JSON.stringify(r)} d30 ${d30} hits ${ev(L, 'player_hit').length}`);
    },
  },
  {
    id: 'P3_08_pulse_drain_bonus', req: 'Tỏa Sáng trúng Bóng đang drain: tổng +15 (thường +5), chuyển stunned',
    ticks: 10, scenario: { ...empty, player: { pos: [0, 0, 20], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 29 }], shades: [{ id: 'S1', pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }] },
    inputs: { frames: [{ tick: 0, pulse: true }] },
    check: (L) => expect(ev(L, 'pulse')[0]?.data.stunned_ids[0] === 'S1' && end(L).score === 15 && snap(L, 10).shades[0].state === 'stunned', `score ${end(L).score}`),
  },
  {
    id: 'P3_09_low_fuel_no_zone', req: 'Đèn fuel < 30 mất vùng an toàn (đứng ở đèn vẫn bị đánh)',
    ticks: 600, scenario: { ...empty, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [0, 1, 14] }] },
    check: (L) => expect(ev(L, 'player_hit').length > 0, 'expected a hit at a weak lantern'),
  },
  {
    id: 'P3_10_no_early_win', req: '[THAY THẾ all_lit] Thắp đủ mọi đèn không kết thúc Đêm',
    ticks: 30, scenario: { ...empty, player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })) }, inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => expect(ev(L, 'lantern_lit').length === 1 && ev(L, 'game_over').length === 0 && end(L).state === 'playing' && end(L).ticks === 30, JSON.stringify(end(L))),
  },
  {
    id: 'P3_11_dawn_survived', req: 'Hết giờ, còn sống, ≥ ceil(0.6×5)=3 đèn sáng → won/dawn_survived; điểm = Σ(50+floor(fuel)) + 50×lửa',
    ticks: 100, scenario: { ...empty, lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })), time_left_s: 1 },
    check: (L) => { const g = ev(L, 'game_over')[0]; return expect(g && g.tick === 60 && g.data.result === 'won' && g.data.reason === 'dawn_survived' && end(L).score === 3 * (50 + 99) + 3 * 50, `${JSON.stringify(g)} ${JSON.stringify(end(L))}`); },
  },
  {
    id: 'P3_12_dawn_below_threshold', req: 'Hết giờ với 2/5 đèn sáng → lost/dawn, không thưởng',
    ticks: 100, scenario: { ...empty, lanterns: ['L1', 'L2'].map((id) => ({ id, lit: true })), time_left_s: 1 },
    check: (L) => { const g = ev(L, 'game_over')[0]; return expect(g && g.data.result === 'lost' && g.data.reason === 'dawn' && end(L).score === 0, JSON.stringify(g)); },
  },
  {
    id: 'P3_13_threshold_night2', req: 'Đêm 2 cần 4/6: 4 đèn sáng lúc bình minh → thắng',
    night: 2, ticks: 100, scenario: { ...empty, lanterns: ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true })), time_left_s: 1 },
    check: (L) => expect(ev(L, 'game_over')[0]?.data.reason === 'dawn_survived', JSON.stringify(ev(L, 'game_over'))),
  },
  {
    id: 'P3_14_threshold_night3', req: 'Đêm 3 cần 5/7: 4 đèn sáng lúc bình minh → thua dawn',
    night: 3, ticks: 100, scenario: { ...empty, lanterns: ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true })), time_left_s: 1 },
    check: (L) => expect(ev(L, 'game_over')[0]?.data.reason === 'dawn' && end(L).state === 'lost', JSON.stringify(ev(L, 'game_over'))),
  },
  {
    id: 'P3_15_no_flames_beats_dawn', req: 'Hết Ngọn Lửa đúng tick bình minh → luôn thua no_flames',
    ticks: 10, scenario: { ...empty, player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }], lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })), time_left_s: 1 / 60 },
    check: (L) => { const g = ev(L, 'game_over')[0]; return expect(g && g.tick === 1 && g.data.reason === 'no_flames', JSON.stringify(g)); },
  },
  {
    id: 'P3_16_wander_targets_weak', req: 'Bóng wander đi tới đèn sáng yếu gần nhất rồi drain',
    ticks: 260, scenario: { ...empty, lanterns: [{ id: 'L1', lit: true, fuel: 29 }, { id: 'L2', lit: true }], shades: [{ id: 'S1', pos: [0, 1, 15] }] },
    check: (L) => { const s = snap(L, 260).shades[0]; return expect(s.state === 'drain' && xz(s.pos, [0, 0, 25]) <= 2 + 1e-3 && snap(L, 100).shades[0].pos[2] > 15, JSON.stringify(s)); },
  },
];

function snapshotStates(L) {
  const allowed = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);
  return snaps(L).every((s) => s.shades.every((x) => allowed.has(x.state)));
}
