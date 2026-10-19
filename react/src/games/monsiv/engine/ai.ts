// The computer opponent: the original's evaluation plus alpha-beta with iterative deepening.
import { ADJ, BL, T, apply, gen, winsNow, type Move, type Path, type State } from "./core";

export interface SearchOpts { depth: number; ms: number; noise: number }
export const LEVELS: Record<1 | 2 | 3, SearchOpts & { name: string }> = {
  1: { name: "Casual", depth: 2, ms: 300, noise: 14 },
  2: { name: "Steady", depth: 4, ms: 700, noise: 2 },
  3: { name: "Strong", depth: 9, ms: 1600, noise: 0 },
};
export const WIN = 10000;

/** Position value for White: advanced pieces, a Throne kept home and guarded. */
export function evalWhite(b: number[]): number {
  let v = 0;
  for (let i = 0; i < 25; i++) {
    const p = b[i];
    if (!p) continue;
    const r = (i / 5) | 0, white = (p & BL) === 0, sign = white ? 1 : -1;
    const adv = white ? 4 - r : r;
    let pv = (p & 7) !== T ? 10 + adv * adv * 1.2 : -adv * 0.8;
    let friends = 0;
    for (const j of ADJ[i]) { const q = b[j]; if (q && (q & BL) === (p & BL)) friends++; }
    pv += (p & 7) === T ? friends * 1.2 : friends * 0.4;
    v += sign * pv;
  }
  return v;
}

const score = (s: State, m: Move) => (m[0] === 0 ? (s.b[m[2]] && (s.b[m[2]] & 7) === T ? 1000 : s.b[m[2]] ? 100 : 0) : -1);
/** Captures of the Throne first, then other captures, then steps, then swaps (stable). */
const order = (s: State, ms: Move[]) => ms.sort((x, y) => score(s, y) - score(s, x));

class TimeUp extends Error {}

export interface Env { now?: () => number; random?: () => number }

/** The computer's move. `path` is every position of the game so far (for the no-repeat rule). */
export function search(root: State, path: Path, opts: SearchOpts, env: Env = {}): Move | null {
  const now = env.now ?? (() => performance.now()), random = env.random ?? Math.random;
  const deadline = now() + opts.ms;
  let nodes = 0;
  // A move ends the game if it wins on the spot or leaves the other side with no move.
  const ends = (s: State, m: Move, t: State) => winsNow(s, m) || gen(t, path, true).length === 0;
  function negamax(s: State, d: number, a: number, b: number, ply: number): number {
    if (d === 0) return (s.turn === 0 ? 1 : -1) * evalWhite(s.b);
    if ((++nodes & 1023) === 0 && now() > deadline) throw new TimeUp();
    let best = -Infinity;
    for (const m of order(s, gen(s, path))) {
      const t = apply(s, m);
      const v = ends(s, m, t) ? WIN - ply - 1 : -negamax(t, d - 1, -b, -a, ply + 1);
      if (v > best) best = v;
      if (v > a) a = v;
      if (a >= b) break;
    }
    return best;
  }
  let moves = gen(root, path);
  for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
  moves = order(root, moves);
  let bestMove: Move | null = moves[0] ?? null;
  for (let d = 1; d <= opts.depth; d++) {
    try {
      let a = -Infinity, best: Move | null = null, bestV = -Infinity;
      const scored: [number, Move][] = [];
      for (const m of moves) {
        const t = apply(root, m);
        const v = (ends(root, m, t) ? WIN - 1 : -negamax(t, d - 1, -Infinity, -a, 1)) + (opts.noise ? (random() - 0.5) * opts.noise : 0);
        scored.push([v, m]);
        if (v > bestV) { bestV = v; best = m; }
        if (v > a) a = v;
      }
      bestMove = best;
      moves = scored.sort((x, y) => y[0] - x[0]).map(x => x[1]);
      if (bestV > 9000) break;
    } catch (e) { if (e instanceof TimeUp) break; throw e; }
  }
  return bestMove;
}
