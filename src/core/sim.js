// Đảo Đèn Lồng — pure game simulation (no DOM, no GPU). Shared by headless CLI and browser.
// Tick model (Test Contract v1.0): state 0 = after scenario setup; step(k) consumes input k -> state k+1.
//
// Order of operations inside one step (documented in docs/notes/phase-1.md):
//  1. timers tick down (invuln, pulse cooldown, shade stun)
//  2. player move (camera-relative) + jump/gravity, clamp to island
//  3. auto pickup motes (pickup_radius, while carried < capacity)
//  4. interact -> deposit into nearest unlit lantern within interact_radius
//  5. pulse -> stun + push shades within pulse_radius
//  6. shades move (chase), then are kept out of lit lanterns' safe_radius and on the island
//  7. shade hit check (non-stunned shade within shade_hit_radius, player not invulnerable)
//  8. spawning (only when random_motes / random_shades are enabled)
//  9. end checks: all lanterns lit -> won (all_lit); flames 0 -> lost (no_flames); time 0 -> lost (dawn)

import { TUNING, WORLD } from './tuning.js';
import { makeRng } from './rng.js';

const T = TUNING;
const DT = 1 / WORLD.tick_rate;
const secToTicks = (s) => Math.round(s * WORLD.tick_rate);

export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return x === 0 ? 0 : x;
};
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class FormatError extends Error {}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function vec3(v, what) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) throw new FormatError(`${what} must be [x,y,z] numbers`);
  return [v[0], v[1], v[2]];
}

export function defaultLanterns() {
  const out = [];
  for (let i = 0; i < T.lantern_count_night1; i++) {
    const a = (i * 2 * Math.PI) / T.lantern_count_night1;
    // L1 sits at (0,0,25) like the contract example.
    out.push({ id: `L${i + 1}`, pos: [r3(WORLD.lantern_ring_radius * Math.sin(a)), 0, r3(WORLD.lantern_ring_radius * Math.cos(a))], lit: false, deposited: 0 });
  }
  return out;
}

export class Sim {
  constructor({ seed = 1, scenario = null } = {}) {
    this.rng = makeRng(seed);
    this.steps = 0;
    this.state = 'playing';
    this.score = 0;
    this.result = null;
    this.player = { pos: [0, 0, 0], vy: 0, flames: T.flames, carried: 0, invuln: 0, cooldown: 0 };
    this.lanterns = defaultLanterns();
    this.motes = [];
    this.shades = [];
    this.nextMote = 1;
    this.nextShade = 1;
    this.randomMotes = true;
    this.randomShades = true;
    this.startTicks = secToTicks(T.night1_duration_s);
    this.moteTimer = 0;
    this.shadeTimer = 0;
    this.prevButtons = { jump: false, interact: false, pulse: false, dash: false };
    this.stats = { hits: 0, pulses: 0, stunned: 0, picked: 0 };

    const sc = scenario || {};
    if (scenario !== null && (typeof scenario !== 'object' || Array.isArray(scenario))) throw new FormatError('scenario must be an object');
    if ('random_motes' in sc) {
      if (typeof sc.random_motes !== 'boolean') throw new FormatError('random_motes must be boolean');
      this.randomMotes = sc.random_motes;
    }
    if ('random_shades' in sc) {
      if (typeof sc.random_shades !== 'boolean') throw new FormatError('random_shades must be boolean');
      this.randomShades = sc.random_shades;
    }
    if (sc.player !== undefined) {
      const p = sc.player;
      if (typeof p !== 'object' || p === null || Array.isArray(p)) throw new FormatError('player must be an object');
      if (p.pos !== undefined) this.player.pos = vec3(p.pos, 'player.pos');
      if (p.carried !== undefined) {
        if (!Number.isInteger(p.carried) || p.carried < 0) throw new FormatError('player.carried must be int >= 0');
        this.player.carried = p.carried;
      }
      if (p.flames !== undefined) {
        if (!Number.isInteger(p.flames) || p.flames < 0) throw new FormatError('player.flames must be int >= 0');
        this.player.flames = p.flames;
      }
    }
    if (sc.lanterns !== undefined) {
      if (!Array.isArray(sc.lanterns)) throw new FormatError('lanterns must be an array');
      for (const l of sc.lanterns) {
        if (typeof l !== 'object' || l === null) throw new FormatError('lantern entry must be an object');
        const target = this.lanterns.find((x) => x.id === l.id);
        if (!target) throw new FormatError(`unknown lantern id ${l.id}`);
        if (l.pos !== undefined) target.pos = vec3(l.pos, `lantern ${l.id}.pos`);
        if (l.deposited !== undefined) {
          if (!isNum(l.deposited) || l.deposited < 0) throw new FormatError('lantern.deposited must be >= 0');
          target.deposited = l.deposited;
        }
        if (l.lit !== undefined) {
          if (typeof l.lit !== 'boolean') throw new FormatError('lantern.lit must be boolean');
          target.lit = l.lit;
          if (l.lit && l.deposited === undefined) target.deposited = T.lantern_cost;
        }
        if (target.deposited >= T.lantern_cost) target.lit = true;
      }
    }
    if (sc.time_left_s !== undefined) {
      if (!isNum(sc.time_left_s) || sc.time_left_s < 0) throw new FormatError('time_left_s must be >= 0');
      this.startTicks = secToTicks(sc.time_left_s);
    }
    this.startTimeS = sc.time_left_s !== undefined ? sc.time_left_s : T.night1_duration_s;

    if (sc.motes !== undefined) {
      if (!Array.isArray(sc.motes)) throw new FormatError('motes must be an array');
      for (const m of sc.motes) {
        if (Array.isArray(m)) this.addMote(vec3(m, 'mote'));
        else if (m && typeof m === 'object') this.addMote(vec3(m.pos, 'mote.pos'), m.id);
        else throw new FormatError('mote must be [x,y,z] or {pos}');
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < WORLD.initial_motes; i++) this.addMote(this.randomMotePos());
    }
    if (sc.shades !== undefined) {
      if (!Array.isArray(sc.shades)) throw new FormatError('shades must be an array');
      for (const s of sc.shades) {
        if (!s || typeof s !== 'object' || Array.isArray(s)) throw new FormatError('shade must be an object');
        if (s.id !== undefined && typeof s.id !== 'string') throw new FormatError('shade.id must be a string');
        this.addShade(vec3(s.pos, 'shade.pos'), s.id);
      }
    } else if (this.randomShades) {
      for (let i = 0; i < WORLD.initial_shades; i++) this.addShade(this.randomShadePos());
    }
  }

