// Single source of truth for gameplay numbers.
// game.contract.json "tuning" MUST mirror TUNING exactly (enforced by tests/contract.test.js).

export const TUNING = {
  player_speed: 6, // m/s on XZ plane
  carry_capacity: 10, // max motes carried
  lantern_cost: 5, // motes needed to light one lantern
  lantern_count_night1: 5,
  pickup_radius: 1.5, // auto pickup when XZ distance <= r
  interact_radius: 3, // deposit when XZ distance to lantern <= r
  pulse_cost: 1, // carried motes spent per pulse
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3, // health
  invuln_s: 1.5,
  hit_drop_ratio: 0.5, // dropped = floor(carried * ratio)
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 5, // shades cannot enter this radius around a LIT lantern
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false, // island edge is a soft wall, no falling
  score: { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 2, per_flame_left: 50 },
};

// Internal world constants (not part of the contract).
export const WORLD = {
  tick_rate: 60,
  island_radius: 40,
  lantern_ring_radius: 25,
  jump_speed: 7,
  gravity: 20,
  shade_height: 1,
  initial_motes: 30,
  max_motes: 30,
  mote_respawn_s: 2,
  mote_min_dist_from_origin: 3,
  initial_shades: 2,
  max_shades: 6,
  shade_spawn_s: 30,
  shade_spawn_radius: 36,
  shade_spawn_min_dist: 15,
};
