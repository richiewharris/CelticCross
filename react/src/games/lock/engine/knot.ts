// Celtic Cross Lock (current version): the rules. Stones sit on a polar grid of rings × sectors;
// each stone carries a piece of the knot as a 4-bit mask of the sides its strands reach.
// Randomness comes in as rng() (Math.random in the game, as in the original, which is unseeded).

export type Rng = () => number;

/** Sides of a stone: N (outward), E (clockwise), S (inward), W (anticlockwise). */
export const N = 1, E = 2, S_ = 4, W = 8;
export const BITS = [N, E, S_, W] as const;
export const OPP: Record<number, number> = { 1: 4, 4: 1, 2: 8, 8: 2 };
export const CROSSING = 15;

export const pop = (m: number) => (m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1);
export const rotCW = (m: number) => ((m << 1) | (m >> 3)) & 15;
export const rotCCW = (m: number) => ((m >> 1) | (m << 3)) & 15;
export const rnd = (n: number, rng: Rng) => Math.floor(rng() * n);

export type TierId = 1 | 2 | 3 | 4 | 5;
export interface Tier { name: string; rings: number; sectors: number; turned: number; desc: string }

export const TIERS: Record<TierId, Tier> = {
  1: { name: "Iron",   rings: 2, sectors: 6,  turned: 3, desc: "12 stones. Three are turned." },
  2: { name: "Bronze", rings: 2, sectors: 8,  turned: 4, desc: "16 stones. Four are turned." },
  3: { name: "Silver", rings: 3, sectors: 6,  turned: 5, desc: "18 stones with crossings. Five are turned." },
  4: { name: "Gold",   rings: 3, sectors: 8,  turned: 6, desc: "24 stones with crossings. Six are turned." },
  5: { name: "Ogham",  rings: 3, sectors: 10, turned: 8, desc: "30 stones with crossings. Eight are turned." },
};
export const TIER_IDS: TierId[] = [1, 2, 3, 4, 5];

/** The stone across side `bit` of stone k, or -1 off the disc (inside the hub or past the rim). */
export function nb(k: number, bit: number, R: number, C: number): number {
  const r = (k / C) | 0, s = k % C;
  if (bit === N) return r + 1 < R ? k + C : -1;
  if (bit === S_) return r > 0 ? k - C : -1;
  if (bit === E) return r * C + (s + 1) % C;
  return r * C + (s - 1 + C) % C;
}

/** How many separate closed strands the knot is made of (a crossing carries two). */
export function countLoops(m: number[], R: number, C: number): number {
  const parent = new Map<number, number>();
  const find = (x: number) => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; }
    return x;
  };
  const piece = (k: number, b: number) => m[k] === 15 ? 2 * k + ((b === N || b === S_) ? 0 : 1) : 2 * k;
  for (let k = 0; k < m.length; k++) for (const b of BITS) if (m[k] & b) { const p = piece(k, b); if (!parent.has(p)) parent.set(p, p); }
  for (let k = 0; k < m.length; k++) for (const b of BITS) {
    if (!(m[k] & b)) continue;
    const j = nb(k, b, R, C); if (j < 0) continue;
    const a = find(piece(k, b)), c = find(piece(j, OPP[b]));
    if (a !== c) parent.set(a, c);
  }
  const roots = new Set<number>(); for (const p of parent.keys()) roots.add(find(p));
  return roots.size;
}

// Build a closed knot: every stone has 2 strand ends (a bend or a straight) or 4 (a crossing).
// Toggling the four joins around a 2×2 block keeps every stone's count of strand
// ends even, so the strands always form closed loops. Start from concentric rings,
// toggle random blocks, then repair any empty stones by toggling a block next to them.
export function makeKnot(T: Tier, rng: Rng = Math.random): number[] {
  const R = T.rings, C = T.sectors, n = R * C;
  const blocksOf = (k: number) => {
    const r = (k / C) | 0, s = k % C, out: [number, number][] = [];
    for (const rr of [r - 1, r]) for (const ss of [s - 1, s]) if (rr >= 0 && rr < R - 1) out.push([rr, (ss + C) % C]);
    return out;
  };
  for (let tries = 0; tries < 4000; tries++) {
    const m = new Array<number>(n).fill(0);
    const tog = (a: number, ba: number, b: number, bb: number) => { m[a] ^= ba; m[b] ^= bb; };
    const block = (r: number, s: number) => {
      const a = r * C + s, b = r * C + (s + 1) % C, c = (r + 1) * C + (s + 1) % C, d = (r + 1) * C + s;
      tog(a, E, b, W); tog(d, E, c, W); tog(a, N, d, S_); tog(b, N, c, S_);
    };
    for (let r = 0; r < R; r++) for (let s = 0; s < C; s++) { const k = r * C + s; tog(k, E, nb(k, E, R, C), W); }
    for (let r = 0; r < R - 1; r++) for (let s = 0; s < C; s++) if (rng() < .5) block(r, s);
    for (let fix = 0; fix < 300; fix++) {
      const empty: number[] = []; for (let k = 0; k < n; k++) if (!m[k]) empty.push(k);
      if (!empty.length) break;
      const bl = blocksOf(empty[rnd(empty.length, rng)]);
      const [r, s] = bl[rnd(bl.length, rng)]; block(r, s);
    }
    if (m.some(x => { const p = pop(x); return p !== 2 && p !== 4; })) continue;
    const crossings = m.filter(x => x === 15).length;
    const bends = m.filter(x => x !== 15 && x !== 5 && x !== 10).length;
    if ((R >= 3 && crossings < 1) || crossings > n * .3 || bends < n * .35) continue;
    if (countLoops(m, R, C) > (R >= 4 ? 3 : 2)) continue;
    return m;
  }
  throw new Error("Could not build a knot");
}

