// Celtic Cross Lock, the cube: the rules and the 3D maths. Pure TypeScript, no DOM.
//
// Six faces of N×N stones; one closed knot runs over the whole surface and across the face edges.
// Every face has a frame in CSS coordinates (x right, y down, z toward the viewer): its outward
// normal n, its "right" r and its "down" d, with r × d = n so a face read from outside is never
// mirrored. The same frames place the faces with matrix3d, so the drawing and the logic agree.
// Stone sides use the dial's 4-bit masks: N = −d (up the face), E = r, S = d, W = −r, so rotCW is a
// clockwise quarter turn as seen from outside the cube.
//
// Tile centres are kept in doubled integer coordinates: the cube spans −N..N on every axis and a
// face's centres sit at odd offsets along r and d. The stone across side u of the stone at c is at
// c + 2u if that is still on the face, otherwise at c + u − n on the face whose normal is u (and it
// is reached through its side pointing along the old normal n).
import { BITS, E, N, S_, W, minTurns, pop, rnd, rotCW, spareTurns, type Rng, type TierId } from "../engine/knot";

export type V3 = readonly [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const same = (a: V3, b: V3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export interface FaceFrame { name: string; n: V3; r: V3; d: V3 }
export const FACES: readonly FaceFrame[] = [
  { name: "front", n: [0, 0, 1], r: [1, 0, 0], d: [0, 1, 0] },
  { name: "right", n: [1, 0, 0], r: [0, 0, -1], d: [0, 1, 0] },
  { name: "back", n: [0, 0, -1], r: [-1, 0, 0], d: [0, 1, 0] },
  { name: "left", n: [-1, 0, 0], r: [0, 0, 1], d: [0, 1, 0] },
  { name: "top", n: [0, -1, 0], r: [1, 0, 0], d: [0, 0, 1] },
  { name: "bottom", n: [0, 1, 0], r: [1, 0, 0], d: [0, 0, -1] },
];

/** Index 0..3 of a side bit (N, E, S, W). */
export const bitIndex = (b: number) => (b === N ? 0 : b === E ? 1 : b === S_ ? 2 : 3);
/** The direction a side of a stone on face f points along. */
export function sideVec(f: number, bit: number): V3 {
  const F = FACES[f];
  return bit === N ? mul(F.d, -1) : bit === E ? F.r : bit === S_ ? F.d : mul(F.r, -1);
}
/** The side of a stone on face f that points along v (which must lie in the face). */
export function vecSide(f: number, v: V3): number {
  for (const b of BITS) if (same(sideVec(f, b), v)) return b;
  throw new Error("not a side of this face");
}

export interface CubeGeom {
  /** Stones along a face edge. */
  N: number;
  /** All stones: face f, row i (down), column j (right) is f·N² + i·N + j. */
  count: number;
  face: number[]; row: number[]; col: number[];
  centre: V3[];
  /** nbr[4k + bitIndex(b)]: the stone across side b of stone k; back[...]: the side it is reached by. */
  nbr: Int32Array; back: Uint8Array;
  /** Grid vertices (stone corners); each stone's four corners, NW NE SE SW. */
  vertices: number; corners: number[][]; vtiles: number[][];
}

const geoms = new Map<number, CubeGeom>();
export function cubeGeom(n: number): CubeGeom {
  const cached = geoms.get(n); if (cached) return cached;
  const count = 6 * n * n;
  const face: number[] = [], row: number[] = [], col: number[] = [], centre: V3[] = [];
  const at = new Map<string, number>();
  const key = (v: V3) => v.join(",");
  for (let f = 0; f < 6; f++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const F = FACES[f], c = add(add(mul(F.n, n), mul(F.r, 2 * j - n + 1)), mul(F.d, 2 * i - n + 1));
    at.set(key(c), centre.length);
    face.push(f); row.push(i); col.push(j); centre.push(c);
  }
  const nbr = new Int32Array(4 * count), back = new Uint8Array(4 * count);
  for (let k = 0; k < count; k++) for (const b of BITS) {
    const f = face[k], u = sideVec(f, b), c = centre[k];
    let c2 = add(c, mul(u, 2)), f2 = f, arrive: number;
    if (dot(c2, u) <= n - 1) arrive = vecSide(f, mul(u, -1));
    else {
      c2 = add(add(c, u), mul(FACES[f].n, -1));
      f2 = FACES.findIndex(F => same(F.n, u));
      arrive = vecSide(f2, FACES[f].n);
    }
    const k2 = at.get(key(c2));
    if (k2 === undefined || face[k2] !== f2) throw new Error("bad neighbour");
    nbr[4 * k + bitIndex(b)] = k2; back[4 * k + bitIndex(b)] = arrive;
  }
  const vid = new Map<string, number>(), corners: number[][] = [], vtiles: number[][] = [];
  for (let k = 0; k < count; k++) {
    const F = FACES[face[k]], c = centre[k];
    const pts: V3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add(add(c, mul(F.r, a)), mul(F.d, b)));
    corners.push(pts.map(p => {
      let v = vid.get(key(p));
      if (v === undefined) { v = vtiles.length; vid.set(key(p), v); vtiles.push([]); }
      vtiles[v].push(k);
      return v;
    }));
  }
  const g: CubeGeom = { N: n, count, face, row, col, centre, nbr, back, vertices: vtiles.length, corners, vtiles };
  geoms.set(n, g);
  return g;
}

export const nbOf = (g: CubeGeom, k: number, b: number) => g.nbr[4 * k + bitIndex(b)];
export const backOf = (g: CubeGeom, k: number, b: number) => g.back[4 * k + bitIndex(b)];

/** Solved: every strand end meets a strand end on the next stone (across face edges too). */
export function solved(g: CubeGeom, cur: number[]): boolean {
  for (let k = 0; k < g.count; k++) for (const b of BITS) {
    if (cur[k] & b && !(cur[nbOf(g, k, b)] & backOf(g, k, b))) return false;
  }
  return true;
}

/** Every strand end that runs into nothing: [stone, side]. */
export function looseEnds(g: CubeGeom, cur: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < g.count; k++) for (const b of BITS) {
    if (cur[k] & b && !(cur[nbOf(g, k, b)] & backOf(g, k, b))) out.push([k, b]);
  }
  return out;
}

