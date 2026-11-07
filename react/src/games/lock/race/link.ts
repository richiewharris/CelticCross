// How a race drives a lock's own hook (useLock, useCube, useCross). Without a link the hooks play as
// always; with one they start from the race's lock, take every new deal from the race (so everyone
// gets the same ones), skip skill and per-lock statistics, and report opens and failed tries.
import type { TierId } from "../engine/knot";

export interface RaceLink<K, D> {
  tier: TierId;
  /** The first lock: its knot (stone masks, or the cross's tiles) and how it is dealt. */
  first: { knot: K; deal: D };
  /** The next deal of the lock in play: Scramble, or the scramble that follows a failed try with no resets. */
  nextDeal(): D;
  /** The lock opened. The race counts it and, after a short beat, loads the next one with loadLock(). */
  opened(): void;
  /** A try failed (the knot was broken). */
  failed(): void;
  /** Free resets: Start over, Retry and Scramble. Without them a failed try scrambles the lock by itself. */
  freeResets: boolean;
}

/** Status lines shared by the race versions of each lock. */
export const RACE_MSG = {
  first: "Go! Open as many locks as you can.",
  next: (n: number) => `Lock ${n}. Keep going.`,
  opened: "Opened!",
  autoScramble: "The knot was broken. The stones scramble for a fresh try.",
  failedFree: "The knot was broken. Retry this lock, or scramble it.",
};
