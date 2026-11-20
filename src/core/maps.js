// Standard maps (Ticket-02 part 2). Angles: from +X toward +Z, i.e. point = (r·cos a, y, r·sin a).
import { TUNING as T } from './tuning.js';

const rad = (d) => (d * Math.PI) / 180;
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;
const ring = (n, r, y, start = 0, step = 360 / n, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => [r3(cx + r * Math.cos(rad(start + i * step))), y, r3(cz + r * Math.sin(rad(start + i * step)))]);
const hyp = Math.hypot;

// ---------- Night 1: Đảo Bến ----------
const N1 = {
  night: 1,
  name: 'Đảo Bến',
  duration_s: T.night1_duration_s,
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  moteSpawns: [...ring(8, 12, 0), ...ring(16, 33, 0)],
  shadeSpawns: ring(12, 37, 0, 15, 30),
  shadeInterval: 480,
  shadeMax: 6,
  shadeSpeed: T.shade_speed,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  ground: (x, z) => (hyp(x, z) <= 40 ? 0 : null),
};

// ---------- Night 2: Đảo Cau ----------
const N2 = {
  night: 2,
  name: 'Đảo Cau',
  duration_s: T.night2_duration_s,
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  moteSpawns: [0, 70].flatMap((cx) => [...ring(4, 10, 0, 0, 90, cx), ...ring(8, 22, 0, 0, 45, cx)]),
  shadeSpawns: [0, 70].flatMap((cx) => ring(8, 26, 0, 22.5, 45, cx)),
  shadeInterval: 420,
  shadeMax: 8,
  shadeSpeed: T.shade_speed,
  pads: [padToward([20, 0, 18], [70, 0, 0], 14, 24), padToward([50, 0, -18], [0, 0, 0], 14, 24)],
  charms: [[35, 0, 0]],
  drifters: true,
  wind: false,
  ground: (x, z) => {
    if (hyp(x, z) <= 28 || hyp(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  },
};

// ---------- Night 3: Đảo Chuông ----------
const RAMPS = [30, 150].map((a) => [Math.cos(rad(a)), Math.sin(rad(a))]);
const N3 = {
  night: 3,
  name: 'Đảo Chuông',
  duration_s: T.night3_duration_s,
  start: [0, 0, -30], // assumption B1: (0,0,0) is inside the bell tower on this map
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  moteSpawns: [...ring(18, 34, 0, 0, 20), ...ring(8, 18, 3, 20, 20), ...ring(4, 5, 6, 45, 90)],
  shadeSpawns: ring(16, 43, 0, 0, 22.5),
  shadeInterval: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], vy: 12, vel: [0, -8] }],
  charms: [[30, 0, 25], [-30, 0, 25]],
  drifters: true,
  wind: true,
  ground: (x, z) => {
    const r = hyp(x, z);
    if (r > 45) return null;
    if (r < 2) return 8; // bell tower: solid, cannot be climbed (8 m wall)
    if (r <= 8) return 6;
    if (z > 0 && r >= 12 && r <= 24) return 3;
    for (const [ux, uz] of RAMPS) {
      const s = x * ux + z * uz;
      const lat = Math.abs(-x * uz + z * ux);
      if (lat <= 1.5 && s >= 24 && s <= 30) return (3 * (30 - s)) / 6;
    }
    return 0;
  },
};

function padToward(pos, target, vy, speed) {
  const dx = target[0] - pos[0];
  const dz = target[2] - pos[2];
  const d = hyp(dx, dz);
  return { pos, vy, vel: [(dx / d) * speed, (dz / d) * speed] };
}

export const NIGHTS = { 1: N1, 2: N2, 3: N3 };
