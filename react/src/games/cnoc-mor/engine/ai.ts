// The computer opponent: a static evaluation plus alpha-beta search with iterative deepening.
import {
  ALL8, CENTRE, CH, DROP, LO, RI, N, NN, RES_H, RES_S, SP, SUMMIT, TIER, apply, gen, key, from, to, total, zoneOk,
  type Move, type Piece, type Side, type State,
} from "./rules";

export const MATE = 100000;
const PV: Record<number, number> = { 1: 100, 2: 0, 3: 320, 4: 480 };
export const pieceValue = (p: Piece) => PV[p] ?? 0;
const DIST: number[] = [];
for (let i = 0; i < NN; i++) DIST[i] = Math.max(Math.abs(((i / N) | 0) - 4), Math.abs((i % N) - 4));

/** Position value from the Host's point of view. */
export function evalHost(s: State): number {
  const b = s.b;
  let v = 0, lord = -1, hTop = 0;
  for (let i = 0; i < NN; i++) {
    const p = b[i];
    if (!p) continue;
    const sg = p >= 3 ? -1 : 1;
    v += sg * PV[p];
    if (p === LO) lord = i;
    if (p === SP) v += 12 * (TIER[i] - 1);
    if (SUMMIT[i] && sg > 0) hTop++;
  }
  v += (s.rh || 0) * 85 - (s.rs || 0) * 200;
  if (lord >= 0) {
    v += 90 * (TIER[lord] - 1);
    const r = (lord / N) | 0, c = lord % N;
    let g = 0;
    for (const [dr, dc] of ALL8) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === SP) g++;
    }
    v += 15 * Math.min(g, 3);
    v -= 30 * DIST[lord];
  }
  v += 45 * hTop;
  if (b[CENTRE] >= 3) v -= 30;
  return v;
}

export function orderScore(s: State, m: Move): number {
  const f = from(m), t = to(m), q = s.b[t];
  if (f === DROP) return -5;
  const p = s.b[f];
  if (q === LO) return 1e5;
  if (p === LO && t === CENTRE) return 9e4;
  return q ? 1000 + PV[q] - PV[p] / 10 : 0;
}

export interface SearchOpts { depth: number; ms: number; noise: number }
export type Seen = Map<string, number>;

class TimeUp extends Error {}

/** Value of a repeated position for the side to move: the side with fewer pieces (reserves included) wins it. */
function repValue(s: State) {
  const mine = total(s, s.turn), theirs = total(s, (s.turn ^ 1) as Side);
  return mine < theirs ? MATE / 2 : mine > theirs ? -MATE / 2 : 0;
}

function makeSearcher(seen: Seen, deadline: number) {
  let nodes = 0;
  const path: string[] = [];
  const repTimes = (k: string) => (seen.get(k) || 0) + path.filter(x => x === k).length;
  function nm(s: State, d: number, a: number, bb: number, ply: number): number {
    if ((++nodes & 511) === 0 && performance.now() > deadline) throw new TimeUp();
    if (d === 0) { const v = evalHost(s); return s.turn === 0 ? v : -v; }
    const ms = gen(s);
    if (!ms.length) return -MATE + ply;
    ms.sort((x, y) => orderScore(s, y) - orderScore(s, x));
    let best = -Infinity;
    for (const m of ms) {
      const t = apply(s, m);
      let v: number;
      if (t.res) v = MATE - ply - 1;
      else {
        const k = key(t);
        if (repTimes(k) >= 2) v = -repValue(t);
        else { path.push(k); v = -nm(t, d - 1, -bb, -a, ply + 1); path.pop(); }
      }
      if (v > best) best = v;
      if (v > a) a = v;
      if (a >= bb) break;
    }
    return best;
  }
  /** Score of one root move at depth d; scores at or below alpha are only bounds. */
  function root(rootS: State, m: Move, d: number, alpha: number) {
    const t = apply(rootS, m);
    if (t.res) return MATE;
    const k = key(t);
    if (repTimes(k) >= 2) return -repValue(t);
    path.push(k);
    const v = -nm(t, d - 1, -Infinity, -alpha, 1);
    path.pop();
    return v;
  }
  return { root };
}

