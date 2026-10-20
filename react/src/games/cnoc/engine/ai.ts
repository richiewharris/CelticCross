// The computer opponent: a static evaluation plus alpha-beta search with iterative deepening.
import {
  ALL8, LO, N, NN, PH, RI, SP, SUMMIT, TIER, apply, count, gen, key, from, sideOf, to,
  type Move, type Piece, type Rules, type Side, type State,
} from "./rules";

export const MATE = 100000;
/** The Phalanx (combining variant): a Spearman that also steps diagonally, worth a little less than the three it replaces. */
export const PHALANX_VALUE = 270;
const PV: Record<number, number> = { 1: 100, 2: 0, 3: 230, 4: 480, 5: PHALANX_VALUE };
export const pieceValue = (p: Piece) => PV[p] ?? 0;

/** Position value from the Host's point of view. */
export function evalHost(s: State, rules: Rules): number {
  const b = s.b;
  let v = 0, lord = -1, hTop = 0, sTop = 0;
  for (let i = 0; i < NN; i++) {
    const p = b[i];
    if (!p) continue;
    const sg = sideOf(p) ? -1 : 1;
    v += sg * PV[p];
    if (p === LO) lord = i;
    if (p === SP) v += 12 * (TIER[i] - 1);
    else if (p === PH) v += 25 * (TIER[i] - 1);
    if (SUMMIT[i]) { if (sg > 0) hTop++; else sTop++; }
  }
  if (lord >= 0) {
    v += 90 * (TIER[lord] - 1);
    const r = (lord / N) | 0, c = lord % N;
    let g = 0;
    for (const [dr, dc] of ALL8) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N && (b[rr * N + cc] === SP || b[rr * N + cc] === PH)) g++;
    }
    v += 15 * Math.min(g, 3);
    let best = 9;
    for (let j = 0; j < NN; j++) if (SUMMIT[j]) best = Math.min(best, Math.max(Math.abs(r - ((j / N) | 0)), Math.abs(c - (j % N))));
    v -= 30 * best;
  }
  v += 45 * hTop;
  v -= s.hold * (400 / rules.holdN) + (sTop && !hTop ? 40 : 0);
  return v;
}

export function orderScore(s: State, m: Move): number {
  const q = s.b[to(m)], p = s.b[from(m)];
  if (q === LO) return 1e5;
  if (p === LO && SUMMIT[to(m)]) return 9e4;
  if (p === RI && q === RI) return 1500; // a merge
  return q ? 1000 + PV[q] - PV[p] / 10 : 0;
}

export interface SearchOpts { depth: number; ms: number; noise: number }
export type Seen = Map<string, number>;

class TimeUp extends Error {}

/** Value of a repeated position for the side to move: the side with fewer pieces wins it. */
function repValue(s: State) {
  const mine = count(s.b, s.turn), theirs = count(s.b, (s.turn ^ 1) as Side);
  return mine < theirs ? MATE / 2 : mine > theirs ? -MATE / 2 : 0;
}

