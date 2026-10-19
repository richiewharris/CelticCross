// How the player's hands move the pan, and the pan's place on the 600x600 canvas.
import { RIN, exposed, step, type Pan, type Particle } from "./pan";
import type { Rng } from "./rng";

export const W0 = 600, CX = 300, CY = 312, ROUT = 252;
export const VIAL = { x: 548, y: 26 };

/** Everything the player is doing to the pan right now (drag, keys, hold buttons). */
export interface Hands {
  dragging: boolean; sx: number; sy: number; x: number; y: number; t0: number; moved: boolean;
  keyOx: number; keyOxT: number; keyTilt: number; holdShake: boolean; holdWash: boolean;
}
export const idleHands = (): Hands => ({
  dragging: false, sx: 0, sy: 0, x: 0, y: 0, t0: 0, moved: false, keyOx: 0, keyOxT: 0, keyTilt: 0, holdShake: false, holdWash: false,
});

/** Where the hands want the pan: sideways offset and tilt. `nowMs` is a performance.now() time. */
export function aim(h: Hands, nowMs: number, dipping: boolean) {
  let ox = 0, tilt = 0;
  if (h.dragging) { ox = Math.max(-75, Math.min(75, (h.x - h.sx) * 0.9)); tilt = Math.max(0, Math.min(1, (h.y - h.sy) / 170)); }
  if (h.keyOx && nowMs - h.keyOxT < 140) ox = h.keyOx;
  if (h.holdShake) ox = Math.sin(nowMs / 1000 * 15) * 48;
  if (h.keyTilt) tilt = Math.max(tilt, h.keyTilt);
  if (h.holdWash) tilt = Math.max(tilt, 0.55);
  if (dipping) { tilt = 0; ox = 0; }
  return { ox, tilt };
}

/** Ease the pan toward the aim over dt real seconds, turn sideways speed into shake energy, and
 *  run the physics in steps of at most 1/60 s so the result does not depend on the frame rate.
 *  Returns the gold that washed out. */
export function drive(pan: Pan, target: { ox: number; tilt: number }, dt: number, rng: Rng): Particle[] {
  const prevOx = pan.ox;
  pan.ox += (target.ox - pan.ox) * Math.min(1, dt * 22);
  pan.tilt += (target.tilt - pan.tilt) * Math.min(1, dt * 7);
  const v = Math.abs(pan.ox - prevOx) / Math.max(dt, 1e-3);
  pan.E += (Math.min(1, v / 520) - pan.E) * Math.min(1, dt * 7);
  const lost: Particle[] = [];
  const n = Math.max(1, Math.ceil(dt / (1 / 60)));
  for (let k = 0; k < n; k++) lost.push(...step(pan, dt / n, rng));
  return lost;
}

/** A particle's position on the canvas, allowing for the pan's offset and tilt. */
export function toScreen(pan: Pan, p: Particle): [number, number] {
  const t = pan.tilt, sy = 1 - 0.3 * t;
  return [CX + pan.ox + p.x * RIN, CY - 20 * t + p.y * RIN * sy];
}

export type Tap =
  | { kind: "toss"; p: Particle } | { kind: "stoneDeep" }
  | { kind: "gold"; p: Particle } | { kind: "buried" } | null;

/** What a tap at canvas point (x, y) hits: the topmost stone or gold under the finger. */
export function tapAt(pan: Pan, x: number, y: number): Tap {
  let best: Particle | null = null, bd = Infinity;
  for (const p of pan.particles) {
    if (!p.alive || (p.kind !== "stone" && p.kind !== "gold")) continue;
    const [sx, sy] = toScreen(pan, p), reach = p.kind === "gold" ? Math.max(16, p.r + 10) : p.r + 6;
    const dd = Math.hypot(sx - x, sy - y);
    if (dd < reach && (p.d < (best ? best.d : 9) || dd < bd - 4)) { best = p; bd = dd; }
  }
  if (!best) return null;
  if (best.kind === "stone") return best.d < 0.3 ? { kind: "toss", p: best } : { kind: "stoneDeep" };
  return exposed(pan, best) ? { kind: "gold", p: best } : { kind: "buried" };
}
