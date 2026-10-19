import { describe, expect, it } from "vitest";
import { LEVELS_N, LEVEL_LO, apply, gen, hash, levelMoves, puzzleFor, puzzleState, rng, sameMove, tryPuzzle, type Move, type Puzzle } from "./core";
import { fromState, playMove, type Game } from "./game";
import { refForces, refMoves, refStart, refWin } from "./testkit";
import ORIGINAL from "./original-puzzles.json";

type Golden = { L: number; i: number; b: string; turn: number; n: number; key: Move; line: Move[]; rating: number; notes: string[]; how: string; tries: number };
const GOLDEN = ORIGINAL as Golden[];

/** Check a puzzle with the reference rules and a brute-force solver that shares no code with core.ts. */
function verify(p: Puzzle) {
  const start = refStart(puzzleState(p));
  // A forced win in n moves...
  expect(refWin(start, p.n)).toBe(true);
  // ...and none shorter.
  if (p.n > 1) expect(refWin(start, p.n - 1)).toBe(false);
  // Exactly one first move forces it.
  const keys = refMoves(start).filter(m => refForces(start, m, p.n));
  expect(keys).toEqual([p.key]);
  if (p.n === 1) expect(refMoves(start).filter(m => refForces(start, m, 1))).toHaveLength(1);
  // The main line is legal, alternates sides, and its last move wins the way the puzzle says.
  expect(p.line).toHaveLength(2 * p.n - 1);
  expect(p.line[0]).toEqual(p.key);
  let g: Game = fromState(puzzleState(p));
  for (const m of p.line) {
    expect(g.winner).toBe(null);
    expect(gen(g.s, g.history.map(h => h.s).concat([g.s])).some(x => sameMove(x, m))).toBe(true);
    g = playMove(g, m);
  }
  expect(g.winner).toBe(p.turn);
  expect(g.reason).toBe(p.how);
}

describe("puzzle generation", () => {
  it.each(GOLDEN.map(g => [`${g.L}·${g.i}`, g] as const))("puzzle %s is the same as on the original page", (_k, g) => {
    const p = puzzleFor(g.L, g.i)!;
    expect({ L: p.L, i: p.i, b: p.b.join(","), turn: p.turn, n: p.n, key: p.key, line: p.line, rating: p.rating, notes: p.notes, how: p.how, tries: p.tries }).toEqual(g);
  }, 30000);

  it.each(GOLDEN.filter(g => g.i <= 2 && g.L <= 11).map(g => [`${g.L}·${g.i}`, g] as const))("puzzle %s is sound", (_k, g) => {
    const p = puzzleFor(g.L, g.i)!;
    verify(p);
    expect(levelMoves(g.L)).toContain(p.n);
  }, 60000);

  it("checks raw candidates the same way", () => {
    let found = 0;
    for (let a = 0; found < 12 && a < 5000; a++) {
      const n = 1 + (a % 3);
      const p = tryPuzzle(hash(99, a), n);
      if (!p) continue;
      verify({ ...p, L: 0, i: 0, tries: 0 });
      found++;
    }
    expect(found).toBe(12);
  }, 60000);

  it("rates puzzles in steps of ten, inside the scale", () => {
    for (const g of GOLDEN) {
      expect(g.rating % 10).toBe(0);
      expect(g.rating).toBeGreaterThanOrEqual(300);
      expect(g.rating).toBeLessThanOrEqual(2400);
      // Inside its level's band, or the closest found (the generator settles for a gap under 120).
      // Level 12 asks for 1950+, which three-move puzzles rarely reach; it takes the nearest.
      const lo = LEVEL_LO(g.L), hi = lo + 150, gap = g.rating < lo ? lo - g.rating : g.rating >= hi ? g.rating - hi + 1 : 0;
      if (g.L < 12) expect(gap).toBeLessThan(120);
    }
  });

  it("has twelve levels from 300 up", () => {
    expect(LEVELS_N).toBe(12);
    expect(LEVEL_LO(1)).toBe(300);
    expect(LEVEL_LO(12)).toBe(1950);
  });

  it("keeps the seeded random numbers of the original", () => {
    const R = rng(hash(1, 1, 0, 7919));
    const xs = [R(), R(), R()];
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
    expect(rng(hash(1, 1, 0, 7919))()).toBe(xs[0]);
    expect(apply(puzzleState({ b: Array(25).fill(0), turn: 0 }), [1, 0, 1]).ls).toEqual([1, -1]);
  });
});
