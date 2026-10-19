import { describe, expect, it } from "vitest";
import {
  ORDER, PLACEMENTS, actor, canPlace, moveNote, newGame, pieceToSet, placePiece, placer, playMove, seenMap, undo, type Game,
} from "./game";
import { CH, DROP, LO, NN, RI, SP, TIER, gen, key, mv, type State } from "./rules";
import { at, sparse } from "./testkit";

/** Set every piece in the first free hole of its zone. */
function setUp(): Game {
  let g = newGame();
  for (let k = 0; k < PLACEMENTS; k++) {
    const hole = [...Array(NN).keys()].find(i => canPlace(g, i))!;
    g = placePiece(g, hole, pieceToSet(g, null));
  }
  return g;
}
const inPlay = (s: State): Game => ({ ...newGame(), s, phase: "play", placed: PLACEMENTS });

describe("setup", () => {
  it("alternates one piece at a time, Host first, five each", () => {
    expect(ORDER).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
    const g = newGame();
    expect(actor(g)).toBe(0);
    expect(actor(placePiece(g, at("a1"), SP))).toBe(1);
  });
  it("keeps each side to its zone", () => {
    const g = newGame();
    expect(canPlace(g, at("a1"))).toBe(true);
    expect(canPlace(g, at("b2"))).toBe(false);
    const g1 = placePiece(g, at("a1"), SP);
    expect(canPlace(g1, at("a1"))).toBe(false); // taken
    expect(canPlace(g1, at("a2"))).toBe(false); // outer ring is the Host's
    expect(canPlace(g1, at("b2"))).toBe(false); // lower slope is no one's
    expect(canPlace(g1, at("c3"))).toBe(true);
    expect(canPlace(g1, at("e5"))).toBe(true);
  });
  it("ends with Lord, 4 spearmen, Chariot and 4 Riders on the hill and full reserves", () => {
    const g = setUp();
    expect(g.phase).toBe("play");
    expect(g.s.b.filter(p => p === SP)).toHaveLength(4);
    expect(g.s.b.filter(p => p === RI)).toHaveLength(4);
    expect(g.s.b.filter(p => p === LO)).toHaveLength(1);
    expect(g.s.b.filter(p => p === CH)).toHaveLength(1);
    expect(g.s).toMatchObject({ turn: 0, rh: 3, rs: 1, ply: 0 });
    expect(g.trays).toEqual({ 0: { [LO]: 0, [SP]: 0 }, 1: { [CH]: 0, [RI]: 0 } });
  });
  it("sets the picked piece, or plain pieces first", () => {
    const g = newGame();
    expect(pieceToSet(g, null)).toBe(SP);
    expect(pieceToSet(g, LO)).toBe(LO);
    const g1 = placePiece(g, at("a1"), LO);
    expect(g1.trays[0][LO]).toBe(0);
    expect(placer(g1)).toBe(1);
    expect(pieceToSet(g1, null)).toBe(RI);
    const g2 = placePiece(g1, at("c3"), RI);
    expect(pieceToSet(g2, LO)).toBe(SP); // no Lord left
  });
});

describe("play", () => {
  it("records moves and takes them back", () => {
    const g = setUp();
    const m = gen(g.s)[0];
    const g2 = playMove(g, m);
    expect(g2.history).toHaveLength(g.history.length + 1);
    expect(g2.s.ply).toBe(1);
    expect(undo(g2).s).toEqual(g.s);
  });
  it("undo against the computer goes back to the player's own turn", () => {
    const g = setUp();
    const g2 = playMove(playMove(g, gen(g.s)[0]), 0);
    expect(g2.s.turn).toBe(0);
    const back = undo(g2, 0);
    expect(back.s).toEqual(g.s);
    // undo during setup returns pieces to the tray
    const p = placePiece(placePiece(newGame(), at("a1"), LO), at("c3"), CH);
    const u = undo(p, 0);
    expect(u.placed).toBe(0);
    expect(u.trays[0][LO]).toBe(1);
  });
  it("writes reserve entries in the log", () => {
    const s = sparse({ a1: "L", e5: "R" }, 0, 3, 1);
    expect(moveNote(s, mv(DROP, at("c1")))).toBe("S in at c1");
    expect(moveNote({ ...s, turn: 1 }, mv(DROP, at("c3")))).toBe("R in at c3");
    expect(moveNote(s, mv(at("a1"), at("a2")))).toBe("L a1–a2");
    const t = sparse({ a2: "S", a3: "R", i1: "L" });
    expect(moveNote(t, mv(at("a2"), at("a3")))).toBe("S a2×a3");
  });
  it("brings a reserve piece in as a move", () => {
    const g = setUp();
    const hole = [...Array(NN).keys()].find(i => TIER[i] === 1 && !g.s.b[i])!;
    const g2 = playMove(g, mv(DROP, hole));
    expect(g2.s.b[hole]).toBe(SP);
    expect(g2.s.rh).toBe(2);
    expect(g2.last).toEqual({ from: DROP, to: hole });
  });
});

describe("game ends", () => {
  it("a side left with no move loses", () => {
    const g = playMove(inPlay(sparse({ a2: "S", i1: "L" }, 0, 0, 0)), mv(at("a2"), at("a1")));
    expect(g).toMatchObject({ winner: 0, why: "nomove" });
  });
  it("crowning on the cairn ends the game", () => {
    const g = playMove(inPlay(sparse({ d4: "L", a9: "R" })), mv(at("d4"), at("e5")));
    expect(g).toMatchObject({ winner: 0, why: "crown" });
  });
  const shuffle = (rh: number, rs: number) => {
    let g = inPlay(sparse({ a1: "L", i1: "S", i9: "C" }, 0, rh, rs));
    const cycle = [mv(at("a1"), at("a2")), mv(at("i9"), at("h9")), mv(at("a2"), at("a1")), mv(at("h9"), at("i9"))];
    for (let k = 0; k < 8 && g.winner === null; k++) g = playMove(g, cycle[k % 4]);
    return g;
  };
  it("a third repetition goes to the side with fewer pieces", () => {
    const g = shuffle(0, 0);
    expect(g).toMatchObject({ winner: 1, why: "repeat" });
    expect(seenMap(g).get(key(g.s))).toBe(3);
  });
  it("repetition counts the reserves", () => {
    expect(shuffle(0, 1)).toMatchObject({ winner: -1, why: "repeat" }); // 2 against 1 + 1 in reserve
    expect(shuffle(1, 0)).toMatchObject({ winner: 1, why: "repeat" });
    // the same board with different reserves is a different position
    const a = sparse({ a1: "L", i9: "C" }, 0, 1, 0), b = { ...a, rh: 0 };
    expect(key(a)).not.toBe(key(b));
  });
  it("300 plies is a draw", () => {
    const g = playMove(inPlay(sparse({ a1: "L", i9: "C" }, 0, 0, 0, 299)), mv(at("a1"), at("a2")));
    expect(g).toMatchObject({ winner: -1, why: "long" });
    const early = playMove(inPlay(sparse({ a1: "L", i9: "C" }, 0, 0, 0, 298)), mv(at("a1"), at("a2")));
    expect(early.winner).toBeNull();
  });
});
