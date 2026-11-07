import { describe, expect, it } from "vitest";
import { TIERS, minTurns, solved as dialSolved, type TierId } from "../engine/knot";
import { CUBE_TIERS, cubeGeom, solved as cubeSolved } from "../cube/engine";
import { minSwaps, solved as crossSolved } from "../engine/cross";
import {
  BONUS_TABLE, DEFAULT_OPTIONS, MINUTES, NEW_RUN, allowedSec, bonusCapSec, bonusFor, bonusOf, clockText, compareRuns,
  consistentRun, crossDeal, crossKnot, cubeDeal, cubeKnot, deadline, describeOptions, dialDeal, dialKnot, durationSec,
  failPenaltySec, failRun, finishRun, hashSeed, isRaceOptions, newSeed, outcome, penaltyOf, rankRuns, runEnded, runFollows,
  solveBonusSec, solveRun, timeLeftMs, type RaceOptions, type RaceRun,
} from "./engine";

const TIER_IDS: TierId[] = [1, 2, 3, 4, 5];
const opts = (o: Partial<RaceOptions> = {}): RaceOptions => ({ ...DEFAULT_OPTIONS, ...o });

describe("options", () => {
  it("recognises valid options and refuses anything else", () => {
    expect(isRaceOptions(DEFAULT_OPTIONS)).toBe(true);
    for (const minutes of MINUTES) for (const kind of ["dial", "cube", "cross"] as const) for (const tier of TIER_IDS)
      expect(isRaceOptions({ minutes, kind, tier, resets: "none", penalty: false, bonus: true })).toBe(true);
    expect(isRaceOptions({ ...DEFAULT_OPTIONS, minutes: 2 })).toBe(false);
    expect(isRaceOptions({ ...DEFAULT_OPTIONS, kind: "stack" })).toBe(false);
    expect(isRaceOptions({ ...DEFAULT_OPTIONS, tier: 6 })).toBe(false);
    expect(isRaceOptions({ ...DEFAULT_OPTIONS, resets: "some" })).toBe(false);
    expect(isRaceOptions({ ...DEFAULT_OPTIONS, penalty: 1 })).toBe(false);
    expect(isRaceOptions({ ...DEFAULT_OPTIONS, extra: 1 })).toBe(false);
    expect(isRaceOptions(null)).toBe(false);
  });
  it("describes them in words", () => {
    expect(describeOptions(opts({ minutes: 3, kind: "dial", tier: 3 }))).toBe("3 min · The dial · Silver · free resets · −30 s a failed try · +2 s a lock");
    expect(describeOptions(opts({ minutes: 1, kind: "cube", tier: 5, resets: "none", penalty: false, bonus: false })))
      .toBe("1 min · The cube · Ogham · no resets · no fail penalty · no solve bonus");
  });
});

