// Đảo Đèn Lồng — pure game simulation (no DOM, no GPU). Shared by headless CLI and browser.
// Test Contract v1.2 / Ticket-02 + Ticket-03. Mandatory order inside one tick:
//   1 read input (pause first; if we just paused, stop)   2 timers (+ fuel decay/drain, then lanterns at fuel<=0 go out)   3 move player (jump, dash, pads, wind) + fall check
//   4 pickup motes & charms   5 lantern interact   6 safe zones   7 pulse   8 move shades & drifters
//   9 contacts (drifters steal first, then shades hit, by ascending id)   10 spawns   11 win/lose   (12 snapshot: runner)
// While paused: tick advances, sim_tick / time / cooldowns / spawns / TTL do not.

import { TUNING as T, RULES as R } from './tuning.js';
import { NIGHTS } from './maps.js';
import { makeRng } from './rng.js';

const DT = 1 / R.tick_rate;
const EPS = 1e-9; // float tolerance for every "within radius r" (distance <= r) test
export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return x === 0 ? 0 : x;
};
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => {
  const n = parseInt(String(id).replace(/^\D+/, ''), 10);
  return Number.isFinite(n) ? n : 1e9;
};
const byId = (a, b) => idNum(a.id) - idNum(b.id) || String(a.id).localeCompare(String(b.id));

export class FormatError extends Error {}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function vec3(v, what) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) throw new FormatError(`${what} must be [x,y,z] numbers`);
  return [v[0], v[1], v[2]];
}
function intField(o, k, what) {
  if (o[k] === undefined) return undefined;
  if (!Number.isInteger(o[k]) || o[k] < 0) throw new FormatError(`${what}.${k} must be an int >= 0`);
  return o[k];
}
function boolField(o, k) {
  if (o[k] === undefined) return undefined;
  if (typeof o[k] !== 'boolean') throw new FormatError(`${k} must be boolean`);
  return o[k];
}

