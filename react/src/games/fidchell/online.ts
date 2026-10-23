// Fidchell online: the adapter that lets the shared online code replay and check a game.
// A move is { f, t }: the square a peg leaves and the square it lands on (0-24, row by row from
// the top, as in the engine). Not [f, t]: Firestore can't store arrays inside the moves array.
import type { OnlineAdapter, OnlineResult } from "../../online/types";
import type { HistoryEntry } from "./engine/game";
import { noteFor } from "./engine/game";
import { GOLD, N, NAME, QUIET_LIMIT, genMoves, initial, play, type Move, type Side, type State } from "./engine/rules";

export interface OnlineMove { f: number; t: number }
export type FidchellOptions = Record<string, never>;
export type FidchellSeat = "gold" | "white";

export const seatOf = (side: Side): FidchellSeat => (side === GOLD ? "gold" : "white");
export const sideOf = (seat: string | null | undefined): Side | null => (seat === "gold" ? 1 : seat === "white" ? 2 : null);
export const toMove = (m: OnlineMove): Move => [m.f, m.t];
export const fromMove = (m: Move): OnlineMove => ({ f: m[0], t: m[1] });

const isSquare = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < N * N;

/** Why a finished game ended, in the page's own words (after the winner's name). */
export function endWords(s: State): string {
  if (s.winner === 0) return `${QUIET_LIMIT} quiet moves with equal pieces.`;
  return s.reason === "reduced" ? "cut the other side down to one piece."
    : s.reason === "blocked" ? "left the other side with no move."
    : `held more pieces after ${QUIET_LIMIT} quiet moves.`;
}

export const fidchellOnline: OnlineAdapter<State, OnlineMove, FidchellOptions> = {
  game: "fidchell",
  seats: [{ id: "gold", label: "Gold" }, { id: "white", label: "White" }],
  defaultOptions: {},
  start: () => initial(),
  seatToAct: s => (s.winner !== null ? null : seatOf(s.turn)),
  legal(s, m) {
    if (s.winner !== null || !m || typeof m !== "object" || !isSquare(m.f) || !isSquare(m.t)) return false;
    return genMoves(s.b, s.turn).some(x => x[0] === m.f && x[1] === m.t);
  },
  apply: (s, m) => play(s, toMove(m)),
  result(s): OnlineResult | null {
    if (s.winner === null) return null;
    if (s.winner === 0) return { winner: null, text: endWords(s) };
    return { winner: seatOf(s.winner), text: `${NAME[s.winner]} ${endWords(s)}` };
  },
};

/** The move list as the page shows it, rebuilt from the online moves (stops at a bad move). */
export function historyOf(moves: readonly OnlineMove[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  let s = initial();
  for (const m of moves) {
    if (!fidchellOnline.legal(s, m)) break;
    out.push({ state: s, note: noteFor(s, toMove(m)), by: s.turn });
    s = play(s, toMove(m));
  }
  return out;
}
