// Input timeline per Test Contract v1.0 section C.
import { FormatError } from './sim.js';

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export function parseInputs(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.frames)) {
    throw new FormatError('inputs must be an object with a "frames" array');
  }
  let last = -1;
  const frames = doc.frames.map((f, i) => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) throw new FormatError(`frame ${i} must be an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new FormatError(`frame ${i}: tick must be an int >= 0`);
    if (f.tick <= last) throw new FormatError(`frame ${i}: ticks must be strictly increasing`);
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every((v) => typeof v === 'number' && Number.isFinite(v))) {
        throw new FormatError(`frame ${i}: move must be [x, z] numbers`);
      }
    }
    if (f.cam_yaw_deg !== undefined && !(typeof f.cam_yaw_deg === 'number' && Number.isFinite(f.cam_yaw_deg))) {
      throw new FormatError(`frame ${i}: cam_yaw_deg must be a number`);
    }
    for (const b of BUTTONS) {
      if (f[b] !== undefined && typeof f[b] !== 'boolean') throw new FormatError(`frame ${i}: ${b} must be boolean`);
    }
    return f;
  });
  return new InputTimeline(frames);
}

export class InputTimeline {
  constructor(frames = []) {
    this.frames = frames;
    this.i = 0;
    this.cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  }
  // Must be called with tick = 0,1,2,... in order. Returns held values for that tick.
  at(tick) {
    while (this.i < this.frames.length && this.frames[this.i].tick <= tick) {
      const f = this.frames[this.i++];
      if (f.move !== undefined) this.cur.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) this.cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of BUTTONS) if (f[b] !== undefined) this.cur[b] = f[b];
    }
    return this.cur;
  }
}
