import { describe, expect, it } from "vitest";
import {
  CELLS, CROSS_TIERS, DIRS, brokenEdges, dealCross, describe as describeTile, makeLock, minSwaps, misplaced, neighbor,
  nextSwap, scramble, sig, solved, spareMoves, type Tile,
} from "./cross";
import { TIER_IDS } from "./knot";
import { mulberry32 } from "./testkit";

const ident = () => CELLS.map((_, i) => i);

describe("the cross", () => {
  it("has fifteen cells joined up and down, left and right", () => {
    expect(CELLS).toHaveLength(15);
    expect(neighbor(0, -1, 0)).toBe(-1);
    expect(neighbor(0, 1, 0)).toBe(2);
    expect(neighbor(6, 0, 1)).toBe(7);
    expect(neighbor(14, 1, 0)).toBe(-1);
    for (let i = 0; i < CELLS.length; i++) for (const [, dr, dc] of DIRS) {
      const j = neighbor(i, dr, dc);
      if (j >= 0) expect(neighbor(j, -dr, -dc)).toBe(i);
    }
  });
});

describe("lock generation", () => {
  for (const t of TIER_IDS) {
    it(`${CROSS_TIERS[t].name}: locks are solved, every stone has a strand, and all kinds appear`, () => {
      const T = CROSS_TIERS[t];
      for (let seed = 1; seed <= 80; seed++) {
        const tiles = makeLock(t, mulberry32(seed * 13 + t));
        expect(solved(tiles, ident())).toBe(true);
        for (const tile of tiles) expect(tile.n + tile.e + tile.s + tile.w).toBeGreaterThan(0);
        const kinds = new Set(tiles.flatMap(x => [x.n, x.e, x.s, x.w]).filter(Boolean));
        expect(kinds.size).toBe(T.colors);
        expect(new Set(tiles.map(sig)).size).toBeGreaterThanOrEqual(8);
        tiles.forEach((_, i) => expect(brokenEdges(tiles, ident(), i)).toEqual([]));
      }
    });
  }
});

describe("dealing", () => {
  for (const t of TIER_IDS) {
    it(`${CROSS_TIERS[t].name}: every lock is unsolved and solvable within its stated moves`, () => {
      for (let seed = 1; seed <= 150; seed++) {
        const rng = mulberry32(seed * 101 + t);
        const tiles = makeLock(t, rng);
        for (const skill of [0, 20, 60, 100]) {
          const d = dealCross(tiles, t, skill, rng);
          expect(solved(tiles, d.arr)).toBe(false);
          expect([...d.arr].sort((a, b) => a - b)).toEqual(ident());
          const need = minSwaps(d.arr);
          expect(d.budget).toBeGreaterThan(need);
          // sending every stone home takes exactly `need` swaps
          const arr = d.arr.slice();
          let used = 0;
          for (let i = 0; i < arr.length; i++) while (arr[i] !== i) { const j = arr.indexOf(i); [arr[i], arr[j]] = [arr[j], arr[i]]; used++; }
          expect(used).toBe(need);
          expect(solved(tiles, arr)).toBe(true);
          // following the Cheat hint also opens it within the budget
          const b = d.arr.slice();
          let hints = 0, h: [number, number] | null;
          while (!solved(tiles, b) && (h = nextSwap(tiles, b)) && hints < 40) { [b[h[0]], b[h[1]]] = [b[h[1]], b[h[0]]]; hints++; }
          expect(solved(tiles, b)).toBe(true);
          expect(hints).toBeLessThanOrEqual(d.budget);
        }
      }
    });
  }
  it("swaps only unlike stones, about the tier's count", () => {
    for (const t of TIER_IDS) {
      const tiles = makeLock(t, mulberry32(t));
      const arr = scramble(tiles, t, mulberry32(t + 50));
      expect(minSwaps(arr)).toBeLessThanOrEqual(CROSS_TIERS[t].scramble + 1);
      expect(misplaced(tiles, arr).length).toBeGreaterThan(0);
    }
  });
});

describe("aids and text", () => {
  it("marks broken joins on both sides of a bad swap", () => {
    const tiles = makeLock(2, mulberry32(4));
    const arr = ident();
    const a = 6, b = tiles.findIndex(x => sig(x) !== sig(tiles[a]));
    [arr[a], arr[b]] = [arr[b], arr[a]];
    expect(misplaced(tiles, arr)).toEqual(expect.arrayContaining([a, b]));
    expect(brokenEdges(tiles, arr, a).length + brokenEdges(tiles, arr, b).length).toBeGreaterThan(0);
    const h = nextSwap(tiles, arr)!;
    expect([...h].sort()).toEqual([a, b].sort());
    expect(nextSwap(tiles, ident())).toBeNull();
  });
  it("describes stones for screen readers", () => {
    const tile: Tile = { n: 1, e: 0, s: 3, w: 2 };
    expect(describeTile(tile)).toBe("strands gold top, garnet bottom, verdigris left");
    expect(describeTile({ n: 0, e: 0, s: 0, w: 0 })).toBe("no strands");
  });
  it("spare moves follow the original formula", () => {
    expect(spareMoves(20, 2, () => 0)).toBe(2);   // round(1.5 + 1.25 - 1)
    expect(spareMoves(0, 5, () => 0)).toBe(1);
    expect(spareMoves(100, 1, () => .99)).toBe(Math.round(1.5 + 6.25 - .5 + .99));
  });
});
