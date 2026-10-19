// A whole game of Cnoc as plain data, with pure transitions. The UI, the review and the
// simulator all drive the game through these functions.
import {
  LETTER, NN, apply, count, emptyBoard, from, gen, key, sqName, to,
  type Move, type Piece, type Rules, type Side, type State, type WinReason,
} from "./rules";
import { PLACEMENTS, effectiveHold, freshTrays, slotAt, type Slot, type Trays } from "./setup";

export type Phase = "place" | "play";
export interface Last { from?: number; to: number }
export interface HistoryEntry {
  s: State; phase: Phase; placed: number; trays: Trays; note: string; by: Side; last: Last | null;
}
export interface Game {
  s: State;
  phase: Phase;
  placed: number;
  trays: Trays;
  history: HistoryEntry[];
  /** null while playing; -1 for a draw. */
  winner: Side | -1 | null;
  why: WinReason | null;
  last: Last | null;
  swap: boolean;
  holdN: number;
}

export function newGame(opts: { swap?: boolean; holdN?: number } = {}): Game {
  return {
    s: { b: emptyBoard(), turn: 0, hold: 0 },
    phase: "place", placed: 0, trays: freshTrays(), history: [],
    winner: null, why: null, last: null,
    swap: !!opts.swap, holdN: opts.holdN ?? 7,
  };
}

export const rulesOf = (g: Game): Rules => ({ holdN: effectiveHold(g.holdN, g.swap) });
export const currentSlot = (g: Game): Slot => slotAt(g.placed, g.swap);
/** Who acts next: the setter during setup, the side to move in play. */
export const actor = (g: Game): Side => (g.phase === "place" ? currentSlot(g).p : g.s.turn);

export function seenMap(g: Game): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of g.history) if (h.phase === "play") m.set(key(h.s), (m.get(key(h.s)) || 0) + 1);
  if (g.phase === "play") m.set(key(g.s), (m.get(key(g.s)) || 0) + 1);
  return m;
}

export const moveNote = (s: State, m: Move) =>
  `${LETTER[s.b[from(m)]]} ${sqName(from(m))}${s.b[to(m)] ? "×" : "–"}${sqName(to(m))}`;

const cloneTrays = (t: Trays): Trays => ({ 0: { ...t[0] }, 1: { ...t[1] } });

/** Set a piece during the setup phase. */
export function placePiece(g: Game, i: number, piece: Piece): Game {
  const slot = currentSlot(g);
  const entry: HistoryEntry = { s: g.s, phase: g.phase, placed: g.placed, trays: g.trays, note: `${LETTER[piece]} ${sqName(i)}`, by: slot.p, last: g.last };
  const b = g.s.b.slice(); b[i] = piece;
  const trays = cloneTrays(g.trays);
  trays[slot.o][piece] = (trays[slot.o][piece] ?? 0) - 1;
  const placed = g.placed + 1;
  return {
    ...g, s: { b, turn: 0, hold: 0 }, trays, placed,
    phase: placed >= PLACEMENTS ? "play" : "place",
    history: [...g.history, entry], last: { to: i },
  };
}

/** Play a move, then settle wins, no-move losses and third repetitions. */
export function playMove(g: Game, m: Move): Game {
  const before = g.s, rules = rulesOf(g);
  const entry: HistoryEntry = { s: before, phase: "play", placed: g.placed, trays: g.trays, note: moveNote(before, m), by: before.turn, last: g.last };
  const t = apply(before, m, rules);
  const s: State = { b: t.b, turn: t.turn, hold: t.hold };
  const next: Game = { ...g, s, history: [...g.history, entry], last: { from: from(m), to: to(m) } };
  if (t.res) return { ...next, winner: (t.res - 1) as Side, why: t.why };
  if (!gen(s).length) return { ...next, winner: before.turn, why: "nomove" };
  const seen = seenMap(next);
  if ((seen.get(key(s)) || 0) >= 3) {
    const nh = count(s.b, 0), ns = count(s.b, 1);
    return { ...next, winner: nh < ns ? 0 : ns < nh ? 1 : -1, why: "repeat" };
  }
  return next;
}

/** Take back the last action; with keepSide, keep going back until it is that side's action. */
export function undo(g: Game, keepSide?: Side): Game {
  if (!g.history.length) return g;
  const hist = g.history.slice();
  let h = hist.pop()!;
  if (keepSide !== undefined) while (h.by !== keepSide && hist.length) h = hist.pop()!;
  return { ...g, s: h.s, phase: h.phase, placed: h.placed, trays: h.trays, last: h.last, history: hist, winner: null, why: null };
}

/** Pieces the setter may choose from right now. */
export function trayChoices(g: Game): Piece[] {
  const slot = currentSlot(g);
  if (slot.k) return [slot.k];
  const tr = g.trays[slot.o];
  return (Object.keys(tr).map(Number) as Piece[]).filter(k => (tr[k] ?? 0) > 0);
}

export const isOver = (g: Game) => g.winner !== null;
export const boardSize = NN;
