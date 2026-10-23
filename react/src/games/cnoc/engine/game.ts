// A whole game of Cnoc as plain data, with pure transitions. The UI, the review and the
// simulator all drive the game through these functions.
import {
  CH, LETTER, LO, NN, PH, RI, SP, apply, count, emptyBoard, from, gen, isMerge, key, sqName, to,
  type Move, type Piece, type Rules, type Side, type State, type WinReason,
} from "./rules";
import { PHALANX_COST, PLACEMENTS, comboSlot, effectiveHold, freshTrays, leftIn, slotAt, type Slot, type Trays } from "./setup";

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
  /** The combining variant (Phalanx and merging Riders). Absent in standard games. */
  combine?: boolean;
}

export function newGame(opts: { swap?: boolean; holdN?: number; combine?: boolean } = {}): Game {
  return {
    s: { b: emptyBoard(), turn: 0, hold: 0 },
    phase: "place", placed: 0, trays: freshTrays(), history: [],
    winner: null, why: null, last: null,
    swap: !!opts.swap, holdN: opts.holdN ?? 7,
    ...(opts.combine ? { combine: true } : {}),
  };
}

export const rulesOf = (g: Game): Rules =>
  g.combine ? { holdN: effectiveHold(g.holdN, g.swap), combine: true } : { holdN: effectiveHold(g.holdN, g.swap) };
export const currentSlot = (g: Game): Slot => (g.combine ? comboSlot(g.placed, g.swap, g.trays) : slotAt(g.placed, g.swap));
/** How many pieces the setup will set in all (13, or 11 once the Host has taken the Phalanx). */
export const totalPlacements = (g: Game) => (g.combine ? g.placed + leftIn(g.trays, 0) + leftIn(g.trays, 1) : PLACEMENTS);
/** Has the Host taken the Phalanx (set it, or chosen it for the rival to set)? */
export const phalanxTaken = (g: Game) => g.s.b.includes(PH) || (g.trays[0][PH] ?? 0) > 0;
/**
 * May the Host take the Phalanx with this action? Own setup: on any Host turn while at least three
 * Spearmen are left to set. Rival's setup: only when setting the Lord (the Sí then set the Phalanx).
 */
export function phalanxOffer(g: Game): boolean {
  if (!g.combine || g.phase !== "place" || phalanxTaken(g)) return false;
  const slot = currentSlot(g);
  if (slot.p !== 0 || slot.o !== 0) return false;
  if (g.swap) return g.placed === 0;
  return (g.trays[0][SP] ?? 0) >= PHALANX_COST;
}
/** Who acts next: the setter during setup, the side to move in play. */
export const actor = (g: Game): Side => (g.phase === "place" ? currentSlot(g).p : g.s.turn);

export function seenMap(g: Game): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of g.history) if (h.phase === "play") m.set(key(h.s), (m.get(key(h.s)) || 0) + 1);
  if (g.phase === "play") m.set(key(g.s), (m.get(key(g.s)) || 0) + 1);
  return m;
}

export const moveNote = (s: State, m: Move) =>
  isMerge(s.b, m)
    ? `R ${sqName(from(m))}+${sqName(to(m))}=C`
    : `${LETTER[s.b[from(m)]]} ${sqName(from(m))}${s.b[to(m)] ? "×" : "–"}${sqName(to(m))}`;

const cloneTrays = (t: Trays): Trays => ({ 0: { ...t[0] }, 1: { ...t[1] } });

/**
 * Set a piece during the setup phase. In the combining variant's rival setup, the Host's Lord
 * placement may carry the choice of the Phalanx (takePhalanx), which the Sí then set later.
 */
export function placePiece(g: Game, i: number, piece: Piece, takePhalanx = false): Game {
  const slot = currentSlot(g);
  const choose = takePhalanx && g.swap && phalanxOffer(g);
  const note = `${LETTER[piece]} ${sqName(i)}${choose ? " · Phalanx" : ""}`;
  const entry: HistoryEntry = { s: g.s, phase: g.phase, placed: g.placed, trays: g.trays, note, by: slot.p, last: g.last };
  const b = g.s.b.slice(); b[i] = piece;
  const trays = cloneTrays(g.trays);
  if (piece === PH && !g.swap) trays[0][SP] = (trays[0][SP] ?? 0) - PHALANX_COST;
  else trays[slot.o][piece] = (trays[slot.o][piece] ?? 0) - 1;
  if (choose) { trays[0][SP] = (trays[0][SP] ?? 0) - PHALANX_COST; trays[0][PH] = 1; }
  const placed = g.placed + 1;
  const done = g.combine ? leftIn(trays, 0) + leftIn(trays, 1) === 0 : placed >= PLACEMENTS;
  return {
    ...g, s: { b, turn: 0, hold: 0 }, trays, placed,
    phase: done ? "play" : "place",
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
  if (!gen(s, rules).length) return { ...next, winner: before.turn, why: "nomove" };
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
  const out = (Object.keys(tr).map(Number) as Piece[]).filter(k => (tr[k] ?? 0) > 0);
  if (!g.swap && phalanxOffer(g)) out.push(PH);
  return out;
}

export const isOver = (g: Game) => g.winner !== null;
export const boardSize = NN;

const PREFER: Piece[] = [SP, RI, LO, CH, PH];
/** The piece a click sets: the one picked in the tray if allowed, else the plainest piece still to set. */
export function defaultPiece(g: Game, pick: Piece | null): Piece {
  const slot = currentSlot(g), choices = trayChoices(g);
  if (slot.k) return slot.k;
  if (pick !== null && choices.includes(pick)) return pick;
  return PREFER.find(k => choices.includes(k)) ?? choices[0];
}
