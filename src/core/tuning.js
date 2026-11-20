// Single source of truth for gameplay numbers — Ticket-02 standard values + Ticket-03 change request (Contract v1.2).
// game.contract.json "tuning" MUST mirror TUNING exactly (enforced by tests/contract.test.js).

export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240, // Ticket-03 (was 300)
  night2_duration_s: 270, // Ticket-03 (was 330)
  night3_duration_s: 300, // Ticket-03 (was 360)
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  // Ticket-03: lantern fuel, drain, new win rule, growing capacity
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  // Ticket-03 score: +5 per mote put in a lantern, +100 first light; time bonus removed (0).
  // Relight +40, pulse on a draining shade 15 total, dawn bonus per lit lantern 50 + floor(fuel): see RULES.
  score: { per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50 },
};

// Other standard rules from Ticket-02 (not contract keys). All durations in ticks (60/s).
export const RULES = {
  tick_rate: 60,
  jump_speed: 7,
  gravity: 20,
  step_height: 0.35, // max ledge a foot can walk up (ramps are smooth; tier cliffs are 3 m)
  pickup_dy: 1.5,
  hit_dy: 1.5,
  dash_ticks: 12,
  dash_cd_ticks: 90,
  pulse_cd_ticks: 180,
  pulse_center_dy: 0.8,
  stun_ticks: 120,
  push_ticks: 15,
  invuln_ticks: 90,
  mote_initial: 20,
  mote_cap: 30,
  mote_spawn_every: 240,
  dropped_ttl: 480,
  drop_ring: [1.5, 2.5],
  safe_evict_ticks: 30,
  shade_first_spawn: 300,
  shade_spawn_min_dist: 15,
  shade_spawning_ticks: 30, // assumption B6
  shade_hover: 1,
  shade_wander_speed: 2, // assumption B7
  shade_detect: 12,
  shade_giveup: 18,
  recoil_m: 2,
  recoil_ticks: 60,
  fall_y: -10,
  respawn_wait: 60,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_spawn_every: 1200,
  drifter_chase_carried: 5,
  drifter_chase_range: 15,
  drifter_touch: 1.2,
  drifter_steal_max: 3,
  drifter_flee_ticks: 240,
  drifter_drop_flee_ticks: 120,
  drifter_hover: 1.5,
  charm_ticks: 600,
  charm_respawn: 2700,
  charm_speed: 7.2,
  wind_every: 1800,
  wind_ticks: 300,
  wind_speed: 2,
  pad_radius: 1,
  // Ticket-03
  fuel_unit: 60, // fuel stored as integer 1/60 units (1 unit/tick decay = 1.0/s)
  capacity_per_light: 2,
  relight_score: 40,
  stun_drain_score: 15, // total for a shade that was draining
  dawn_lantern_score: 50, // + floor(fuel)
  drain_range: 2,
  drain_chase_range: 6,
  drain_event_every: 60,
};