describe("penalty and bonus tables", () => {
  it("a failed try costs 10 s per minute of race", () => {
    expect(MINUTES.map(failPenaltySec)).toEqual([10, 30, 50, 100]);
    expect(penaltyOf(opts({ minutes: 5 }))).toBe(50);
    expect(penaltyOf(opts({ minutes: 5, penalty: false }))).toBe(0);
  });
  it("a solve earns 1–5 s, more for longer races and harder locks", () => {
    for (const m of MINUTES) for (const t of TIER_IDS) {
      const b = solveBonusSec(m, t);
      expect(b).toBeGreaterThanOrEqual(1); expect(b).toBeLessThanOrEqual(5);
      if (t > 1) expect(b).toBeGreaterThanOrEqual(solveBonusSec(m, (t - 1) as TierId));
    }
    for (let i = 1; i < MINUTES.length; i++) for (const t of TIER_IDS)
      expect(BONUS_TABLE[MINUTES[i]][t - 1]).toBeGreaterThanOrEqual(BONUS_TABLE[MINUTES[i - 1]][t - 1]);
    expect(bonusOf(opts({ minutes: 10, tier: 5 }))).toBe(5);
    expect(bonusOf(opts({ minutes: 1, tier: 1 }))).toBe(1);
    expect(bonusOf(opts({ bonus: false }))).toBe(0);
  });
  it("caps the bonus at the race's length, so a clock never more than doubles", () => {
    for (const m of MINUTES) for (const t of TIER_IDS) {
      const o = opts({ minutes: m, tier: t });
      expect(bonusCapSec(o)).toBe(m * 60);
      expect(bonusFor(o, 100000)).toBe(m * 60);
      let r: RaceRun = NEW_RUN;
      for (let i = 0; i < 1000; i++) r = solveRun(o, r, 0, 0)!.run;
      expect(r.bonus).toBe(m * 60);
      expect(allowedSec(o, r)).toBe(2 * durationSec(o));
    }
    const o = opts({ minutes: 1, tier: 5 }); // 3 s a lock, 60 s cap: the 21st lock earns nothing
    expect(bonusFor(o, 20)).toBe(60);
    let r: RaceRun = NEW_RUN;
    for (let i = 0; i < 20; i++) r = solveRun(o, r, 0, 0)!.run;
    expect(solveRun(o, r, 0, 0)!.gained).toBe(0);
  });
});

describe("the clock", () => {
  const o = opts({ minutes: 1, tier: 2 }); // 60 s, −10 s a fail, +1 s a lock
  it("counts down from the race's length", () => {
    expect(timeLeftMs(o, NEW_RUN, 1000, 1000)).toBe(60000);
    expect(timeLeftMs(o, NEW_RUN, 1000, 31000)).toBe(30000);
    expect(timeLeftMs(o, NEW_RUN, 1000, 99000)).toBe(0);
    expect(runEnded(o, NEW_RUN, 1000, 60999)).toBe(false);
    expect(runEnded(o, NEW_RUN, 1000, 61000)).toBe(true);
  });
  it("adds the bonus for a solve and takes the penalty for a fail", () => {
    const s = solveRun(o, NEW_RUN, 0, 5000)!;
    expect(s.gained).toBe(1);
    expect(s.run).toMatchObject({ solves: 1, bonus: 1, fails: 0, penalty: 0 });
    expect(timeLeftMs(o, s.run, 0, 5000)).toBe(56000);
    const f = failRun(o, s.run, 0, 6000)!;
    expect(f.lost).toBe(10);
    expect(f.run).toMatchObject({ solves: 1, bonus: 1, fails: 1, penalty: 10 });
    expect(deadline(o, f.run, 0)).toBe(51000);
  });
  it("a penalty can end the run on the spot", () => {
    const f = failRun(o, NEW_RUN, 0, 55000)!;
    expect(runEnded(o, f.run, 0, 55000)).toBe(true);
    expect(timeLeftMs(o, f.run, 0, 55000)).toBe(0);
    expect(failRun(o, f.run, 0, 55001)).toBeNull();
    expect(solveRun(o, f.run, 0, 55001)).toBeNull();
    expect(finishRun(o, f.run, 0, 56000).finishedAt).toBe(50000);
  });
  it("nothing counts after the clock runs out or the run is finished", () => {
    expect(solveRun(o, NEW_RUN, 0, 60000)).toBeNull();
    expect(failRun(o, NEW_RUN, 0, 60000)).toBeNull();
    const done = finishRun(o, NEW_RUN, 0, 30000);
    expect(done).toMatchObject({ finished: true, finishedAt: 30000 });
    expect(solveRun(o, done, 0, 30001)).toBeNull();
    expect(finishRun(o, done, 0, 99999)).toBe(done);
    expect(finishRun(o, NEW_RUN, 0, 70000).finishedAt).toBe(60000);
  });
  it("with no penalty and no bonus the clock is just the race's length", () => {
    const p = opts({ minutes: 3, penalty: false, bonus: false });
    let r: RaceRun = NEW_RUN;
    r = failRun(p, r, 0, 1000)!.run; r = solveRun(p, r, 0, 2000)!.run; r = failRun(p, r, 0, 3000)!.run;
    expect(r).toMatchObject({ solves: 1, fails: 2, bonus: 0, penalty: 0 });
    expect(deadline(p, r, 0)).toBe(180000);
  });
  it("reads as m:ss, whole seconds, then tenths in the last ten", () => {
    expect(clockText(600000)).toBe("10:00");
    expect(clockText(65400)).toBe("1:05");
    expect(clockText(59999)).toBe("59");
    expect(clockText(9950)).toBe("9.9");
    expect(clockText(0)).toBe("0.0");
    expect(clockText(-5)).toBe("0.0");
  });
});

