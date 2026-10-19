import { describe, expect, it } from "vitest";
import { aiChoice } from "./ai";
import { ALL, DIST, bit, sample, seeded, type Die } from "./dice";
import { DEFAULT_SETTINGS, applyRoll, diceOdds, legalDie, newMatch, newRound, type Game, type Player } from "./game";
import { V, chanceOf } from "./odds";

function at(total: number, hands: [number, number], turn: Player = 1, forced = -1): Game {
  const g = newMatch(DEFAULT_SETTINGS, () => 0);
  const R = newRound(turn);
  R.total = total; R.hands = { 1: hands[0], 2: hands[1] }; R.forced = forced;
  return { M: g.M, R };
}

/** The value of a position for a given player (1 win, 0.5 draw, 0 loss), worked out by brute force
 *  through the game engine itself (applyRoll over every face), with both sides choosing their best die. */
function exact(g: Game, me: Player, memo = new Map<string, number>()): number {
  const R = g.R;
  if (R.over) return R.over.winner === 0 ? 0.5 : R.over.winner === me ? 1 : 0;
  const key = `${R.total}|${R.hands[1]}|${R.hands[2]}|${R.turn}|${R.forced}|${me}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = R.turn === me ? -1 : 2;
  for (const pick of [0, 1, 2] as Die[]) {
    const d = legalDie(g, pick);
    if (d === null || d !== pick && R.forced < 0) continue;
    const v = rollExact(g, d, me, memo);
    best = R.turn === me ? Math.max(best, v) : Math.min(best, v);
  }
  memo.set(key, best);
  return best;
}
const rollExact = (g: Game, d: Die, me: Player, memo: Map<string, number>) =>
  DIST[d].reduce((s, [v, p]) => s + p * exact(applyRoll(g, d, v), me, memo), 0);

const HANDS = [0, 1, 2, 3, 4, 5, 6, 7];

describe("the coach's odds", () => {
  it("match brute force through the game rules for every die in many positions", () => {
    let checked = 0;
    for (const total of [0, 1, 2, 4, 5, 6, 8, 10, 11, 13, 15, 17, 19])
      for (const hp of HANDS) for (const ho of HANDS) {
        if (!hp) continue;
        const g = at(total, [hp, ho]);
        for (const d of [0, 1, 2] as Die[]) {
          if (!(hp & bit(d))) continue;
          expect(chanceOf(total, hp, ho, d, -1)).toBeCloseTo(rollExact(g, d, 1, new Map()), 12);
          checked++;
        }
        expect(V(total, hp, ho, -1)).toBeCloseTo(exact(g, 1), 12);
      }
    expect(checked).toBeGreaterThan(500);
  });
  it("match brute force for a forced re-roll", () => {
    for (const d of [0, 1, 2] as Die[]) for (const ho of HANDS) for (const total of [3, 7, 10, 16]) {
      const g = at(total, [0, ho], 1, d);
      expect(chanceOf(total, 0, ho, 0, d)).toBeCloseTo(rollExact(g, d, 1, new Map()), 12);
    }
  });
  it("trivial positions", () => {
    expect(V(0, 0, 0, -1)).toBe(0.5); // nothing left to roll: drawn
    // At 19 only a 1 wins: the caltrop 1/4, the twin cubes standing on end 1/16.
    expect(chanceOf(19, ALL, 0, 0, -1)).toBeCloseTo(0.25, 12);
    expect(chanceOf(19, bit(2), 0, 2, -1)).toBeCloseTo(1 / 16, 12);
    // From 17 with only the caltrop left on the table: 3 wins, 4 busts, 1 or 2 spends the last die (a draw).
    expect(chanceOf(17, bit(0), 0, 0, -1)).toBeCloseTo(0.25 + 0.5 * 0.5, 12);
    // From 4 with only the wire cube left anywhere, worked by hand: every three re-rolls the same cube
    // (7, 10, 13, 16, 19), 9 loses, 20 wins, over 20 busts, anything else spends the last die (a draw).
    const v19 = 1 / 6;
    const v16 = (0.5 + 0.5 + v19 + 1) / 6;
    const v13 = (5 * 0.5 + v16) / 6;
    const v10 = (5 * 0.5 + v13) / 6;
    const v7 = (0.5 + 0 + v10 + 0.5 + 0.5 + 0.5) / 6;
    expect(chanceOf(4, bit(1), 0, 1, -1)).toBeCloseTo((0.5 + 0.5 + v7 + 0.5 + 0 + 0.5) / 6, 12);
    expect(chanceOf(4, bit(1), 0, 1, -1)).toBeCloseTo(18787 / 46656, 12);
  });
  it("odds for the player to move are given for each die they can roll", () => {
    const g = at(5, [bit(0) | bit(2), ALL]);
    const o = diceOdds(g.R);
    expect(o[1]).toBeNull();
    expect(o[0]).toBeCloseTo(chanceOf(5, 5, ALL, 0, -1), 12);
    const f = diceOdds(at(5, [0, ALL], 1, 1).R);
    expect(f[0]).toBeNull();
    expect(f[1]).not.toBeNull();
  });
  it("agree with a large seeded Monte Carlo of best play from the start", () => {
    const rng = seeded(2026), N = 200_000;
    let score = 0;
    for (let i = 0; i < N; i++) {
      let g = at(0, [ALL, ALL]);
      while (!g.R.over) {
        const d = aiChoice(g.R, 3, rng);
        g = applyRoll(g, d, sample(d, rng));
      }
      score += g.R.over.winner === 0 ? 0.5 : g.R.over.winner === 1 ? 1 : 0;
    }
    // standard error about 0.001
    expect(Math.abs(score / N - V(0, ALL, ALL, -1))).toBeLessThan(0.005);
  });
});

describe("the computer", () => {
  it("Shrewd takes an immediate win when one is there", () => {
    // At 16: the caltrop wins on a 4 (1/4); the wire cube on a 4 (1/6) but busts on 5–6.
    const R = at(16, [ALL, 0], 1).R;
    const best = ([0, 1, 2] as Die[]).reduce((a, d) => (chanceOf(16, ALL, 0, d, -1) > chanceOf(16, ALL, 0, a, -1) ? d : a), 0 as Die);
    expect(aiChoice(R, 3, () => 0.5)).toBe(best);
  });
  it("Shrewd always picks the die with the highest odds", () => {
    const rng = seeded(9);
    for (let t = 0; t < 20; t++) for (const hp of HANDS) for (const ho of HANDS) {
      if (!hp) continue;
      const R = at(t, [hp, ho]).R;
      const d = aiChoice(R, 3, rng);
      expect(hp & bit(d)).toBeTruthy();
      const odds = diceOdds(R).filter((x): x is number => x !== null);
      expect(chanceOf(t, hp, ho, d, -1)).toBeCloseTo(Math.max(...odds), 12);
    }
  });
  it("avoids a die that can only lose when a safe one exists", () => {
    // At 11 with the caltrop and wire cube, the other side spent: 1 makes 12 (draw), 9 is behind us.
    // Shrewd's pick must be at least as good as the alternative.
    const R = at(11, [bit(0) | bit(1), 0]).R;
    const d = aiChoice(R, 3, () => 0.5);
    expect(chanceOf(11, 3, 0, d, -1)).toBeGreaterThanOrEqual(chanceOf(11, 3, 0, d === 0 ? 1 : 0, -1));
  });
  it("every level only picks dice it holds, and rolls the forced die", () => {
    const rng = seeded(1);
    for (const lvl of [1, 2, 3] as const) {
      for (let k = 0; k < 200; k++) {
        const hp = 1 + ((rng() * 7) | 0);
        const d = aiChoice(at(0, [hp, ALL]).R, lvl, rng);
        expect(hp & bit(d)).toBeTruthy();
      }
      expect(aiChoice(at(4, [0, ALL], 1, 2).R, lvl, rng)).toBe(2);
    }
  });
  it("Casual is uniform over its dice", () => {
    const rng = seeded(5), count = [0, 0, 0];
    for (let k = 0; k < 30_000; k++) count[aiChoice(at(0, [ALL, ALL]).R, 1, rng)]++;
    for (const c of count) expect(Math.abs(c / 30_000 - 1 / 3)).toBeLessThan(0.02);
  });
});