/** How many separate closed strands the knot is made of (a crossing carries two). */
export function countLoops(g: CubeGeom, m: number[]): number {
  const parent = new Map<number, number>();
  const find = (x: number) => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; }
    return x;
  };
  const piece = (k: number, b: number) => (m[k] === 15 ? 2 * k + (b === N || b === S_ ? 0 : 1) : 2 * k);
  for (let k = 0; k < g.count; k++) for (const b of BITS) if (m[k] & b) { const p = piece(k, b); if (!parent.has(p)) parent.set(p, p); }
  for (let k = 0; k < g.count; k++) for (const b of BITS) {
    if (!(m[k] & b)) continue;
    const j = nbOf(g, k, b);
    if (!(m[j] & backOf(g, k, b))) continue;
    const a = find(piece(k, b)), c = find(piece(j, backOf(g, k, b)));
    if (a !== c) parent.set(a, c);
  }
  const roots = new Set<number>(); for (const p of parent.keys()) roots.add(find(p));
  return roots.size;
}

/* ---------- Tiers ---------- */
export interface CubeTier { name: string; N: number; crossings: boolean; obscured: boolean; turned: number; desc: string }
export const CUBE_TIERS: Record<TierId, CubeTier> = {
  1: { name: "Iron", N: 2, crossings: false, obscured: false, turned: 4, desc: "24 stones, 2×2 on each face. Four are turned." },
  2: { name: "Bronze", N: 3, crossings: false, obscured: false, turned: 5, desc: "54 stones, 3×3 on each face. Five are turned." },
  3: { name: "Silver", N: 3, crossings: true, obscured: false, turned: 6, desc: "54 stones with crossings. Six are turned." },
  4: { name: "Gold", N: 3, crossings: true, obscured: true, turned: 7, desc: "54 stones with crossings. Only the face toward you shows its knot. Seven are turned." },
  5: { name: "Ogham", N: 4, crossings: true, obscured: true, turned: 9, desc: "96 stones, 4×4 on each face, with crossings. Only the face toward you shows its knot. Nine are turned." },
};

/** The knot drawn by a two-colouring of the grid vertices: a strand crosses every stone side whose two
 *  corners differ. Flipping one vertex toggles the cycle of joins around it (a 4-cycle, or a 3-cycle at
 *  a corner of the cube), so every stone keeps an even number of strand ends and the knot stays closed. */
export function knotFromColours(g: CubeGeom, col: ArrayLike<number>): number[] {
  return g.corners.map(([nw, ne, se, sw]) =>
    (col[nw] ^ col[ne] ? N : 0) | (col[ne] ^ col[se] ? E : 0) | (col[se] ^ col[sw] ? S_ : 0) | (col[sw] ^ col[nw] ? W : 0));
}

/** Build a closed knot for a tier: toggle random vertex cycles on an empty cube, repair empty stones
 *  (and, below Silver, crossings) by toggling a cycle at one of their corners, then keep it only if
 *  every stone carries a bend, a straight or (Silver and up) a crossing, and the loops are few. */