describe("run checks (as the security rules make them)", () => {
  const o = opts({ minutes: 3, tier: 4 }); // −30 s, +3 s
  it("accepts runs built by play and refuses made-up ones", () => {
    let r: RaceRun = NEW_RUN, prev = r;
    for (let i = 0; i < 30; i++) {
      r = (i % 4 === 3 ? failRun(o, r, 0, i * 1000)!.run : solveRun(o, r, 0, i * 1000)!.run);
      expect(consistentRun(o, r)).toBe(true);
      expect(runFollows(o, prev, r)).toBe(true);
      prev = r;
    }
    expect(consistentRun(o, { ...r, bonus: r.bonus + 1 })).toBe(false);
    expect(consistentRun(o, { ...r, penalty: 0 })).toBe(false);
    expect(consistentRun(o, { ...r, solves: 2.5 })).toBe(false);
    expect(consistentRun(o, { ...r, finished: true })).toBe(false); // no finishedAt
    expect(runFollows(o, r, { ...NEW_RUN })).toBe(false); // counts can't go down
    const fin = finishRun(o, r, 0, 1e9);
    expect(consistentRun(o, fin)).toBe(true);
    expect(runFollows(o, fin, solveRun(o, r, 0, 0)!.run)).toBe(false); // nothing after the finish
  });
});

describe("scoring", () => {
  it("more solves wins, then fewer failed tries, else a draw", () => {
    expect(outcome({ solves: 5, fails: 9 }, { solves: 4, fails: 0 })).toBe("a");
    expect(outcome({ solves: 4, fails: 2 }, { solves: 4, fails: 1 })).toBe("b");
    expect(outcome({ solves: 4, fails: 1 }, { solves: 4, fails: 1 })).toBe("draw");
    expect(compareRuns({ solves: 0, fails: 0 }, { solves: 0, fails: 0 })).toBe(0);
  });
  it("ranks a leaderboard, tied results sharing a place", () => {
    const list = [
      { n: "a", run: { solves: 3, fails: 1 } }, { n: "b", run: { solves: 5, fails: 2 } },
      { n: "c", run: { solves: 3, fails: 1 } }, { n: "d", run: { solves: 5, fails: 0 } }, { n: "e", run: { solves: 0, fails: 0 } },
    ];
    const r = rankRuns(list);
    expect(r.map(x => x.n)).toEqual(["d", "b", "a", "c", "e"]);
    expect(r.map(x => x.place)).toEqual([1, 2, 3, 3, 5]);
    expect(rankRuns([])).toEqual([]);
  });
});

