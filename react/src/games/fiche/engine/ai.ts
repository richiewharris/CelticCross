// The computer's choice of die. Casual picks at random, Steady weighs the odds with a little
// noise, Shrewd always takes the die with the best chance.
import { bit, type Die, type Rng } from "./dice";
import { other, type Level, type Round } from "./game";
import { chanceOf } from "./odds";

export const LEVEL_NAMES: Record<Level, string> = { 1: "Casual", 2: "Steady", 3: "Shrewd" };

export function aiChoice(R: Round, lvl: Level, rng: Rng): Die {
  const p = R.turn, hp = R.hands[p], ho = R.hands[other(p)];
  if (R.forced >= 0) return R.forced as Die;
  const opts = ([0, 1, 2] as Die[]).filter(d => hp & bit(d));
  if (lvl === 1) return opts[(rng() * opts.length) | 0];
  const scored = opts
    .map(d => [chanceOf(R.total, hp, ho, d, -1) + (lvl === 2 ? (rng() - 0.5) * 0.18 : 0), d] as const)
    .sort((a, b) => b[0] - a[0]);
  return scored[0][1];
}
