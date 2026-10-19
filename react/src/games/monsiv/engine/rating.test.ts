import { describe, expect, it } from "vitest";
import { freshStats, levelLabel, levelOf, pickLevel, ratingDelta, recordResult } from "./rating";

describe("puzzle rating", () => {
  it("starts at 600, level 3", () => {
    const ps = freshStats();
    expect(ps.rating).toBe(600);
    expect(levelOf(600)).toBe(3);
    expect(pickLevel(ps)).toBe(3);
    expect(pickLevel({ ...ps, pick: "9" })).toBe(9);
  });
  it("maps ratings to levels 1 to 12", () => {
    expect(levelOf(100)).toBe(1);
    expect(levelOf(449)).toBe(1);
    expect(levelOf(450)).toBe(2);
    expect(levelOf(3000)).toBe(12);
  });
  it("labels levels like the original", () => {
    expect(levelLabel(1)).toBe("Level 1 · 300–449 · win in 1–2");
    expect(levelLabel(5)).toBe("Level 5 · 900–1049 · win in 2");
    expect(levelLabel(12)).toBe("Level 12 · 1950–2099+ · win in 3");
  });
  it("moves Elo-style: K 40 for the first 20 puzzles, then 24", () => {
    expect(ratingDelta(600, 600, 0, 1)).toBe(20);
    expect(ratingDelta(600, 600, 0, 0.5)).toBe(0);
    expect(ratingDelta(600, 600, 25, 0)).toBe(-12);
    expect(ratingDelta(600, 1000, 0, 1)).toBe(36);
  });
  it("records results, streaks and the next puzzle number", () => {
    let { ps, delta } = recordResult(freshStats(), 3, 1, 600, 1);
    expect(delta).toBe(20);
    expect(ps).toMatchObject({ rating: 620, best: 620, played: 1, solved: 1, streak: 1, recent: ["w"], next: { 3: 2 } });
    ({ ps } = recordResult(ps, 3, 2, 600, 0.5));
    expect(ps).toMatchObject({ solved: 1, streak: 0, recent: ["w", "h"], next: { 3: 3 } });
    ({ ps } = recordResult({ ...ps, rating: 110 }, 1, 9, 300, 0));
    expect(ps.rating).toBe(100);
    expect(ps.recent).toEqual(["w", "h", "l"]);
  });
});
