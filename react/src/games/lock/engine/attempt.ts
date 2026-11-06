// One attempt at a lock (the dial and the cube): the stones and turns as they are now, and how the
// lock was dealt, so the very same puzzle can be played again. Pure: no React, no DOM.
//
// A failed try leaves the attempt `failed`: no stone turns until the player picks Retry (the dealt
// arrangement and budget again) or Scramble (a new deal of the same knot).
import { rotCCW, rotCW } from "./knot";

/** How a lock was dealt: the starting arrangement and the turn budget (plus whatever else the version keeps, e.g. a spin). */
export interface Dealt { readonly cur: readonly number[]; readonly budget: number }

export interface Attempt<D extends Dealt = Dealt> {
  cur: number[];
  turnsLeft: number;
  budget: number;
  /** How this lock was dealt (never changed by play). */
  dealt: D;
  /** The last try broke the knot: waiting for Retry or Scramble. */
  failed: boolean;
}

/** Start playing a deal: the stones as dealt and the whole budget. */
export function startAttempt<D extends Dealt>(dealt: D): Attempt<D> {
  return { cur: dealt.cur.slice(), turnsLeft: dealt.budget, budget: dealt.budget, dealt, failed: false };
}

/** The same lock again, exactly as it was dealt (Retry, and Start over mid-attempt). */
export const retryAttempt = <D extends Dealt>(a: Attempt<D>): Attempt<D> => startAttempt(a.dealt);

/** The try broke the knot: the stones stay as they are and nothing more can be turned. */
export const failAttempt = <A extends Attempt>(a: A): A => ({ ...a, failed: true });

/** Has anything been played since the deal (a turn spent, or a failed try)? */
export const touched = (a: Attempt) => a.failed || a.turnsLeft !== a.budget || a.cur.some((m, k) => m !== a.dealt.cur[k]);

/** Give stone k a quarter turn. Null if it can't (failed, no turns left, a crossing). */
export function turnInAttempt<A extends Attempt>(a: A, k: number, ccw: boolean): A | null {
  if (a.failed || a.turnsLeft <= 0 || a.cur[k] === undefined || a.cur[k] === 15) return null;
  const cur = a.cur.slice(); cur[k] = ccw ? rotCCW(cur[k]) : rotCW(cur[k]);
  return { ...a, cur, turnsLeft: a.turnsLeft - 1 };
}

/** The status line while a failed try waits for a choice. */
export const FAILED_MSG = "The knot was broken. Retry this lock from the start, or scramble it for a fresh try.";