function makeSearcher(rules: Rules, seen: Seen, deadline: number) {
  let nodes = 0;
  const path: string[] = [];
  const repTimes = (k: string) => (seen.get(k) || 0) + path.filter(x => x === k).length;
  function nm(s: State, d: number, a: number, bb: number, ply: number): number {
    if ((++nodes & 511) === 0 && performance.now() > deadline) throw new TimeUp();
    if (d === 0) { const v = evalHost(s, rules); return s.turn === 0 ? v : -v; }
    const ms = gen(s, rules);
    if (!ms.length) return -MATE + ply;
    ms.sort((x, y) => orderScore(s, y) - orderScore(s, x));
    let best = -Infinity;
    for (const m of ms) {
      const t = apply(s, m, rules);
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
    const t = apply(rootS, m, rules);
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

/** Choose a move for the side to move. */
export function search(rootS: State, opts: SearchOpts, seen: Seen, rules: Rules): Move | null {
  const deadline = performance.now() + opts.ms;
  const S = makeSearcher(rules, seen, deadline);
  let moves = gen(rootS, rules);
  if (!moves.length) return null;
  moves.sort((x, y) => orderScore(rootS, y) - orderScore(rootS, x));
  let bestMove = moves[0];
  for (let d = 1; d <= opts.depth; d++) {
    try {
      let a = -Infinity, bestV = -Infinity, bm = moves[0];
      const sc: [number, Move][] = [];
      for (const m of moves) {
        let v = S.root(rootS, m, d, a - opts.noise - 1);
        v += (Math.random() - 0.5) * opts.noise;
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
export function analyse(rootS: State, maxDepth: number, ms: number, seen: Seen, rules: Rules): Analysis {
  const deadline = performance.now() + ms;
  const S = makeSearcher(rules, seen, deadline);
  let moves = gen(rootS, rules);
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

export const LEVELS: Record<number, SearchOpts & { name: string }> = {
  1: { name: "Novice", depth: 1, ms: 200, noise: 160 },
  2: { name: "Warrior", depth: 3, ms: 500, noise: 40 },
  3: { name: "Champion", depth: 5, ms: 1200, noise: 6 },
  4: { name: "High King", depth: 8, ms: 2600, noise: 0 },
};

/** How good a hole is for a piece, from its owner's point of view (no randomness). */
export function placeScore(s: State, side: Side, piece: Piece, i: number, rules: Rules): number {
  const b = s.b.slice(); b[i] = piece;
  let v = evalHost({ b, turn: 0, hold: 0 }, rules);
  if (side === 1) v = -v;
  const enemy = gen({ b, turn: (side ^ 1) as Side, hold: 0 }, rules);
  if (enemy.some(m => to(m) === i)) v -= PV[piece] / 2 + (piece === LO ? 400 : 0);
  const mine = gen({ b, turn: side, hold: 0 }, rules);
  for (const m of mine) if (from(m) === i && b[to(m)]) v += 20;
  return v;
}

/** The computer's choice of hole. spite = setting the rival's piece, so put it where it does worst. */
export function cpuPlace(
  s: State, side: Side, piece: Piece, lvl: number, spite: boolean, zone: (i: number) => boolean, rules: Rules,
): number {
  const cand: number[] = [];
  for (let i = 0; i < NN; i++) if (!s.b[i] && zone(i)) cand.push(i);
  if (lvl === 1) return cand[(Math.random() * cand.length) | 0];
  let best = cand[0], bv = -Infinity;
  for (const i of cand) {
    let v = placeScore(s, side, piece, i, rules);
    if (spite) v = -v;
    v += Math.random() * (lvl === 2 ? 90 : 40);
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}

/** Noise on the Phalanx decision by level: the Novice is close to a coin toss, the High King decides on judgement alone. */
const PHX_NOISE: Record<number, number> = { 1: 600, 2: 120, 3: 40, 4: 0 };
/** What the computer reckons a Phalanx's freedom (stepping in eight directions, and onto the summit corners) is worth over plain Spearmen. */
const PHX_MOBILITY = 60;

/**
 * Should the computer's Host take the Phalanx with this action (combining variant)?
 * Own setup: compare the best hole for the Phalanx against the best hole for a Spearman plus the two
 * further Spearmen it would cost. Rival's setup: the Sí will set it, so judge it in the abstract.
 */
export function cpuWantsPhalanx(
  s: State, swap: boolean, lvl: number, zone: (i: number) => boolean, rules: Rules, rnd: () => number = Math.random,
): boolean {
  const noise = (rnd() - 0.5) * 2 * (PHX_NOISE[lvl] ?? 0);
  if (swap) return PV[PH] + PHX_MOBILITY - 3 * PV[SP] + noise > 0;
  let bestP = -Infinity, bestS = -Infinity;
  for (let i = 0; i < NN; i++) {
    if (s.b[i] || !zone(i)) continue;
    bestP = Math.max(bestP, placeScore(s, 0, PH, i, rules));
    bestS = Math.max(bestS, placeScore(s, 0, SP, i, rules));
  }
  return bestP + PHX_MOBILITY - (bestS + 2 * PV[SP]) + noise > 0;
}
