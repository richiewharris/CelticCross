import { describe, expect, it } from "vitest";
import { search, LEVELS } from "./ai";
import { currentSlot, newGame, placePiece, playMove, rulesOf, seenMap, trayChoices, type Game } from "./game";
import { reviewGame, summarize } from "./review";
import { PLACEMENTS, slotZone } from "./setup";

// A short game: a strong Host against a careless Sí.
function playOut(): Game {
  let g = newGame();
  for (let k = 0; k < PLACEMENTS; k++) {
    const slot = currentSlot(g), piece = trayChoices(g)[0];
    const holes = [...Array(49).keys()].filter(i => !g.s.b[i] && slotZone(slot, i));
    g = placePiece(g, holes[(k * 5) % holes.length], piece);
  }
  for (let t = 0; t < 200 && g.winner === null; t++) {
    const lv = g.s.turn === 0 ? { ...LEVELS[3], ms: 150, noise: 0 } : { ...LEVELS[1], ms: 50 };
    g = playMove(g, search(g.s, lv, seenMap(g), rulesOf(g))!);
  }
  return g;
}

describe("game review", () => {
  it("grades every action and gives the loser at least one mistake", () => {
    const g = playOut();
    expect(g.winner).not.toBeNull();
    const list = reviewGame(g, 120);
    expect(list.every(e => e.q)).toBe(true);
    const sums = summarize(list);
    if (g.winner === 0 || g.winner === 1) {
      const loser = sums[g.winner ^ 1];
      expect(loser.counts.blun + loser.counts.miss).toBeGreaterThan(0);
    }
    // counts cover moves in play only
    for (const x of sums) expect(Object.values(x.counts).reduce((a, b) => a + b, 0)).toBe(x.nMoves);
  });
});