/** Solved: every strand end meets a strand end on the next stone. */
export function solved(cur: number[], R: number, C: number): boolean {
  for (let k = 0; k < cur.length; k++) for (const b of BITS) {
    if (!(cur[k] & b)) continue;
    const j = nb(k, b, R, C);
    if (j < 0 || !(cur[j] & OPP[b])) return false;
  }
  return true;
}

/** Every strand end that runs into nothing: [stone, side]. */
export function looseEnds(cur: number[], R: number, C: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < cur.length; k++) for (const b of BITS) {
    if (!(cur[k] & b)) continue;
    const j = nb(k, b, R, C);
    if (j < 0 || !(cur[j] & OPP[b])) out.push([k, b]);
  }
  return out;
}

export function cwSteps(c: number, t: number): number { for (let i = 0; i < 4; i++) { if (c === t) return i; c = rotCW(c); } return 0; }
/** Fewest quarter turns either way (positive = clockwise, negative = anticlockwise). */
export function signedSteps(c: number, t: number): number { const n = cwSteps(c, t); return n === 3 ? -1 : n; }
export const stepsTo = (c: number, t: number) => Math.abs(signedSteps(c, t));

/** Turn a fixed number of stones (about one either way) away from the solved knot. */
export function scramble(sol: number[], T: Tier, rng: Rng = Math.random): number[] {
  const R = T.rings, C = T.sectors;
  const turnable = sol.map((m, k) => m === 15 ? -1 : k).filter(k => k >= 0);
  const K = Math.min(turnable.length, Math.max(2, T.turned + rnd(3, rng) - 1));
  for (let tries = 0; tries < 200; tries++) {
    const cur = sol.slice(), pool = turnable.slice();
    for (let i = 0; i < K; i++) {
      const k = pool.splice(rnd(pool.length, rng), 1)[0], m = sol[k];
      if (m === 5 || m === 10) cur[k] = rotCW(m);
      else { const n = rng() < .8 ? 1 + 2 * rnd(2, rng) : 2; let x = m; for (let j = 0; j < n; j++) x = rotCW(x); cur[k] = x; }
    }
    if (!solved(cur, R, C)) return cur;
  }
  const cur = sol.slice(); cur[turnable[0]] = rotCW(cur[turnable[0]]); return cur;
}

/** Quarter turns needed to put every stone back as in the knot it was dealt from. */
export const minTurns = (cur: number[], sol: number[]) => cur.reduce((n, c, k) => n + stepsTo(c, sol[k]), 0);
/** Turns to spare on top of that: more for higher skill, fewer on harder locks. */
export const spareTurns = (skill: number, tier: number, rng: Rng = Math.random) =>
  Math.max(1, Math.round(2 + skill / 14 - tier * 0.6 + rng()));

/** Geometry constants shared with the drawing: the window is centred on 3 o'clock (WC°). */
export const WC = 90, WIN = 60;

export interface Deal { cur: number[]; budget: number; phi: number }

/** Scramble a knot and give it a turn budget and a starting spin (same order of draws as the original). */
export function deal(tier: TierId, sol: number[], skill: number, rng: Rng = Math.random): Deal {
  const T = TIERS[tier];
  const cur = scramble(sol, T, rng);
  const budget = minTurns(cur, sol) + spareTurns(skill, tier, rng);
  const da = 360 / T.sectors;
  return { cur, budget, phi: WC - (rnd(T.sectors, rng) + .5) * da };
}

/* ---------- Skill ---------- */
export interface Profile { skill: number; opened: number; attempts: number }
export const NEW_PROFILE: Profile = { skill: 20, opened: 0, attempts: 0 };
export const RANKS: [number, string][] = [[0, "Novice"], [20, "Apprentice"], [40, "Journeyman"], [60, "Adept"], [80, "Master"]];
export const rank = (s: number) => RANKS.filter(r => s >= r[0]).pop()![1];

/** Skill gained for opening a lock (none for a practice lock opened with Cheat on). */
export function skillGain(skill: number, tier: number, left: number, cheated: boolean): number {
  return cheated ? 0 : Math.min(100 - skill, Math.max(1, Math.round(tier * 2 + left * .5 - skill / 30)));
}

export function openedMessage(cheated: boolean, gain: number): string {
  return cheated ? "The box opens. Practice lock, so no skill gained." : gain > 0 ? `The box opens. Skill +${gain}.` : "The box opens.";
}
