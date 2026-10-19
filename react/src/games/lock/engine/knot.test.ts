import { describe, expect, it } from "vitest";
import {
  BITS, CROSSING, E, N, OPP, S_, TIERS, TIER_IDS, W, WC, countLoops, cwSteps, deal, looseEnds, makeKnot, minTurns,
  nb, pop, rank, rotCCW, rotCW, scramble, signedSteps, skillGain, solved, spareTurns, stepsTo, openedMessage,
} from "./knot";
import { geom, snapPhi, visible } from "./dial";
import { mulberry32 } from "./testkit";

describe("stone masks", () => {
  it("quarter turns cycle the four sides", () => {
    expect(rotCW(N)).toBe(E); expect(rotCW(E)).toBe(S_); expect(rotCW(S_)).toBe(W); expect(rotCW(W)).toBe(N);
    for (let m = 0; m < 16; m++) {
      expect(rotCCW(rotCW(m))).toBe(m);
      expect(rotCW(rotCW(rotCW(rotCW(m))))).toBe(m);
      expect(pop(rotCW(m))).toBe(pop(m));
    }
    expect(rotCW(CROSSING)).toBe(CROSSING);
    expect(rotCW(5)).toBe(10); // a straight flips between radial and around
  });
  it("counts the shortest way round", () => {
    expect(cwSteps(N | E, E | S_)).toBe(1);
    expect(signedSteps(N | E, W | N)).toBe(-1);
    expect(signedSteps(N | E, S_ | W)).toBe(2);
    expect(stepsTo(N | E, W | N)).toBe(1);
    expect(signedSteps(5, 5)).toBe(0);
  });
  it("neighbours wrap around the ring but stop at the hub and rim", () => {
    const R = 2, C = 6;
    expect(nb(0, W, R, C)).toBe(5);
    expect(nb(5, E, R, C)).toBe(0);
    expect(nb(0, S_, R, C)).toBe(-1);
    expect(nb(0, N, R, C)).toBe(6);
    expect(nb(7, N, R, C)).toBe(-1);
    expect(nb(7, S_, R, C)).toBe(1);
    for (let k = 0; k < R * C; k++) for (const b of BITS) {
      const j = nb(k, b, R, C);
      if (j >= 0) expect(nb(j, OPP[b], R, C)).toBe(k);
    }
  });
});

describe("solved and loose ends", () => {
  it("concentric rings are a solved knot of one strand per ring", () => {
    const m = new Array(12).fill(E | W);
    expect(solved(m, 2, 6)).toBe(true);
    expect(looseEnds(m, 2, 6)).toEqual([]);
    expect(countLoops(m, 2, 6)).toBe(2);
  });
  it("a strand running into the hub or off the rim is loose", () => {
    const m = new Array(12).fill(E | W);
    m[0] = S_ | W; // runs into the hub; its east neighbour now has a loose west end
    expect(solved(m, 2, 6)).toBe(false);
    expect(looseEnds(m, 2, 6)).toEqual(expect.arrayContaining([[0, S_], [1, W]]));
    const n = new Array(12).fill(E | W);
    n[7] = N | W;
    expect(looseEnds(n, 2, 6)).toEqual(expect.arrayContaining([[7, N], [8, W]]));
  });
});

describe("knot generation", () => {
  for (const t of TIER_IDS) {
    it(`${TIERS[t].name}: knots are closed, varied and keep to the rules`, () => {
      const T = TIERS[t], n = T.rings * T.sectors;
      for (let seed = 1; seed <= 60; seed++) {
        const m = makeKnot(T, mulberry32(seed * 7 + t));
        expect(m).toHaveLength(n);
        expect(solved(m, T.rings, T.sectors)).toBe(true);
        for (const x of m) expect([2, 4]).toContain(pop(x));
        const crossings = m.filter(x => x === 15).length;
        if (T.rings >= 3) expect(crossings).toBeGreaterThanOrEqual(1);
        else expect(crossings).toBe(0); // two rings never allow one: it would need 4 open sides
        expect(crossings).toBeLessThanOrEqual(n * .3);
        expect(m.filter(x => x !== 15 && x !== 5 && x !== 10).length).toBeGreaterThanOrEqual(n * .35);
        expect(countLoops(m, T.rings, T.sectors)).toBeLessThanOrEqual(2);
      }
    });
  }
  it("is deterministic for a seeded rng", () => {
    expect(makeKnot(TIERS[4], mulberry32(9))).toEqual(makeKnot(TIERS[4], mulberry32(9)));
  });
});

