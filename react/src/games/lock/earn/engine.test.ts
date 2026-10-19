import { describe, expect, it } from "vitest";
import { BITS, E, N, OPP, S_, TIERS, TIER_IDS, W, makeKnot, nb, pop, rotCCW, rotCW, signedSteps, solved, stepsTo, type TierId } from "../engine/knot";
import { mulberry32 } from "../engine/testkit";
import {
  EARN_TIERS, MAX_JOIN_COST, REWARD, START_MAX, START_MIN, bestFinish, canFinish, earnDeal, earnScramble, fairDeal, isMade,
  joinCost, joinsWithinReach, knotJoins, need, plan, startState, turnStone, type EarnState, type Join,
} from "./engine";

const rotations = (m: number) => [0, 1, 2, 3].map(i => { let x = m; for (let j = 0; j < i; j++) x = rotCW(x); return x; });

/** Fix stone k the short way round, one quarter turn at a time. */
function fix(st: EarnState, sol: number[], joins: Join[], k: number) {
  const s = signedSteps(st.cur[k], sol[k]);
  for (let i = 0; i < Math.abs(s); i++) {
    const r = turnStone(st, sol, joins, k, s < 0);
    if (!r) return null;
    st = r.state;
  }
  return st;
}

/** Brute force: try every order of the wrong stones. */
function anyOrder(st: EarnState, sol: number[], joins: Join[]): boolean {
  const wrong = st.cur.map((_, k) => k).filter(k => need(st.cur, sol, k) > 0);
  if (!wrong.length) return true;
  return wrong.some(k => {
    if (st.pool < need(st.cur, sol, k)) return false;
    const next = fix(st, sol, joins, k);
    return !!next && anyOrder(next, sol, joins);
  });
}

describe("joins", () => {
  for (const t of TIER_IDS) {
    it(`${TIERS[t].name}: every pair of facing strand ends is one join`, () => {
      const T = TIERS[t];
      for (let seed = 1; seed <= 20; seed++) {
        const sol = makeKnot(T, mulberry32(seed + 100 * t));
        const joins = knotJoins(sol, T.rings, T.sectors);
        expect(joins.length).toBe(sol.reduce((n, m) => n + pop(m), 0) / 2);
        const seen = new Set<string>();
        for (const j of joins) {
          expect(nb(j.a, j.side, T.rings, T.sectors)).toBe(j.b);
          expect(sol[j.a] & j.side).toBeTruthy();
          expect(sol[j.b] & OPP[j.side]).toBeTruthy();
          const key = [Math.min(j.a, j.b), Math.max(j.a, j.b)].join();
          expect(seen.has(key)).toBe(false); seen.add(key);
          expect(isMade(sol, sol, j)).toBe(true);
        }
      }
    });
  }
});

describe("earning turns", () => {
  // Two rings of six, plain concentric strands: every stone is E|W, every join runs round a ring.
  const R = 2, C = 6;
  const sol = new Array(12).fill(E | W);
  const joins = knotJoins(sol, R, C);
  it("a lone stone set right pays for both its joins", () => {
    const cur = sol.slice(); cur[2] = N | S_;
    const st = startState(cur, sol, joins, 3);
    expect(st.paid.filter(Boolean).length).toBe(joins.length - 2); // the whole joins never pay
    const r = turnStone(st, sol, joins, 2, false)!;
    expect(r.made).toHaveLength(2);
    expect(r.gain).toBe(2 * REWARD);
    expect(r.state.pool).toBe(3 - 1 + 2 * REWARD);
    expect(r.state.earned).toBe(2 * REWARD);
    expect(r.state.used).toBe(1);
  });
  it("a stone next to a wrong one pays only for the join it closes", () => {
    const cur = sol.slice(); cur[2] = N | S_; cur[3] = N | S_;
    let st = startState(cur, sol, joins, 3);
    let r = turnStone(st, sol, joins, 2, false)!;
    expect(r.gain).toBe(REWARD); // 1–2 is made, 2–3 still waits on stone 3
    st = r.state;
    r = turnStone(st, sol, joins, 3, true)!;
    expect(r.gain).toBe(2 * REWARD); // 2–3 and 3–4
    expect(solved(r.state.cur, R, C)).toBe(true);
  });
  it("breaking and remaking a join never pays twice", () => {
    const cur = sol.slice(); cur[2] = N | S_;
    let st = startState(cur, sol, joins, 4);
    st = turnStone(st, sol, joins, 2, false)!.state; // made: +2
    const pool = st.pool;
    st = turnStone(st, sol, joins, 2, false)!.state; // broken again
    st = turnStone(st, sol, joins, 2, true)!.state;  // made again: nothing
    expect(st.pool).toBe(pool - 2);
    // turning a stone that was right at the deal away and back pays nothing either
    st = turnStone(st, sol, joins, 7, false)!.state;
    st = turnStone(st, sol, joins, 7, true)!.state;
    expect(st.pool).toBe(pool - 4);
    expect(st.earned).toBe(2 * REWARD);
  });
  it("needs a turn in hand, and crossings never turn", () => {
    const cur = sol.slice(); cur[2] = N | S_;
    expect(turnStone(startState(cur, sol, joins, 0), sol, joins, 2, false)).toBeNull();
    const x = [15, ...sol.slice(1)];
    expect(turnStone(startState(x, x, knotJoins(x, R, C), 3), x, knotJoins(x, R, C), 0, false)).toBeNull();
  });
  it("the order matters: a run of three fixed from the middle runs dry", () => {
    const cur = sol.slice(); cur[1] = cur[2] = cur[3] = N | S_;
    const paid = startState(cur, sol, joins, 1).paid;
    // From an end: 1 (−1 +1), 2 (−1 +1), 3 (−1 +2). From the middle: 2 (−1, nothing) and you're out.
    const order = plan({ cur, sol, joins, pool: 1, paid })!;
    expect(order[0]).not.toBe(2);
    let st = startState(cur, sol, joins, 1);
    st = fix(st, sol, joins, 2)!;
    expect(st.pool).toBe(0);
    expect(canFinish({ cur: st.cur, sol, joins, pool: st.pool, paid: st.paid })).toBe(false);
    expect(bestFinish({ cur, sol, joins, pool: 1, paid })).toBe(1 - 3 + 4 * REWARD);
  });
});

