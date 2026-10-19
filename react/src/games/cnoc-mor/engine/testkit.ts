// Helpers for tests: build positions from a picture of the hill.
import type { Piece, Side, State } from "./rules";

const CODE: Record<string, Piece> = { ".": 0, S: 1, L: 2, R: 3, C: 4 };
/** rows: 9 strings of 9 characters, top row (rank 9) first. S spearman, L Lord, R rider, C chariot. */
export function pos(rows: string[], turn: Side = 0, rh = 0, rs = 0, ply = 0): State {
  const b = rows.join("").replace(/\s/g, "").split("").map(ch => CODE[ch]);
  if (b.length !== 81) throw new Error("need 81 holes");
  return { b, turn, rh, rs, ply };
}
/** "e5" -> 40 */
export const at = (sq: string) => (9 - Number(sq[1])) * 9 + (sq.charCodeAt(0) - 97);
export const EMPTY_ROW = ".........";
/** A picture with just a few pieces: { e5: "L", a1: "R" }. */
export function sparse(pieces: Record<string, string>, turn: Side = 0, rh = 0, rs = 0, ply = 0): State {
  const rows = Array.from({ length: 9 }, () => EMPTY_ROW.split(""));
  for (const [sq, ch] of Object.entries(pieces)) {
    const i = at(sq);
    rows[(i / 9) | 0][i % 9] = ch;
  }
  return pos(rows.map(r => r.join("")), turn, rh, rs, ply);
}
