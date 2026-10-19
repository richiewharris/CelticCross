// Fidchell of Cups: the rules. Fidchell's capture-by-trapping on a 7x7 board, with Tablero's
// two dice, pass numbers, the Queen's toast and refills from each side's jug.
// Pure: no DOM, no timers. Randomness comes in as `rng` (defaults to Math.random).

export const N = 7, MEAD = 1, WINE = 2, MID = 3, JUG = 4, QUIET_LIMIT = 60;
export const PASS = [7, 11, 12];
export type Side = 1 | 2;
export type Cell = 0 | Side;
export type Rng = () => number;

export const other = (s: Side): Side => (3 - s) as Side;
export const DIRS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const at = (r: number, c: number) => r * N + c;
export const inB = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;
/** Square name, a1 bottom-left (mead's back row is row 1). */
export const sq = (i: number) => "abcdefg"[i % N] + (N - ((i / N) | 0));
export const NAME: Record<Side, string> = { 1: "Mead", 2: "Wine" };
export const d6 = (rng: Rng = Math.random) => 1 + ((rng() * 6) | 0);
export const baseRow = (side: Side) => (side === MEAD ? N - 1 : 0);

export interface Piece { id: number; side: Side; pos: number; alive: boolean; fresh?: boolean }
export interface State {
  b: Cell[];
  pieces: Piece[];
  nextId: number;
  turn: Side;
  dice: [number, number] | null;
  used: [boolean, boolean];
  /** Where the cup moved with the first die landed; it may not move again this roll. */
  movedTo: number;
  jug: Record<Side, number>;
  drinks: Record<Side, number>;
  quiet: number;
  queen: number;
  queenPending: boolean;
  /** 1 or 2 for a win, 0 for a draw, null while playing. */
  winner: Side | 0 | null;
  reason: "dry" | "quiet" | null;
}
/** [die index, from, to] */
export type Step = [number, number, number];
export interface DrinkEvent { at: number; refill: number }

export function newState(queen: number): State {
  const b: Cell[] = new Array(N * N).fill(0), pieces: Piece[] = [];
  let id = 0;
  for (let c = 0; c < N; c++) { b[at(0, c)] = WINE; pieces.push({ id: id++, side: WINE, pos: at(0, c), alive: true }); }
  for (let c = 0; c < N; c++) { b[at(N - 1, c)] = MEAD; pieces.push({ id: id++, side: MEAD, pos: at(N - 1, c), alive: true }); }
  return {
    b, pieces, nextId: id, turn: MEAD, dice: null, used: [false, false], movedTo: -1, jug: { 1: JUG, 2: JUG }, drinks: { 1: 0, 2: 0 },
    quiet: 0, queen, queenPending: false, winner: null, reason: null,
  };
}

export const clone = (s: State): State => ({
  ...s, b: s.b.slice(), pieces: s.pieces.map(p => ({ ...p })), used: [s.used[0], s.used[1]], jug: { ...s.jug }, drinks: { ...s.drinks },
  dice: s.dice && [s.dice[0], s.dice[1]],
});

/** Moves of exactly d holes in a straight line through empty holes. `skip` is a square whose cup may not move. */
export function movesFor(b: readonly Cell[], side: Side, d: number, skip = -1): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < N * N; i++) {
    if (b[i] !== side || i === skip) continue;
    const r = (i / N) | 0, c = i % N;
    for (const [dr, dc] of DIRS) {
      let ok = true;
      for (let k = 1; k <= d; k++) { const rr = r + dr * k, cc = c + dc * k; if (!inB(rr, cc) || b[at(rr, cc)]) { ok = false; break; } }
      if (ok) out.push([i, at(r + dr * d, c + dc * d)]);
    }
  }
  return out;
}

/** Rival cups trapped by a cup of `side` standing on `to`. */
export function capturesFor(b: readonly Cell[], to: number, side: Side): number[] {
  const r = (to / N) | 0, c = to % N, foe = other(side), caps: number[] = [];
  for (const [dr, dc] of DIRS) {
    const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (inB(r2, c2) && b[at(r1, c1)] === foe && b[at(r2, c2)] === side) caps.push(at(r1, c1));
  }
  return caps;
}

/** Where a refilled cup goes: its owner's back row, nearest the middle; failing that, the next row in. */
export function refillSpot(b: readonly Cell[], side: Side): number {
  const cols = [3, 2, 4, 1, 5, 0, 6];
  for (let k = 0; k < N; k++) {
    const r = side === MEAD ? N - 1 - k : k;
    for (const c of cols) if (!b[at(r, c)]) return at(r, c);
  }
  return -1;
}

