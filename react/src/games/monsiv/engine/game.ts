// A whole game of Monsiv as plain data, with pure transitions. The page, the puzzle trainer
// and the simulator drive games through these functions.
import { BL, T, apply, farRow, gen, other, type Move, type Path, type State, type Turn } from "./core";

export type Reason = "throne" | "row" | "blocked";
export interface HistoryEntry { s: State; last: Move | null; note: string; by: Turn }
export interface Game {
  s: State;
  history: HistoryEntry[];
  winner: Turn | null;
  reason: Reason | null;
  last: Move | null;
}

export const NAMES: Record<number, string> = { 1: "Throne", 2: "Angel", 3: "Cross" };
export const LETTER: Record<number, string> = { 1: "T", 2: "A", 3: "C" };
export const sqName = (i: number) => "abcde"[i % 5] + (5 - ((i / 5) | 0));
export const who = (t: Turn) => (t === 0 ? "White" : "Black");

/** The opening position: Angels, Crosses and a Throne on each back row. */
export function initialState(): State {
  const b: number[] = Array(25).fill(0);
  const top = "ACTAC", bot = "CATCA", code: Record<string, number> = { T: 1, A: 2, C: 3 };
  for (let c = 0; c < 5; c++) { b[c] = code[top[c]] | BL; b[20 + c] = code[bot[c]]; }
  return { b, turn: 0, ls: [-1, -1] };
}

export const fromState = (s: State): Game => ({ s, history: [], winner: null, reason: null, last: null });
export const newGame = (): Game => fromState(initialState());

/** Every position of this game so far (the no-repeat rule looks at these). */
export const pathOf = (g: Game): Path => g.history.map(h => h.s).concat([g.s]);
export const legalMoves = (g: Game): Move[] => (g.winner !== null ? [] : gen(g.s, pathOf(g)));

export function notation(s: State, m: Move): string {
  if (m[0] === 0) return `${LETTER[s.b[m[1]] & 7]} ${sqName(m[1])}${s.b[m[2]] ? "×" : "–"}${sqName(m[2])}`;
  return `${LETTER[s.b[m[1]] & 7]}${sqName(m[1])}⇄${LETTER[s.b[m[2]] & 7]}${sqName(m[2])}`;
}

/** Why a move ends the game, if it does: the Throne taken, the far row reached, or no reply left. */
export function outcome(s: State, m: Move, path: Path): Reason | null {
  if (m[0] === 0) {
    const q = s.b[m[2]];
    if (q && (q & 7) === T) return "throne";
    if (((m[2] / 5) | 0) === farRow(s.turn)) return "row";
  }
  const t = apply(s, m);
  return gen(t, path, true).length === 0 ? "blocked" : null;
}

/** Play a (legal) move. */
export function playMove(g: Game, m: Move): Game {
  const s = g.s, path = pathOf(g);
  const reason = outcome(s, m, path);
  return {
    s: apply(s, m),
    history: [...g.history, { s, last: g.last, note: notation(s, m), by: s.turn }],
    winner: reason ? s.turn : null, reason, last: m,
  };
}

/** Take back the last move; with keepSide, keep going back until it was that side's move. */
export function undo(g: Game, keepSide?: Turn): Game {
  if (!g.history.length) return g;
  const hist = g.history.slice();
  let h = hist.pop()!;
  if (keepSide !== undefined) while (h.by !== keepSide && hist.length) h = hist.pop()!;
  return { s: h.s, history: hist, winner: null, reason: null, last: h.last };
}

/** The squares a move touches: from and to, or the two swapped squares. */
export const squaresOf = (m: Move) => [m[1], m[2]];

export const winText = (r: Reason) => (r === "throne" ? "took the Throne" : r === "row" ? "reached the far row" : "left the opponent with no move");
export { other };
