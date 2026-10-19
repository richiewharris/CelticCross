import { describe, expect, it } from "vitest";
import { LEVELS, evalWhite, search } from "./ai";
import { rng, type Move } from "./core";
import { fromState, newGame, playMove, type Game } from "./game";
import { at, pos } from "./testkit";

const env = { random: rng(7) };
const step = (a: string, b: string): Move => [0, at(a), at(b)];

describe("the computer", () => {
  it.each([1, 2, 3] as const)("level %i takes the Throne when it can", lvl => {
    const s = pos([".....", ".....", "..t..", "..C..", "T...."]);
    expect(search(s, [s], { ...LEVELS[lvl], ms: 3000 }, env)).toEqual(step("c2", "c3"));
  });
  it.each([1, 2, 3] as const)("level %i reaches the far row when it can", lvl => {
    const s = pos(["....t", ".....", ".....", ".c...", "T...."], 8);
    expect(search(s, [s], { ...LEVELS[lvl], ms: 3000 }, env)).toEqual(step("b2", "b1"));
  });
  it.each([2, 3] as const)("level %i stops a Cross about to reach its far row", lvl => {
    // Black's Cross on b2 threatens b1; only the Angel on a1 can take it.
    const s = pos(["..t..", ".....", ".....", ".c...", "A...T"]);
    expect(search(s, [s], { ...LEVELS[lvl], ms: 3000 }, env)).toEqual(step("a1", "b2"));
  });
  it("likes advanced pieces and a guarded Throne", () => {
    expect(evalWhite(newGame().s.b)).toBeCloseTo(0);
    const ahead = pos(["actac", ".....", "C....", ".....", ".ATCA"]); // the a1 Cross pushed to a3
    expect(evalWhite(ahead.b)).toBeGreaterThan(0);
  });
  it("finishes games against itself", () => {
    let g: Game = newGame();
    for (let k = 0; k < 200 && g.winner === null; k++) {
      const m = search(g.s, g.history.map(h => h.s).concat([g.s]), { depth: 2, ms: 1000, noise: 14 }, env);
      expect(m).not.toBe(null);
      g = playMove(g, m!);
    }
    expect(g.winner).not.toBe(null);
  });
  it("plays from an arbitrary position", () => {
    const g = fromState(pos(["actac", ".....", ".....", ".....", "CATCA"]));
    expect(search(g.s, [g.s], { depth: 1, ms: 100, noise: 0 }, env)).not.toBe(null);
  });
});
