// Exact odds: the chance the player about to roll takes the round (a draw counts half),
// assuming both sides then always make the choice that gives them the best chance.
// A three that doesn't land on 20 is held: its roller may reroll that die (the new roll replaces
// the three) or keep it (it counts, and they roll again).
import { DIST, bit, landing, type Die } from "./dice";

const memo = new Map<number, number>();

/** t: total, hp: roller's hand, ho: other hand, forced: die that must be rolled again or -1. */
export function V(t: number, hp: number, ho: number, forced: number): number {
  const key = t * 1000 + hp * 100 + ho * 10 + (forced + 1);
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let v: number;
  if (forced >= 0) v = rollValue(t, 0, ho, forced as Die);
  else if (!hp) v = ho ? 1 - V(t, ho, 0, -1) : 0.5;
  else {
    v = -1;
    for (let d = 0; d < 3; d++) if (hp & bit(d)) v = Math.max(v, rollValue(t, hp & ~bit(d), ho, d as Die));
  }
  memo.set(key, v);
  return v;
}

/** Value of rolling die d at total t; hpAfter is the roller's hand once d has left it. */
function rollValue(t: number, hpAfter: number, ho: number, d: Die): number {
  let s = 0;
  for (const [r, p] of DIST[d]) s += p * (r === 3 && t + 3 !== 20 ? H(t, hpAfter, ho, d) : after(t + r, r, d, hpAfter, ho));
  return s;
}

/** A three is held on die d at total t (not yet counted): the better of rerolling and keeping. */
function H(t: number, hp: number, ho: number, d: Die): number {
  return Math.max(keepChance(t, hp, ho, d), rerollChance(t, hp, ho, d));
}

function after(T: number, r: number, d: Die, hpAfter: number, ho: number): number {
  const what = landing(T, r);
  if (what === "win") return 1;
  if (what === "bust" || what === "nine") return 0;
  if (what === "draw") return 0.5;
  if (what === "again") return hpAfter ? V(T, hpAfter, ho, -1) : V(T, 0, ho, d);
  if (ho) return 1 - V(T, ho, hpAfter, -1);
  return hpAfter ? V(T, hpAfter, 0, -1) : 0.5; // rival is out of dice: keep rolling, or all spent
}

/** Keep the held three on die d at total t: it counts and the total lands as usual. */
export function keepChance(t: number, hp: number, ho: number, d: Die): number {
  return after(t + 3, 3, d, hp, ho);
}

/** Reroll die d with a three held at total t. A three again is held again, so the value w of
 *  holding solves w = max(keep, sum_r p_r * x_r) with x_3 = w; with q = P(3), reroll = rest / (1 - q). */
export function rerollChance(t: number, hp: number, ho: number, d: Die): number {
  let rest = 0, q = 0;
  for (const [r, p] of DIST[d]) {
    if (r === 3) q += p;
    else rest += p * after(t + r, r, d, hp, ho);
  }
  // If rerolling is worth taking at all, a three again means reroll again: rest + q*w with w = reroll.
  const reroll = rest / (1 - q);
  const keep = keepChance(t, hp, ho, d);
  return reroll >= keep ? reroll : rest + q * keep;
}

/** The roller's chance of taking the round if they roll die d now. */
export function chanceOf(t: number, hp: number, ho: number, d: Die, forced: number): number {
  return forced >= 0 ? rollValue(t, 0, ho, forced as Die) : rollValue(t, hp & ~bit(d), ho, d);
}
