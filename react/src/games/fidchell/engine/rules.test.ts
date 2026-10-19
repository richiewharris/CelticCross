import { describe, expect, it } from "vitest";
import { GOLD, QUIET_LIMIT, WHITE, capsOf, count, fromRows, fromSq, genMoves, initial, play, sq, threatened, type Move } from "./rules";

const mv = (a: string, b: string): Move => [fromSq(a), fromSq(b)];
const has = (ms: Move[], m: Move) => ms.some(x => x[0] === m[0] && x[1] === m[1]);

describe("setup and moves", () => {
  it("starts with five a side, white on rank 5, gold on rank 1, gold to move", () => {
    const s = initial();
    expect(count(s.b, GOLD)).toBe(5);
    expect(count(s.b, WHITE)).toBe(5);
    expect(s.b[fromSq("a1")]).toBe(GOLD);
    expect(s.b[fromSq("e5")]).toBe(WHITE);
    expect(s.turn).toBe(GOLD);
    expect(s.pieces.map(p => p.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("names squares a-e and 1-5", () => {
    expect(sq(0)).toBe("a5");
    expect(sq(24)).toBe("e1");
    expect(fromSq("c3")).toBe(12);
  });
  it("gives each gold piece three moves up its file at the start", () => {
    const ms = genMoves(initial().b, GOLD);
    expect(ms).toHaveLength(15);
    expect(has(ms, mv("a1", "a4"))).toBe(true);
    expect(has(ms, mv("a1", "a5"))).toBe(false);
  });
  it("slides any distance in a line, but not diagonally or over a piece", () => {
    const s = fromRows([".....", ".....", "..g.w", ".....", "....."]);
    const ms = genMoves(s.b, GOLD);
    expect(has(ms, mv("c3", "c5"))).toBe(true);
    expect(has(ms, mv("c3", "a3"))).toBe(true);
    expect(has(ms, mv("c3", "d3"))).toBe(true);
    expect(has(ms, mv("c3", "e3"))).toBe(false); // occupied
    expect(has(ms, mv("c3", "d4"))).toBe(false); // diagonal
    expect(ms).toHaveLength(7);
    const blocked = fromRows([".....", ".....", "gw...", ".....", "....."]);
    expect(has(genMoves(blocked.b, GOLD), mv("a3", "c3"))).toBe(false); // no jumping
  });
});

describe("captures", () => {
  it("takes a piece trapped between the mover and a friend", () => {
    const s = fromRows(["w....", ".....", ".gw..", ".....", "...gw"]);
    const n = play(s, mv("d1", "d3"));
    expect(n.last?.caps).toEqual([fromSq("c3")]);
    expect(n.b[fromSq("c3")]).toBe(0);
    expect(n.pieces.find(p => p.pos === fromSq("c3") && p.side === WHITE)?.alive).toBe(false);
    expect(n.quiet).toBe(0);
  });
  it("can take three at once", () => {
    const s = fromRows(["..g..", "..w..", "gw.wg", ".....", "w.g.w"]);
    const m = mv("c1", "c3");
    expect(capsOf(s.b, m, GOLD)).toHaveLength(3);
    const n = play(s, m);
    expect(count(n.b, WHITE)).toBe(2);
    expect(n.winner).toBe(null);
  });
  it("lets a piece move safely into a gap between two enemies", () => {
    const s = fromRows(["....w", ".....", ".w.w.", ".....", "g.g.."]);
    const n = play(s, mv("c1", "c3"));
    expect(n.b[fromSq("c3")]).toBe(GOLD);
    expect(n.last?.caps).toEqual([]);
  });
  it("does not use the board edge as an anchor", () => {
    const s = fromRows([".....", ".....", "w....", ".....", "..g.w"]);
    expect(play(s, mv("c1", "c3")).b[fromSq("c3")]).toBe(GOLD);
    expect(capsOf(s.b, mv("c1", "c3"), GOLD)).toEqual([]);
    const t = fromRows([".....", ".....", "w....", ".....", ".g..w"]);
    expect(capsOf(t.b, mv("b1", "b3"), GOLD)).toEqual([]);
  });
  it("only the moving side captures, and only around the moved piece", () => {
    // White b3 already sits between golds a3 and c3; a gold move elsewhere doesn't take it.
    const s = fromRows(["w....", ".....", "gwg..", ".....", "....g"]);
    const n = play(s, mv("e1", "e2"));
    expect(n.b[fromSq("b3")]).toBe(WHITE);
    // Moving the far anchor into place does take.
    const t = fromRows(["w...w", ".....", ".wg..",".....", "g...."]);
    expect(play(t, mv("a1", "a3")).b[fromSq("b3")]).toBe(0);
  });
  it("lists the pieces in danger", () => {
    const s = fromRows(["....w", ".....", ".gw..", ".....", "...g."], WHITE);
    expect([...threatened(s.b, WHITE)]).toEqual([fromSq("c3")]);
    expect(threatened(s.b, GOLD).size).toBe(0);
  });
});

describe("the end", () => {
  it("wins by cutting the rival to one piece", () => {
    const s = fromRows(["....w", ".....", ".gw..", ".....", "...g."]);
    const n = play(s, mv("d1", "d3"));
    expect(n.winner).toBe(GOLD);
    expect(n.reason).toBe("reduced");
  });
  it("wins by leaving the rival with no move", () => {
    const s = fromRows(["ww.g.", "gg...", ".....", ".....", "....."]);
    const n = play(s, mv("d5", "c5"));
    expect(n.last?.caps).toEqual([]);
    expect(genMoves(n.b, WHITE)).toHaveLength(0);
    expect(n.winner).toBe(GOLD);
    expect(n.reason).toBe("blocked");
  });
  it(`after ${QUIET_LIMIT} quiet moves the side with more pieces wins`, () => {
    const s = fromRows(["w...w", ".....", ".....", ".....", "g.g.g"], GOLD, QUIET_LIMIT - 1);
    const n = play(s, mv("c1", "c2"));
    expect(n.quiet).toBe(QUIET_LIMIT);
    expect(n.winner).toBe(GOLD);
    expect(n.reason).toBe("quiet");
    const t = fromRows(["w.w.w", ".....", ".....", ".....", "g...g"], GOLD, QUIET_LIMIT - 1);
    expect(play(t, mv("a1", "a2")).winner).toBe(WHITE);
  });
  it(`after ${QUIET_LIMIT} quiet moves with equal pieces it's a draw`, () => {
    const s = fromRows(["w...w", ".....", ".....", ".....", "g...g"], GOLD, QUIET_LIMIT - 1);
    const n = play(s, mv("a1", "a2"));
    expect(n.winner).toBe(0);
    expect(n.reason).toBe("quiet");
  });
  it("a capture resets the quiet count", () => {
    const s = fromRows(["w...w", ".....", ".gw..", ".....", "w..g."], GOLD, QUIET_LIMIT - 1);
    const n = play(s, mv("d1", "d3"));
    expect(n.quiet).toBe(0);
    expect(n.winner).toBe(null);
  });
  it("one move before the limit, play goes on", () => {
    const s = fromRows(["w...w", ".....", ".....", ".....", "g...g"], GOLD, QUIET_LIMIT - 2);
    expect(play(s, mv("a1", "a2")).winner).toBe(null);
  });
});