/** Choose a move for the side to move. rng is for the level's noise (Math.random by default). */
export function search(rootS: State, opts: SearchOpts, seen: Seen, rng: () => number = Math.random): Move | null {
  const deadline = performance.now() + opts.ms;
  const S = makeSearcher(seen, deadline);
  let moves = gen(rootS);
  if (!moves.length) return null;
  moves.sort((x, y) => orderScore(rootS, y) - orderScore(rootS, x));
  let bestMove = moves[0];
  for (let d = 1; d <= opts.depth; d++) {
    try {
      let a = -Infinity, bestV = -Infinity, bm = moves[0];
      const sc: [number, Move][] = [];
      for (const m of moves) {
        let v = S.root(rootS, m, d, a - opts.noise - 1);
        v += (rng() - 0.5) * opts.noise;
        sc.push([v, m]);
        if (v > bestV) { bestV = v; bm = m; }
        if (v > a) a = v;
      }
      bestMove = bm;
      moves = sc.sort((x, y) => y[0] - x[0]).map(x => x[1]);
      if (bestV > MATE / 2) break;
    } catch (e) {
      if (e instanceof TimeUp) break;
      throw e;
    }
  }
  return bestMove;
}

export interface Analysis { m: Move | null; v: number; depth: number }

/** Deep value of a position for the side to move, used by the game review. */
export function analyse(rootS: State, maxDepth: number, ms: number, seen: Seen): Analysis {
  const deadline = performance.now() + ms;
  const S = makeSearcher(seen, deadline);
  let moves = gen(rootS);
  if (!moves.length) return { m: null, v: -MATE, depth: 0 };
  moves.sort((x, y) => orderScore(rootS, y) - orderScore(rootS, x));
  let out: Analysis | null = null;
  for (let d = 1; d <= maxDepth; d++) {
    try {
      let a = -Infinity, bestV = -Infinity, bm = moves[0];
      const sc: [number, Move][] = [];
      for (const m of moves) {
        const v = S.root(rootS, m, d, a - 1);
        sc.push([v, m]);
        if (v > bestV) { bestV = v; bm = m; }
        if (v > a) a = v;
      }
      moves = sc.sort((x, y) => y[0] - x[0]).map(x => x[1]);
      out = { m: bm, v: bestV, depth: d };
      if (Math.abs(bestV) >= MATE / 2) break;
    } catch (e) {
      if (e instanceof TimeUp) break;
      throw e;
    }
  }
  return out ?? { m: moves[0], v: 0, depth: 0 };
}

export type Level = 1 | 2 | 3 | 4;
export const LEVELS: Record<Level, SearchOpts & { name: string }> = {
  1: { name: "Novice", depth: 1, ms: 250, noise: 160 },
  2: { name: "Warrior", depth: 2, ms: 700, noise: 40 },
  3: { name: "Champion", depth: 3, ms: 1600, noise: 8 },
  4: { name: "High King", depth: 6, ms: 3200, noise: 0 },
};

/** How good a hole is for a piece, from its owner's point of view (no randomness). */
export function placeScore(s: State, side: Side, piece: Piece, i: number): number {
  const b = s.b.slice(); b[i] = piece;
  let v = evalHost({ b, turn: 0, rh: RES_H, rs: RES_S, ply: 0 });
  if (side === 1) v = -v;
  const enemy = gen({ b, turn: (side ^ 1) as Side, rh: 0, rs: 0, ply: 0 });
  if (enemy.some(m => to(m) === i && from(m) !== DROP)) v -= PV[piece] / 2 + (piece === LO ? 400 : 0);
  const mine = gen({ b, turn: side, rh: 0, rs: 0, ply: 0 });
  for (const m of mine) if (from(m) === i && b[to(m)]) v += 20;
  return v;
}

/** The computer's choice of hole during setup. */
export function cpuPlace(s: State, side: Side, piece: Piece, lvl: number, rng: () => number = Math.random): number {
  const cand: number[] = [];
  for (let i = 0; i < NN; i++) if (!s.b[i] && zoneOk(side, i)) cand.push(i);
  if (lvl === 1) return cand[(rng() * cand.length) | 0];
  let best = cand[0], bv = -Infinity;
  for (const i of cand) {
    const v = placeScore(s, side, piece, i) + rng() * (lvl === 2 ? 90 : 40);
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}

/** Which piece the computer sets next: its special piece with chance 1 in (pieces left), else a plain one. */
export function cpuPick(tray: Partial<Record<Piece, number>>, side: Side, rng: () => number = Math.random): Piece {
  const special: Piece = side === 0 ? LO : CH, plain: Piece = side === 0 ? SP : RI;
  const left = (tray[special] ?? 0) + (tray[plain] ?? 0);
  return tray[special] && (rng() < 1 / left || !tray[plain]) ? special : plain;
}
