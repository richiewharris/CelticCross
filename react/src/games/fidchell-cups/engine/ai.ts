// The computer: score positions, list every way to play a roll, look one rival roll ahead.
import {
  N, PASS, baseRow, capturesFor, clone, move, movesFor, other, passTurn, withDice,
  type Cell, type Rng, type Side, type State, type Step,
} from "./rules";

export const BIG = 1e6;

/** Squares of `side`'s cups the rival could drink with one move of any length. */
export function threatened(b: readonly Cell[], side: Side): Set<number> {
  const foe = other(side), hit = new Set<number>();
  for (let d = 1; d <= 6; d++) for (const [f, t] of movesFor(b, foe, d)) {
    const c = b.slice(); c[t] = foe; c[f] = 0;
    for (const x of capturesFor(c, t, foe)) hit.add(x);
  }
  return hit;
}
/** How many of `side`'s cups the rival could drink with one move of any length. */
export const threatCount = (b: readonly Cell[], side: Side) => threatened(b, side).size;

export function evaluate(s: State, side: Side, deep: boolean): number {
  if (s.winner === side) return BIG;
  if (s.winner === other(side)) return -BIG;
  if (s.winner === 0) return 0;
  let v = (s.jug[side] - s.jug[other(side)]) * 100 + (s.drinks[side] - s.drinks[other(side)]) * 5;
  if (deep) {
    v -= threatCount(s.b, side) * (s.jug[side] === 0 ? 4000 : 38);
    v += threatCount(s.b, other(side)) * (s.jug[other(side)] === 0 ? 300 : 12);
  }
  return v;
}

export interface Plan { steps: Step[]; s: State; v?: number }

/** Every way to play the current roll: both dice if possible (that's forced), otherwise one. */
export function plans(s: State): Plan[] {
  if (!s.dice) return [];
  const dice = s.dice;
  const out: Plan[] = [], seen = new Set<string>();
  const orders: number[][] = s.used[0] || s.used[1] ? [[s.used[0] ? 1 : 0]] : (dice[0] === dice[1] ? [[0, 1]] : [[0, 1], [1, 0]]);
  for (const order of orders) {
    const [a, b2] = order;
    for (const [f, t] of movesFor(s.b, s.turn, dice[a], s.movedTo)) {
      const r1 = move(s, a, f, t);
      if (b2 === undefined || r1.s.winner !== null) { out.push({ steps: [[a, f, t]], s: r1.s }); continue; }
      const seconds = movesFor(r1.s.b, s.turn, dice[b2], t);
      if (!seconds.length) { out.push({ steps: [[a, f, t]], s: r1.s }); continue; }
      for (const [f2, t2] of seconds) {
        const key = [f, t, f2, t2].join(",");
        if (seen.has(key)) continue; seen.add(key);
        out.push({ steps: [[a, f, t], [b2, f2, t2]], s: move(r1.s, b2, f2, t2).s });
      }
    }
  }
  if (!out.length && orders.length === 2) {
    // Neither order lets the first die move; try the other die alone.
    for (const k of [1, 0]) for (const [f, t] of movesFor(s.b, s.turn, dice[k], s.movedTo)) out.push({ steps: [[k, f, t]], s: move(s, k, f, t).s });
  }
  const longest = Math.max(0, ...out.map(p => p.steps.length));
  return out.filter(p => p.steps.length === longest);
}

/** The 21 distinct rolls with their chances. */
export const OUTCOMES: [number, number, number][] = (() => {
  const o: [number, number, number][] = [];
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) o.push([a, b, a === b ? 1 / 36 : 2 / 36]);
  return o;
})();

/** The rival's expected best reply to `s` over all 21 rolls, scored for `me`. */
export function expectedReply(s: State, me: Side): number {
  const foe = other(me), base: State = { ...passTurn(s), turn: foe };
  let total = 0;
  for (const [a, b, p] of OUTCOMES) {
    const sum = a + b;
    if (sum === s.queen) { total += p * (s.jug[me] === 0 ? -BIG : evaluate(s, me, false) - 100); continue; }
    if (PASS.includes(sum)) { total += p * evaluate(s, me, false); continue; }
    const ps = plans(withDice(base, [a, b]));
    if (!ps.length) { total += p * evaluate(s, me, false); continue; }
    let worst = Infinity;
    for (const q of ps) { const v = evaluate(q.s, me, false); if (v < worst) worst = v; }
    total += p * worst;
  }
  return total;
}

export type Level = 1 | 2 | 3;
export const LEVELS: Record<Level, { name: string; deep: boolean; noise: number; look: number }> = {
  1: { name: "Casual", deep: false, noise: 160, look: 0 },
  2: { name: "Steady", deep: true, noise: 4, look: 0 },
  3: { name: "Strong", deep: true, noise: 0, look: 6 },
};

export function bestPlan(s: State, lvl: Level, rng: Rng = Math.random): Plan | null {
  const L = LEVELS[lvl], me = s.turn;
  const ps = plans(s);
  if (!ps.length) return null;
  for (const p of ps) p.v = evaluate(p.s, me, L.deep) + (L.noise ? (rng() - 0.5) * L.noise : 0);
  ps.sort((x, y) => y.v! - x.v!);
  if (L.look) {
    for (const p of ps.slice(0, L.look)) {
      if (p.s.winner === null) p.v = p.v! * 0.35 + expectedReply(p.s, me) * 0.65 - threatCount(p.s.b, me) * (p.s.jug[me] === 0 ? 4000 : 20);
    }
    ps.sort((x, y) => y.v! - x.v!);
  }
  return ps[0];
}

/** Drink the rival cup that threatens you most; failing that, the most advanced one. */
export function bestToastTarget(s: State, rng: Rng = Math.random): number {
  const me = s.turn, foe = other(me);
  let best = -1, bv = -Infinity;
  for (let i = 0; i < N * N; i++) if (s.b[i] === foe) {
    const t = clone(s); t.b[i] = 0;
    const v = -threatCount(t.b, me) * 50 + Math.abs(((i / N) | 0) - baseRow(foe)) * 3 + rng();
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}

/** For the treason drink: the cup the wronged rival would take from the roller. */
export const treasonVictim = (s: State, rng: Rng = Math.random) => bestToastTarget({ ...clone(s), turn: other(s.turn) }, rng);
