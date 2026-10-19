// A whole game of Cnoc Mór as plain data, with pure transitions. The UI, the review and the
// simulator all drive the game through these functions.
import {
  CH, DROP, LETTER, LO, PLY_LIMIT, RES_H, RES_S, RI, SP, apply, emptyState, from, gen, key, sqName, to, total, zoneOk,
  type Move, type Piece, type Side, type State, type WinReason,
} from "./rules";

export type Phase = "place" | "play";
export interface Last { from?: number; to: number }
export type Trays = Record<Side, Partial<Record<Piece, number>>>;
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
}

/** Setup: one piece at a time, Host first, five each. */
export const ORDER: Side[] = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
export const PLACEMENTS = ORDER.length;
export const freshTrays = (): Trays => ({ 0: { [LO]: 1, [SP]: 4 }, 1: { [CH]: 1, [RI]: 4 } });

export function newGame(): Game {
  return {
    s: emptyState(), phase: "place", placed: 0, trays: freshTrays(), history: [],
    winner: null, why: null, last: null,
  };
}

/** Who sets the next piece during setup (always their own). */
export const placer = (g: Game): Side => ORDER[g.placed];
/** Who acts next: the setter during setup, the side to move in play. */
export const actor = (g: Game): Side => (g.phase === "place" ? placer(g) : g.s.turn);

export function seenMap(g: Game): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of g.history) if (h.phase === "play") m.set(key(h.s), (m.get(key(h.s)) || 0) + 1);
  if (g.phase === "play") m.set(key(g.s), (m.get(key(g.s)) || 0) + 1);
  return m;
}

export const moveNote = (s: State, m: Move) => {
  const f = from(m), t = to(m);
  if (f === DROP) return `${s.turn === 0 ? "S" : "R"} in at ${sqName(t)}`;
  return `${LETTER[s.b[f]]} ${sqName(f)}${s.b[t] ? "×" : "–"}${sqName(t)}`;
};

const cloneTrays = (t: Trays): Trays => ({ 0: { ...t[0] }, 1: { ...t[1] } });

/** Set a piece during the setup phase. */
export function placePiece(g: Game, i: number, piece: Piece): Game {
  const side = placer(g);
  const entry: HistoryEntry = { s: g.s, phase: g.phase, placed: g.placed, trays: g.trays, note: `${LETTER[piece]} ${sqName(i)}`, by: side, last: g.last };
  const b = g.s.b.slice(); b[i] = piece;
  const trays = cloneTrays(g.trays);
  trays[side][piece] = (trays[side][piece] ?? 0) - 1;
  const placed = g.placed + 1;
  return {
    ...g, s: { b, turn: 0, rh: RES_H, rs: RES_S, ply: 0 }, trays, placed,
    phase: placed >= PLACEMENTS ? "play" : "place",
    history: [...g.history, entry], last: { to: i },
  };
}

/** May this piece go in this hole right now? */
export const canPlace = (g: Game, i: number) => g.phase === "place" && !g.s.b[i] && zoneOk(placer(g), i);

/** Play a move, then settle wins, no-move losses, third repetitions and the move limit. */
export function playMove(g: Game, m: Move): Game {
  const before = g.s;
  const entry: HistoryEntry = { s: before, phase: "play", placed: g.placed, trays: g.trays, note: moveNote(before, m), by: before.turn, last: g.last };
  const t = apply(before, m);
  const s: State = { b: t.b, turn: t.turn, rh: t.rh, rs: t.rs, ply: t.ply };
  const next: Game = { ...g, s, history: [...g.history, entry], last: { from: from(m), to: to(m) } };
  if (t.res) return { ...next, winner: (t.res - 1) as Side, why: t.why };
  if (!gen(s).length) return { ...next, winner: before.turn, why: "nomove" };
  const seen = seenMap(next);
  if ((seen.get(key(s)) || 0) >= 3) {
    const nh = total(s, 0), ns = total(s, 1);
    return { ...next, winner: nh < ns ? 0 : ns < nh ? 1 : -1, why: "repeat" };
  }
  if (s.ply >= PLY_LIMIT) return { ...next, winner: -1, why: "long" };
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

/** The pieces the setter still holds, special piece second. */
export const trayKinds = (side: Side): Piece[] => (side === 0 ? [SP, LO] : [RI, CH]);
/** The piece a tap on the board sets: the picked one if any are left, else plain pieces first. */
export function pieceToSet(g: Game, pick: Piece | null): Piece {
  const side = placer(g), tr = g.trays[side];
  if (pick && tr[pick]) return pick;
  return side === 0 ? (tr[SP] ? SP : LO) : (tr[RI] ? RI : CH);
}
