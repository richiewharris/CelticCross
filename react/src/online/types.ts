// Shared shapes for online play. A game is one Firestore document holding the options, who sits
// where, and the list of moves; every browser rebuilds the position by replaying the moves through
// the game's own rules engine, so the rules on the page are the referee.

export type SeatId = string;

export interface OnlineResult {
  /** The seat that won, or null for a draw. */
  winner: SeatId | null;
  /** How it ended, in words ("The Lord stands on the summit."). */
  text: string;
  /** Set when a player resigned. */
  resigned?: SeatId;
  /** Set when a move failed the rules check on replay. */
  illegalAt?: number;
}

export interface OnlineDoc<M = unknown, O = unknown> {
  v: 1;
  game: string;
  options: O;
  /** Who sits in each seat (uid), or null while the seat is empty. */
  seats: Record<SeatId, string | null>;
  /** The uids of everyone seated, for the "your games" query and the security rules. */
  players: string[];
  creator: string;
  status: "open" | "active" | "done";
  moves: M[];
  /** The seat that acts first; when the last seat fills, `turn` becomes that seat's player. */
  firstSeat: SeatId;
  /** The uid that acts next, or null before the game starts and after it ends. */
  turn: string | null;
  result: OnlineResult | null;
  /** After the game: the id of the rematch game, once a player offers one. */
  next: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OnlineGameSummary { id: string; doc: OnlineDoc }

/** What a game must provide to be played online. S = position, M = move (plain JSON), O = options. */
export interface OnlineAdapter<S, M, O> {
  game: string;
  seats: { id: SeatId; label: string }[];
  defaultOptions: O;
  /** A short line describing the options, for the invite ("Hold 7 · Set your own pieces"). */
  describeOptions?(o: O): string;
  start(o: O): S;
  /** The seat that acts next, or null when the game is over. */
  seatToAct(s: S): SeatId | null;
  legal(s: S, m: M): boolean;
  apply(s: S, m: M): S;
  /** The result once the game is over, else null. */
  result(s: S): OnlineResult | null;
}

export interface Replay<S> {
  s: S;
  /** Index of the first move that broke the rules, if any (the position stops before it). */
  illegalAt: number | null;
}

/** Rebuild the position from the moves, checking each one against the rules. */
export function replay<S, M, O>(a: OnlineAdapter<S, M, O>, doc: Pick<OnlineDoc<M, O>, "options" | "moves">): Replay<S> {
  let s = a.start(doc.options);
  for (let i = 0; i < doc.moves.length; i++) {
    const m = doc.moves[i];
    if (a.seatToAct(s) === null || !a.legal(s, m)) return { s, illegalAt: i };
    s = a.apply(s, m);
  }
  return { s, illegalAt: null };
}