/** Drink the cups at `squares` for `drinker` (mutates s); each owner refills from their jug, or loses if it's dry. */
export function drink(s: State, squares: number[], drinker: Side): DrinkEvent[] {
  const owner = other(drinker), events: DrinkEvent[] = [];
  for (const x of squares) {
    if (s.winner !== null) break;
    s.b[x] = 0;
    const p = s.pieces.find(q => q.alive && q.pos === x); if (p) p.alive = false;
    s.drinks[drinker]++;
    if (s.jug[owner] > 0) {
      s.jug[owner]--;
      const spot = refillSpot(s.b, owner);
      s.b[spot] = owner;
      s.pieces.push({ id: s.nextId++, side: owner, pos: spot, alive: true, fresh: true });
      events.push({ at: x, refill: spot });
    } else { s.winner = drinker; s.reason = "dry"; events.push({ at: x, refill: -1 }); }
  }
  if (squares.length) s.quiet = 0;
  return events;
}

/** [die index, from, to] for every unused die. */
export function legalNow(s: State): Step[] {
  if (!s.dice || s.queenPending || s.winner !== null) return [];
  const out: Step[] = [];
  for (let k = 0; k < 2; k++) if (!s.used[k]) for (const [f, t] of movesFor(s.b, s.turn, s.dice[k], s.movedTo)) out.push([k, f, t]);
  return out;
}

export function move(s0: State, k: number, from: number, to: number): { s: State; caps: number[]; events: DrinkEvent[] } {
  const s = clone(s0), side = s.turn;
  s.pieces.forEach(p => { p.fresh = false; });
  s.b[to] = side; s.b[from] = 0;
  const p = s.pieces.find(q => q.alive && q.pos === from);
  if (p) p.pos = to;
  s.used[k] = true; s.movedTo = to;
  const caps = capturesFor(s.b, to, side);
  const events = drink(s, caps, side);
  if (!caps.length) s.quiet++;
  if (s.winner === null && s.quiet >= QUIET_LIMIT) {
    const a = s.drinks[MEAD], w = s.drinks[WINE];
    s.winner = a > w ? MEAD : w > a ? WINE : 0; s.reason = "quiet";
  }
  return { s, caps, events };
}

export type Outcome = "queen" | "pass" | "move" | "stuck";
export function rollOutcome(s: State): Outcome {
  if (!s.dice) throw new Error("no dice");
  const sum = s.dice[0] + s.dice[1];
  if (sum === s.queen) return "queen";
  if (PASS.includes(sum)) return "pass";
  return legalNow(s).length ? "move" : "stuck";
}

export const withDice = (s: State, d: [number, number]): State =>
  ({ ...clone(s), dice: [d[0], d[1]], used: [false, false], movedTo: -1, queenPending: d[0] + d[1] === s.queen });
export const passTurn = (s: State): State => ({ ...clone(s), turn: other(s.turn), dice: null, used: [false, false], movedTo: -1, queenPending: false });
export const rollAgain = (s: State): State => ({ ...clone(s), dice: null, used: [false, false], movedTo: -1, queenPending: false });
/** After a toast: the roller rolls again, unless the Queen's number was also a pass number. */
const afterQueen = (s: State, wasPassNumber: boolean) => (wasPassNumber ? passTurn(s) : rollAgain(s));

/** The roller toasts the Queen and drinks the rival cup on `target`. */
export function toast(s0: State, target: number): { s: State; events: DrinkEvent[] } {
  if (!s0.dice) throw new Error("no dice");
  const s = clone(s0), sum = s0.dice[0] + s0.dice[1];
  s.pieces.forEach(p => { p.fresh = false; });
  const events = drink(s, [target], s.turn);
  s.queenPending = false;
  return { s: s.winner !== null ? s : afterQueen(s, PASS.includes(sum)), events };
}

/** The roller rolled on without toasting: the rival drinks the roller's cup on `victim`. */
export function treason(s0: State, victim: number): { s: State; events: DrinkEvent[] } {
  const s = clone(s0);
  s.pieces.forEach(p => { p.fresh = false; });
  const events = drink(s, [victim], other(s.turn));
  s.queenPending = false;
  return { s: s.winner !== null ? s : rollAgain(s), events };
}
