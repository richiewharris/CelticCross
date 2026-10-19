import { describe, expect, it } from "vitest";
import { gen, rng, type Move, type State } from "./core";
import { legalMoves, newGame, notation, playMove, undo, fromState, type Game } from "./game";
import { at, pos, refMoves, refPlay, refStart, type Ref } from "./testkit";

const step = (a: string, b: string): Move => [0, at(a), at(b)];
const swap = (a: string, b: string): Move => { const x = at(a), y = at(b); return [1, Math.min(x, y), Math.max(x, y)]; };
const has = (ms: Move[], m: Move) => ms.some(x => x[0] === m[0] && x[1] === m[1] && x[2] === m[2]);
const moves = (s: State) => gen(s, [s]);

describe("the opening", () => {
  it("sets Angels, Crosses and a Throne on each back row, White to move", () => {
    const g = newGame();
    expect(g.s).toEqual(pos(["actac", ".....", ".....", ".....", "CATCA"]));
    expect(g.s.turn).toBe(0);
  });
  it("lets each piece step its own way and swap with a different neighbour", () => {
    const ms = legalMoves(newGame());
    expect(has(ms, step("a1", "a2"))).toBe(true); // Cross straight
    expect(has(ms, step("b1", "a2"))).toBe(true); // Angel diagonal
    expect(has(ms, step("b1", "b2"))).toBe(false); // Angel can't go straight
    expect(has(ms, step("c1", "c2"))).toBe(true); // Throne any way
    expect(has(ms, swap("a1", "b1"))).toBe(true); // Cross and Angel
    expect(has(ms, swap("b1", "c1"))).toBe(true); // Angel and Throne
    expect(ms.filter(m => m[0] === 1)).toHaveLength(4);
  });
});

describe("the Throne", () => {
  it("may not step where an enemy piece could take it", () => {
    const s = pos(["....t", "...c.", "..T..", ".....", "....."]);
    const ms = moves(s);
    expect(has(ms, step("c3", "d3"))).toBe(false); // the Cross on d4 covers d3
    expect(has(ms, step("c3", "c4"))).toBe(false); // ... and c4
    expect(has(ms, step("c3", "b4"))).toBe(true);
  });
  it("may not take a guarded piece, but may take an unguarded one", () => {
    const guarded = pos(["..c..", "..a..", "..T..", ".....", "....t"]);
    expect(has(moves(guarded), step("c3", "c4"))).toBe(false);
    const free = pos([".....", "..a..", "..T..", ".....", "....t"]);
    expect(has(moves(free), step("c3", "c4"))).toBe(true);
  });
  it("may swap only onto a safe square", () => {
    const s = pos(["t....", ".....", "...c.", "..TA.", "....."]);
    // Swapping puts the Throne on d2, which the Cross on d3 covers.
    expect(has(moves(s), swap("c2", "d2"))).toBe(false);
  });
  it("may always make a winning move, guarded or not", () => {
    const s = pos(["..c..", "..t..", "..T..", ".....", "....."]);
    expect(has(moves(s), step("c3", "c4"))).toBe(true); // takes the Throne, though the Cross on c5 guards it
    const row = pos(["...c.", ".T...", ".....", ".....", "t...."]);
    expect(has(moves(row), step("b4", "c5"))).toBe(true); // the far row, though the Cross covers c5
  });
});

describe("the swap", () => {
  it("needs two different pieces", () => {
    const s = pos(["t....", ".....", ".....", "..CC.", "..T.."]);
    expect(moves(s).some(m => m[0] === 1 && m[1] === at("c2") && m[2] === at("d2"))).toBe(false);
  });
  it("can't swap the same pair twice in a row, but can after a step", () => {
    let g: Game = fromState(pos(["t...c", ".....", ".....", ".....", "TC.A."]));
    g = playMove(g, swap("a1", "b1"));
    g = playMove(g, step("e5", "e4"));
    expect(has(legalMoves(g), swap("a1", "b1"))).toBe(false);
    g = playMove(g, step("d1", "e2")); // any step clears the limit
    g = playMove(g, step("e4", "e5"));
    expect(has(legalMoves(g), swap("a1", "b1"))).toBe(true);
  });
});

describe("no repeats", () => {
  it("forbids recreating an earlier position", () => {
    let g = newGame();
    g = playMove(g, step("a1", "a2"));
    g = playMove(g, step("e5", "e4"));
    g = playMove(g, step("a2", "a1"));
    // e4-e5 would bring back the opening with White to move.
    expect(has(legalMoves(g), step("e4", "e5"))).toBe(false);
    expect(has(legalMoves(g), step("e4", "d4"))).toBe(true);
  });
});

describe("winning", () => {
  it("by taking the Throne", () => {
    const g = playMove(fromState(pos([".....", "..t..", "..C..", ".....", "T...."])), step("c3", "c4"));
    expect([g.winner, g.reason]).toEqual([0, "throne"]);
  });
  it("by reaching the far row", () => {
    const g = playMove(fromState(pos([".....", "C....", ".....", "..t..", "T...."])), step("a4", "a5"));
    expect([g.winner, g.reason]).toEqual([0, "row"]);
    const b = playMove(fromState(pos(["....t", ".....", ".....", "...c.", "T...."], 8)), step("d2", "d1"));
    expect([b.winner, b.reason]).toEqual([8, "row"]);
  });
  it("by leaving the other side with no move", () => {
    // Black's lone Throne on a5 is boxed in: the Cross covers a4 and b5, the Angel guards b4.
    const s = pos(["t....", ".....", "AC...", ".....", "T...."]);
    const g = playMove(fromState(s), step("b3", "b4"));
    expect(legalMoves(g)).toEqual([]);
    expect([g.winner, g.reason]).toEqual([0, "blocked"]);
  });
});

describe("notation and undo", () => {
  it("writes steps, captures and swaps", () => {
    const s = pos([".....", "..t..", "..C..", ".....", "TA..."]);
    expect(notation(s, step("c3", "c4"))).toBe("C c3×c4");
    expect(notation(s, step("c3", "d3"))).toBe("C c3–d3");
    expect(notation(s, swap("a1", "b1"))).toBe("Ta1⇄Ab1");
  });
  it("takes back to the player's own last move", () => {
    let g = newGame();
    g = playMove(g, step("a1", "a2"));
    g = playMove(g, step("e5", "e4"));
    const back = undo(g, 0);
    expect(back.s).toEqual(newGame().s);
    expect(back.history).toHaveLength(0);
    expect(undo(g).history).toHaveLength(1);
  });
});

describe("the two rule engines of the original agree", () => {
  it("on every move and every ending in 300 random games", () => {
    const R = rng(12345);
    for (let k = 0; k < 300; k++) {
      let g = newGame(), r: Ref = refStart(g.s);
      for (let ply = 0; ply < 80 && g.winner === null; ply++) {
        const ms = legalMoves(g);
        expect(ms).toEqual(refMoves(r));
        const m = ms[(R() * ms.length) | 0];
        const next = refPlay(r, m);
        g = playMove(g, m);
        r = next.r;
        expect(g.winner !== null).toBe(next.won);
      }
    }
  });
});