describe("planning", () => {
  it("agrees with trying every order", () => {
    let checked = 0, stuck = 0;
    for (const t of [1, 2, 3] as TierId[]) {
      const T = TIERS[t];
      for (let seed = 1; seed <= 60; seed++) {
        const rng = mulberry32(seed * 7 + t);
        const sol = makeKnot(T, rng), joins = knotJoins(sol, T.rings, T.sectors);
        const cur = earnScramble(sol, T, { turned: [4, 6], cluster: .8, twice: .4 }, rng);
        for (const pool of [1, 2, 3, 4]) {
          const st = startState(cur, sol, joins, pool);
          const x = { cur, sol, joins, pool, paid: st.paid };
          const brute = anyOrder(st, sol, joins);
          expect(canFinish(x)).toBe(brute);
          const order = plan(x);
          expect(order !== null).toBe(brute);
          checked++; if (!brute) stuck++;
        }
      }
    }
    expect(stuck).toBeGreaterThan(checked * .1);
    expect(stuck).toBeLessThan(checked * .9);
  });
});

describe("dealing", () => {
  for (const t of TIER_IDS) {
    it(`${TIERS[t].name}: deals are fair: 3–5 turns, joins within three quarter turns, a good order exists`, () => {
      const T = TIERS[t], ET = EARN_TIERS[t];
      const starts = new Set<number>();
      let redeals = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const rng = mulberry32(seed * 131 + t);
        const sol = makeKnot(T, rng), joins = knotJoins(sol, T.rings, T.sectors);
        const d = earnDeal(t, sol, rng);
        redeals += d.tries;
        expect(d.tries).toBeLessThan(500); // never the fallback
        expect(d.start).toBeGreaterThanOrEqual(START_MIN);
        expect(d.start).toBeLessThanOrEqual(START_MAX);
        starts.add(d.start);
        expect(solved(d.cur, T.rings, T.sectors)).toBe(false);
        d.cur.forEach((c, k) => {
          expect(rotations(sol[k])).toContain(c);
          if (sol[k] === 15) expect(c).toBe(15);
        });
        const moved = d.cur.filter((c, k) => c !== sol[k]).length;
        expect(moved).toBeGreaterThanOrEqual(ET.turned[0]);
        expect(moved).toBeLessThanOrEqual(ET.turned[1]);
        // every join still to be made needs at most three quarter turns
        for (const j of joins) if (!isMade(d.cur, sol, j)) expect(joinCost(d.cur, sol, j)).toBeLessThanOrEqual(MAX_JOIN_COST);
        expect(joinsWithinReach(d.cur, sol, joins)).toBe(true);
        // the good order plays out turn by turn and opens the lock
        let st = startState(d.cur, sol, joins, d.start);
        const order = plan({ cur: d.cur, sol, joins, pool: d.start, paid: st.paid })!;
        expect(order).not.toBeNull();
        expect(new Set(order).size).toBe(moved);
        for (const k of order) {
          expect(st.pool).toBeGreaterThanOrEqual(need(st.cur, sol, k));
          st = fix(st, sol, joins, k)!;
          expect(st).not.toBeNull();
        }
        expect(solved(st.cur, T.rings, T.sectors)).toBe(true);
        expect(st.pool).toBeGreaterThanOrEqual(0);
        expect(st.used).toBe(d.cur.reduce((n, c, k) => n + stepsTo(c, sol[k]), 0));
        expect(st.pool).toBe(d.start + st.earned - st.used);
      }
      expect([...starts].sort()).toEqual([3, 4, 5]);
      expect(redeals / 200).toBeLessThan(5);
    });
  }

  it("rejects a deal with a join that needs four quarter turns", () => {
    const R = 2, C = 6, sol = new Array(12).fill(E | W), joins = knotJoins(sol, R, C);
    // bends would be needed to turn twice; use a knot with bends instead
    const k2 = makeKnot(TIERS[1], mulberry32(3)), j2 = knotJoins(k2, 2, 6);
    const bendJoin = j2.find(j => ![5, 10].includes(k2[j.a]) && ![5, 10].includes(k2[j.b]))!;
    const cur = k2.slice();
    cur[bendJoin.a] = rotCW(rotCW(k2[bendJoin.a]));
    cur[bendJoin.b] = rotCW(rotCW(k2[bendJoin.b]));
    expect(joinCost(cur, k2, bendJoin)).toBe(4);
    expect(joinsWithinReach(cur, k2, j2)).toBe(false);
    expect(fairDeal(cur, k2, j2, 5, 2, 6)).toBe(false);
    // ...and one no order can finish
    const ring = sol.slice(); for (let k = 0; k < 6; k++) ring[k] = N | S_;
    expect(fairDeal(ring, sol, joins, 3, R, C)).toBe(true);  // along the ring, each stone pays for the last
    expect(fairDeal(ring, sol, joins, 1, R, C)).toBe(false); // but the first pays nothing, so one turn is not enough
    expect(fairDeal(sol, sol, joins, 3, R, C)).toBe(false);  // already solved
    const one = sol.slice(); one[0] = N | S_;
    expect(fairDeal(one, sol, joins, 3, R, C)).toBe(true);
  });

  it("the scramble never turns two joined stones twice each", () => {
    for (const t of TIER_IDS) {
      const T = TIERS[t];
      for (let seed = 1; seed <= 100; seed++) {
        const rng = mulberry32(seed + 9000 * t);
        const sol = makeKnot(T, rng), joins = knotJoins(sol, T.rings, T.sectors);
        const cur = earnScramble(sol, T, EARN_TIERS[t], rng);
        for (const j of joins) expect(joinCost(cur, sol, j)).toBeLessThanOrEqual(3);
      }
    }
  });

  it("is deterministic for a seeded rng", () => {
    const sol = makeKnot(TIERS[3], mulberry32(4));
    expect(earnDeal(3, sol, mulberry32(8))).toEqual(earnDeal(3, sol, mulberry32(8)));
  });
});

