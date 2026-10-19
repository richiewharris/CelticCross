// Celtic Cross Lock, "Earned turns": the same dial, but you start with only a few turns and earn
// more for every join of the knot you make. Pure rules, no React or DOM.
//
// A join is a pair of facing strand ends between two neighbouring stones in the solved knot.
// It is *made* when both its stones sit in their solved orientation, and it pays the first time
// it is made (joins already whole at the deal never pay; a join broken and made again never
// pays twice). The pool after fixing a set of stones is
//   start + REWARD·(joins made inside the set) − (quarter turns spent on the set),
// so what matters is the order: fix a stone whose neighbours are already right and it pays at once;
// fix one whose neighbours are still wrong and it pays nothing until they are.
import { BITS, E, N, TIERS, WC, nb, rnd, rotCCW, rotCW, solved, stepsTo, type Rng, type Tier, type TierId } from "../engine/knot";

/** Turns earned for each join made. */
export const REWARD = 1;
/** You start each lock with START_MIN..START_MAX turns. */
export const START_MIN = 3, START_MAX = 5;
/** No join that is still to be made may need more than this many quarter turns over its two stones. */
export const MAX_JOIN_COST = 3;

/** How many stones the variant turns on each tier, and how strongly they bunch along the strand. */
export interface EarnTier { turned: [number, number]; cluster: number; twice: number }
export const EARN_TIERS: Record<TierId, EarnTier> = {
  1: { turned: [6, 8], cluster: 1, twice: .5 },
  2: { turned: [7, 9], cluster: 1, twice: .5 },
  3: { turned: [9, 11], cluster: 1, twice: .5 },
  4: { turned: [10, 12], cluster: 1, twice: .5 },
  5: { turned: [10, 12], cluster: 1, twice: .5 },
};
export const EARN_DESC: Record<TierId, string> = {
  1: "12 stones. Six to eight are turned, in one run.",
  2: "16 stones. Seven to nine are turned, in one run.",
  3: "18 stones with crossings. Nine to eleven are turned.",
  4: "24 stones with crossings. Ten to twelve are turned.",
  5: "30 stones with crossings. Ten to twelve are turned.",
};

/* ---------- Joins ---------- */

/** One join of the knot: stone a's side `side` faces stone b. */
export interface Join { a: number; b: number; side: number }

/** Every join of a solved knot, each once. */
export function knotJoins(sol: number[], R: number, C: number): Join[] {
  const out: Join[] = [];
  for (let k = 0; k < sol.length; k++) for (const side of [N, E]) {
    if (!(sol[k] & side)) continue;
    const j = nb(k, side, R, C);
    if (j >= 0) out.push({ a: k, b: j, side });
  }
  return out;
}

/** Quarter turns stone k still needs (the fewer way round). */
export const need = (cur: number[], sol: number[], k: number) => stepsTo(cur[k], sol[k]);
export const isMade = (cur: number[], sol: number[], j: Join) => cur[j.a] === sol[j.a] && cur[j.b] === sol[j.b];
/** Quarter turns a join still needs over its two stones. */
export const joinCost = (cur: number[], sol: number[], j: Join) => need(cur, sol, j.a) + need(cur, sol, j.b);

/* ---------- Play ---------- */

export interface EarnState {
  cur: number[];
  /** Turns in hand. */
  pool: number;
  /** One flag per join: has it paid already (or was it whole at the deal)? */
  paid: boolean[];
  start: number; earned: number; used: number;
}

export function startState(cur: number[], sol: number[], joins: Join[], start: number): EarnState {
  return { cur: cur.slice(), pool: start, paid: joins.map(j => isMade(cur, sol, j)), start, earned: 0, used: 0 };
}

export interface TurnResult { state: EarnState; made: number[]; gain: number }

/** Give stone k a quarter turn. Null if it can't turn (a crossing, or no turns left). */
export function turnStone(st: EarnState, sol: number[], joins: Join[], k: number, ccw: boolean): TurnResult | null {
  if (st.pool <= 0 || st.cur[k] === 15) return null;
  const cur = st.cur.slice();
  cur[k] = ccw ? rotCCW(cur[k]) : rotCW(cur[k]);
  const paid = st.paid.slice(), made: number[] = [];
  joins.forEach((j, i) => { if (!paid[i] && (j.a === k || j.b === k) && isMade(cur, sol, j)) { paid[i] = true; made.push(i); } });
  const gain = REWARD * made.length;
  return { state: { ...st, cur, paid, pool: st.pool - 1 + gain, earned: st.earned + gain, used: st.used + 1 }, made, gain };
}

/* ---------- Planning: is there still a good order? ---------- */

export interface Situation { cur: number[]; sol: number[]; joins: Join[]; pool: number; paid: boolean[] }

/** The stones that still need turning, and what fixing each costs and pays given which others are done. */
function frame(x: Situation) {
  const wrong: number[] = [];
  x.cur.forEach((_, k) => { if (need(x.cur, x.sol, k) > 0) wrong.push(k); });
  const idx = new Map(wrong.map((k, i) => [k, i]));
  const cost = wrong.map(k => need(x.cur, x.sol, k));
  // For each wrong stone, its unpaid joins: the bit of the other stone (0 if it is already right).
  const links: number[][] = wrong.map(() => []);
  x.joins.forEach((j, i) => {
    if (x.paid[i]) return;
    const ia = idx.get(j.a), ib = idx.get(j.b);
    if (ia !== undefined) links[ia].push(ib === undefined ? 0 : 1 << ib);
    if (ib !== undefined) links[ib].push(ia === undefined ? 0 : 1 << ia);
  });
  // An unpaid join with neither stone wrong would pay on the next turn of either; it can't occur
  // in play (a join pays the moment it is made), so it is ignored here.
  const gain = (done: number, i: number) => links[i].reduce((n, m) => n + ((m & done) === m ? REWARD : 0), 0);
  return { wrong, cost, gain };
}

