import { describe, expect, it } from "vitest";
import { BIG, OUTCOMES, bestPlan, bestToastTarget, evaluate, plans, threatened, treasonVictim } from "./ai";
import { MEAD, WINE, move, newState, sq, withDice } from "./rules";
import { at, pos, seeded } from "./testkit";

const E = ".......";

describe("plans", () => {
  it("cover all 21 distinct rolls with total chance 1", () => {
    expect(OUTCOMES).toHaveLength(21);
    expect(OUTCOMES.reduce((t, [, , p]) => t + p, 0)).toBeCloseTo(1);
  });
  it("use both dice when that is possible, with two different cups", () => {
    const s = withDice(newState(2), [1, 2]);
    const ps = plans(s);
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.steps).toHaveLength(2);
      expect(p.steps[1][1]).not.toBe(p.steps[0][2]);
    }
  });
  it("fall back to one die when only one can move", () => {
    // A lone mead cup on a1 under a wine cup on a3: a double 6 can only go along the row once.
    const s = withDice(pos([E, E, E, E, "W......", E, "M......"], { queen: 2 }), [6, 6]);
    const ps = plans(s);
    expect(ps.length).toBe(1);
    expect(ps[0].steps.map(([, f, t]) => sq(f) + sq(t))).toEqual(["a1g1"]);
  });
  it("continue with the die that is left", () => {
    const s0 = withDice(newState(2), [1, 3]);
    const s = move(s0, 0, at("d1"), at("d2")).s;
    const ps = plans(s);
    expect(ps.every(p => p.steps.length === 1 && p.steps[0][0] === 1 && p.steps[0][1] !== at("d2"))).toBe(true);
  });
});

describe("the computer", () => {
  it("scores a won game as BIG and a lost one as -BIG", () => {
    const s = { ...newState(8), winner: MEAD as 1 };
    expect(evaluate(s, MEAD, true)).toBe(BIG);
    expect(evaluate(s, WINE, true)).toBe(-BIG);
  });
  it("drinks the last cup it needs to win, at every level", () => {
    // Wine's jug is dry: trapping c4 wins.
    const s = pos([E, E, E, ".MW....", E, "......M", "...M..."], { dice: [3, 1], used: [false, false], jug: { 1: 4, 2: 0 }, queen: 2 });
    for (const lvl of [1, 2, 3] as const) {
      for (let k = 0; k < 5; k++) {
        const plan = bestPlan(s, lvl, seeded(k))!;
        expect(plan.s.winner).toBe(MEAD);
      }
    }
  });
  it("prefers a capture when one is on offer", () => {
    const s = pos([E, E, E, ".MW....", E, E, "...M..M"], { dice: [3, 2], used: [false, false], queen: 2 });
    const plan = bestPlan(s, 3, seeded(1))!;
    expect(plan.s.drinks[MEAD]).toBe(1);
  });
  it("with an empty jug, steps out of a trap rather than leaving a cup to be drunk", () => {
    // Wine could move e7 down to e4 and trap mead's d4 against c4.
    const s = pos(["....W..", E, E, "..WM...", E, E, "M......"], { dice: [1, 1], used: [false, false], jug: { 1: 0, 2: 4 }, queen: 2, turn: MEAD });
    expect(threatened(s.b, MEAD).has(at("d4"))).toBe(true);
    for (const lvl of [2, 3] as const) {
      const plan = bestPlan(s, lvl, seeded(3))!;
      expect(threatened(plan.s.b, MEAD).size).toBe(0);
    }
  });
  it("is deterministic with a seeded rng", () => {
    const s = withDice(newState(2), [2, 5]);
    const a = bestPlan(s, 1, seeded(42))!.steps, b = bestPlan(s, 1, seeded(42))!.steps;
    expect(a).toEqual(b);
  });
  it("toasts away the rival cup that threatens it most", () => {
    // Wine's e7 cup can drop to e4 and trap d4 against c4. Drinking either ends the threat;
    // c4 is the more advanced of the two, so it goes.
    const s = pos(["....W.W", E, E, "..WM...", E, E, "M......"], { dice: [1, 1], turn: MEAD, queen: 2 });
    expect(bestToastTarget(s, seeded(1))).toBe(at("c4"));
  });
  it("picks a treason victim among the roller's own cups", () => {
    const s = withDice(newState(8), [4, 4]);
    expect(s.b[treasonVictim(s, seeded(5))]).toBe(MEAD);
  });
});
