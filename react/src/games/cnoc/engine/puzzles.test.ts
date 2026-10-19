import { describe, expect, it } from "vitest";
import { PUZZLES, checkTree, mainLine, puzzleStart } from "./puzzles";

describe("puzzles", () => {
  it("has 2- to 5-move puzzles for both sides", () => {
    expect(PUZZLES.filter(p => p.side === 0).length).toBeGreaterThan(20);
    expect(PUZZLES.filter(p => p.side === 1).length).toBeGreaterThan(20);
    expect(new Set(PUZZLES.map(p => p.n))).toEqual(new Set([2, 3, 4, 5]));
  });
  it.each(PUZZLES.map(p => [p.id, p] as const))("%s has a valid solution tree", (_id, p) => {
    expect(checkTree(puzzleStart(p), p.t, p.side)).toBe(true);
    expect(mainLine(p).length).toBe(2 * p.n - 1);
  });
});