describe("the seeded puzzle sequence", () => {
  it("hashes parts in order", () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(1, 3, 2));
    expect(hashSeed(0)).not.toBe(hashSeed(1));
    const s = newSeed(() => .5);
    expect(Number.isInteger(s) && s >= 0 && s < 2 ** 31).toBe(true);
  });

  for (const tier of TIER_IDS) {
    it(`dial, ${TIERS[tier].name}: same seed same locks, each lock (knot and deal) different, each deal openable within its budget`, () => {
      const T = TIERS[tier];
      for (const seed of [1, 987654321]) {
        const seen = new Set<string>();
        for (let i = 0; i < 6; i++) {
          const sol = dialKnot(tier, seed, i);
          expect(dialKnot(tier, seed, i)).toEqual(sol);
          expect(dialSolved(sol, T.rings, T.sectors)).toBe(true);
          const deals = [0, 1, 2].map(j => dialDeal(tier, sol, seed, i, j));
          seen.add(sol.join() + "|" + deals[0].cur.join());
          expect(dialDeal(tier, sol, seed, i, 1)).toEqual(deals[1]);
          expect(new Set(deals.map(d => d.cur.join() + d.phi)).size).toBeGreaterThan(1);
          for (const d of deals) {
            expect(dialSolved(d.cur, T.rings, T.sectors)).toBe(false);
            expect(minTurns(d.cur, sol)).toBeLessThan(d.budget);
            expect(d.cur.every((m, k) => (m === 15) === (sol[k] === 15))).toBe(true);
          }
        }
        expect(seen.size).toBe(6);
      }
      // Two-ring knots come from a small family and can repeat, but the deals differ.
      const lock = (seed: number) => { const sol = dialKnot(tier, seed, 0); return sol.join() + "|" + dialDeal(tier, sol, seed, 0, 0).cur.join(); };
      expect(lock(1)).not.toEqual(lock(2));
    });

    it(`cube, ${CUBE_TIERS[tier].name}: seeded locks, openable within budget`, () => {
      const g = cubeGeom(CUBE_TIERS[tier].N);
      const seen = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const sol = cubeKnot(tier, 42, i);
        expect(cubeKnot(tier, 42, i)).toEqual(sol);
        expect(cubeSolved(g, sol)).toBe(true);
        seen.add(sol.join() + "|" + cubeDeal(tier, sol, 42, i, 0).cur.join());
        for (const j of [0, 1]) {
          const d = cubeDeal(tier, sol, 42, i, j);
          expect(cubeDeal(tier, sol, 42, i, j)).toEqual(d);
          expect(cubeSolved(g, d.cur)).toBe(false);
          expect(minTurns(d.cur, sol)).toBeLessThan(d.budget);
          expect(d.orient).toBeGreaterThanOrEqual(0); expect(d.orient).toBeLessThan(24);
        }
      }
      expect(seen.size).toBe(3);
    });

    it(`classic cross, tier ${tier}: seeded locks, openable within budget`, () => {
      const seen = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const tiles = crossKnot(tier, 7, i);
        expect(crossKnot(tier, 7, i)).toEqual(tiles);
        expect(crossSolved(tiles, tiles.map((_, k) => k))).toBe(true);
        seen.add(JSON.stringify(tiles) + crossDeal(tier, tiles, 7, i, 0).arr.join());
        for (const j of [0, 1, 2]) {
          const d = crossDeal(tier, tiles, 7, i, j);
          expect(crossDeal(tier, tiles, 7, i, j)).toEqual(d);
          expect(crossSolved(tiles, d.arr)).toBe(false);
          expect(minSwaps(d.arr)).toBeLessThan(d.budget);
          // Swapping every stone home within the budget opens it.
          const a = d.arr.slice(); let used = 0;
          for (let c = 0; c < a.length; c++) while (a[c] !== c) { const t = a[c]; [a[c], a[t]] = [a[t], a[c]]; used++; }
          expect(used).toBeLessThanOrEqual(d.budget);
          expect(crossSolved(tiles, a)).toBe(true);
        }
      }
      expect(seen.size).toBe(6);
    });
  }

  it("the same race gives every racer the same locks, whatever order they are asked for", () => {
    const a = [0, 1, 2, 3].map(i => dialKnot(3, 555, i).join());
    const b = [3, 2, 1, 0].map(i => dialKnot(3, 555, i).join()).reverse();
    expect(a).toEqual(b);
  });
});