export function makeKnot(T: CubeTier, rng: Rng = Math.random): number[] {
  const g = cubeGeom(T.N), n = g.count;
  for (let tries = 0; tries < 5000; tries++) {
    const col = new Uint8Array(g.vertices);
    for (let v = 0; v < g.vertices; v++) if (rng() < .42) col[v] = 1;
    let m = knotFromColours(g, col);
    for (let fix = 0; fix < 400; fix++) {
      const bad: number[] = [];
      for (let k = 0; k < n; k++) { const p = pop(m[k]); if (p === 0 || (p === 4 && !T.crossings)) bad.push(k); }
      if (!bad.length) break;
      const k = bad[rnd(bad.length, rng)], v = g.corners[k][rnd(4, rng)];
      col[v] ^= 1;
      m = knotFromColours(g, col);
    }
    if (m.some(x => { const p = pop(x); return p !== 2 && (p !== 4 || !T.crossings); })) continue;
    const crossings = m.filter(x => x === 15).length;
    const bends = m.filter(x => x !== 15 && x !== 5 && x !== 10).length;
    if (T.crossings && (crossings < Math.max(2, n / 18) || crossings > n * .2)) continue;
    if (bends < n * .4) continue;
    if (countLoops(g, m) > (T.N >= 4 ? 3 : 2)) continue;
    return m;
  }
  throw new Error("Could not build a knot");
}

/** Turn a number of stones (about the tier's count) away from the solved knot; crossings never move. */
export function scramble(sol: number[], T: CubeTier, rng: Rng = Math.random): number[] {
  const g = cubeGeom(T.N);
  const turnable = sol.map((m, k) => (m === 15 ? -1 : k)).filter(k => k >= 0);
  const K = Math.min(turnable.length, Math.max(2, T.turned + rnd(3, rng) - 1));
  for (let tries = 0; tries < 200; tries++) {
    const cur = sol.slice(), pool = turnable.slice();
    for (let i = 0; i < K; i++) {
      const k = pool.splice(rnd(pool.length, rng), 1)[0], m = sol[k];
      if (m === 5 || m === 10) cur[k] = rotCW(m);
      else { const t = rng() < .8 ? 1 + 2 * rnd(2, rng) : 2; let x = m; for (let j = 0; j < t; j++) x = rotCW(x); cur[k] = x; }
    }
    if (!solved(g, cur)) return cur;
  }
  const cur = sol.slice(); cur[turnable[0]] = rotCW(cur[turnable[0]]); return cur;
}

export interface Deal { cur: number[]; budget: number; orient: number }
/** Scramble a knot, give it a turn budget (fewest turns plus some to spare) and a starting orientation. */
export function deal(tier: TierId, sol: number[], skill: number, rng: Rng = Math.random): Deal {
  const cur = scramble(sol, CUBE_TIERS[tier], rng);
  const budget = minTurns(cur, sol) + spareTurns(skill, tier, rng);
  return { cur, budget, orient: rnd(24, rng) };
}

