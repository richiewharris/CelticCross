// Helpers for tests: build positions from a picture of the board.
import type { Piece, Side, State } from "./rules";

const CODE: Record<string, Piece> = { ".": 0, S: 1, L: 2, R: 3, C: 4 };
/** rows: 7 strings of 7 characters, top row first. S spearman, L Lord, R rider, C chariot. */
export function pos(rows: string[], turn: Side = 0, hold = 0): State {
  const b = rows.join("").replace(/\s/g, "").split("").map(ch => CODE[ch]);
  if (b.length !== 49) throw new Error("need 49 holes");
  return { b, turn, hold };
}
export const at = (sq: string) => (7 - Number(sq[1])) * 7 + (sq.charCodeAt(0) - 97);
