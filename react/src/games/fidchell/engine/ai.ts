// The computer: iterative-deepening negamax with alpha-beta, as in the original page.
import { MID, N, QUIET_LIMIT, applyBoard, capsOf, count, genMoves, other, type Cell, type Move, type Side, type State } from "./rules";

export const WIN = 100000;
export interface Level { depth: number; ms: number; noise: number }
export type LevelId = 1 | 2 | 3;
export const LEVELS: Record<LevelId, Level> = {
  1: { depth: 1, ms: 200, noise: 140 },
  2: { depth: 3, ms: 700, noise: 8 },
  3: { depth: 6, ms: 1500, noise: 0 },
};
export const LEVEL_NAMES: Record<LevelId, string> = { 1: "Casual", 2: "Steady", 3: "Strong" };
/** What the hint arrow uses. */
export const HINT_LEVEL: Level = { depth: 3, ms: 250, noise: 0 };

/** Material dominates; then mobility; then a small pull away from the edges. */
export function evaluate(b: readonly Cell[], side: Side): number {
  let mine = 0, theirs = 0, pos = 0;
  for (let i = 0; i < N * N; i++) {
    const v = b[i]; if (!v) continue;
    const r = (i / N) | 0, c = i % N;
    const centre = MID - Math.max(Math.abs(r - MID), Math.abs(c - MID));
    if (v === side) { mine++; pos += centre; } else { theirs++; pos -= centre; }
  }
  const mob = genMoves(b, side).length - genMoves(b, other(side)).length;
  return (mine - theirs) * 120 + mob * 2 + pos * 3;
}

class TimeUp extends Error {}

/** Captures first (stable, so the shuffle survives among equals). */
export function orderMoves(b: readonly Cell[], ms: Move[], side: Side): Move[] {
  return ms.map(m => [capsOf(b, m, side).length, m] as const).sort((x, y) => y[0] - x[0]).map(x => x[1]);
}

export interface SearchEnv { rng?: () => number; now?: () => number }

export function search(state: State, lv: Level, env: SearchEnv = {}): Move | null {
  const rng = env.rng ?? Math.random, now = env.now ?? (() => performance.now());
  const deadline = now() + lv.ms;
  let nodes = 0;
  function negamax(b: Cell[], side: Side, quiet: number, depth: number, alpha: number, beta: number, ply: number): number {
    if ((++nodes & 1023) === 0 && now() > deadline) throw new TimeUp();
    const mineN = count(b, side), foeN = count(b, other(side));
    if (mineN <= 1) return -WIN + ply;
    if (quiet >= QUIET_LIMIT) return mineN > foeN ? WIN / 2 - ply : mineN < foeN ? -WIN / 2 + ply : 0;
    const ms = genMoves(b, side);
    if (!ms.length) return -WIN + ply;
    if (depth === 0) return evaluate(b, side);
    let best = -Infinity;
    for (const m of orderMoves(b, ms, side)) {
      const c = b.slice();
      const caps = applyBoard(c, m, side);
      const v = -negamax(c, other(side), caps.length ? 0 : quiet + 1, depth - 1, -beta, -alpha, ply + 1);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  const side = state.turn;
  let moves = genMoves(state.b, side);
  if (!moves.length) return null;
  for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
  moves = orderMoves(state.b, moves, side);
  let bestMove = moves[0];
  for (let d = 1; d <= lv.depth; d++) {
    try {
      let alpha = -Infinity, best: Move | null = null, bestV = -Infinity;
      const scored: [number, Move][] = [];
      for (const m of moves) {
        const c = state.b.slice();
        const caps = applyBoard(c, m, side);
        const v = -negamax(c, other(side), caps.length ? 0 : state.quiet + 1, d - 1, -Infinity, -alpha, 1) + (lv.noise ? (rng() - 0.5) * lv.noise : 0);
        scored.push([v, m]);
        if (v > bestV) { bestV = v; best = m; }
        if (v > alpha) alpha = v;
      }
      if (best) bestMove = best;
      moves = scored.sort((x, y) => y[0] - x[0]).map(x => x[1]);
      if (bestV > WIN / 4) break;
    } catch (e) { if (e instanceof TimeUp) break; throw e; }
  }
  return bestMove;
}
