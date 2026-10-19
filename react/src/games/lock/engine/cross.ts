// Celtic Cross Lock (classic version): fifteen stones on a ringed cross; swap stones until every
// strand meets a strand of the same kind. Randomness comes in as rng() (Math.random in the game).
import { rnd, type Rng, type TierId } from "./knot";

/** The cross on a 5×7 grid: [row, column] of each stone's cell. */
export const CELLS: [number, number][] = [[0,2],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3],[2,4],[3,1],[3,2],[3,3],[4,2],[5,2],[6,2]];
const idxOf = new Map(CELLS.map(([r, c], i) => [r + "," + c, i]));
export type Dir = "n" | "e" | "s" | "w";
export const DIRS: [Dir, number, number, Dir][] = [["n", -1, 0, "s"], ["e", 0, 1, "w"], ["s", 1, 0, "n"], ["w", 0, -1, "e"]];
export const neighbor = (i: number, dr: number, dc: number) => { const [r, c] = CELLS[i]; const k = idxOf.get((r + dr) + "," + (c + dc)); return k === undefined ? -1 : k; };
const DIR_WORD: Record<Dir, string> = { n: "top", e: "right", s: "bottom", w: "left" };
const KIND = ["", "gold", "verdigris", "garnet"];

/** A stone: the strand kind (0 none, 1 gold, 2 verdigris, 3 garnet) leaving each side. */
export type Tile = Record<Dir, number>;

export interface CrossTier { name: string; colors: number; p: number; scramble: number; desc: string }
export const CROSS_TIERS: Record<TierId, CrossTier> = {
  1: { name: "Iron",   colors: 1, p: .55, scramble: 2, desc: "One strand kind, a few stones out of place." },
  2: { name: "Bronze", colors: 2, p: .6,  scramble: 4, desc: "Two strand kinds. A handful of stones moved." },
  3: { name: "Silver", colors: 2, p: .7,  scramble: 6, desc: "Two strand kinds, denser knotwork." },
  4: { name: "Gold",   colors: 3, p: .72, scramble: 8, desc: "Three strand kinds. Most stones out of place." },
  5: { name: "Ogham",  colors: 3, p: .8,  scramble: 11, desc: "Three kinds, dense knots, nearly every stone moved." },
};

export const sig = (t: Tile) => `${t.n}${t.e}${t.s}${t.w}`;

/** A solved cross: random joins between neighbouring cells, every stone with at least one strand. */
export function makeLock(tier: TierId, rng: Rng = Math.random): Tile[] {
  const T = CROSS_TIERS[tier];
  for (let tries = 0; tries < 500; tries++) {
    const tiles: Tile[] = CELLS.map(() => ({ n: 0, e: 0, s: 0, w: 0 }));
    for (let i = 0; i < CELLS.length; i++) {
      for (const [d, dr, dc, opp] of DIRS) {
        if (d !== "e" && d !== "s") continue;
        const j = neighbor(i, dr, dc);
        if (j < 0) continue;
        const v = rng() < T.p ? 1 + rnd(T.colors, rng) : 0;
        tiles[i][d] = v; tiles[j][opp] = v;
      }
    }
    const deg = (t: Tile) => +(t.n > 0) + +(t.e > 0) + +(t.s > 0) + +(t.w > 0);
    if (tiles.some(t => deg(t) === 0)) continue;
    const used = new Set(tiles.flatMap(t => [t.n, t.e, t.s, t.w]).filter(Boolean));
    if (used.size < T.colors) continue;
    const sigs = new Set(tiles.map(sig));
    if (sigs.size < Math.min(8, CELLS.length - 4)) continue;
    return tiles;
  }
  throw new Error("Could not generate a lock");
}

/** arr[cell] = which stone (index into tiles) sits in that cell. */
export function scramble(tiles: Tile[], tier: TierId, rng: Rng = Math.random): number[] {
  const T = CROSS_TIERS[tier];
  for (let tries = 0; tries < 200; tries++) {
    const arr = tiles.map((_, i) => i);
    const k = Math.max(1, T.scramble + rnd(3, rng) - 1);
    let done = 0, guard = 0;
    while (done < k && guard++ < 400) {
      const a = rnd(arr.length, rng), b = rnd(arr.length, rng);
      if (a === b || sig(tiles[arr[a]]) === sig(tiles[arr[b]])) continue;
      [arr[a], arr[b]] = [arr[b], arr[a]]; done++;
    }
    if (!solved(tiles, arr)) return arr;
  }
  return tiles.map((_, i) => i).reverse();
}