  // ---------- helpers ----------
  addMote(pos, id) {
    const mid = id || `M${this.nextMote++}`;
    this.motes.push({ id: mid, pos });
    return mid;
  }
  addShade(pos, id) {
    let sid = id;
    if (!sid) {
      do sid = `S${this.nextShade++}`;
      while (this.shades.some((s) => s.id === sid));
    }
    this.shades.push({ id: sid, pos, stun: 0 });
    return sid;
  }
  randomMotePos() {
    const R = WORLD.island_radius - 2;
    for (let i = 0; i < 20; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = WORLD.mote_min_dist_from_origin + Math.sqrt(this.rng()) * (R - WORLD.mote_min_dist_from_origin);
      const p = [r3(Math.sin(a) * d), 0, r3(Math.cos(a) * d)];
      if (distXZ(p, this.player.pos) > T.pickup_radius) return p;
    }
    return [0, 0, R];
  }
  randomShadePos() {
    let p;
    for (let i = 0; i < 20; i++) {
      const a = this.rng() * Math.PI * 2;
      p = [r3(Math.sin(a) * WORLD.shade_spawn_radius), WORLD.shade_height, r3(Math.cos(a) * WORLD.shade_spawn_radius)];
      const farFromPlayer = distXZ(p, this.player.pos) >= WORLD.shade_spawn_min_dist;
      const outsideSafe = this.lanterns.every((l) => !l.lit || distXZ(p, l.pos) > T.safe_radius);
      if (farFromPlayer && outsideSafe) return p;
    }
    return p;
  }
  get timeLeftS() {
    return Math.max(0, this.startTimeS - this.steps / WORLD.tick_rate);
  }
  get litCount() {
    return this.lanterns.filter((l) => l.lit).length;
  }