describe("dealing a lock", () => {
  for (const t of TIER_IDS) {
    it(`${TIERS[t].name}: every lock is unsolved and solvable within its stated turns`, () => {
      const T = TIERS[t];
      for (let seed = 1; seed <= 150; seed++) {
        const rng = mulberry32(seed * 31 + t);
        const sol = makeKnot(T, rng);
        for (const skill of [0, 20, 55, 100]) {
          const d = deal(t, sol, skill, rng);
          expect(solved(d.cur, T.rings, T.sectors)).toBe(false);
          // crossings never move
          d.cur.forEach((c, k) => { if (sol[k] === 15) expect(c).toBe(15); });
          // every stone is a turn of the knot's stone
          d.cur.forEach((c, k) => { expect([0, 1, 2, 3].map(i => { let x = sol[k]; for (let j = 0; j < i; j++) x = rotCW(x); return x; })).toContain(c); });
          const need = minTurns(d.cur, sol);
          expect(d.budget).toBeGreaterThan(need);
          // play it out the way the Cheat badges say: it closes in exactly `need` turns
          const cur = d.cur.slice();
          let used = 0;
          for (let k = 0; k < cur.length; k++) {
            const s = signedSteps(cur[k], sol[k]);
            for (let i = 0; i < Math.abs(s); i++) { cur[k] = s > 0 ? rotCW(cur[k]) : rotCCW(cur[k]); used++; }
          }
          expect(used).toBe(need);
          expect(used).toBeLessThanOrEqual(d.budget);
          expect(solved(cur, T.rings, T.sectors)).toBe(true);
          // the dial starts with a sector centred in the window
          const g = geom(t);
          expect(snapPhi(g, d.phi)).toBeCloseTo(d.phi, 9);
          expect(d.phi).toBeLessThanOrEqual(WC);
        }
      }
    });
  }
  it("turns about the tier's number of stones", () => {
    for (const t of TIER_IDS) {
      const T = TIERS[t];
      for (let seed = 1; seed <= 40; seed++) {
        const rng = mulberry32(seed);
        const sol = makeKnot(T, rng);
        const cur = scramble(sol, T, rng);
        const moved = cur.filter((c, k) => c !== sol[k]).length;
        expect(moved).toBeGreaterThanOrEqual(1);
        expect(moved).toBeLessThanOrEqual(T.turned + 1);
      }
    }
  });
});

describe("skill", () => {
  it("spare turns grow with skill and shrink with the tier, never below one", () => {
    const lo = () => 0, hi = () => .999;
    expect(spareTurns(20, 2, lo)).toBe(2);       // round(2 + 1.43 - 1.2) = 2
    expect(spareTurns(100, 1, hi)).toBe(10);     // round(2 + 7.14 - .6 + 1)
    expect(spareTurns(0, 5, lo)).toBe(1);        // round(2 - 3) clamps to 1
    expect(spareTurns(80, 3, lo)).toBeGreaterThan(spareTurns(10, 3, lo));
  });
  it("ranks and gains follow the original table", () => {
    expect(rank(0)).toBe("Novice"); expect(rank(19)).toBe("Novice"); expect(rank(20)).toBe("Apprentice");
    expect(rank(40)).toBe("Journeyman"); expect(rank(60)).toBe("Adept"); expect(rank(100)).toBe("Master");
    expect(skillGain(20, 2, 3, false)).toBe(Math.round(4 + 1.5 - 20 / 30));
    expect(skillGain(20, 2, 3, true)).toBe(0);
    expect(skillGain(99, 5, 10, false)).toBe(1);
    expect(skillGain(100, 5, 10, false)).toBe(0);
    expect(skillGain(90, 1, 0, false)).toBe(1);
    expect(openedMessage(true, 0)).toMatch(/Practice lock/);
    expect(openedMessage(false, 4)).toBe("The box opens. Skill +4.");
    expect(openedMessage(false, 0)).toBe("The box opens.");
  });
});

describe("the window", () => {
  it("lets you turn only the stones whose middle is well inside the window", () => {
    const want: Record<number, number> = { 6: 1, 8: 3, 10: 3 }; // centres within ±58° of 3 o'clock
    for (const t of TIER_IDS) {
      const g = geom(t);
      const phi = WC - .5 * g.da;
      const shown = Array.from({ length: g.R * g.C }, (_, k) => k).filter(k => visible(g, k, phi)).length;
      expect(shown).toBe(want[g.C] * g.R);
      expect(visible(g, 0, phi)).toBe(true);
    }
  });
});
