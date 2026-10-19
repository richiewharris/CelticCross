// Solver-checked puzzles: a forced win in 2 to 5 moves for the side to move.
// Each puzzle carries a solution tree. At a node with alternatives `a`, any listed move works
// and the computer answers with the stored reply; at a final node `w`, any immediately winning move works.
import data from "./puzzles.json";
import { apply, gen, immediateWin, type Move, type Piece, type Rules, type Side, type State } from "./rules";

export type PuzzleNode = { w: [number, number] } | { a: [number, number, number, number, PuzzleNode][] };
export interface Puzzle {
  id: string; label: string; side: Side; n: number; hold: number; b: Piece[]; t: PuzzleNode; why: string;
}
export const PUZZLES = data as unknown as Puzzle[];
export const PUZZLE_RULES: Rules = { holdN: 7 };
export const puzzleStart = (p: Puzzle): State => ({ b: p.b.slice() as Piece[], turn: p.side, hold: p.hold });

/** The next node after the player's move, or null if the move fails. Also returns the reply. */
export function stepPuzzle(node: PuzzleNode, s: State, m: Move): { ok: boolean; reply?: Move; next?: PuzzleNode } {
  if ("w" in node) return { ok: immediateWin(s, m, PUZZLE_RULES) };
  const alt = node.a.find(a => a[0] * 64 + a[1] === m);
  return alt ? { ok: true, reply: alt[2] * 64 + alt[3], next: alt[4] } : { ok: false };
}

/** The main line, as a list of moves alternating player and reply. */
export function mainLine(p: Puzzle): Move[] {
  const out: Move[] = [];
  let node: PuzzleNode = p.t;
  for (;;) {
    if ("w" in node) { out.push(node.w[0] * 64 + node.w[1]); return out; }
    const a = node.a[0];
    out.push(a[0] * 64 + a[1], a[2] * 64 + a[3]);
    node = a[4];
  }
}

/** Check a whole solution tree against the rules (used by the tests). */
export function checkTree(s: State, node: PuzzleNode, me: Side): boolean {
  const ms = gen(s);
  if ("w" in node) {
    const m = node.w[0] * 64 + node.w[1];
    return ms.includes(m) && immediateWin(s, m, PUZZLE_RULES);
  }
  for (const a of node.a) {
    const m = a[0] * 64 + a[1];
    if (!ms.includes(m)) return false;
    const t = apply(s, m, PUZZLE_RULES);
    if (t.res) return false;
    const r = a[2] * 64 + a[3];
    if (!gen(t).includes(r)) return false;
    const u = apply(t, r, PUZZLE_RULES);
    if (u.res) return false;
    if (!checkTree(u, a[4], me)) return false;
  }
  return true;
}