export const MAX_PLAN = 20;

/**
 * The best pool reachable after fixing each set of wrong stones (−1 if unreachable), by DP over
 * subsets: a stone can be fixed only with at least its cost in hand, and fixing it pays for each
 * of its unpaid joins whose other stone is already right.
 */
function reach(x: Situation) {
  const F = frame(x), n = F.wrong.length;
  if (n > MAX_PLAN) throw new Error("Too many stones to plan");
  const best = new Int16Array(1 << n).fill(-1);
  best[0] = x.pool;
  for (let S = 0; S < 1 << n; S++) {
    const p = best[S];
    if (p < 0) continue;
    for (let i = 0; i < n; i++) {
      if (S & (1 << i) || p < F.cost[i]) continue;
      const q = p - F.cost[i] + F.gain(S, i), T = S | (1 << i);
      if (q > best[T]) best[T] = q;
    }
  }
  return { F, best, full: (1 << n) - 1 };
}

/** A good order to fix the stones in (stone indices), or null if none exists from here. */
export function plan(x: Situation): number[] | null {
  const { F, best, full } = reach(x);
  if (best[full] < 0) return null;
  // Walk back from the full set.
  const order: number[] = [];
  let S = full;
  while (S) {
    let found = -1;
    for (let i = 0; i < F.wrong.length && found < 0; i++) {
      if (!(S & (1 << i))) continue;
      const P = S & ~(1 << i), p = best[P];
      if (p >= F.cost[i] && p - F.cost[i] + F.gain(P, i) === best[S]) found = i;
    }
    order.unshift(F.wrong[found]); S &= ~(1 << found);
  }
  return order;
}

/** Can the lock still be finished from here with a good order? */
export const canFinish = (x: Situation) => { const { best, full } = reach(x); return best[full] >= 0; };

/** Turns left over after the best order (−1 if it can't be finished). */
export const bestFinish = (x: Situation) => { const { best, full } = reach(x); return best[full]; };

/* ---------- Dealing ---------- */

/** Every join still to be made needs at most MAX_JOIN_COST quarter turns over its two stones. */
export function joinsWithinReach(cur: number[], sol: number[], joins: Join[]): boolean {
  return joins.every(j => isMade(cur, sol, j) || joinCost(cur, sol, j) <= MAX_JOIN_COST);
}

/**
 * Turn some stones away from the knot, bunched along the strand: each new stone is, with
 * probability `cluster`, joined to one already turned. Bends turn one way or the other (now and
 * then twice), straights once; a stone never turns twice next to one that did.
 */
export function earnScramble(sol: number[], T: Tier, E_: EarnTier, rng: Rng): number[] {
  const R = T.rings, C = T.sectors;
  const turnable = sol.map((m, k) => m === 15 ? -1 : k).filter(k => k >= 0);
  const want = Math.min(turnable.length, E_.turned[0] + rnd(E_.turned[1] - E_.turned[0] + 1, rng));
  const joined = (k: number) => BITS.filter(b => sol[k] & b).map(b => nb(k, b, R, C)).filter(j => j >= 0 && sol[j] !== 15);
  const chosen: number[] = [], isChosen = new Set<number>();
  while (chosen.length < want) {
    let k = -1;
    if (chosen.length && rng() < E_.cluster) {
      const near = [...new Set(chosen.flatMap(joined))].filter(j => !isChosen.has(j));
      if (near.length) k = near[rnd(near.length, rng)];
    }
    if (k < 0) { const rest = turnable.filter(j => !isChosen.has(j)); k = rest[rnd(rest.length, rng)]; }
    chosen.push(k); isChosen.add(k);
  }
  const cur = sol.slice();
  for (const k of chosen) {
    const m = sol[k];
    if (m === 5 || m === 10) { cur[k] = rotCW(m); continue; }
    const twiceOk = joined(k).every(j => stepsTo(cur[j], sol[j]) < 2);
    cur[k] = twiceOk && rng() < E_.twice ? rotCW(rotCW(m)) : rng() < .5 ? rotCW(m) : rotCCW(m);
  }
  return cur;
}

export interface EarnDeal { cur: number[]; start: number; phi: number; tries: number }

/** Is this a fair deal: unsolved, every join within three quarter turns, and a good order exists? */
export function fairDeal(cur: number[], sol: number[], joins: Join[], start: number, R: number, C: number): boolean {
  if (solved(cur, R, C) || !joinsWithinReach(cur, sol, joins)) return false;
  return canFinish({ cur, sol, joins, pool: start, paid: joins.map(j => isMade(cur, sol, j)) });
}

/** Deal a lock: a starting purse of 3–5 turns and a scramble that can be finished from it. */
export function earnDeal(tier: TierId, sol: number[], rng: Rng = Math.random, ET: EarnTier = EARN_TIERS[tier]): EarnDeal {
  const T = TIERS[tier], joins = knotJoins(sol, T.rings, T.sectors);
  const start = START_MIN + rnd(START_MAX - START_MIN + 1, rng);
  let tries = 0, cur: number[] = [];
  for (; tries < 500; tries++) {
    cur = earnScramble(sol, T, ET, rng);
    if (fairDeal(cur, sol, joins, start, T.rings, T.sectors)) break;
  }
  if (tries === 500) {
    // Fall back to one lone stone a quarter turn out: always fair.
    cur = sol.slice();
    const k = sol.findIndex(m => m !== 15);
    cur[k] = rotCW(sol[k]);
  }
  const da = 360 / T.sectors;
  return { cur, start, phi: WC - (rnd(T.sectors, rng) + .5) * da, tries };
}
