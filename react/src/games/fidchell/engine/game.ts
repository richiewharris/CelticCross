// A whole game: the position, the move list with notes, undo, and the text the page shows.
import type { LevelId } from "./ai";
import { MID, N, NAME, QUIET_LIMIT, at, capsOf, initial, play, sq, type Move, type Side, type State } from "./rules";

export type Mode = "cpu" | "pvp";
export interface HistoryEntry { state: State; note: string; by: Side }
export interface Game {
  state: State;
  history: HistoryEntry[];
  mode: Mode;
  /** The human's side against the computer. */
  side: Side;
  lvl: LevelId;
  /** Bumped by every new game, so the pieces don't glide back to the start. */
  round: number;
}

export const START_CURSOR = at(N - 1, MID);

export function newGame(mode: Mode, side: Side, lvl: LevelId, round = 0): Game {
  return { state: initial(), history: [], mode, side, lvl, round };
}

/** "a1–a3", "b2×b4", "c1×c3(2)". */
export function noteFor(s: State, m: Move): string {
  const caps = capsOf(s.b, m, s.turn);
  return sq(m[0]) + (caps.length ? "×" : "–") + sq(m[1]) + (caps.length > 1 ? `(${caps.length})` : "");
}

export function doMove(g: Game, m: Move): Game {
  const s = g.state;
  return { ...g, history: [...g.history, { state: s, note: noteFor(s, m), by: s.turn }], state: play(s, m) };
}

export const isOver = (g: Game) => g.state.winner !== null;

export function canUndo(g: Game): boolean {
  return g.history.length > 0 && !(g.mode === "cpu" && !g.history.some(x => x.by === g.side));
}

/** Take back one move, or against the computer, back to before the human's last move. */
export function undo(g: Game): Game {
  if (!g.history.length) return g;
  const history = g.history.slice();
  let h = history.pop()!;
  if (g.mode === "cpu") while (h.by !== g.side && history.length) h = history.pop()!;
  return { ...g, history, state: h.state };
}

export function statusText(g: Game, thinking: boolean): { text: string; tone: "" | "win" | "lose" } {
  const s = g.state;
  if (s.winner !== null) {
    const w = s.winner;
    const why = s.reason === "reduced" ? "cut the other side down to one piece" : s.reason === "blocked" ? "left the other side with no move" : `held more pieces after ${QUIET_LIMIT} quiet moves`;
    if (w === 0) return { text: `${QUIET_LIMIT} quiet moves with equal pieces. A draw.`, tone: "" };
    return { text: `${NAME[w]} wins: ${why}.`, tone: g.mode === "cpu" ? (w === g.side ? "win" : "lose") : "" };
  }
  if (thinking) return { text: "The computer is thinking…", tone: "" };
  if (g.mode === "cpu") return { text: `Your move (${NAME[g.side]})`, tone: "" };
  return { text: `${NAME[s.turn]} to move`, tone: "" };
}

export function hintText(over: boolean, humanTurn: boolean, selected: boolean, hints: boolean): string {
  if (over || !humanTurn) return "";
  if (selected) return "Tap a dot to move there. A red ring means that move captures. Tap the piece again to cancel.";
  return hints ? "Dashed red rings mark your pieces in danger. The arrow is a suggested move." : "Tap one of your pieces to see where it can go.";
}

/** Checks a stored game is still usable. */
export function validGame(v: unknown): v is Game {
  const g = v as Game | null;
  return !!g && !!g.state && Array.isArray(g.state.b) && g.state.b.length === N * N && Array.isArray(g.history)
    && (g.mode === "cpu" || g.mode === "pvp") && (g.side === 1 || g.side === 2) && [1, 2, 3].includes(g.lvl);
}
