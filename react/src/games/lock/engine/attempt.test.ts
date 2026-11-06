import { describe, expect, it } from "vitest";
import { TIERS, TIER_IDS, deal, makeKnot, minTurns, rotCW, solved } from "./knot";
import { failAttempt, retryAttempt, startAttempt, touched, turnInAttempt, type Attempt } from "./attempt";
import { mulberry32 } from "./testkit";
import type { Deal } from "./knot";

const rotations = (m: number) => [m, rotCW(m), rotCW(rotCW(m)), rotCW(rotCW(rotCW(m)))];

/** Spend every turn on the first few turnable stones. */
function playOut(a: Attempt<Deal>): Attempt<Deal> {
  const ks = a.cur.map((m, k) => (m === 15 ? -1 : k)).filter(k => k >= 0);
  for (let i = 0; a.turnsLeft > 0; i++) a = turnInAttempt(a, ks[i % 3], i % 2 === 1)!;
  return a;
}

describe("an attempt at the dial", () => {
  for (const t of TIER_IDS) it(`${TIERS[t].name}: Retry after a failed try restores exactly the dealt stones and budget`, () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed * 7 + t);
      const sol = makeKnot(TIERS[t], rng), d = deal(t, sol, 40, rng);
      const dealtCur = d.cur.slice();
      let a = startAttempt(d);
      expect(touched(a)).toBe(false);
      a = playOut(a);
      expect(a.turnsLeft).toBe(0);
      expect(touched(a)).toBe(true);
      a = failAttempt(a);
      expect(a.failed).toBe(true);
      const r = retryAttempt(a);
      expect(r.cur).toEqual(dealtCur);
      expect(r.turnsLeft).toBe(d.budget);
      expect(r.budget).toBe(d.budget);
      expect(r.failed).toBe(false);
      expect(r.dealt).toBe(d);
      expect(touched(r)).toBe(false);
      // play never changed the deal itself, and the retry is a copy of it
      expect(d.cur).toEqual(dealtCur);
      expect(r.cur).not.toBe(d.cur);
    }
  });

  it("can't turn a stone while failed, out of turns, or on a crossing", () => {
    const rng = mulberry32(5);
    const sol = makeKnot(TIERS[4], rng), d = deal(4, sol, 20, rng);
    const a = startAttempt(d), k = a.cur.findIndex(m => m !== 15), x = a.cur.indexOf(15);
    expect(turnInAttempt(a, k, false)!.turnsLeft).toBe(a.turnsLeft - 1);
    expect(turnInAttempt(failAttempt(a), k, false)).toBeNull();
    expect(turnInAttempt({ ...a, turnsLeft: 0 }, k, false)).toBeNull();
    if (x >= 0) expect(turnInAttempt(a, x, false)).toBeNull();
  });

  it("Start over mid-attempt is the same as Retry: back to the deal", () => {
    const rng = mulberry32(9);
    const sol = makeKnot(TIERS[2], rng), d = deal(2, sol, 20, rng);
    let a = startAttempt(d);
    a = turnInAttempt(a, 0, false)!; a = turnInAttempt(a, 1, true)!;
    expect(retryAttempt(a)).toEqual(startAttempt(d));
  });

  for (const t of TIER_IDS) it(`${TIERS[t].name}: Scramble deals an unsolved arrangement of the same knot, budget refilled`, () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed * 11 + t);
      const sol = makeKnot(TIERS[t], rng), solCopy = sol.slice();
      const a = failAttempt(playOut(startAttempt(deal(t, sol, 40, rng))));
      const s = startAttempt(deal(t, sol, 40, rng));
      expect(sol).toEqual(solCopy);
      expect(solved(s.cur, TIERS[t].rings, TIERS[t].sectors)).toBe(false);
      s.cur.forEach((m, k) => expect(rotations(sol[k])).toContain(m));
      s.cur.forEach((m, k) => { if (sol[k] === 15) expect(m).toBe(15); });
      expect(s.turnsLeft).toBe(s.budget);
      expect(s.budget).toBeGreaterThan(minTurns(s.cur, sol));
      expect(s.failed).toBe(false);
      expect(a.failed).toBe(true);
    }
  });
});