/** Cycle count over tile identities: an upper bound on swaps needed. */
export function minSwaps(arr: number[]): number {
  const seen = new Array<boolean>(arr.length).fill(false);
  let swaps = 0;
  for (let i = 0; i < arr.length; i++) {
    if (seen[i]) continue;
    let len = 0, j = i;
    while (!seen[j]) { seen[j] = true; j = arr[j]; len++; }
    swaps += len - 1;
  }
  return swaps;
}

export function solved(tiles: Tile[], arr: number[]): boolean {
  for (let i = 0; i < CELLS.length; i++) {
    const t = tiles[arr[i]];
    for (const [d, dr, dc, opp] of DIRS) {
      const j = neighbor(i, dr, dc);
      if (j < 0) { if (t[d]) return false; }
      else if (t[d] !== tiles[arr[j]][opp]) return false;
    }
  }
  return true;
}

export function spareMoves(skill: number, tier: number, rng: Rng = Math.random): number {
  return Math.max(1, Math.round(1.5 + skill / 16 - tier * 0.5 + rng()));
}

export interface CrossDeal { arr: number[]; budget: number }
export function dealCross(tiles: Tile[], tier: TierId, skill: number, rng: Rng = Math.random): CrossDeal {
  const arr = scramble(tiles, tier, rng);
  return { arr, budget: minSwaps(arr) + spareMoves(skill, tier, rng) };
}

/* ---------- Cheat / training aids ---------- */
export function brokenEdges(tiles: Tile[], arr: number[], i: number): Dir[] {
  const t = tiles[arr[i]], out: Dir[] = [];
  for (const [d, dr, dc, opp] of DIRS) {
    const j = neighbor(i, dr, dc);
    if (j < 0 ? t[d] !== 0 : t[d] !== tiles[arr[j]][opp]) out.push(d);
  }
  return out;
}
export function misplaced(tiles: Tile[], arr: number[]): number[] {
  return CELLS.map((_, i) => i).filter(i => sig(tiles[arr[i]]) !== sig(tiles[i]));
}
// Swaps that put the right kind of stone into cell i. A swap that fixes both
// cells is best; otherwise pick the one that sets up the most of those.
function candidates(tiles: Tile[], arr: number[]) {
  const wrong = misplaced(tiles, arr);
  const out: { i: number; j: number; both: boolean }[] = [];
  for (const i of wrong) for (const j of wrong) {
    if (j > i && (sig(tiles[arr[j]]) === sig(tiles[i]) || sig(tiles[arr[i]]) === sig(tiles[j]))) {
      const both = sig(tiles[arr[j]]) === sig(tiles[i]) && sig(tiles[arr[i]]) === sig(tiles[j]);
      out.push({ i, j, both });
    }
  }
  return out;
}
function greedyStep(tiles: Tile[], arr: number[]): [number, number] | null {
  const cs = candidates(tiles, arr);
  if (!cs.length) return null;
  const both = cs.find(c => c.both);
  if (both) return [both.i, both.j];
  let best = cs[0], bestScore = -1;
  for (const c of cs) {
    const a = arr.slice(); [a[c.i], a[c.j]] = [a[c.j], a[c.i]];
    const score = candidates(tiles, a).filter(x => x.both).length;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return [best.i, best.j];
}
// Two strategies: match stones by pattern, or send each stone to its own home.
// Hint with whichever finishes in fewer swaps from here.
export function nextSwap(tiles: Tile[], arr0: number[]): [number, number] | null {
  if (!misplaced(tiles, arr0).length) return null;
  const a = arr0.slice();
  let first: [number, number] | null = null, n = 0, step: [number, number] | null;
  while ((step = greedyStep(tiles, a)) && n < 40) { if (!first) first = step; [a[step[0]], a[step[1]]] = [a[step[1]], a[step[0]]]; n++; }
  const homeLen = minSwaps(arr0);
  if (first && n <= homeLen) return first;
  const i = arr0.findIndex((t, k) => t !== k);
  return i < 0 ? first : [i, arr0.indexOf(i)];
}
export function describe(t: Tile): string {
  const parts = (["n", "e", "s", "w"] as Dir[]).filter(d => t[d]).map(d => `${KIND[t[d]]} ${DIR_WORD[d]}`);
  return parts.length ? "strands " + parts.join(", ") : "no strands";
}
