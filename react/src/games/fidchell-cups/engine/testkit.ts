// Helpers for tests and the simulator: positions from a picture, a seeded RNG, scripted dice.
import { MEAD, N, WINE, newState, type Cell, type Piece, type Rng, type Side, type State } from "./rules";

/** rows: 7 strings of 7 characters, top row (row 7, wine's back row) first. M mead, W wine, . empty. */
export function pos(rows: string[], opts: Partial<Pick<State, "turn" | "queen" | "jug" | "drinks" | "quiet" | "dice" | "used" | "movedTo">> = {}): State {
  const cells = rows.join("").replace(/\s/g, "").split("");
  if (cells.length !== N * N) throw new Error("need 49 holes");
  const b: Cell[] = cells.map(ch => (ch === "M" ? MEAD : ch === "W" ? WINE : 0));
  const pieces: Piece[] = [];
  b.forEach((v, i) => { if (v) pieces.push({ id: pieces.length, side: v as Side, pos: i, alive: true }); });
  return { ...newState(opts.queen ?? 2), b, pieces, nextId: pieces.length, ...opts };
}
/** Square index from a name like "d1". */
export const at = (name: string) => (N - Number(name[1])) * N + (name.charCodeAt(0) - 97);

/** A small seeded generator (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** An RNG whose d6 rolls come out as the given faces, in order. */
export const dice = (...faces: number[]): Rng => { let k = 0; return () => (faces[k++ % faces.length] - 1) / 6 + 0.01; };
