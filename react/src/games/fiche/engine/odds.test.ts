import { describe, expect, it } from "vitest";
import { aiChoice, playChoice } from "./ai";
import { ALL, DIST, bit, seeded, type Die } from "./dice";
import { DEFAULT_SETTINGS, applyRoll, diceOdds, keepHeld, keepOdds, legalDie, newMatch, newRound, type Game, type Player } from "./game";
import { V, chanceOf, keepChance, rerollChance } from "./odds";

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
  const key = `${R.total}|${R.hands[1]}|${R.hands[2]}|${R.turn}|${R.forced}|${R.held}|${me}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = R.turn === me ? -1 : 2;
  if (R.held >= 0) {
    // Keep the three, or reroll the held die (the new roll replaces it). A reroll can show three
    // again, which brings back this same position, so solve w = best(keep, rest + q·w) by iteration.
    const d = R.held as Die, mine = R.turn === me;
    const k = exact(keepHeld(g), me, memo);
    let rest = 0, q = 0;
    for (const [v, p] of DIST[d]) { if (v === 3) q += p; else rest += p * exact(applyRoll(g, d, v), me, memo); }
    let w = k;
    for (let i = 0; i < 400; i++) w = mine ? Math.max(k, rest + q * w) : Math.min(k, rest + q * w);
    memo.set(key, w);
    return w;
  }
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
    // At 19 only a 1 wins. The caltrop: 1 wins (1/4), 2 or 4 bust, a three is rerolled until it
    // isn't a three, so it wins 1/4 ÷ 3/4 = 1/3. The twin cubes standing on end: 1/16, and their
    // three rerolls too (a three is 2/16 of their rolls): 1/16 ÷ 14/16 = 1/14.
    expect(chanceOf(19, ALL, 0, 0, -1)).toBeCloseTo(1 / 3, 12);
    expect(chanceOf(19, bit(2), 0, 2, -1)).toBeCloseTo((1 / 16) / (1 - 2 / 16 * (1 - 1 / 16)), 12);
    // From 17 with only the caltrop left on the table: a three lands on 20 and wins outright,
    // 4 busts, 1 or 2 spends the last die (a draw).
    expect(chanceOf(17, bit(0), 0, 0, -1)).toBeCloseTo(0.25 + 0.5 * 0.5, 12);
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
        g = playChoice(g, aiChoice(g.R, 3, rng), rng);
      }
      score += g.R.over.winner === 0 ? 0.5 : g.R.over.winner === 1 ? 1 : 0;
    }
    // standard error about 0.001
    expect(Math.abs(score / N - V(0, ALL, ALL, -1))).toBeLessThan(0.005);
  });
});

describe("a held three (reroll or keep)", () => {
  it("the coach's reroll and keep odds match brute force through the game rules", () => {
    let checked = 0;
    for (const total of [0, 2, 4, 6, 8, 10, 13, 15, 16, 18]) for (const hp of HANDS) for (const ho of HANDS)
      for (const d of [0, 1, 2] as Die[]) {
        if (hp & bit(d) || total + 3 === 20) continue; // the held die is already spent; 3 onto 20 just wins
        const g = at(total, [hp, ho]); g.R.held = d;
        const w = exact(g, 1);
        expect(Math.max(rerollChance(total, hp, ho, d), keepChance(total, hp, ho, d))).toBeCloseTo(w, 10);
        expect(keepOdds(g.R)).toBeCloseTo(exact(keepHeld(g), 1), 12);
        expect(diceOdds(g.R)[d]).toBeCloseTo(rerollChance(total, hp, ho, d), 12);
        checked++;
      }
    expect(checked).toBeGreaterThan(400);
  });
  it("needing a 1 or 2 at 18, a three is worth rerolling", () => {
    const g = at(18, [bit(1) | bit(2), ALL]); g.R.held = 0;
    expect(keepOdds(g.R)).toBe(0); // 21 is bust
    expect(diceOdds(g.R)[0]).toBeGreaterThan(0.4);
    expect(aiChoice(g.R, 3, () => 0.5)).toBe(0);
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
      const d = aiChoice(R, 3, rng) as Die;
      expect(hp & bit(d)).toBeTruthy();
      const odds = diceOdds(R).filter((x): x is number => x !== null);
      expect(chanceOf(t, hp, ho, d, -1)).toBeCloseTo(Math.max(...odds), 12);
    }
  });
  it("avoids a die that can only lose when a safe one exists", () => {
    // At 11 with the caltrop and wire cube, the other side spent: 1 makes 12 (draw), 9 is behind us.
    // Shrewd's pick must be at least as good as the alternative.
    const R = at(11, [bit(0) | bit(1), 0]).R;
    const d = aiChoice(R, 3, () => 0.5) as Die;
    expect(chanceOf(11, 3, 0, d, -1)).toBeGreaterThanOrEqual(chanceOf(11, 3, 0, d === 0 ? 1 : 0, -1));
  });
  it("every level only picks dice it holds, and rolls the forced die", () => {
    const rng = seeded(1);
    for (const lvl of [1, 2, 3] as const) {
      for (let k = 0; k < 200; k++) {
        const hp = 1 + ((rng() * 7) | 0);
        const d = aiChoice(at(0, [hp, ALL]).R, lvl, rng) as Die;
        expect(hp & bit(d)).toBeTruthy();
      }
      expect(aiChoice(at(4, [0, ALL], 1, 2).R, lvl, rng)).toBe(2);
    }
  });
  it("Casual is uniform over its dice", () => {
    const rng = seeded(5), count = [0, 0, 0];
    for (let k = 0; k < 30_000; k++) count[aiChoice(at(0, [ALL, ALL]).R, 1, rng) as Die]++;
    for (const c of count) expect(Math.abs(c / 30_000 - 1 / 3)).toBeLessThan(0.02);
  });
});
