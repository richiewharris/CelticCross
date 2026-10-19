// Exact odds: the chance the player about to roll takes the round (a draw counts half),
// assuming both sides then always pick the die that gives them the best chance.
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

function rollValue(t: number, hpAfter: number, ho: number, d: Die): number {
  let s = 0;
  for (const [r, p] of DIST[d]) s += p * after(t + r, r, d, hpAfter, ho);
  return s;
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

/** The roller's chance of taking the round if they roll die d now. */
export function chanceOf(t: number, hp: number, ho: number, d: Die, forced: number): number {
  return forced >= 0 ? rollValue(t, 0, ho, forced as Die) : rollValue(t, hp & ~bit(d), ho, d);
}
