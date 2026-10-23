// Monsiv online: the adapter that lets the shared online code replay and referee a game.
// The position is the engine's Game (board, history for the no-repeat rule, winner and reason);
// a move is a small plain object that maps one-to-one onto the engine's [kind, a, b] move.
import type { OnlineAdapter, OnlineResult } from "../../online/types";
import { sameMove, type Move } from "./engine/core";
import { legalMoves, newGame, playMove, who, winText, type Game } from "./engine/game";

export type MonsivSeat = "white" | "black";
/** A step (or capture) from `from` to `to`, or, with swap, two neighbouring own pieces trading places. */
export interface OnlineMove { from: number; to: number; swap: boolean }
/** Monsiv has no options; an empty map keeps the invite format (and the security rules) happy. */
export type MonsivOptions = Record<string, never>;

/** The engine move for an online move (swaps are stored lowest square first). */
export function toEngine(m: OnlineMove): Move {
  return m.swap ? [1, Math.min(m.from, m.to), Math.max(m.from, m.to)] : [0, m.from, m.to];
}
export const fromEngine = (m: Move): OnlineMove => ({ from: m[1], to: m[2], swap: m[0] === 1 });

const isSquare = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 25;
const wellFormed = (m: unknown): m is OnlineMove => {
  const o = m as OnlineMove | null;
  return !!o && typeof o === "object" && isSquare(o.from) && isSquare(o.to) && typeof o.swap === "boolean";
};

export const seatOf = (turn: number): MonsivSeat => (turn === 0 ? "white" : "black");

export const monsivOnline: OnlineAdapter<Game, OnlineMove, MonsivOptions> = {
  game: "monsiv",
  seats: [{ id: "white", label: "White" }, { id: "black", label: "Black" }],
  defaultOptions: {},
  start: () => newGame(),
  seatToAct: g => (g.winner !== null ? null : seatOf(g.s.turn)),
  legal(g, m) {
    if (!wellFormed(m) || g.winner !== null) return false;
    const em = toEngine(m);
    return legalMoves(g).some(x => sameMove(x, em));
  },
  apply: (g, m) => playMove(g, toEngine(m)),
  result(g): OnlineResult | null {
    if (g.winner === null || !g.reason) return null;
    return { winner: seatOf(g.winner), text: `${who(g.winner)} ${winText(g.reason)}.` };
  },
};
