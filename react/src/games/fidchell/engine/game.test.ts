import { describe, expect, it } from "vitest";
import { canUndo, doMove, hintText, newGame, noteFor, statusText, undo, validGame } from "./game";
import { GOLD, WHITE, fromRows, fromSq, type Move } from "./rules";

const mv = (a: string, b: string): Move => [fromSq(a), fromSq(b)];

describe("a game", () => {
  it("notes moves, captures and multiple captures", () => {
    const s = fromRows(["..g..", "..w..", "gw.wg", ".....", "w.g.w"]);
    expect(noteFor(s, mv("c1", "c2"))).toBe("c1–c2");
    expect(noteFor(s, mv("c1", "c3"))).toBe("c1×c3(3)");
    const t = fromRows(["....w", ".....", ".gw..", ".....", "w..g."]);
    expect(noteFor(t, mv("d1", "d3"))).toBe("d1×d3");
  });
  it("undoes back to the human's move against the computer", () => {
    let g = newGame("cpu", GOLD, 2);
    expect(canUndo(g)).toBe(false);
    g = doMove(g, mv("a1", "a2"));
    g = doMove(g, mv("e5", "e4"));
    expect(g.history.map(h => h.by)).toEqual([GOLD, WHITE]);
    expect(canUndo(g)).toBe(true);
    const back = undo(g);
    expect(back.history).toHaveLength(0);
    expect(back.state.turn).toBe(GOLD);
    expect(back.state.b[fromSq("a1")]).toBe(GOLD);
  });
  it("can't undo the computer's opening move when the human plays white", () => {
    const g = doMove(newGame("cpu", WHITE, 2), mv("a1", "a2"));
    expect(canUndo(g)).toBe(false);
  });
  it("undoes one move at a time between friends", () => {
    let g = newGame("pvp", GOLD, 2);
    g = doMove(doMove(g, mv("a1", "a2")), mv("e5", "e4"));
    expect(canUndo(g)).toBe(true);
    expect(undo(g).history).toHaveLength(1);
    expect(undo(g).state.turn).toBe(WHITE);
  });
  it("words the status like the original", () => {
    const g = newGame("cpu", GOLD, 2);
    expect(statusText(g, false).text).toBe("Your move (Gold)");
    expect(statusText(g, true).text).toBe("The computer is thinking…");
    expect(statusText({ ...g, mode: "pvp" }, false).text).toBe("Gold to move");
    const won = doMove({ ...g, state: fromRows(["....w", ".....", ".gw..", ".....", "...g."]) }, mv("d1", "d3"));
    expect(statusText(won, false)).toEqual({ text: "Gold wins: cut the other side down to one piece.", tone: "win" });
    expect(statusText({ ...won, side: WHITE }, false).tone).toBe("lose");
    expect(statusText({ ...won, mode: "pvp" }, false).tone).toBe("");
    const draw = { ...g, state: { ...g.state, winner: 0 as const, reason: "quiet" as const } };
    expect(statusText(draw, false).text).toBe("30 quiet moves with equal pieces. A draw.");
    expect(hintText(false, true, false, false)).toBe("Tap one of your pieces to see where it can go.");
    expect(hintText(true, true, false, false)).toBe("");
  });
  it("checks stored games", () => {
    expect(validGame(newGame("pvp", WHITE, 3))).toBe(true);
    expect(validGame({ state: { b: [] } })).toBe(false);
    expect(validGame(null)).toBe(false);
  });
});
