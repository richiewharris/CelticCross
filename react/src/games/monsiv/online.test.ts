import { describe, expect, it } from "vitest";
import { replay } from "../../online/types";
import { search } from "./engine/ai";
import { rng, type Move } from "./engine/core";
import { legalMoves, newGame, pathOf, playMove, type Game } from "./engine/game";
import { fromEngine, monsivOnline as A, toEngine, type OnlineMove } from "./online";

/** A whole game of the computer against itself, with seeded noise and a fake clock. */
function selfPlay(seed: number): { moves: Move[]; g: Game } {
  const R = rng(seed);
  let t = 0;
  const env = { random: R, now: () => (t += 0.01) };
  let g = newGame();
  const moves: Move[] = [];
  while (g.winner === null && moves.length < 400) {
    const opts = { depth: 1 + (moves.length % 2), ms: 1e9, noise: 30 };
    // Now and then play a random legal move, so swaps and odd lines turn up.
    const ms = legalMoves(g);
    const m = R() < 0.3 ? ms[(R() * ms.length) | 0] : search(g.s, pathOf(g), opts, env)!;
    moves.push(m);
    g = playMove(g, m);
  }
  return { moves, g };
}

describe("Monsiv online adapter", () => {
  const games = [1, 2, 3, 4, 5, 6, 7, 8].map(selfPlay);

  it("starts with White to move and no result", () => {
    const s = A.start(A.defaultOptions);
    expect(A.seatToAct(s)).toBe("white");
    expect(A.result(s)).toBeNull();
    expect(A.seats.map(x => x.id)).toEqual(["white", "black"]);
  });

  it("replays self-played games move for move, with the engine's result", () => {
    let swaps = 0;
    const reasons = new Set<string>();
    for (const { moves, g } of games) {
      expect(g.winner).not.toBeNull();
      let s = A.start({});
      let eg = newGame();
      for (const m of moves) {
        const om = fromEngine(m);
        expect(JSON.parse(JSON.stringify(om))).toEqual(om); // plain JSON
        expect(A.seatToAct(s)).toBe(eg.s.turn === 0 ? "white" : "black");
        expect(A.legal(s, om)).toBe(true);
        if (om.swap) swaps++;
        s = A.apply(s, om);
        eg = playMove(eg, m);
        expect(s.s).toEqual(eg.s);
      }
      expect(s).toEqual(g);
      expect(A.seatToAct(s)).toBeNull();
      const r = A.result(s)!;
      expect(r.winner).toBe(g.winner === 0 ? "white" : "black");
      expect(r.text).toMatch(/^(White|Black) (took the Throne|reached the far row|left the opponent with no move)\.$/);
      reasons.add(g.reason!);
      const rep = replay(A, { options: {}, moves: moves.map(fromEngine) });
      expect(rep.illegalAt).toBeNull();
      expect(rep.s).toEqual(g);
    }
    expect(swaps).toBeGreaterThan(0);
    expect(reasons.size).toBeGreaterThan(1);
  });

  it("maps swaps either way round onto the engine's move", () => {
    expect(toEngine({ from: 22, to: 21, swap: true })).toEqual([1, 21, 22]);
    const s = A.start({});
    expect(A.legal(s, { from: 22, to: 21, swap: true })).toBe(true); // Throne c1 ⇄ Angel b1
    expect(A.legal(s, { from: 21, to: 22, swap: true })).toBe(true);
  });

  it("refuses illegal and malformed moves", () => {
    const s = A.start({});
    const bad: unknown[] = [
      { from: 21, to: 16, swap: false }, // Angel can't step straight
      { from: 2, to: 7, swap: false }, // Black's piece on White's turn
      { from: 20, to: 22, swap: true }, // not neighbours
      { from: 20, to: 15, swap: true }, // swap with an empty square
      { from: 7, to: 12, swap: false }, // empty square
      { from: 20, to: 15 }, // no swap flag
      { from: -1, to: 3, swap: false }, { from: 20.5, to: 15, swap: false }, { from: "20", to: 15, swap: false },
      null, [0, 20, 15], 5,
    ];
    for (const m of bad) expect(A.legal(s, m as OnlineMove)).toBe(false);
    // The same swap twice running is against the rules.
    let g = A.apply(s, { from: 21, to: 22, swap: true });
    g = A.apply(g, { from: 1, to: 6, swap: false });
    expect(A.legal(g, { from: 21, to: 22, swap: true })).toBe(false);
    // Nothing is legal once the game is over.
    const { g: done } = games[0];
    for (const m of legalMoves({ ...done, winner: null })) expect(A.legal(done, fromEngine(m))).toBe(false);
  });

  it("stops replay at the first bad move", () => {
    const { moves } = games[1];
    const ok = moves.slice(0, 6).map(fromEngine);
    const rep = replay(A, { options: {}, moves: [...ok, { from: 12, to: 13, swap: false }, ...ok] });
    expect(rep.illegalAt).toBe(6);
    expect(rep.s.history).toHaveLength(6);
    let g = newGame();
    for (const m of moves.slice(0, 6)) g = playMove(g, m);
    expect(rep.s).toEqual(g);
    // A move after the game has ended is bad too.
    const full = games[2].moves.map(fromEngine);
    const after = replay(A, { options: {}, moves: [...full, full[0]] });
    expect(after.illegalAt).toBe(full.length);
    expect(A.result(after.s)).not.toBeNull();
  });
});
