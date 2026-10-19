// Celtic Cross Lock, "Earned turns": how often each way of choosing the order of stones gets the
// lock open. Every deal can be finished with a good order (the deal checks that), so the best
// order always wins; the question is how often careless orders run dry.
// Run: npx tsx sim/lock-earn-sim.ts [locks per tier] [cluster] [turned scale]
import { TIERS, TIER_IDS, makeKnot, signedSteps, solved, type TierId } from "../src/games/lock/engine/knot";
import { mulberry32 } from "../src/games/lock/engine/testkit";
import {
  EARN_TIERS, earnDeal, knotJoins, need, plan, startState, turnStone, type EarnState, type EarnTier, type Join,
} from "../src/games/lock/earn/engine";

type Rng = () => number;
type Pick = (st: EarnState, sol: number[], joins: Join[], affordable: number[], rng: Rng) => number;

/** What fixing stone k would pay right now. */
const payNow = (st: EarnState, sol: number[], joins: Join[], k: number) =>
  joins.filter((j, i) => !st.paid[i] && (j.a === k || j.b === k) && (j.a === k || st.cur[j.a] === sol[j.a]) && (j.b === k || st.cur[j.b] === sol[j.b])).length;
const pickBy = (score: (k: number) => number, affordable: number[], rng: Rng) => {
  const best = Math.max(...affordable.map(score));
  const top = affordable.filter(k => score(k) === best);
  return top[Math.floor(rng() * top.length)];
};

const STRATS: Record<string, { pick?: Pick; strict?: boolean }> = {
  // a random order of the stones, fixed in turn; stuck the moment the next costs more than you hold
  "random order": { strict: true },
  // any stone you can afford, at random
  "random affordable": { pick: (_s, _o, _j, a, rng) => a[Math.floor(rng() * a.length)] },
  // fix the stone whose neighbours are most wrong first (pays least now)
  "careless": { pick: (st, sol, joins, a, rng) => pickBy(k => -payNow(st, sol, joins, k) * 3 + need(st.cur, sol, k), a, rng) },
  // fix the stone that pays most for what it costs
  "greedy": { pick: (st, sol, joins, a, rng) => pickBy(k => payNow(st, sol, joins, k) * 3 - need(st.cur, sol, k), a, rng) },
};

function fix(st: EarnState, sol: number[], joins: Join[], k: number): EarnState {
  const s = signedSteps(st.cur[k], sol[k]);
  for (let i = 0; i < Math.abs(s); i++) st = turnStone(st, sol, joins, k, s < 0)!.state;
  return st;
}

function play(tier: TierId, sol: number[], cur: number[], start: number, strat: string, rng: Rng): { won: boolean; left: number } {
  const T = TIERS[tier], joins = knotJoins(sol, T.rings, T.sectors);
  let st = startState(cur, sol, joins, start);
  const S = STRATS[strat];
  if (strat === "best") {
    for (const k of plan({ cur, sol, joins, pool: start, paid: st.paid })!) st = fix(st, sol, joins, k);
  } else if (S.strict) {
    const order = cur.map((_, k) => k).filter(k => need(cur, sol, k) > 0);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const k of order) { if (st.pool < need(st.cur, sol, k)) return { won: false, left: 0 }; st = fix(st, sol, joins, k); }
  } else {
    for (;;) {
      const wrong = st.cur.map((_, k) => k).filter(k => need(st.cur, sol, k) > 0);
      if (!wrong.length) break;
      const a = wrong.filter(k => need(st.cur, sol, k) <= st.pool);
      if (!a.length) return { won: false, left: 0 };
      st = fix(st, sol, joins, S.pick!(st, sol, joins, a, rng));
    }
  }
  if (!solved(st.cur, T.rings, T.sectors)) throw new Error("not solved");
  return { won: true, left: st.pool };
}

const N = +(process.argv[2] ?? 2000);
const clusterArg = process.argv[3] !== undefined ? +process.argv[3] : null;
const scaleArg = process.argv[4] !== undefined ? +process.argv[4] : null;
const names = ["best", ...Object.keys(STRATS)];
console.log(`${N} locks per tier${clusterArg !== null ? `, cluster ${clusterArg}` : ""}${scaleArg !== null ? `, turned x${scaleArg}` : ""}`);
console.log("tier     stones  need  start " + names.map(n => n.padStart(18)).join(""));
for (const t of TIER_IDS) {
  const base = EARN_TIERS[t];
  const over = process.env.EARN_ET ? JSON.parse(process.env.EARN_ET)[t] as Partial<EarnTier> | undefined : undefined;
  const ET: EarnTier = {
    ...base, ...over,
    cluster: clusterArg ?? over?.cluster ?? base.cluster,
    turned: scaleArg !== null ? [Math.round(base.turned[0] * scaleArg), Math.round(base.turned[1] * scaleArg)] : over?.turned ?? base.turned,
  };
  const won: Record<string, number> = {}, left: Record<string, number> = {};
  let stones = 0, needs = 0, starts = 0, tries = 0;
  for (let i = 0; i < N; i++) {
    const rng = mulberry32(i * 977 + t * 13);
    const sol = makeKnot(TIERS[t], rng);
    const d = earnDeal(t, sol, rng, ET);
    tries += d.tries;
    stones += d.cur.filter((c, k) => c !== sol[k]).length;
    needs += d.cur.reduce((n, _c, k) => n + need(d.cur, sol, k), 0);
    starts += d.start;
    for (const s of names) {
      const r = play(t, sol, d.cur, d.start, s, mulberry32(i * 31 + 7));
      won[s] = (won[s] ?? 0) + (r.won ? 1 : 0);
      left[s] = (left[s] ?? 0) + r.left;
    }
  }
  const pct = (x: number) => (100 * x / N).toFixed(0) + "%";
  console.log(`${TIERS[t].name.padEnd(8)} ${(stones / N).toFixed(1).padStart(6)} ${(needs / N).toFixed(1).padStart(5)} ${(starts / N).toFixed(1).padStart(6)} `
    + names.map(s => `${pct(won[s])} won, ${(left[s] / Math.max(1, won[s])).toFixed(1)} left`.padStart(18)).join("")
    + `   redeals ${(tries / N).toFixed(1)}`);
}
