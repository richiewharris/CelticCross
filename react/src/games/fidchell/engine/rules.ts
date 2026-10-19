// Fidchell on a 5x5 board: slide along rows and columns, take by trapping between two.
export const N = 5, GOLD = 1, WHITE = 2, QUIET_LIMIT = 30, MID = (N - 1) / 2;
export type Side = 1 | 2;
export type Cell = 0 | Side;
export type Move = [from: number, to: number];
export type Reason = "reduced" | "blocked" | "quiet";

export interface Piece { id: number; side: Side; pos: number; alive: boolean }
export interface LastMove { from: number; to: number; caps: number[]; side: Side }
export interface State {
  b: Cell[];
  pieces: Piece[];
  turn: Side;
  quiet: number;
  last: LastMove | null;
  /** 0 = draw, null = still playing. */
  winner: Side | 0 | null;
  reason: Reason | null;
  ply: number;
}

export const other = (s: Side): Side => (3 - s) as Side;
export const DIRS: readonly [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const at = (r: number, c: number) => r * N + c;
export const inB = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;
export const sq = (i: number) => "abcdefg"[i % N] + (N - ((i / N) | 0));
/** "c3" -> index. */
export const fromSq = (s: string) => at(N - Number(s.slice(1)), s.charCodeAt(0) - 97);
export const NAME: Record<Side, string> = { 1: "Gold", 2: "White" };

export function initial(): State {
  const b: Cell[] = new Array<Cell>(N * N).fill(0);
  const pieces: Piece[] = [];
  let id = 0;
  for (let c = 0; c < N; c++) { b[at(0, c)] = WHITE; pieces.push({ id: id++, side: WHITE, pos: at(0, c), alive: true }); }
  for (let c = 0; c < N; c++) { b[at(N - 1, c)] = GOLD; pieces.push({ id: id++, side: GOLD, pos: at(N - 1, c), alive: true }); }
  return { b, pieces, turn: GOLD, quiet: 0, last: null, winner: null, reason: null, ply: 0 };
}

export function genMoves(b: readonly Cell[], side: Side): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < N * N; i++) {
    if (b[i] !== side) continue;
    const r = (i / N) | 0, c = i % N;
    for (const [dr, dc] of DIRS) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc) && b[at(rr, cc)] === 0) { out.push([i, at(rr, cc)]); rr += dr; cc += dc; }
    }
  }
  return out;
}

/** Custodial capture: the moved piece and a friendly piece beyond close on an enemy. */
export function capturesFor(b: readonly Cell[], to: number, side: Side): number[] {
  const r = (to / N) | 0, c = to % N, foe = other(side), caps: number[] = [];
  for (const [dr, dc] of DIRS) {
    const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (inB(r2, c2) && b[at(r1, c1)] === foe && b[at(r2, c2)] === side) caps.push(at(r1, c1));
  }
  return caps;
}

export function count(b: readonly Cell[], side: Side) { let n = 0; for (const v of b) if (v === side) n++; return n; }

/** Apply a move to a bare board in place (used by the search). Returns the captured squares. */
export function applyBoard(b: Cell[], m: Move, side: Side): number[] {
  b[m[1]] = side; b[m[0]] = 0;
  const caps = capturesFor(b, m[1], side);
  for (const x of caps) b[x] = 0;
  return caps;
}

/** The board with the piece moved but nothing taken yet. */
export function withMove(b: readonly Cell[], m: Move, side: Side): Cell[] { const c = b.slice(); c[m[1]] = side; c[m[0]] = 0; return c; }

/** The squares a move would take. */
export const capsOf = (b: readonly Cell[], m: Move, side: Side) => capturesFor(withMove(b, m, side), m[1], side);

export function play(s: State, m: Move): State {
  const side = s.turn;
  const b = s.b.slice();
  const caps = applyBoard(b, m, side);
  const pieces = s.pieces.map(p => ({ ...p }));
  const mover = pieces.find(p => p.alive && p.pos === m[0]);
  if (mover) mover.pos = m[1];
  for (const x of caps) { const p = pieces.find(q => q.alive && q.pos === x && q.side !== side); if (p) p.alive = false; }
  const n: State = { b, pieces, turn: other(side), quiet: caps.length ? 0 : s.quiet + 1, last: { from: m[0], to: m[1], caps, side }, winner: null, reason: null, ply: s.ply + 1 };
  const foeLeft = count(b, other(side));
  if (foeLeft <= 1) { n.winner = side; n.reason = "reduced"; }
  else if (genMoves(b, other(side)).length === 0) { n.winner = side; n.reason = "blocked"; }
  else if (n.quiet >= QUIET_LIMIT) {
    const g = count(b, GOLD), w = count(b, WHITE);
    n.winner = g > w ? GOLD : w > g ? WHITE : 0; n.reason = "quiet";
  }
  return n;
}

/** Pieces of `side` the opponent could take with their next move. */
export function threatened(b: readonly Cell[], side: Side): Set<number> {
  const foe = other(side), set = new Set<number>();
  for (const m of genMoves(b, foe)) for (const x of capsOf(b, m, foe)) set.add(x);
  return set;
}

/** Build a position from rows top (rank 5) to bottom: "g" gold, "w" white, "." empty. */
export function fromRows(rows: string[], turn: Side = GOLD, quiet = 0): State {
  const b: Cell[] = [];
  const pieces: Piece[] = [];
  rows.join("").split("").forEach((ch, i) => {
    const v: Cell = ch === "g" ? GOLD : ch === "w" ? WHITE : 0;
    b.push(v);
    if (v) pieces.push({ id: pieces.length, side: v, pos: i, alive: true });
  });
  return { b, pieces, turn, quiet, last: null, winner: null, reason: null, ply: 0 };
}
