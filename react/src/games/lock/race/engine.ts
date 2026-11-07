// Race mode for the Celtic Cross Lock: the rules, the clock, the scoring and the seeded puzzle sequence.
// Pure TypeScript: no React, no DOM, no timers. Times are plain millisecond numbers passed in by the caller.
//
// A race: as many locks opened as you can before your clock runs out. Every racer (and every later
// challenger) gets the same locks in the same order: lock i, and its j-th deal, come from the race seed.
import { TIERS, deal as dealDial, makeKnot, minTurns, type Deal as DialDeal, type Rng, type TierId } from "../engine/knot";
import { CUBE_TIERS, deal as dealCube, makeKnot as makeCubeKnot, type Deal as CubeDeal } from "../cube/engine";
import { CROSS_TIERS, dealCross, makeLock, minSwaps, type CrossDeal, type Tile } from "../engine/cross";

/* ---------- Options ---------- */
export type RaceKind = "dial" | "cube" | "cross";
export type RaceMinutes = 1 | 3 | 5 | 10;
export type Resets = "free" | "none";

export interface RaceOptions {
  minutes: RaceMinutes;
  kind: RaceKind;
  tier: TierId;
  /** free: Start over, Retry and Scramble as often as you like. none: a failed try scrambles the lock by itself. */
  resets: Resets;
  /** Lose time for every failed try (10 s per minute of race). */
  penalty: boolean;
  /** Gain a few seconds for every lock opened (see BONUS_TABLE), never more in all than the race's length. */
  bonus: boolean;
}

export const MINUTES: readonly RaceMinutes[] = [1, 3, 5, 10];
export const KINDS: readonly { kind: RaceKind; label: string }[] = [
  { kind: "dial", label: "The dial" },
  { kind: "cube", label: "The cube" },
  { kind: "cross", label: "Classic cross" },
];
export const DEFAULT_OPTIONS: RaceOptions = { minutes: 3, kind: "dial", tier: 2, resets: "free", penalty: true, bonus: true };

export function isRaceOptions(x: unknown): x is RaceOptions {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o).sort().join();
  return keys === "bonus,kind,minutes,penalty,resets,tier"
    && MINUTES.includes(o.minutes as RaceMinutes)
    && KINDS.some(k => k.kind === o.kind)
    && [1, 2, 3, 4, 5].includes(o.tier as number)
    && (o.resets === "free" || o.resets === "none")
    && typeof o.penalty === "boolean" && typeof o.bonus === "boolean";
}

export const tierName = (o: Pick<RaceOptions, "kind" | "tier">) =>
  (o.kind === "cube" ? CUBE_TIERS : o.kind === "cross" ? CROSS_TIERS : TIERS)[o.tier].name;
export const tierDesc = (o: Pick<RaceOptions, "kind" | "tier">) =>
  (o.kind === "cube" ? CUBE_TIERS : o.kind === "cross" ? CROSS_TIERS : TIERS)[o.tier].desc;
export const kindLabel = (k: RaceKind) => KINDS.find(x => x.kind === k)!.label;

/* ---------- Time ---------- */
export const durationSec = (o: Pick<RaceOptions, "minutes">) => o.minutes * 60;
/** Seconds lost for a failed try with the penalty on: 10 per minute of race (10, 30, 50, 100). */
export const failPenaltySec = (minutes: RaceMinutes) => minutes * 10;
/** Seconds gained per lock opened with the bonus on, by race length (rows) and tier (Iron … Ogham). */
export const BONUS_TABLE: Readonly<Record<RaceMinutes, readonly [number, number, number, number, number]>> = {
  1: [1, 1, 2, 2, 3],
  3: [1, 2, 2, 3, 4],
  5: [2, 2, 3, 4, 5],
  10: [2, 3, 4, 5, 5],
};
export const solveBonusSec = (minutes: RaceMinutes, tier: TierId) => BONUS_TABLE[minutes][tier - 1];
/** What a failed try costs in this race (0 with the penalty off). */
export const penaltyOf = (o: RaceOptions) => (o.penalty ? failPenaltySec(o.minutes) : 0);
/** What an opened lock earns in this race (0 with the bonus off). */
export const bonusOf = (o: RaceOptions) => (o.bonus ? solveBonusSec(o.minutes, o.tier) : 0);
/** The most bonus time one racer can earn: the race's own length, so a clock can at most double. */
export const bonusCapSec = (o: RaceOptions) => durationSec(o);
/** Total bonus after `solves` locks: each one earns its share until the cap is reached. */
export const bonusFor = (o: RaceOptions, solves: number) => Math.min(solves * bonusOf(o), bonusCapSec(o));

