// Cnoc online: the adapter that lets src/online replay and referee a game from its list of moves.
// The position is the engine's own Game (history included, so the review works on it too).
import type { OnlineAdapter, OnlineResult, SeatId } from "../../online/types";
import {
  actor, currentSlot, newGame, phalanxOffer, placePiece, playMove, rulesOf, trayChoices, type Game,
} from "./engine/game";
import { NN, gen, mv, sideName, type Piece, type Side } from "./engine/rules";
import { slotZone } from "./engine/setup";
import { why } from "./text";

export interface CnocOptions {
  /** Sí turns the summit must be held (two fewer in the rival's setup). */
  holdN: 7 | 8;
  /** "Set your rival's" setup. */
  swap: boolean;
  /** The combining variant (Phalanx and merging Riders). */
  combine: boolean;
}

/**
 * One action, as stored in the game document.
 * Setup: `{ at, k }` sets piece k on hole at; `ph: 1` (combining, rival's setup, with the Host's Lord)
 * also brings a Phalanx for the Sí to set. Play: `{ f, t }` moves from hole f to hole t.
 * Plain objects, never nested arrays (Firestore can't store an array inside an array).
 */
export type CnocMove = { at: number; k: number; ph?: 1 } | { f: number; t: number };

export const SEATS: { id: SeatId; label: string }[] = [{ id: "host", label: "Host" }, { id: "si", label: "Sí" }];
export const seatOf = (side: Side): SeatId => (side === 0 ? "host" : "si");
export const sideOfSeat = (seat: SeatId | null): Side | null => (seat === "host" ? 0 : seat === "si" ? 1 : null);

const isHole = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < NN;
const isObj = (m: unknown): m is Record<string, unknown> => typeof m === "object" && m !== null && !Array.isArray(m);
const sameKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every(k => keys.includes(k));

export const optionsOk = (o: unknown): o is CnocOptions =>
  isObj(o) && (o.holdN === 7 || o.holdN === 8) && typeof o.swap === "boolean" && typeof o.combine === "boolean";

export function legalMove(g: Game, m: CnocMove): boolean {
  if (g.winner !== null || !isObj(m)) return false;
  if ("at" in m) {
    if (g.phase !== "place" || !sameKeys(m, ["at", "k", "ph"]) || !isHole(m.at) || g.s.b[m.at]) return false;
    if (!slotZone(currentSlot(g), m.at) || !trayChoices(g).includes(m.k as Piece)) return false;
    if (m.ph !== undefined && !(m.ph === 1 && g.swap && phalanxOffer(g))) return false;
    return true;
  }
  if ("f" in m) {
    if (g.phase !== "play" || !sameKeys(m, ["f", "t"]) || !isHole(m.f) || !isHole(m.t)) return false;
    return gen(g.s, rulesOf(g)).includes(mv(m.f, m.t));
  }
  return false;
}

export function applyMove(g: Game, m: CnocMove): Game {
  return "at" in m ? placePiece(g, m.at, m.k as Piece, m.ph === 1) : playMove(g, mv(m.f, m.t));
}

export function gameResult(g: Game): OnlineResult | null {
  if (g.winner === null) return null;
  return { winner: g.winner === -1 ? null : seatOf(g.winner), text: why(g.why) };
}

export const cnocOnline: OnlineAdapter<Game, CnocMove, CnocOptions> = {
  game: "cnoc",
  seats: SEATS,
  defaultOptions: { holdN: 7, swap: false, combine: false },
  describeOptions: o =>
    [`hold ${o.swap ? o.holdN - 2 : o.holdN} turns`, o.swap ? "set your rival's pieces" : "set your own pieces", o.combine ? "combining pieces" : "standard pieces"].join(" · "),
  start: o => newGame(optionsOk(o) ? { holdN: o.holdN, swap: o.swap, combine: o.combine } : {}),
  seatToAct: g => (g.winner !== null ? null : seatOf(actor(g))),
  legal: legalMove,
  apply: applyMove,
  result: gameResult,
};

/** "the Host" / "the Sí" for a seat. */
export const seatName = (seat: SeatId | null) => { const s = sideOfSeat(seat); return s === null ? "" : `the ${sideName(s)}`; };
