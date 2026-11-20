// Phase 1 scenario catalog: each entry = one acceptance criterion (AC) checked through the real headless output.
// Used by tests/scenarios.test.js (CI) and tools/proof.js (writes evidence to docs/proof/phase-1/).
import { TUNING as T } from '../../src/core/tuning.js';

const empty = { random_motes: false, random_shades: false, motes: [], shades: [] };
const ev = (lines, name) => lines.filter((l) => l.type === 'event' && l.name === name);
const snapAt = (lines, tick) => lines.find((l) => l.type === 'snapshot' && l.tick === tick);
const end = (lines) => lines[lines.length - 1];
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
const xz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const expect = (cond, msg) => (cond ? null : msg);

export const SCENARIOS = [
  {
    id: 'AC01_move_speed',
    req: 'Di chuyển: player_speed m/s theo trục Z khi move=[0,1], yaw=0',
    ticks: 60,
    scenario: empty,
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      const p = snapAt(L, 60).player.pos;
      return expect(near(p[2], T.player_speed) && near(p[0], 0), `pos at tick 60 = ${p}, expected z=${T.player_speed}`);
    },
  },
  {
    id: 'AC02_camera_yaw',
    req: 'Hướng di chuyển theo cam_yaw_deg (90° → move [0,1] đi +X)',
    ticks: 60,
    scenario: empty,
    inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] },
    check: (L) => {
      const p = snapAt(L, 60).player.pos;
      return expect(near(p[0], T.player_speed) && near(p[2], 0), `pos ${p}, expected x=${T.player_speed}`);
    },
  },
  {
    id: 'AC03_diagonal_normalized',
    req: 'Vector move dài hơn 1 được chuẩn hóa',
    ticks: 60,
    scenario: empty,
    inputs: { frames: [{ tick: 0, move: [1, 1] }] },
    check: (L) => {
      const p = snapAt(L, 60).player.pos;
      return expect(near(Math.hypot(p[0], p[2]), T.player_speed), `distance ${Math.hypot(p[0], p[2])}`);
    },
  },
  {
    id: 'AC04_pickup_radius',
    req: 'Nhặt đom đóm khi khoảng cách XZ ≤ pickup_radius (mote ở z=5 → nhặt ở tick 35)',
    ticks: 60,
    scenario: { ...empty, motes: [[0, 0, 5]] },
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      const e = ev(L, 'mote_picked');
      const want = Math.round(((5 - T.pickup_radius) / T.player_speed) * 60);
      return expect(e.length === 1 && e[0].tick === want && e[0].data.carried === 1, `mote_picked ${JSON.stringify(e)} want tick ${want}`);
    },
  },
  {
    id: 'AC05_carry_capacity',
    req: 'Không mang quá carry_capacity đom đóm',
    ticks: 300,
    scenario: { ...empty, motes: Array.from({ length: 14 }, (_, i) => [0, 0, 2 + i]) },
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (L) => {
      const s = end(L) && L.filter((l) => l.type === 'snapshot').pop();
      return expect(s.player.carried === T.carry_capacity && s.motes_active === 14 - T.carry_capacity && ev(L, 'mote_picked').length === T.carry_capacity, `carried ${s.player.carried}, motes left ${s.motes_active}`);
    },
  },
  {
    id: 'AC06_deposit_and_light',
    req: 'Nạp lantern_cost đom đóm vào đèn trong interact_radius → deposit + lantern_lit, +per_lantern',
    ticks: 10,
    scenario: { ...empty, player: { pos: [0, 0, 23], carried: T.lantern_cost } },
    inputs: { frames: [{ tick: 2, interact: true }, { tick: 3, interact: false }] },
    check: (L) => {
      const d = ev(L, 'deposit')[0];
      const lit = ev(L, 'lantern_lit')[0];
      return expect(
        d && d.tick === 3 && d.data.lantern_id === 'L1' && d.data.amount === T.lantern_cost && lit && lit.data.lantern_id === 'L1' && end(L).score === T.score.per_lantern,
        `deposit=${JSON.stringify(d)} lit=${JSON.stringify(lit)} score=${end(L).score}`,
      );
    },
  },
  {
    id: 'AC07_partial_deposit',
    req: 'Nạp một phần: đèn chưa đủ thì chưa sáng; ngoài interact_radius thì không nạp',
    ticks: 20,
    scenario: { ...empty, player: { pos: [0, 0, 22.5], carried: 3 } },
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, move: [0, -1] }, { tick: 12, move: [0, 0], interact: true }] },
    check: (L) => {
      const d = ev(L, 'deposit');
      return expect(d.length === 1 && d[0].data.deposited === 3 && ev(L, 'lantern_lit').length === 0, `deposits ${JSON.stringify(d)}`);
    },
  },
  {
    id: 'AC08_win_all_lit',
    req: 'Thắp đèn cuối → won/all_lit, cộng điểm thời gian & ngọn lửa còn lại',
    ticks: 30,
    scenario: {
      ...empty,
      player: { pos: [0, 0, 23], carried: T.lantern_cost, flames: 2 },
      lanterns: [{ id: 'L2', lit: true }, { id: 'L3', lit: true }, { id: 'L4', lit: true }, { id: 'L5', lit: true }],
      time_left_s: 100,
    },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (L) => {
      const g = ev(L, 'game_over')[0];
      const want = T.score.per_lantern + Math.floor(100 - 1 / 60) * T.score.per_second_left + 2 * T.score.per_flame_left;
      return expect(g && g.tick === 1 && g.data.result === 'won' && g.data.reason === 'all_lit' && end(L).state === 'won' && end(L).ticks === 1 && end(L).score === want, `game_over=${JSON.stringify(g)} end=${JSON.stringify(end(L))} want score ${want}`);
    },
  },
  {
    id: 'AC09_pulse_stun_push',
    req: 'Tỏa sáng: tốn pulse_cost, Bóng Mực trong pulse_radius bị stunned pulse_stun_s và đẩy pulse_push_m',
    ticks: 200,
    scenario: { ...empty, player: { carried: 2 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [0, 1, -20] }] },
    inputs: { frames: [{ tick: 0, pulse: true }] },
    check: (L) => {
      const p = ev(L, 'pulse')[0];
      const after = L.find((l) => l.type === 'snapshot' && l.tick === 10).shades.find((s) => s.id === 'S1');
      const stillStunned = L.find((l) => l.type === 'snapshot' && l.tick === 180).shades.find((s) => s.id === 'S1').state === 'stunned';
      const chaseAgain = L.find((l) => l.type === 'snapshot' && l.tick === 190).shades.find((s) => s.id === 'S1').state !== 'stunned';
      return expect(
        p && p.tick === 1 && JSON.stringify(p.data.stunned_ids) === '["S1"]' && near(after.pos[0], 3 + T.pulse_push_m) && after.state === 'stunned' && stillStunned && chaseAgain && end(L).score === T.score.per_stun,
        `pulse=${JSON.stringify(p)} S1@10=${JSON.stringify(after)} stunned@180=${stillStunned} chase@190=${chaseAgain}`,
      );
    },
  },
  {
    id: 'AC10_pulse_cooldown_and_cost',
    req: 'Tỏa sáng có cooldown pulse_cooldown_s; không đủ ánh sáng thì không tỏa',
    ticks: 300,
    scenario: { ...empty, player: { carried: 2 } },
    inputs: {
      frames: [
        { tick: 0, pulse: true }, { tick: 1, pulse: false },
        { tick: 60, pulse: true }, { tick: 61, pulse: false }, // in cooldown -> ignored
        { tick: 130, pulse: true }, { tick: 131, pulse: false }, // ok, carried 2 -> 0
        { tick: 260, pulse: true }, // no light left -> ignored
      ],
    },
    check: (L) => {
      const ticks = ev(L, 'pulse').map((e) => e.tick);
      return expect(JSON.stringify(ticks) === '[1,131]', `pulse ticks ${JSON.stringify(ticks)}`);
    },
  },
  {
    id: 'AC11_hit_invuln_drop',
    req: 'Bị chạm: mất 1 flame, rơi floor(carried×hit_drop_ratio), bất tử invuln_s',
    ticks: 200,
    scenario: { ...empty, player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] },
    inputs: null,
    check: (L) => {
      const h = ev(L, 'player_hit');
      const gap = h.length > 1 ? h[1].tick - h[0].tick : -1;
      return expect(h.length >= 2 && h[0].tick === 1 && h[0].data.flames === 2 && h[0].data.dropped === Math.floor(4 * T.hit_drop_ratio) && gap === Math.round(T.invuln_s * 60), `hits ${JSON.stringify(h)}`);
    },
  },
  {
    id: 'AC12_lose_no_flames',
    req: 'Hết flame → lost/no_flames, dừng sớm',
    ticks: 600,
    scenario: { ...empty, player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }] },
    inputs: null,
    check: (L) => {
      const g = ev(L, 'game_over')[0];
      return expect(g && g.data.result === 'lost' && g.data.reason === 'no_flames' && end(L).state === 'lost' && end(L).ticks === g.tick, `game_over=${JSON.stringify(g)} end=${JSON.stringify(end(L))}`);
    },
  },
  {
    id: 'AC13_dawn',
    req: 'Hết thời gian đêm → lost/dawn; time_left_s giảm 1/60 mỗi bước',
    ticks: 600,
    scenario: { ...empty, time_left_s: 2 },
    inputs: null,
    check: (L) => {
      const g = ev(L, 'game_over')[0];
      return expect(g && g.tick === 120 && g.data.reason === 'dawn' && snapAt(L, 60).time_left_s === 1 && end(L).ticks === 120, `game_over=${JSON.stringify(g)}`);
    },
  },
  {
    id: 'AC14_safe_radius',
    req: 'Bóng Mực không vào safe_radius quanh đèn đã thắp; người chơi đứng ở đèn không bị chạm',
    ticks: 600,
    scenario: { ...empty, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ id: 'S1', pos: [0, 1, 10] }] },
    inputs: null,
    check: (L) => {
      const snaps = L.filter((l) => l.type === 'snapshot');
      const minD = Math.min(...snaps.map((s) => xz(s.shades[0].pos, [0, 0, 25])));
      return expect(minD >= T.safe_radius && ev(L, 'player_hit').length === 0, `min distance ${minD}, hits ${ev(L, 'player_hit').length}`);
    },
  },
  {
    id: 'AC15_unlit_lantern_not_safe',
    req: 'Đèn chưa thắp không bảo vệ (giả định A7)',
    ticks: 600,
    scenario: { ...empty, player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [0, 1, 10] }] },
    inputs: null,
    check: (L) => expect(ev(L, 'player_hit').length > 0, 'expected a hit near unlit lantern'),
  },
  {
    id: 'AC16_island_edge',
    req: 'fall_enabled=false: không rơi khỏi đảo, bị giữ ở bán kính 40 m',
    ticks: 600,
    scenario: empty,
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (L) => {
      const p = L.filter((l) => l.type === 'snapshot').pop().player.pos;
      return expect(near(Math.hypot(p[0], p[2]), 40) && ev(L, 'player_hit').length === 0, `pos ${p}`);
    },
  },
  {
    id: 'AC17_jump',
    req: 'Nhảy: Y tăng rồi về 0; chỉ kích hoạt ở cạnh false→true',
    ticks: 120,
    scenario: empty,
    inputs: { frames: [{ tick: 0, jump: true }] },
    check: (L) => {
      const y20 = snapAt(L, 20).player.pos[1];
      const y120 = snapAt(L, 120).player.pos[1];
      return expect(y20 > 0.5 && y120 === 0, `y@20=${y20} y@120=${y120} (held jump must not re-jump)`);
    },
  },
  {
    id: 'AC18_default_level',
    req: 'Màn mặc định: 5 đèn L1–L5, đom đóm ngẫu nhiên, Bóng Mực xuất hiện (shade_spawned) theo seed',
    ticks: 1900,
    seed: 42,
    scenario: { player: { flames: 99 } }, // only to survive until the 30 s spawn; entities stay random
    inputs: null,
    check: (L) => {
      const s0 = L[0];
      const spawned = ev(L, 'shade_spawned');
      return expect(
        s0.lanterns.length === 5 && s0.lanterns.map((l) => l.id).join() === 'L1,L2,L3,L4,L5' && s0.motes_active === 30 && s0.shades.length === 2 && spawned.length === 1 && spawned[0].tick === 1800 && spawned[0].data.id === 'S3',
        `lanterns ${s0.lanterns.length}, motes ${s0.motes_active}, shades ${s0.shades.length}, spawned ${JSON.stringify(spawned)}`,
      );
    },
  },
  {
    id: 'AC19_scenario_no_events',
    req: 'Dựng scenario không phát sự kiện, không cộng điểm (đèn lit sẵn, mote dưới chân)',
    ticks: 0,
    scenario: { ...empty, motes: [[0, 0, 0]], lanterns: [{ id: 'L1', lit: true }] },
    inputs: null,
    check: (L) => expect(L.length === 2 && L[0].score === 0 && L[1].type === 'end' && L[1].ticks === 0, `lines ${L.length}`),
  },
];