/* ---------- One racer's run ---------- */
export interface RaceRun {
  solves: number;
  fails: number;
  /** Seconds gained and lost so far. */
  bonus: number;
  penalty: number;
  finished: boolean;
  /** When the clock ran out (ms, the racer's own clock), once finished. */
  finishedAt: number | null;
}
export const NEW_RUN: RaceRun = { solves: 0, fails: 0, bonus: 0, penalty: 0, finished: false, finishedAt: null };

/** Seconds on the clock in all: the race's length plus bonuses minus penalties. */
export const allowedSec = (o: RaceOptions, r: RaceRun) => durationSec(o) + r.bonus - r.penalty;
/** The moment this run's clock reaches zero, for a run started at `startAt`. */
export const deadline = (o: RaceOptions, r: RaceRun, startAt: number) => startAt + allowedSec(o, r) * 1000;
export const timeLeftMs = (o: RaceOptions, r: RaceRun, startAt: number, now: number) => Math.max(0, deadline(o, r, startAt) - now);
export const runEnded = (o: RaceOptions, r: RaceRun, startAt: number, now: number) => r.finished || now >= deadline(o, r, startAt);

/** A lock was opened at `now`: one more solve and its bonus. Null if the clock had already run out. */
export function solveRun(o: RaceOptions, r: RaceRun, startAt: number, now: number): { run: RaceRun; gained: number } | null {
  if (runEnded(o, r, startAt, now)) return null;
  const solves = r.solves + 1, bonus = bonusFor(o, solves);
  return { run: { ...r, solves, bonus }, gained: bonus - r.bonus };
}

/** A try failed at `now`: one more fail and its penalty (which may end the run at once). Null if already over. */
export function failRun(o: RaceOptions, r: RaceRun, startAt: number, now: number): { run: RaceRun; lost: number } | null {
  if (runEnded(o, r, startAt, now)) return null;
  const fails = r.fails + 1, p = penaltyOf(o);
  return { run: { ...r, fails, penalty: fails * p }, lost: p };
}

/** Close the run: finished, at the moment its clock ran out (or now, if stopped early). */
export function finishRun(o: RaceOptions, r: RaceRun, startAt: number, now: number): RaceRun {
  if (r.finished) return r;
  return { ...r, finished: true, finishedAt: Math.round(Math.min(now, Math.max(startAt, deadline(o, r, startAt)))) };
}

/** Do the run's numbers fit the race's rules (the bonus and penalty follow from solves and fails)? Mirrors firestore.rules. */
export function consistentRun(o: RaceOptions, r: RaceRun): boolean {
  const ints = [r.solves, r.fails, r.bonus, r.penalty].every(n => Number.isInteger(n) && n >= 0 && n <= 100000);
  return ints && r.bonus === bonusFor(o, r.solves) && r.penalty === r.fails * penaltyOf(o)
    && (r.finished ? typeof r.finishedAt === "number" : r.finishedAt === null);
}

/** Can `next` follow `prev` (numbers only grow, nothing changes after the finish)? Mirrors firestore.rules. */
export function runFollows(o: RaceOptions, prev: RaceRun, next: RaceRun): boolean {
  return !prev.finished && consistentRun(o, next) && next.solves >= prev.solves && next.fails >= prev.fails;
}