const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const r1 = (v) => Math.round(v * 10) / 10 || 0;
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export class Sim {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    const map = NIGHTS[night];
    if (!map) throw new Error(`night ${night} not available (1, 2, 3)`);
    if (scenario !== null && !isObj(scenario)) throw new FormatError('scenario must be an object');
    const sc = scenario || {};
    this.map = map;
    this.night = night;
    this.rng = makeRng(seed);
    this.tick = 0;
    this.simTick = 0;
    this.paused = false;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.next = { M: 1, S: 1, D: 1 };
    this.player = {
      pos: [...map.start], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: T.flames, carried: 0, invuln: 0, dashCd: 0, dashTicks: 0, dashDir: [0, 1],
      pulseCd: 0, charm: 0, launch: null, respawn: 0,
    };
    // fuel is an integer count of 1/60 units (FU); everLit/relit track the Ticket-03 lantern lifecycle
    this.lanterns = map.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0, fuel: 0, everLit: false, relit: 0 }));
    this.successfulLights = 0;
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.charms = map.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawn: 0 }));
    this.wind = { active: false, dir: null, left: 0 };
    this.randomMotes = boolField(sc, 'random_motes') ?? true;
    this.randomShades = boolField(sc, 'random_shades') ?? true;
    this.randomDrifters = (boolField(sc, 'random_drifters') ?? true) && map.drifters;
    this.windEnabled = (boolField(sc, 'wind_enabled') ?? true) && map.wind;
    this.startTimeS = map.duration_s;
    this.stats = { hits: 0, falls: 0, pulses: 0, stunned: 0, steals: 0, deposited: 0 };

    // ---- player ----
    if (sc.player !== undefined) {
      const p = sc.player;
      if (!isObj(p)) throw new FormatError('player must be an object');
      if (p.pos !== undefined) this.player.pos = vec3(p.pos, 'player.pos');
      const P = this.player;
      P.carried = intField(p, 'carried', 'player') ?? P.carried;
      P.flames = intField(p, 'flames', 'player') ?? P.flames;
      P.invuln = intField(p, 'invuln_ticks', 'player') ?? 0;
      P.dashCd = intField(p, 'dash_cd_ticks', 'player') ?? 0;
      P.pulseCd = intField(p, 'pulse_cd_ticks', 'player') ?? 0;
      P.charm = intField(p, 'charm_ticks', 'player') ?? 0;
      this.successfulLights = intField(p, 'successful_lights', 'player') ?? 0;
    }
    const g = map.ground(this.player.pos[0], this.player.pos[2]);
    this.player.grounded = g !== null && Math.abs(this.player.pos[1] - g) < 1e-6;

    // ---- lanterns ----
    if (sc.lanterns !== undefined) {
      if (!Array.isArray(sc.lanterns)) throw new FormatError('lanterns must be an array');
      for (const l of sc.lanterns) {
        if (!isObj(l)) throw new FormatError('lantern entry must be an object');
        const t = this.lanterns.find((x) => x.id === l.id);
        if (!t) throw new FormatError(`unknown lantern id ${l.id} for night ${night}`);
        if (l.pos !== undefined) t.pos = vec3(l.pos, `lantern ${l.id}.pos`);
        if (l.deposited !== undefined) {
          if (!isNum(l.deposited) || l.deposited < 0) throw new FormatError('lantern.deposited must be >= 0');
          t.deposited = l.deposited;
        }
        if (l.ever_lit !== undefined) {
          if (typeof l.ever_lit !== 'boolean') throw new FormatError('lantern.ever_lit must be boolean');
          t.everLit = l.ever_lit;
        }
        if (l.lit !== undefined) {
          if (typeof l.lit !== 'boolean') throw new FormatError('lantern.lit must be boolean');
          t.lit = l.lit;
        }
        if (l.fuel !== undefined && (!isNum(l.fuel) || l.fuel < 0 || l.fuel > T.fuel_max)) throw new FormatError('lantern.fuel must be 0..100');
        if (!t.lit && t.deposited >= this.costOf(t)) t.lit = true;
        if (t.lit) {
          // lit: true without fuel -> 100; a lit lantern has been lit at least once
          t.fuel = Math.round((l.fuel ?? T.fuel_max) * R.fuel_unit);
          if (l.ever_lit === undefined) t.everLit = true;
          if (l.deposited === undefined) t.deposited = this.costOf(t);
          if (t.fuel <= 0) Object.assign(t, { lit: false, fuel: 0, deposited: 0 });
        } else t.fuel = 0;
      }
    }
    if (sc.time_left_s !== undefined) {
      if (!isNum(sc.time_left_s) || sc.time_left_s < 0) throw new FormatError('time_left_s must be >= 0');
      this.startTimeS = sc.time_left_s;
    }
    this.endTick = Math.round(this.startTimeS * R.tick_rate);

    // ---- motes ----
    if (sc.motes !== undefined) {
      if (!Array.isArray(sc.motes)) throw new FormatError('motes must be an array');
      for (const m of sc.motes) {
        if (Array.isArray(m)) this.addMote(vec3(m, 'mote'), 'random');
        else if (isObj(m)) {
          const kind = m.kind ?? 'random';
          if (kind !== 'random' && kind !== 'dropped') throw new FormatError('mote.kind must be random|dropped');
          const ttl = intField(m, 'ttl_ticks', 'mote') ?? (m.ttl_s !== undefined && isNum(m.ttl_s) ? Math.round(m.ttl_s * 60) : R.dropped_ttl);
          this.addMote(vec3(m.pos, 'mote.pos'), kind, kind === 'dropped' ? ttl : null, m.id);
        } else throw new FormatError('mote must be [x,y,z] or {pos}');
      }
    } else if (this.randomMotes) {
      const idx = map.moteSpawns.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      for (const i of idx.slice(0, R.mote_initial)) this.addMote([...map.moteSpawns[i]], 'random', null, undefined, i);
    }

    // ---- shades (none at start by default: first spawn at tick 300) ----
    if (sc.shades !== undefined) {
      if (!Array.isArray(sc.shades)) throw new FormatError('shades must be an array');
      for (const s of sc.shades) {
        if (!isObj(s)) throw new FormatError('shade must be an object');
        if (s.id !== undefined && typeof s.id !== 'string') throw new FormatError('shade.id must be a string');
        const state = s.state ?? 'wander';
        if (!SHADE_STATES.includes(state)) throw new FormatError(`shade.state must be one of ${SHADE_STATES}`);
        const sh = this.addShade(vec3(s.pos, 'shade.pos'), s.id, state);
        const left = intField(s, 'state_ticks_left', 'shade');
        if (state === 'stunned') sh.st = left ?? R.stun_ticks;
        if (state === 'spawning') sh.st = left ?? R.shade_spawning_ticks;
        if (s.target_lantern_id !== undefined) {
          const tl = this.lanterns.find((x) => x.id === s.target_lantern_id);
          if (!tl) throw new FormatError(`unknown target_lantern_id ${s.target_lantern_id}`);
          sh.target = tl;
        }
        if (state === 'drain' && !sh.target) sh.target = this.nearestLantern(sh.pos, () => true);
        if (state === 'recoil') {
          sh.st = left ?? R.recoil_ticks;
          sh.dir = this.awayFromPlayer(sh.pos);
        }
      }
    }

    // ---- drifters ----
    if (sc.drifters !== undefined) {
      if (!Array.isArray(sc.drifters)) throw new FormatError('drifters must be an array');
      for (const d of sc.drifters) {
        if (!isObj(d)) throw new FormatError('drifter must be an object');
        const state = d.state ?? 'idle';
        if (!DRIFTER_STATES.includes(state)) throw new FormatError(`drifter.state must be one of ${DRIFTER_STATES}`);
        const dr = this.addDrifter(vec3(d.pos, 'drifter.pos'), d.id);
        dr.state = state;
        dr.stolen = intField(d, 'stolen', 'drifter') ?? 0;
        dr.removeAt = intField(d, 'state_ticks_left', 'drifter') ?? (state === 'flee' ? R.drifter_flee_ticks : 0);
        if (dr.stolen > 0 || state === 'flee') dr.stoleOnce = true;
      }
    }

    // ---- charms ----
    if (sc.charms !== undefined) {
      if (!Array.isArray(sc.charms)) throw new FormatError('charms must be an array');
      this.charms = sc.charms.map((c, i) => {
        if (!isObj(c)) throw new FormatError('charm must be an object');
        const id = c.id ?? `C${i + 1}`;
        const def = map.charms[idNum(id) - 1];
        const pos = c.pos !== undefined ? vec3(c.pos, 'charm.pos') : def ? [...def] : null;
        if (!pos) throw new FormatError(`charm ${id} needs pos on night ${night}`);
        const available = boolField(c, 'available') ?? true;
        const respawn = intField(c, 'respawn_ticks', 'charm') ?? (available ? 0 : R.charm_respawn);
        return { id, pos, available, respawn: available ? 0 : respawn };
      });
    }
  }

  // ---------- helpers ----------
  ground(x, z) {
    return this.map.ground(x, z);
  }
  addMote(pos, kind, ttl = null, id, point = -1) {
    const m = { id: id || `M${this.next.M++}`, pos, kind, ttl, point, born: this.simTick };
    this.motes.push(m);
    return m;
  }
  addShade(pos, id, state = 'spawning') {
    let sid = id;
    while (!sid || (!id && this.shades.some((s) => s.id === sid))) sid = `S${this.next.S++}`;
    const s = { id: sid, pos, state, st: state === 'spawning' ? R.shade_spawning_ticks : 0, dir: [1, 0], pushLeft: 0, evictLeft: 0, evictFrom: null, wp: null, target: null, drainTicks: 0, born: this.simTick };
    this.shades.push(s);
    return s;
  }
  addDrifter(pos, id) {
    let did = id;
    while (!did || (!id && this.drifters.some((d) => d.id === did))) did = `D${this.next.D++}`;
    const d = { id: did, pos, state: 'idle', stolen: 0, removeAt: 0, stoleOnce: false, wp: null, born: this.simTick };
    this.drifters.push(d);
    return d;
  }
  awayFromPlayer(pos) {
    const P = this.player.pos;
    const dx = pos[0] - P[0];
    const dz = pos[2] - P[2];
    const d = Math.hypot(dx, dz);
    return d < 1e-9 ? [1, 0] : [dx / d, dz / d];
  }
  get timeLeftS() {
    return Math.max(0, this.startTimeS - this.simTick / R.tick_rate);
  }
  get winThreshold() {
    return Math.ceil(T.win_ratio * this.lanterns.length - 1e-9);
  }
  get litCount() {
    return this.lanterns.filter((l) => l.lit).length;
  }
  // Ticket-03: a lit lantern only protects while fuel >= 30 (exactly 30 still protects)
  hasZone(l) {
    return l.lit && l.fuel >= T.low_fuel_threshold * R.fuel_unit;
  }
  inSafeZone(x, z) {
    return this.lanterns.some((l) => this.hasZone(l) && Math.hypot(x - l.pos[0], z - l.pos[2]) < T.safe_radius);
  }
  costOf(l) {
    return l.everLit ? T.relight_cost : T.lantern_cost;
  }
  get capacity() {
    return Math.min(T.capacity_max, T.carry_capacity + R.capacity_per_light * this.successfulLights);
  }
  // nearest lantern matching pred (ties -> lower id)
  nearestLantern(pos, pred) {
    let best = null;
    let bestD = Infinity;
    for (const l of [...this.lanterns].sort(byId)) {
      if (!pred(l)) continue;
      const d = distXZ(l.pos, pos);
      if (d < bestD) (best = l), (bestD = d);
    }
    return best;
  }

  // Horizontal move with terrain: cannot walk up more than step_height; canVoid=false blocks walking off ground.
  // Returns true if fully moved.
  moveXZ(pos, nx, nz, footY, canVoid) {
    const ok = (x, z) => {
      const h = this.ground(x, z);
      if (h === null) return canVoid;
      return h <= footY + R.step_height;
    };
    if (ok(nx, nz)) {
      pos[0] = nx;
      pos[2] = nz;
      return true;
    }
    if (ok(nx, pos[2])) pos[0] = nx;
    else if (ok(pos[0], nz)) pos[2] = nz;
    return false;
  }
  hoverY(e, hover) {
    const h = this.ground(e.pos[0], e.pos[2]);
    if (h !== null) e.pos[1] = h + hover;
  }

  // ---------- main step ----------
  step(input = {}) {
    const ev = [];
    if (this.state !== 'playing') return ev;
    this.tick++;
    const emit = (name, data = {}) => ev.push({ type: 'event', tick: this.tick, name, data });
    const P = this.player;

    // 1. input (pause first)
    const btn = {};
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      const now = !!input[k];
      btn[k] = now && !this.prev[k];
      this.prev[k] = now;
    }
    if (btn.pause) {
      this.paused = !this.paused;
      emit(this.paused ? 'paused' : 'resumed');
      if (this.paused) return ev;
    } else if (this.paused) return ev;
    this.simTick++;

    // 2. timers
    if (P.invuln > 0) P.invuln--;
    if (P.dashCd > 0) P.dashCd--;
    if (P.pulseCd > 0) P.pulseCd--;
    if (P.charm > 0) P.charm--;
    let respawnNow = false;
    if (P.respawn > 0 && --P.respawn === 0) respawnNow = true;
    for (const s of this.shades) {
      if ((s.state === 'stunned' || s.state === 'spawning') && s.st > 0 && --s.st === 0) {
        s.state = 'wander';
        s.wp = null;
      }
    }
    for (const m of this.motes) if (m.kind === 'dropped' && m.ttl > 0) m.ttl--;
    this.motes = this.motes.filter((m) => m.kind !== 'dropped' || m.ttl > 0);
    for (const c of this.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    // 2b (Ticket-03). fuel: decay 1/60 per tick + 5/60 per draining shade; then lanterns at fuel <= 0 go out
    for (const l of this.lanterns) if (l.lit) l.fuel -= T.fuel_decay_per_s;
    for (const s of [...this.shades].sort(byId)) {
      if (s.state !== 'drain' || !s.target || !s.target.lit) continue;
      s.target.fuel -= T.drain_per_s;
      if (++s.drainTicks % R.drain_event_every === 0) emit('fuel_drain', { lantern_id: s.target.id, shade_id: s.id, fuel: r1(Math.max(0, s.target.fuel) / R.fuel_unit) });
    }
    for (const l of [...this.lanterns].sort(byId)) {
      if (l.lit && l.fuel <= 0) {
        Object.assign(l, { lit: false, fuel: 0, deposited: 0, everLit: true });
        emit('lantern_out', { lantern_id: l.id });
      }
    }

    // 3. player movement
    const alive = P.respawn === 0;
    if (respawnNow) {
      P.pos = [...this.map.start];
      P.vel = [0, 0, 0];
      P.grounded = true;
      P.launch = null;
      P.dashTicks = 0;
      P.invuln = R.invuln_ticks;
    } else if (alive) this.movePlayer(input, btn, emit);

    // 4. pickup
    if (alive && !respawnNow) {
      for (let i = 0; i < this.motes.length && P.carried < this.capacity; ) {
        const m = this.motes[i];
        if (m.born < this.simTick && distXZ(m.pos, P.pos) <= T.pickup_radius + EPS && Math.abs(P.pos[1] - m.pos[1]) <= R.pickup_dy) {
          this.motes.splice(i, 1);
          P.carried++;
          emit('mote_picked', { carried: P.carried });
        } else i++;
      }
      for (const c of this.charms) {
        if (c.available && distXZ(c.pos, P.pos) <= T.pickup_radius + EPS && Math.abs(P.pos[1] - c.pos[1]) <= R.pickup_dy) {
          c.available = false;
          c.respawn = R.charm_respawn;
          P.charm = R.charm_ticks;
          P.dashCd = 0;
          emit('charm_picked', { charm_id: c.id, charm_ticks: R.charm_ticks });
        }
      }
    }

    // 5. interact
    // Ticket-03: eligible = unlit, or lit but not full; nearest, ties -> lower id
    const newlyLit = [];
    const FMAX = T.fuel_max * R.fuel_unit;
    if (alive && btn.interact && P.carried > 0) {
      const best = this.nearestLantern(P.pos, (l) => (!l.lit || l.fuel < FMAX) && distXZ(l.pos, P.pos) <= T.interact_radius + EPS);
      if (best && !best.lit) {
        const cost = this.costOf(best);
        const amount = Math.min(P.carried, cost - best.deposited);
        if (amount > 0) {
          P.carried -= amount;
          best.deposited += amount;
          this.score += amount * T.score.per_mote;
          this.stats.deposited += amount;
          emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= cost) {
            const relight = best.everLit;
            best.lit = true;
            best.fuel = FMAX;
            best.everLit = true;
            if (relight) best.relit++;
            this.successfulLights++;
            this.score += relight ? R.relight_score : T.score.per_lantern;
            newlyLit.push(best);
            emit('lantern_lit', { lantern_id: best.id, relight });
          }
        }
      } else if (best) {
        // refuel: used = min(carried, ceil((100 - fuel) / 10)) — in integer fuel units
        const per = T.fuel_per_mote * R.fuel_unit;
        const used = Math.min(P.carried, Math.ceil((FMAX - best.fuel) / per));
        if (used > 0) {
          const before = best.fuel;
          best.fuel = Math.min(FMAX, best.fuel + per * used);
          P.carried -= used;
          this.score += used * T.score.per_mote;
          this.stats.deposited += used;
          emit('refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuel / R.fuel_unit) });
          const low = T.low_fuel_threshold * R.fuel_unit;
          if (before < low && best.fuel >= low) newlyLit.push(best); // zone comes back -> evict shades like a fresh light
        }
      }
    }

    // 6. safe zones: shades caught inside a newly lit (or refuelled to >= 30) lantern are evicted to the edge within 30 ticks
    for (const l of newlyLit) {
      for (const s of this.shades) {
        if (distXZ(s.pos, l.pos) < T.safe_radius) {
          s.evictLeft = R.safe_evict_ticks;
          s.evictFrom = l;
        }
      }
    }

    // 7. pulse
    if (alive && btn.pulse && P.pulseCd === 0 && P.carried >= T.pulse_cost) {
      P.carried -= T.pulse_cost;
      P.pulseCd = R.pulse_cd_ticks;
      const c = [P.pos[0], P.pos[1] + R.pulse_center_dy, P.pos[2]];
      const stunned = [];
      for (const s of [...this.shades].sort(byId)) {
        if (dist3(s.pos, c) <= T.pulse_radius + EPS) {
          this.score += s.state === 'drain' ? R.stun_drain_score : T.score.per_stun; // 15 total if it was draining
          s.state = 'stunned';
          s.st = R.stun_ticks;
          s.pushLeft = R.push_ticks;
          const dx = s.pos[0] - c[0];
          const dz = s.pos[2] - c[2];
          const d = Math.hypot(dx, dz);
          s.dir = d < 1e-9 ? [1, 0] : [dx / d, dz / d];
          stunned.push(s.id);
        }
      }
      for (const d of [...this.drifters].sort(byId)) {
        if (d.state === 'removed' || dist3(d.pos, c) > T.pulse_radius + EPS) continue;
        if (d.state === 'chase') {
          d.state = 'flee';
          d.removeAt = this.simTick + R.drifter_flee_ticks;
          d.stoleOnce = true;
        } else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen;
          for (let i = 0; i < amount; i++) {
            const g = this.ground(d.pos[0], d.pos[2]);
            this.addMote([d.pos[0], g ?? 0, d.pos[2]], 'dropped', R.dropped_ttl);
          }
          d.stolen = 0;
          d.removeAt = this.simTick + R.drifter_drop_flee_ticks;
          emit('drifter_drop', { drifter_id: d.id, amount });
        }
      }
      this.stats.pulses++;
      this.stats.stunned += stunned.length;
      emit('pulse', { stunned_ids: stunned });
    }

    // 8. move shades and drifters
    this.moveShades();
    this.moveDrifters();

    // 9. contacts: drifters steal first, then shades hit (ascending id)
    if (alive && !respawnNow) {
      for (const d of [...this.drifters].sort(byId)) {
        if ((d.state === 'idle' || d.state === 'chase') && !d.stoleOnce && d.born < this.simTick && P.carried > 0 && distXZ(d.pos, P.pos) <= R.drifter_touch + EPS) {
          const amount = Math.min(R.drifter_steal_max, P.carried);
          P.carried -= amount;
          d.stolen = amount;
          d.stoleOnce = true;
          d.state = 'flee';
          d.removeAt = this.simTick + R.drifter_flee_ticks;
          this.stats.steals++;
          emit('drifter_steal', { drifter_id: d.id, amount, carried: P.carried });
        }
      }
      if (P.invuln === 0) {
        for (const s of [...this.shades].sort(byId)) {
          if ((s.state !== 'wander' && s.state !== 'chase') || s.evictLeft > 0 || s.born >= this.simTick) continue;
          if (distXZ(s.pos, P.pos) <= T.shade_hit_radius + EPS && Math.abs(s.pos[1] - P.pos[1]) <= R.hit_dy + EPS) {
            P.flames = Math.max(0, P.flames - 1);
            const dropped = Math.floor(P.carried * T.hit_drop_ratio);
            P.carried -= dropped;
            for (let i = 0; i < dropped; i++) {
              const a = this.rng() * Math.PI * 2;
              const r = R.drop_ring[0] + this.rng() * (R.drop_ring[1] - R.drop_ring[0]);
              const x = P.pos[0] + Math.cos(a) * r;
              const z = P.pos[2] + Math.sin(a) * r;
              this.addMote([x, this.ground(x, z) ?? P.pos[1], z], 'dropped', R.dropped_ttl);
            }
            P.invuln = R.invuln_ticks;
            s.state = 'recoil';
            s.st = R.recoil_ticks;
            s.dir = this.awayFromPlayer(s.pos);
            this.stats.hits++;
            emit('player_hit', { by: 'shade', flames: P.flames, dropped });
            break; // at most one flame lost per tick
          }
        }
      }
    }

    // 10. spawns
    this.spawn(emit);

    // 11. win / lose (Ticket-03): no early win. no_flames always first; at dawn win iff lit >= ceil(0.6 × total)
    if (P.flames <= 0) this.finish('lost', 'no_flames', emit);
    else if (this.simTick >= this.endTick) {
      if (this.litCount >= this.winThreshold) this.finish('won', 'dawn_survived', emit);
      else this.finish('lost', 'dawn', emit);
    }
    return ev;
  }

  movePlayer(input, btn, emit) {
    const P = this.player;
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
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) P.facing = [wx / wl, wz / wl];

    // dash (edge-triggered; ignored while dashing; cooldown 90 ticks from dash start unless Bùa Gió active)
    if (btn.dash && P.dashTicks === 0 && (P.dashCd === 0 || P.charm > 0)) {
      let dir;
      if (wl > 1e-9) dir = [wx / wl, wz / wl];
      else if (P.launch) {
        const l = Math.hypot(P.launch[0], P.launch[1]);
        dir = [P.launch[0] / l, P.launch[1] / l];
      } else dir = [...P.facing];
      P.dashDir = dir;
      P.dashTicks = R.dash_ticks;
      P.dashCd = P.charm > 0 ? 0 : R.dash_cd_ticks;
      emit('dash');
    }

    const speed = P.charm > 0 ? R.charm_speed : T.player_speed;
    let vx, vz;
    const dashing = P.dashTicks > 0;
    if (dashing) {
      vx = P.dashDir[0] * T.dash_speed;
      vz = P.dashDir[1] * T.dash_speed;
      P.dashTicks--;
    } else if (P.launch) {
      [vx, vz] = P.launch;
    } else {
      vx = wx * speed;
      vz = wz * speed;
    }
    if (this.wind.active) {
      const a = (this.wind.dir * Math.PI) / 180;
      vx += Math.cos(a) * R.wind_speed;
      vz += Math.sin(a) * R.wind_speed;
    }
    if (btn.jump && P.grounded && !dashing) {
      P.vel[1] = R.jump_speed;
      P.grounded = false;
    }

    this.moveXZ(P.pos, P.pos[0] + vx * DT, P.pos[2] + vz * DT, P.pos[1], true);
    const h = this.ground(P.pos[0], P.pos[2]);
    if (dashing) {
      P.vel[1] = 0; // airborne dash holds altitude
      if (h !== null && h >= P.pos[1] - R.step_height && h <= P.pos[1] + R.step_height && P.grounded) P.pos[1] = h;
      else P.grounded = false;
    } else if (P.grounded && h !== null && h >= P.pos[1] - R.step_height && P.vel[1] <= 0) {
      P.pos[1] = h;
      P.vel[1] = 0;
    } else {
      P.grounded = false;
      P.vel[1] -= R.gravity * DT;
      P.pos[1] += P.vel[1] * DT;
      if (h !== null && P.pos[1] <= h) {
        P.pos[1] = h;
        P.vel[1] = 0;
        P.grounded = true;
        P.launch = null;
      }
    }
    P.vel[0] = vx;
    P.vel[2] = vz;

    // launch pads: foot touching the pad top
    if (P.grounded) {
      for (const pad of this.map.pads) {
        if (distXZ(pad.pos, P.pos) <= R.pad_radius + EPS && Math.abs(P.pos[1] - pad.pos[1]) < 0.05) {
          P.launch = [...pad.vel];
          P.vel = [pad.vel[0], pad.vy, pad.vel[1]];
          P.grounded = false;
        }
      }
    }

    // fall off the island: once, ignores invulnerability
    if (P.pos[1] < R.fall_y) {
      const lost = P.carried;
      P.carried = 0;
      P.flames = Math.max(0, P.flames - 1);
      P.vel = [0, 0, 0];
      P.launch = null;
      P.dashTicks = 0;
      P.respawn = R.respawn_wait;
      this.stats.falls++;
      emit('player_hit', { by: 'fall', flames: P.flames, dropped: 0, lost });
    }
  }

  moveShades() {
    const P = this.player;
    const playerAway = P.respawn > 0;
    const speed = this.map.shadeSpeed * DT;
    for (const s of this.shades) {
      const foot = s.pos[1] - R.shade_hover;
      if (s.evictLeft > 0) {
        const l = s.evictFrom.pos;
        let dx = s.pos[0] - l[0];
        let dz = s.pos[2] - l[2];
        const d = Math.hypot(dx, dz);
        if (d < 1e-9) [dx, dz] = [1, 0];
        else [dx, dz] = [dx / d, dz / d];
        const stepLen = (T.safe_radius - d) / s.evictLeft;
        s.pos[0] += dx * stepLen;
        s.pos[2] += dz * stepLen;
        s.evictLeft--;
        this.hoverY(s, R.shade_hover);
        continue;
      }
      if (s.state === 'spawning') continue;
      if (s.state === 'stunned') {
        if (s.pushLeft > 0) {
          const st = T.pulse_push_m / R.push_ticks;
          const moved = this.moveXZ(s.pos, s.pos[0] + s.dir[0] * st, s.pos[2] + s.dir[1] * st, foot, false);
          s.pushLeft = moved ? s.pushLeft - 1 : 0;
        }
      } else if (s.state === 'recoil') {
        const st = R.recoil_m / R.recoil_ticks;
        this.moveXZ(s.pos, s.pos[0] + s.dir[0] * st, s.pos[2] + s.dir[1] * st, foot, false);
        if (--s.st <= 0) {
          s.state = 'wander';
          s.wp = null;
        }
      } else {
        const d = distXZ(s.pos, P.pos);
        const LOW = T.low_fuel_threshold * R.fuel_unit;
        if (s.state === 'drain') {
          // Ticket-03 drain exits: player within 6 m -> chase; lantern out / refuelled >= 30 / > 2 m away -> wander
          if (!playerAway && d <= R.drain_chase_range + EPS) s.state = 'chase';
          else if (!s.target || !s.target.lit || s.target.fuel >= LOW || distXZ(s.pos, s.target.pos) > R.drain_range + EPS) s.state = 'wander';
        } else if (playerAway) s.state = 'wander';
        else if (s.state === 'wander' && d <= R.shade_detect + EPS) s.state = 'chase';
        else if (s.state === 'chase' && d > R.shade_giveup) s.state = 'wander';
        if (s.state === 'chase') {
          if (d > 1e-9) {
            const m = Math.min(speed, d);
            this.moveXZ(s.pos, s.pos[0] + ((P.pos[0] - s.pos[0]) / d) * m, s.pos[2] + ((P.pos[2] - s.pos[2]) / d) * m, foot, false);
          }
        } else if (s.state === 'wander') {
          // wander target: nearest weak lit lantern (fuel < 30), else nearest unlit lantern, else roam
          const weak = this.nearestLantern(s.pos, (l) => l.lit && l.fuel < LOW);
          const goal = weak || this.nearestLantern(s.pos, (l) => !l.lit);
          if (goal) {
            const startD = distXZ(s.pos, goal.pos);
            if (startD > R.drain_range + EPS) {
              const m = Math.min(R.shade_wander_speed * DT, startD - R.drain_range);
              this.moveXZ(s.pos, s.pos[0] + ((goal.pos[0] - s.pos[0]) / startD) * m, s.pos[2] + ((goal.pos[2] - s.pos[2]) / startD) * m, foot, false);
            }
            if (weak && distXZ(s.pos, weak.pos) <= R.drain_range + EPS) {
              s.state = 'drain';
              s.target = weak;
              s.drainTicks = 0;
            }
          } else {
            if (!s.wp || distXZ(s.pos, s.wp) < 0.5) s.wp = this.randomWaypoint(s.pos, 8);
            const d2 = distXZ(s.pos, s.wp);
            const m = Math.min(R.shade_wander_speed * DT, d2);
            const moved = d2 > 1e-9 && this.moveXZ(s.pos, s.pos[0] + ((s.wp[0] - s.pos[0]) / d2) * m, s.pos[2] + ((s.wp[2] - s.pos[2]) / d2) * m, foot, false);
            if (!moved) s.wp = null;
          }
        }
        // drain: stands still (fuel is taken in step 2 of the next ticks)
      }
      // lit lanterns with fuel >= 30 block shades at the 6 m edge (weak lanterns have no zone)
      for (const l of this.lanterns) {
        if (!this.hasZone(l)) continue;
        const dx = s.pos[0] - l.pos[0];
        const dz = s.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < T.safe_radius) {
          const ux = d < 1e-9 ? 1 : dx / d;
          const uz = d < 1e-9 ? 0 : dz / d;
          s.pos[0] = l.pos[0] + ux * T.safe_radius;
          s.pos[2] = l.pos[2] + uz * T.safe_radius;
        }
      }
      this.hoverY(s, R.shade_hover);
    }
  }

  moveDrifters() {
    const P = this.player;
    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      const dist = distXZ(d.pos, P.pos);
      if (d.state === 'idle' || d.state === 'chase') {
        const want = !d.stoleOnce && P.respawn === 0 && P.carried >= R.drifter_chase_carried && dist <= R.drifter_chase_range + EPS;
        d.state = want ? 'chase' : 'idle';
      }
      if (d.state === 'chase') {
        if (dist > 1e-9) {
          const m = Math.min(R.drifter_speed * DT, dist);
          d.pos[0] += ((P.pos[0] - d.pos[0]) / dist) * m;
          d.pos[2] += ((P.pos[2] - d.pos[2]) / dist) * m;
        }
      } else if (d.state === 'flee') {
        const [ux, uz] = this.awayFromPlayer(d.pos);
        d.pos[0] += ux * R.drifter_speed * DT;
        d.pos[2] += uz * R.drifter_speed * DT;
        if (this.simTick >= d.removeAt) {
          d.state = 'removed';
          d.stolen = 0;
        }
      } else {
        if (!d.wp || distXZ(d.pos, d.wp) < 0.5) d.wp = this.randomWaypoint(d.pos, 10);
        const d2 = distXZ(d.pos, d.wp);
        const m = Math.min(R.drifter_idle_speed * DT, d2);
        if (d2 > 1e-9) {
          d.pos[0] += ((d.wp[0] - d.pos[0]) / d2) * m;
          d.pos[2] += ((d.wp[2] - d.pos[2]) / d2) * m;
        }
      }
      const g = this.ground(d.pos[0], d.pos[2]);
      d.pos[1] = (g ?? 0) + R.drifter_hover;
    }
  }

  randomWaypoint(from, radius) {
    for (let i = 0; i < 8; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = this.rng() * radius;
      const x = from[0] + Math.cos(a) * r;
      const z = from[2] + Math.sin(a) * r;
      if (this.ground(x, z) !== null) return [x, 0, z];
    }
    return [from[0], 0, from[2]];
  }

  spawn(emit) {
    const t = this.simTick;
    const map = this.map;
    if (this.randomMotes && t % R.mote_spawn_every === 0 && this.motes.length < R.mote_cap) {
      const used = new Set(this.motes.filter((m) => m.point >= 0).map((m) => m.point));
      const free = map.moteSpawns.map((_, i) => i).filter((i) => !used.has(i));
      if (free.length) {
        const i = free[Math.floor(this.rng() * free.length)];
        this.addMote([...map.moteSpawns[i]], 'random', null, undefined, i);
      }
    }
    if (this.randomShades && t >= R.shade_first_spawn) {
      let n = 0;
      if (t === R.shade_first_spawn) n = 2;
      else if ((t - R.shade_first_spawn) % map.shadeInterval === 0) n = 1;
      for (let k = 0; k < n && this.shades.length < map.shadeMax; k++) {
        const valid = map.shadeSpawns.filter(
          (p) => distXZ(p, this.player.pos) >= R.shade_spawn_min_dist && !this.inSafeZone(p[0], p[2]) && !this.shades.some((s) => distXZ(s.pos, p) < 0.5),
        );
        if (!valid.length) break;
        const p = valid[Math.floor(this.rng() * valid.length)];
        const s = this.addShade([p[0], p[1] + R.shade_hover, p[2]]);
        emit('shade_spawned', { id: s.id });
      }
    }
    if (this.randomDrifters && t % R.drifter_spawn_every === 0) {
      const aliveN = this.drifters.filter((d) => d.state !== 'removed').length;
      if (aliveN < R.drifter_max) {
        const p = map.shadeSpawns[Math.floor(this.rng() * map.shadeSpawns.length)];
        this.addDrifter([p[0], p[1] + R.drifter_hover, p[2]]);
      }
    }
    if (this.wind.active && --this.wind.left <= 0) this.wind.active = false;
    if (this.windEnabled && t % R.wind_every === 0) {
      this.wind = { active: true, dir: Math.floor(this.rng() * 360), left: R.wind_ticks };
    }
  }

  finish(result, reason, emit) {
    this.state = result;
    this.result = reason;
    if (result === 'won') {
      // Ticket-03 dawn bonus: each lit lantern 50 + floor(fuel), each remaining flame 50 (time bonus removed)
      for (const l of this.lanterns) if (l.lit) this.score += R.dawn_lantern_score + Math.floor(l.fuel / R.fuel_unit);
      this.score += this.player.flames * T.score.per_flame_left;
    }
    emit('game_over', { result, reason });
  }

  snapshot() {
    const P = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.paused && this.state === 'playing' ? 'paused' : this.state,
      time_left_s: r3(this.timeLeftS),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.active ? this.wind.dir : null },
      player: {
        pos: P.pos.map(r3), vel: P.vel.map(r3), grounded: P.grounded, flames: P.flames, carried: P.carried, capacity: this.capacity,
        invuln: P.invuln > 0, dash_cd_s: r3(P.dashCd / 60), pulse_cd_s: r3(P.pulseCd / 60), charm_s: r3(P.charm / 60),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited, fuel: l.lit ? r1(l.fuel / R.fuel_unit) : 0, ever_lit: l.everLit, relit_count: l.relit })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.kind === 'dropped' ? r3(m.ttl / 60) : null })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / 60) })),
    };
  }
}
