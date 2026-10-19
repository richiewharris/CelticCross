import { describe, expect, it } from "vitest";
import { actor, currentSlot, newGame, placePiece, playMove, trayChoices, undo } from "./game";
import { CH, LO, RI, SP, SUMMIT, gen } from "./rules";
import { PLACEMENTS, slotZone } from "./setup";

function setUp(swap = false) {
  let g = newGame({ swap });
  for (let k = 0; k < PLACEMENTS; k++) {
    const slot = currentSlot(g);
    const piece = trayChoices(g)[0];
    const hole = [...Array(49).keys()].find(i => !g.s.b[i] && slotZone(slot, i))!;
    g = placePiece(g, hole, piece);
  }
  return g;
}

describe("setup", () => {
  it("alternates, Host first, and finishes with the Host's last three", () => {
    const g = newGame();
    expect(actor(g)).toBe(0);
    expect(actor(placePiece(g, 0, SP))).toBe(1);
    const done = setUp();
    expect(done.phase).toBe("play");
    expect(done.s.b.filter(p => p === SP)).toHaveLength(7);
    expect(done.s.b.filter(p => p === RI)).toHaveLength(4);
    expect(done.s.b.filter(p => p === LO || p === CH)).toHaveLength(2);
  });
  it("in the rival's setup, the Chariot starts on the summit and the hold is shorter", () => {
    const g = setUp(true);
    expect(SUMMIT[g.s.b.indexOf(CH)]).toBe(true);
    expect(g.holdN - 2).toBe(5);
  });
});

describe("play", () => {
  it("records moves and takes them back", () => {
    const g = setUp();
    const m = gen(g.s)[0];
    const g2 = playMove(g, m);
    expect(g2.history).toHaveLength(g.history.length + 1);
    expect(undo(g2).s).toEqual(g.s);
  });
});
