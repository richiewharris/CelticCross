import { describe, expect, it } from "vitest";
import { DIST, UPRIGHT, landing, sample, seeded, type Die } from "./dice";

describe("dice", () => {
  it("each die's chances add up to one", () => {
    for (const dist of DIST) expect(dist.reduce((s, [, p]) => s + p, 0)).toBeCloseTo(1, 12);
  });
  it("the caltrop and wire cube are fair", () => {
    for (const [, p] of DIST[0]) expect(p).toBe(1 / 4);
    for (const [, p] of DIST[1]) expect(p).toBe(1 / 6);
  });
  it("the twin cubes show 1 only on end, otherwise the sum of two four-sided cubes", () => {
    const sums = new Map<number, number>();
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) sums.set(a + b, (sums.get(a + b) ?? 0) + 1 / 16);
    expect(DIST[2][0]).toEqual([1, UPRIGHT]);
    for (const [v, p] of DIST[2].slice(1)) expect(p).toBeCloseTo((1 - UPRIGHT) * (sums.get(v) ?? 0), 12);
    expect(DIST[2].map(([v]) => v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("sampling follows the table (seeded)", () => {
    const rng = seeded(42), N = 200_000;
    for (const d of [0, 1, 2] as Die[]) {
      const count = new Map<number, number>();
      for (let i = 0; i < N; i++) { const v = sample(d, rng); count.set(v, (count.get(v) ?? 0) + 1); }
      for (const [v, p] of DIST[d]) expect(Math.abs((count.get(v) ?? 0) / N - p)).toBeLessThan(0.005);
    }
  });
  it("sampling is deterministic for a seed and maps the unit interval in order", () => {
    const a = seeded(7), b = seeded(7);
    for (let i = 0; i < 50; i++) expect(sample(2, a)).toBe(sample(2, b));
    expect(sample(2, () => 0)).toBe(1);
    expect(sample(2, () => 0.999999)).toBe(8);
    expect(sample(0, () => 0.26)).toBe(2);
  });
});

describe("landing", () => {
  it("knows every special total", () => {
    expect(landing(20, 5)).toBe("win");
    expect(landing(21, 1)).toBe("bust");
    expect(landing(28, 8)).toBe("bust");
    expect(landing(9, 4)).toBe("nine");
    expect(landing(9, 3)).toBe("nine"); // a three onto 9 still loses
    expect(landing(12, 6)).toBe("draw");
    expect(landing(12, 3)).toBe("draw"); // a three onto 12 is still a draw
    expect(landing(7, 4)).toBe("again");
    expect(landing(7, 3)).toBe("again");
    expect(landing(5, 3)).toBe("again");
    expect(landing(20, 3)).toBe("win");
    expect(landing(23, 3)).toBe("bust");
    for (const t of [1, 2, 4, 5, 6, 8, 10, 11, 13, 14, 15, 16, 17, 18, 19]) expect(landing(t, t === 1 ? 1 : 2)).toBeNull();
  });
});
