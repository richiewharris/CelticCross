import { describe, expect, it } from "vitest";
import { MATE, cpuPick, cpuPlace, search } from "./ai";
import { PLACEMENTS, newGame, placePiece, placer, playMove, seenMap, type Game } from "./game";
import { buildEntries, classify, reviewGame, summarize, type MoveEntry } from "./review";
import { DROP, NN, TIER, from, mv, to } from "./rules";

// A short game: a careful Host against a careless Sí.
function playOut(): Game {
  let g = newGame();
  for (let k = 0; k < PLACEMENTS; k++) {
    const side = placer(g), piece = cpuPick(g.trays[side], side);
    g = placePiece(g, cpuPlace(g.s, side, piece, 2), piece);
  }
  // open with a reserve entry so the review sees one
  const hole = [...Array(NN).keys()].find(i => TIER[i] === 1 && !g.s.b[i])!;
  g = playMove(g, mv(DROP, hole));
  for (let t = 0; t < 300 && g.winner === null; t++) {
    const lv = g.s.turn === 0 ? { depth: 2, ms: 40, noise: 0 } : { depth: 1, ms: 20, noise: 300 };
    g = playMove(g, search(g.s, lv, seenMap(g))!);
  }
  return g;
}

describe("game review", () => {
  it("grades every action and gives the loser at least one mistake", () => {
    const g = playOut();
    expect(g.winner).not.toBeNull();
    const list = reviewGame(g, 25);
    expect(list).toHaveLength(g.history.length);
    expect(list.every(e => e.q)).toBe(true);
    const sums = summarize(list);
    if (g.winner === 0 || g.winner === 1) {
      const loser = sums[g.winner ^ 1];
      expect(loser.counts.blun + loser.counts.miss).toBeGreaterThan(0);
    }
    for (const x of sums) expect(Object.values(x.counts).reduce((a, b) => a + b, 0)).toBe(x.nMoves);
    expect(sums[0].nPlace).toBe(5);
    expect(sums[1].nPlace).toBe(5);
    // the reserve entry decodes back to a drop on the right hole
    const drop = list.find((e): e is MoveEntry => e.kind === "move")!;
    expect(from(drop.m)).toBe(DROP);
    expect(drop.note).toMatch(/^S in at /);
    expect(drop.after.b[to(drop.m)]).toBe(1);
  }, 120000);
  it("classifies losses into bands", () => {
    expect(classify(0, 0, 0)).toBe("best");
    expect(classify(30, 0, -30)).toBe("exc");
    expect(classify(100, 0, -100)).toBe("good");
    expect(classify(200, 0, -200)).toBe("miss");
    expect(classify(500, 0, -500)).toBe("blun");
    expect(classify(2000, MATE, 0)).toBe("blun");
    expect(classify(0, MATE, MATE - 1)).toBe("best");
    expect(classify(900, 0, -MATE)).toBe("blun");
    expect(classify(900, 0, -900, true)).toBe("best");
  });
  it("builds one entry per action", () => {
    let g = newGame();
    g = placePiece(g, 0, 2);
    expect(buildEntries(g)).toHaveLength(1);
    expect(buildEntries(g)[0]).toMatchObject({ kind: "place", to: 0, piece: 2, by: 0 });
  });
});