/* ---------- Scoring ---------- */
export type Score = Pick<RaceRun, "solves" | "fails">;
/** Order of two results: more solves first, then fewer failed tries; 0 is a draw. */
export const compareRuns = (a: Score, b: Score) => (b.solves - a.solves) || (a.fails - b.fails);
export function outcome(a: Score, b: Score): "a" | "b" | "draw" {
  const c = compareRuns(a, b);
  return c < 0 ? "a" : c > 0 ? "b" : "draw";
}
/** Best first; ties keep their order. Each entry also gets its place (tied results share one). */
export function rankRuns<T extends { run: Score }>(list: readonly T[]): (T & { place: number })[] {
  const sorted = list.map((x, i) => ({ x, i })).sort((p, q) => compareRuns(p.x.run, q.x.run) || p.i - q.i).map(p => p.x);
  const out: (T & { place: number })[] = [];
  sorted.forEach((x, i) => out.push({ ...x, place: i > 0 && compareRuns(sorted[i - 1].run, x.run) === 0 ? out[i - 1].place : i + 1 }));
  return out;
}

/* ---------- The seeded puzzle sequence ---------- */
/** Mix numbers into one 32-bit seed (murmur3's finaliser after each part). */
export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x9e3779b1);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  }
  return h >>> 0;
}
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A fresh race seed (a non-negative 31-bit integer, so it stores as a plain int). */
export const newSeed = (rng: Rng = Math.random) => Math.floor(rng() * 0x7fffffff);

const KIND_SALT: Record<RaceKind, number> = { dial: 1, cube: 2, cross: 3 };
const KNOT = 0x6b6e6f74;
/** Randomness for lock i's knot, and for its j-th deal (separate streams, so a deal never shifts the knot). */
export const knotRng = (kind: RaceKind, tier: TierId, seed: number, i: number) => mulberry32(hashSeed(seed, KIND_SALT[kind], tier, i, KNOT));
export const dealRng = (kind: RaceKind, tier: TierId, seed: number, i: number, j: number) => mulberry32(hashSeed(seed, KIND_SALT[kind], tier, i, j));

/** The skill every racer's turn budgets are dealt with (spare turns don't depend on who is playing). */
export const RACE_SKILL = 40;

export const dialKnot = (tier: TierId, seed: number, i: number) => makeKnot(TIERS[tier], knotRng("dial", tier, seed, i));
export const dialDeal = (tier: TierId, sol: number[], seed: number, i: number, j: number): DialDeal =>
  dealDial(tier, sol, RACE_SKILL, dealRng("dial", tier, seed, i, j));

export const cubeKnot = (tier: TierId, seed: number, i: number) => makeCubeKnot(CUBE_TIERS[tier], knotRng("cube", tier, seed, i));
export const cubeDeal = (tier: TierId, sol: number[], seed: number, i: number, j: number): CubeDeal =>
  dealCube(tier, sol, RACE_SKILL, dealRng("cube", tier, seed, i, j));

export const crossKnot = (tier: TierId, seed: number, i: number): Tile[] => makeLock(tier, knotRng("cross", tier, seed, i));
export const crossDeal = (tier: TierId, tiles: Tile[], seed: number, i: number, j: number): CrossDeal =>
  dealCross(tiles, tier, RACE_SKILL, dealRng("cross", tier, seed, i, j));

/** Fewest moves to open a deal: quarter turns for the dial and cube, swaps (an upper bound) for the cross. */
export const fewestMoves = (cur: number[], sol: number[]) => minTurns(cur, sol);
export const fewestSwaps = (arr: number[]) => minSwaps(arr);

/* ---------- Words ---------- */
export const fmtSec = (s: number) => `${s} s`;
/** "3 min · The dial · Silver · free resets · −30 s a failed try · +2 s a lock" */
export function describeOptions(o: RaceOptions): string {
  return [
    `${o.minutes} min`, kindLabel(o.kind), tierName(o),
    o.resets === "free" ? "free resets" : "no resets",
    o.penalty ? `−${failPenaltySec(o.minutes)} s a failed try` : "no fail penalty",
    o.bonus ? `+${solveBonusSec(o.minutes, o.tier)} s a lock` : "no solve bonus",
  ].join(" · ");
}
/** A clock reading: "2:05" from a minute up, "47" below, "9.4" in the last ten seconds. */
export function clockText(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return (Math.floor(s * 10) / 10).toFixed(1);
  const whole = Math.floor(s);
  if (whole < 60) return String(whole);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
