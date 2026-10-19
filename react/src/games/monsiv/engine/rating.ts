// The puzzle trainer's rating: Elo-style, with the puzzle as the opponent.
import { LEVELS_N, LEVEL_LO } from "./core";

export const levelOf = (r: number) => Math.max(1, Math.min(LEVELS_N, Math.floor((r - 300) / 150) + 1));
export const levelRange = (L: number): [number, number] => [LEVEL_LO(L), LEVEL_LO(L) + 149];
/** Label for the difficulty picker, as the original wrote it. */
export function levelLabel(L: number): string {
  const [lo, hi] = levelRange(L);
  const n = lo + 75 < 800 ? "win in 1–2" : lo + 75 < 1250 ? "win in 2" : "win in 3";
  return `Level ${L} · ${lo}–${L === LEVELS_N ? hi + "+" : hi} · ${n}`;
}

/** Rating change for a result: score 1 for a solve, ½ with a hint, 0 for a miss. */
export function ratingDelta(rating: number, puzzleRating: number, played: number, score: number): number {
  const E = 1 / (1 + Math.pow(10, (puzzleRating - rating) / 400));
  const K = played < 20 ? 40 : 24;
  return Math.round(K * (score - E));
}

export interface PuzzleStats {
  rating: number; played: number; solved: number; streak: number; best: number;
  /** Next puzzle number to play at each level. */
  next: Record<string, number>;
  /** Last 20 results: w solved, h solved with a hint, l missed. */
  recent: ("w" | "h" | "l")[];
  pick: string; // "auto" or a level number
  cur: { L: number; i: number } | null;
  speed: "1" | "2" | "3";
}
export const freshStats = (): PuzzleStats => ({ rating: 600, played: 0, solved: 0, streak: 0, best: 600, next: {}, recent: [], pick: "auto", cur: null, speed: "2" });

/** Record a result; returns the new stats and the rating change. */
export function recordResult(ps: PuzzleStats, L: number, i: number, puzzleRating: number, score: number): { ps: PuzzleStats; delta: number } {
  const d = ratingDelta(ps.rating, puzzleRating, ps.played, score);
  const rating = Math.max(100, ps.rating + d);
  return {
    delta: d,
    ps: {
      ...ps, rating, best: Math.max(ps.best, rating), played: ps.played + 1,
      solved: ps.solved + (score === 1 ? 1 : 0), streak: score === 1 ? ps.streak + 1 : 0,
      recent: ps.recent.concat([score === 1 ? "w" : score > 0 ? "h" : "l"]).slice(-20),
      next: { ...ps.next, [L]: Math.max(ps.next[L] || 1, i + 1) },
    },
  };
}
export const nextIndex = (ps: PuzzleStats, L: number) => ps.next[L] || 1;
export const pickLevel = (ps: PuzzleStats) => (ps.pick === "auto" ? levelOf(ps.rating) : +ps.pick);
export const SPEED_MS: Record<string, number> = { 1: 1700, 2: 950, 3: 420 };