/* ---------- Turning the cube ---------- */
/** Unit quaternion [w, x, y, z] in CSS coordinates. */
export type Quat = readonly [number, number, number, number];
export const QID: Quat = [1, 0, 0, 0];
export function qmul(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}
export const qconj = (q: Quat): Quat => [q[0], -q[1], -q[2], -q[3]];
export const qdot = (a: Quat, b: Quat) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
export function qnorm(q: Quat): Quat { const l = Math.hypot(...q) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
/** Rotation by `deg` degrees about `axis` (right-hand rule in CSS coordinates). */
export function qaxis(axis: V3, deg: number): Quat {
  const l = Math.hypot(...axis); if (!l) return QID;
  const h = deg * Math.PI / 360, s = Math.sin(h) / l;
  return [Math.cos(h), axis[0] * s, axis[1] * s, axis[2] * s];
}
/** Row-major 3×3 rotation matrix. */
export function qmat(q: Quat): number[] {
  const [w, x, y, z] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}
export function qrot(q: Quat, v: V3): V3 {
  const m = qmat(q);
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
export function qslerp(a: Quat, b: Quat, t: number): Quat {
  let d = qdot(a, b);
  if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > .9995) return qnorm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
}
/** Angle in degrees between two orientations. */
export const qangle = (a: Quat, b: Quat) => 360 / Math.PI * Math.acos(Math.min(1, Math.abs(qdot(a, b))));

// Components of a face-square orientation are 0, ±1/2, ±1/√2 or ±1: snap away float drift.
const exact = (x: number) => { for (const c of [0, .5, Math.SQRT1_2, 1]) if (Math.abs(Math.abs(x) - c) < 1e-6) return Math.sign(x) * c + 0; return x; };
/** The 24 orientations that put every face square to the view. */
export const ORIENTATIONS: readonly Quat[] = (() => {
  const out: Quat[] = [QID];
  const gens = [qaxis([1, 0, 0], 90), qaxis([0, 1, 0], 90), qaxis([0, 0, 1], 90)];
  for (let i = 0; i < out.length; i++) for (const gq of gens) {
    const q = qnorm(qmul(gq, out[i]));
    if (!out.some(o => Math.abs(qdot(o, q)) > .999)) out.push(q.map(exact) as unknown as Quat);
  }
  return out;
})();

/** The nearest face-square orientation, signed to lie on q's side (so a slerp takes the short way). */
export function snapQuat(q: Quat): { index: number; q: Quat } {
  let best = 0, bd = -1;
  ORIENTATIONS.forEach((o, i) => { const d = Math.abs(qdot(o, q)); if (d > bd) { bd = d; best = i; } });
  const o = ORIENTATIONS[best];
  return { index: best, q: qdot(o, q) < 0 ? [-o[0], -o[1], -o[2], -o[3]] : o };
}

/** A quarter turn of the cube that carries direction a onto direction b. */
export const quarter = (a: V3, b: V3) => qaxis(cross(a, b), 90);
export type CubeTurn = "left" | "right" | "up" | "down" | "roll" | "unroll";
/** Turns of the whole cube, in the view's own axes: "left" moves the front face to the left, and so on. */
export const TURNS: Record<CubeTurn, Quat> = {
  left: quarter([0, 0, 1], [-1, 0, 0]),
  right: quarter([0, 0, 1], [1, 0, 0]),
  up: quarter([0, 0, 1], [0, -1, 0]),
  down: quarter([0, 0, 1], [0, 1, 0]),
  roll: quarter([1, 0, 0], [0, 1, 0]),
  unroll: quarter([0, 1, 0], [1, 0, 0]),
};
export const turnCube = (q: Quat, t: CubeTurn) => qnorm(qmul(TURNS[t], q));

/** The fixed camera: the cube is seen a little from above and from the right, so three faces show. */
export const TILT_X = -22, TILT_Y = -28;
export const TILT: Quat = qmul(qaxis([1, 0, 0], TILT_X), qaxis([0, 1, 0], TILT_Y));
export const viewQuat = (q: Quat) => qmul(TILT, q);
/** Turn the cube by a drag on screen (pixels): the front follows the pointer. */
export function dragCube(q: Quat, dx: number, dy: number, degPerPx = .5): Quat {
  const len = Math.hypot(dx, dy); if (!len) return q;
  const d = qaxis([-dy, dx, 0], len * degPerPx);
  return qnorm(qmul(qmul(qmul(qconj(TILT), d), TILT), q));
}
/** How squarely each face looks at the viewer (the z of its normal on screen), indexed by face. */
export const faceFacing = (q: Quat) => { const v = viewQuat(q); return FACES.map(F => qrot(v, F.n)[2]); };
/** Faces you can see (and touch) with the cube turned to q. */
export const visibleFaces = (q: Quat) => faceFacing(q).map((z, f) => (z > .15 ? f : -1)).filter(f => f >= 0);
/** The face pointing at you. */
export const frontFace = (q: Quat) => { const z = faceFacing(q); return z.indexOf(Math.max(...z)); };
/** Light from the upper left, in front: how bright each face is (0..1) with the cube turned to q. */
const LIGHT: V3 = (() => { const l: V3 = [-.35, -.55, .76]; const s = Math.hypot(...l); return [l[0] / s, l[1] / s, l[2] / s]; })();
export const faceLight = (q: Quat) => { const v = viewQuat(q); return FACES.map(F => Math.max(0, dot(qrot(v, F.n), LIGHT))); };

/** CSS matrix3d for a rotation (with an optional translation). */
export function cssMatrix(m: number[], t: V3 = [0, 0, 0]): string {
  const c = [m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, t[0], t[1], t[2], 1];
  return `matrix3d(${c.map(x => +x.toFixed(6)).join(",")})`;
}
/** Place face f of a cube whose half-side is the CSS length `half`: local x along r, y along d, z along n. */
export function faceTransform(f: number, half: string): string {
  const F = FACES[f];
  return `${cssMatrix([F.r[0], F.d[0], F.n[0], F.r[1], F.d[1], F.n[1], F.r[2], F.d[2], F.n[2]])} translateZ(${half})`;
}
export const cubeTransform = (q: Quat) => cssMatrix(qmat(viewQuat(q)));
