/* Panning physics (no DOM).
 * Each particle lives in the pan's unit disc (x, y), with a depth d: 0 is the top of the pile,
 * 1 the bottom. Shaking pulls each particle toward the depth its weight gives it. Tilting lets
 * water carry the top of the pile toward the lip.
 * A pan holds ~600 particles and is stepped many times a second, so it is mutated in place. */
import { poisson, rand, type Rng } from "./rng";

export type Kind = "stone" | "gravel" | "sand" | "black" | "gold";
export type Pt = [number, number];

export const KIND: Record<Kind, { target: Pt; mob: number; r: Pt }> = {
  stone: { target: [0.00, 0.08], mob: 0.12, r: [12, 19] },
  gravel: { target: [0.08, 0.34], mob: 0.75, r: [3.4, 5.8] },
  sand: { target: [0.32, 0.66], mob: 1.25, r: [1.5, 2.5] },
  black: { target: [0.70, 0.90], mob: 0.55, r: [1.1, 1.8] },
  gold: { target: [0.93, 1.00], mob: 0.32, r: [2.1, 4.0] },
};
export const RIN = 205;     // radius of the pan floor, in canvas units
export const STEEP = 0.72;  // tilt above this starts to move settled material

export interface Particle {
  kind: Kind; x: number; y: number; d: number; target: number; r: number; rot: number; alive: boolean;
  col: string; shape: Pt[] | null; phase: number;
  /** gold only */
  mg: number; nugget: boolean; picked: boolean; exp: boolean;
}

export interface Pan {
  particles: Particle[];
  /** water 0..1, tilt 0..1, sideways offset in canvas units, shake energy 0..1 */
  W: number; tilt: number; ox: number; E: number; shakeTime: number; flow: number;
  lostFlakes: number; lostMg: number; keptMg: number; keptFlakes: number;
  startLight: number; goldTotal: number;
}

function inDisc(rng: Rng, maxR: number): Pt {
  const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * maxR;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
function blob(rng: Rng, n: number, jitter: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * (1 - jitter / 2 + rng() * jitter), Math.sin(a) * (1 - jitter / 2 + rng() * jitter)]);
  }
  return pts;
}

export function makeParticle(kind: Kind, rng: Rng, extra: { mg?: number; r?: number; nugget?: boolean } = {}): Particle {
  const K = KIND[kind];
  const [x, y] = inDisc(rng, 0.9);
  const d = rng(), target = rand(rng, ...K.target), r0 = rand(rng, ...K.r), rot = rng() * Math.PI;
  const p: Particle = {
    kind, x, y, d, target, r: extra.r ?? r0, rot, alive: true, col: "", shape: null, phase: 0,
    mg: extra.mg ?? 0, nugget: !!extra.nugget, picked: false, exp: false,
  };
  const hsl = (h: Pt, s: Pt, l: Pt) => `hsl(${rand(rng, ...h) | 0} ${rand(rng, ...s) | 0}% ${rand(rng, ...l) | 0}%)`;
  if (kind === "sand") p.col = hsl([32, 46], [22, 40], [46, 64]);
  if (kind === "gravel") p.col = hsl([18, 40], [6, 18], [34, 58]);
  if (kind === "stone") { p.col = hsl([22, 36], [5, 13], [36, 52]); p.shape = blob(rng, 9, 0.35); }
  if (kind === "black") p.col = `hsl(${rand(rng, 200, 230) | 0} 8% ${rand(rng, 9, 17) | 0}%)`;
  if (kind === "gold") { p.shape = blob(rng, p.nugget ? 9 : 6, p.nugget ? 0.3 : 0.55); p.phase = rng() * 6.28; }
  return p;
}

/** Scoop a pan from a spot: `rich` is how much gold the spot still holds, `stones` its stoniness. */
export function scoop(rich: number, stones: number, rng: Rng): Pan {
  const ps: Particle[] = [];
  const nStones = stones + poisson(rng, 1.5);
  for (let i = 0; i < nStones; i++) ps.push(makeParticle("stone", rng));
  for (let i = 0; i < 95; i++) ps.push(makeParticle("gravel", rng));
  for (let i = 0; i < 420; i++) ps.push(makeParticle("sand", rng));
  for (let i = 0; i < 70 + rich * 25; i++) ps.push(makeParticle("black", rng));
  const flakes = poisson(rng, rich * 4.5);
  for (let i = 0; i < flakes; i++) {
    const mg = Math.max(0.6, Math.exp(rand(rng, 0, 2.6)));  // about 1 to 13 mg
    ps.push(makeParticle("gold", rng, { mg, r: 1.7 + Math.sqrt(mg) * 0.75 }));
  }
  if (rng() < 0.035 * rich) {
    const mg = rand(rng, 90, 650);
    ps.push(makeParticle("gold", rng, { mg, nugget: true, r: 4.2 + Math.sqrt(mg) * 0.16 }));
  }
  return {
    particles: ps, W: 0.6, tilt: 0, ox: 0, E: 0, shakeTime: 0, flow: 0,
    lostFlakes: 0, lostMg: 0, keptMg: 0, keptFlakes: 0,
    startLight: ps.filter(p => p.kind === "sand" || p.kind === "gravel").length,
    goldTotal: ps.filter(p => p.kind === "gold").reduce((a, p) => a + p.mg, 0),
  };
}