describe("strategy matters", () => {
  // Fixing the stones in a random order runs out of turns a fair share of the time; fixing the
  // stone that pays most for its cost never does on these deals; the planned order never does.
  for (const t of TIER_IDS) {
    it(`${TIERS[t].name}`, () => {
      const T = TIERS[t];
      let randomFails = 0, greedyFails = 0;
      const n = 150;
      for (let seed = 1; seed <= n; seed++) {
        const rng = mulberry32(seed * 17 + t);
        const sol = makeKnot(T, rng), joins = knotJoins(sol, T.rings, T.sectors);
        const d = earnDeal(t, sol, rng);
        // random order
        const order = d.cur.map((_, k) => k).filter(k => d.cur[k] !== sol[k]);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        let st: EarnState | null = startState(d.cur, sol, joins, d.start);
        for (const k of order) { if (!st || st.pool < need(st.cur, sol, k)) { st = null; break; } st = fix(st, sol, joins, k); }
        if (!st) randomFails++;
        // greedy: most pay for the cost first
        st = startState(d.cur, sol, joins, d.start);
        for (;;) {
          const s: EarnState = st;
          const wrong = s.cur.map((_, k) => k).filter(k => need(s.cur, sol, k) > 0 && need(s.cur, sol, k) <= s.pool);
          if (!wrong.length) break;
          const pays = (k: number) => joins.filter((j, i) => !s.paid[i] && (j.a === k || j.b === k)
            && (j.a === k || s.cur[j.a] === sol[j.a]) && (j.b === k || s.cur[j.b] === sol[j.b])).length;
          const k = wrong.reduce((a, b) => (pays(b) * 3 - need(s.cur, sol, b) > pays(a) * 3 - need(s.cur, sol, a) ? b : a));
          st = fix(s, sol, joins, k)!;
        }
        if (!solved(st.cur, T.rings, T.sectors)) greedyFails++;
      }
      expect(randomFails / n).toBeGreaterThan(.2);
      expect(randomFails / n).toBeLessThan(.7);
      expect(greedyFails / n).toBeLessThan(.05);
    });
  }
});

void BITS; void rotCCW;