  // ---------- main step ----------
  // input: { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash } (held values); edges computed here.
  step(input = {}) {
    const ev = [];
    if (this.state !== 'playing') return ev;
    this.steps++;
    const tick = this.steps;
    const emit = (name, data) => ev.push({ type: 'event', tick, name, data });
    const P = this.player;

    const btn = {};
    for (const k of ['jump', 'interact', 'pulse', 'dash']) {
      const now = !!input[k];
      btn[k] = now && !this.prevButtons[k];
      this.prevButtons[k] = now;
    }

    // 1. timers
    if (P.invuln > 0) P.invuln--;
    if (P.cooldown > 0) P.cooldown--;
    for (const s of this.shades) if (s.stun > 0) s.stun--;

    // 2. movement
    let [mx, mz] = Array.isArray(input.move) ? input.move : [0, 0];
    mx = Math.max(-1, Math.min(1, mx || 0));
    mz = Math.max(-1, Math.min(1, mz || 0));
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    P.pos[0] += wx * T.player_speed * DT;
    P.pos[2] += wz * T.player_speed * DT;
    const onGround = P.pos[1] <= 0;
    if (btn.jump && onGround) P.vy = WORLD.jump_speed;
    if (P.vy !== 0 || P.pos[1] > 0) {
      P.vy -= WORLD.gravity * DT;
      P.pos[1] += P.vy * DT;
      if (P.pos[1] <= 0) {
        P.pos[1] = 0;
        P.vy = 0;
      }
    }
    clampIsland(P.pos);

    // 3. pickup
    for (let i = 0; i < this.motes.length && P.carried < T.carry_capacity; ) {
      if (distXZ(this.motes[i].pos, P.pos) <= T.pickup_radius) {
        this.motes.splice(i, 1);
        P.carried++;
        this.score += T.score.per_mote;
        this.stats.picked++;
        emit('mote_picked', { carried: P.carried });
      } else i++;
    }

    // 4. interact / deposit
    if (btn.interact && P.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(l.pos, P.pos);
        if (d <= T.interact_radius && d < bestD) {
          best = l;
          bestD = d;
        }
      }
      if (best) {
        const amount = Math.min(P.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          P.carried -= amount;
          best.deposited += amount;
          emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            this.score += T.score.per_lantern;
            emit('lantern_lit', { lantern_id: best.id });
          }
        }
      }
    }

    // 5. pulse
    if (btn.pulse && P.cooldown === 0 && P.carried >= T.pulse_cost) {
      P.carried -= T.pulse_cost;
      P.cooldown = secToTicks(T.pulse_cooldown_s);
      const stunned = [];
      for (const s of this.shades) {
        const d = distXZ(s.pos, P.pos);
        if (d <= T.pulse_radius) {
          s.stun = secToTicks(T.pulse_stun_s);
          let dx = s.pos[0] - P.pos[0];
          let dz = s.pos[2] - P.pos[2];
          if (d < 1e-9) {
            dx = 1;
            dz = 0;
          } else {
            dx /= d;
            dz /= d;
          }
          s.pos[0] += dx * T.pulse_push_m;
          s.pos[2] += dz * T.pulse_push_m;
          stunned.push(s.id);
        }
      }
      this.score += stunned.length * T.score.per_stun;
      this.stats.pulses++;
      this.stats.stunned += stunned.length;
      emit('pulse', { stunned_ids: stunned });
    }

    // 6. shades move
    const step = T.shade_speed * DT;
    for (const s of this.shades) {
      if (s.stun === 0) {
        const dx = P.pos[0] - s.pos[0];
        const dz = P.pos[2] - s.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-9) {
          const m = Math.min(step, d);
          s.pos[0] += (dx / d) * m;
          s.pos[2] += (dz / d) * m;
        }
      }
      for (const l of this.lanterns) {
        if (!l.lit) continue;
        const dx = s.pos[0] - l.pos[0];
        const dz = s.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        const keep = T.safe_radius + 0.01;
        if (d < keep) {
          const ux = d < 1e-9 ? 1 : dx / d;
          const uz = d < 1e-9 ? 0 : dz / d;
          s.pos[0] = l.pos[0] + ux * keep;
          s.pos[2] = l.pos[2] + uz * keep;
        }
      }
      clampIsland(s.pos);
    }

    // 7. hit
    if (P.invuln === 0) {
      const hitter = this.shades.find((s) => s.stun === 0 && distXZ(s.pos, P.pos) <= T.shade_hit_radius);
      if (hitter) {
        P.flames = Math.max(0, P.flames - 1);
        const dropped = Math.floor(P.carried * T.hit_drop_ratio);
        P.carried -= dropped;
        P.invuln = secToTicks(T.invuln_s);
        this.stats.hits++;
        emit('player_hit', { by: 'shade', flames: P.flames, dropped });
      }
    }

    // 8. spawning
    if (this.randomMotes) {
      if (++this.moteTimer >= secToTicks(WORLD.mote_respawn_s)) {
        this.moteTimer = 0;
        if (this.motes.length < WORLD.max_motes) this.addMote(this.randomMotePos());
      }
    }
    if (this.randomShades) {
      if (++this.shadeTimer >= secToTicks(WORLD.shade_spawn_s)) {
        this.shadeTimer = 0;
        if (this.shades.length < WORLD.max_shades) emit('shade_spawned', { id: this.addShade(this.randomShadePos()) });
      }
    }

    // 9. end checks
    if (this.litCount === this.lanterns.length) this.finish('won', 'all_lit', emit);
    else if (P.flames <= 0) this.finish('lost', 'no_flames', emit);
    else if (this.steps >= this.startTicks) this.finish('lost', 'dawn', emit);
    return ev;
  }

  finish(result, reason, emit) {
    this.state = result;
    this.result = reason;
    if (result === 'won') {
      this.score += Math.floor(this.timeLeftS) * T.score.per_second_left + this.player.flames * T.score.per_flame_left;
    }
    emit('game_over', { result, reason });
  }

  snapshot() {
    return {
      type: 'snapshot',
      tick: this.steps,
      sim_tick: this.steps,
      state: this.state,
      time_left_s: r3(this.timeLeftS),
      score: this.score,
      player: { pos: this.player.pos.map(r3), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.stun > 0 ? 'stunned' : 'chase' })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
    };
  }
}

function clampIsland(pos) {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > WORLD.island_radius) {
    pos[0] *= WORLD.island_radius / d;
    pos[2] *= WORLD.island_radius / d;
  }
}