/** Advance the pan by dt seconds. Returns gold particles that washed out this step. */
export function step(pan: Pan, dt: number, rng: Rng): Particle[] {
  const lost: Particle[] = [];
  const wf = 0.25 + 0.75 * Math.min(1, pan.W / 0.5);  // shaking needs water
  const E = pan.E;
  if (E > 0.02) {
    const k = Math.min(1, E * 1.35 * dt * wf);
    for (const p of pan.particles) {
      if (!p.alive) continue;
      p.d += (p.target - p.d) * k + (rng() - 0.5) * 0.05 * E * dt;
      p.d = Math.min(1, Math.max(0, p.d));
      const j = 0.012 * E * (1.2 - p.d);
      p.x += (rng() - 0.5) * j; p.y += (rng() - 0.5) * j;
      const m = Math.hypot(p.x, p.y);
      if (m > 0.93) { p.x *= 0.93 / m; p.y *= 0.93 / m; }
    }
    pan.shakeTime += dt * Math.min(1, E * 1.5);
    pan.W = Math.max(0, pan.W - E * 0.015 * dt);
  }
  const t = pan.tilt;
  if (t > 0.04 && pan.W > 0.01) {
    let stonesIn = 0;
    for (const p of pan.particles) if (p.alive && p.kind === "stone" && p.d < 0.3) stonesIn++;
    const F = t * Math.min(1, pan.W * 1.4) * Math.max(0.55, 1 - 0.05 * stonesIn);
    const steep = Math.max(0, (t - STEEP) / (1 - STEEP));
    for (const p of pan.particles) {
      if (!p.alive) continue;
      const mob = KIND[p.kind].mob * ((1 - p.d) ** 2 + steep * 0.65);
      const v = F * mob * 1.3 * dt;
      p.y += v; p.x += (rng() - 0.5) * v * 0.6;
      const m = Math.hypot(p.x, p.y);
      if (m > 0.95) {
        if (p.y > 0.2) { p.alive = false; if (p.kind === "gold") lost.push(p); }
        else { p.x *= 0.95 / m; p.y *= 0.95 / m; }
      }
    }
    pan.W = Math.max(0, pan.W - F * 0.3 * dt);
    pan.flow = F;
  } else pan.flow = 0;
  for (const g of lost) { pan.lostFlakes++; pan.lostMg += g.mg; }
  return lost;
}

// Each light particle stands for a good handful of sediment. Gold can be seen (and picked) only
// once the sediment lying over it nearby has been washed thin.
export const BULK: Partial<Record<Kind, number>> = { sand: 1, gravel: 2.5, stone: 4 };
export const NEAR = 26, EXPOSE_AT = 1.3;

export function coverOver(pan: Pan, g: Particle) {
  let cover = 0;
  const gx = g.x * RIN, gy = g.y * RIN;
  for (const q of pan.particles) {
    const w = BULK[q.kind];
    if (!w || !q.alive || q.d >= g.d) continue;
    const dx = q.x * RIN - gx, dy = q.y * RIN - gy, dd = dx * dx + dy * dy;
    if (dd < NEAR * NEAR) cover += w * (1 - Math.sqrt(dd) / NEAR);
  }
  return cover;
}
export const exposed = (pan: Pan, g: Particle) => coverOver(pan, g) < EXPOSE_AT;

/** Recompute which gold can be seen (the original does this every 0.18 s, for drawing). */
export function refreshExposure(pan: Pan) {
  for (const p of pan.particles) if (p.alive && p.kind === "gold") p.exp = exposed(pan, p);
}

/** Sediment thickness on a coarse grid across the pan floor, for drawing. */
export const GRID = 22;
export function sedimentGrid(pan: Pan, out = new Float32Array(GRID * GRID)) {
  out.fill(0);
  for (const q of pan.particles) {
    const w = BULK[q.kind];
    if (!w || !q.alive || q.kind === "stone") continue;
    const gx = Math.min(GRID - 1, Math.max(0, ((q.x + 1) / 2 * GRID) | 0));
    const gy = Math.min(GRID - 1, Math.max(0, ((q.y + 1) / 2 * GRID) | 0));
    out[gy * GRID + gx] += w;
  }
  return out;
}

/** Dip the pan in the stream: full of water, and the loose top lifts a little. */
export function dip(pan: Pan, rng: Rng) {
  pan.W = 1;
  for (const p of pan.particles) if (p.alive && p.d < 0.45) p.d = Math.max(0, p.d - rng() * 0.06);
}

export const lightLeft = (pan: Pan) =>
  pan.particles.reduce((n, p) => n + +(p.alive && (p.kind === "sand" || p.kind === "gravel")), 0) / Math.max(1, pan.startLight);
export const goldSettled = (pan: Pan) => {
  const g = pan.particles.filter(p => p.alive && p.kind === "gold");
  return g.length ? g.filter(p => p.d > 0.85).length / g.length : 1;
};
export const stonesUp = (pan: Pan) => pan.particles.filter(p => p.alive && p.kind === "stone" && p.d < 0.3);
export const stonesLeft = (pan: Pan) => pan.particles.some(p => p.alive && p.kind === "stone");

/** Take a gold particle out into the vial. */
export function collect(pan: Pan, g: Particle) {
  g.alive = false; g.picked = true;
  pan.keptMg += g.mg; pan.keptFlakes++;
}
