import { describe, expect, it } from "vitest";
import { HINT_LEVEL, LEVELS, WIN, evaluate, search, type LevelId } from "./ai";
import { mulberry32 } from "./rng";
import { GOLD, WHITE, fromRows, genMoves, initial, play, type State } from "./rules";

// A clock that never runs out, so results don't depend on machine speed.
const env = (seed: number) => ({ rng: mulberry32(seed), now: () => 0 });

describe("the computer", () => {
  it.each([1, 2, 3] as LevelId[])("takes an immediate win at level %i", lvl => {
    // Gold d1-d3 takes c3 and leaves White one piece.
    const s = fromRows(["....w", ".....", ".gw..", ".....", "g..g."]);
    for (let seed = 1; seed <= 8; seed++) {
      const m = search(s, { ...LEVELS[lvl], depth: Math.min(LEVELS[lvl].depth, 4) }, env(seed))!;
      expect(play(s, m).winner).toBe(GOLD);
    }
  });
  it("wins by blocking when that's the only win", () => {
    const s = fromRows(["ww.g.", "gg...", ".....", ".....", "....."]);
    const m = search(s, { ...LEVELS[2] }, env(3))!;
    expect(play(s, m).winner).toBe(GOLD);
  });
  it("saves a piece when losing it would lose the game", () => {
    // White to move: Gold threatens d1-d3 taking c3, which would leave White one piece.
    const s = fromRows(["....w", ".....", ".gw..", ".....", "g..g."], WHITE);
    for (let seed = 1; seed <= 5; seed++) {
      const after = play(s, search(s, LEVELS[2], env(seed))!);
      expect(after.winner).toBe(null);
      for (const r of genMoves(after.b, GOLD)) expect(play(after, r).winner).not.toBe(GOLD);
    }
  });
  it("at one ply, takes a piece rather than a quiet move", () => {
    const s = fromRows(["w.w.w", ".....", ".gw..", ".....", "g..g."]);
    const m = search(s, { depth: 1, ms: 200, noise: 0 }, env(1))!;
    expect(play(s, m).last?.caps.length).toBe(1);
  });
  it("finds a move from the opening and returns null with none", () => {
    expect(search(initial(), HINT_LEVEL, env(1))).not.toBeNull();
    const stuck: State = { ...fromRows(["wwg..", "gg...", ".....", ".....", "....."], WHITE) };
    expect(search(stuck, LEVELS[1], env(1))).toBeNull();
  });
  it("counts material first", () => {
    const up = fromRows(["w....", ".....", ".....", ".....", "gg..."]);
    expect(evaluate(up.b, GOLD)).toBeGreaterThan(100);
    expect(evaluate(up.b, WHITE)).toBeLessThan(-100);
    expect(evaluate(initial().b, GOLD)).toBe(0);
    expect(WIN).toBeGreaterThan(1000);
  });
  it("respects its time budget", () => {
    let t = 0;
    const m = search(initial(), { depth: 12, ms: 50, noise: 0 }, { rng: mulberry32(1), now: () => (t += 1) });
    expect(m).not.toBeNull();
  });
});
