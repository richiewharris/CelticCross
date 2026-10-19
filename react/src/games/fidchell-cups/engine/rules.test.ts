import { describe, expect, it } from "vitest";
import {
  JUG, MEAD, QUIET_LIMIT, WINE, capturesFor, d6, drink, legalNow, move, movesFor, newState, passTurn, refillSpot, rollOutcome,
  sq, toast, treason, withDice,
} from "./rules";
import { at, dice, pos } from "./testkit";

const EMPTY = ".......";

describe("the board", () => {
  it("starts with seven cups a side on the back rows, full jugs, mead to roll", () => {
    const s = newState(8);
    expect(s.b.filter(v => v === MEAD)).toHaveLength(7);
    expect(s.b.filter(v => v === WINE)).toHaveLength(7);
    for (let c = 0; c < 7; c++) { expect(s.b[at("a1") + c]).toBe(MEAD); expect(s.b[at("a7") + c]).toBe(WINE); }
    expect(s.jug).toEqual({ 1: JUG, 2: JUG });
    expect(s.turn).toBe(MEAD);
    expect(s.queen).toBe(8);
  });
  it("names squares from a1 at mead's left", () => {
    expect(sq(at("a1"))).toBe("a1");
    expect(sq(at("g7"))).toBe("g7");
    expect(sq(at("d4"))).toBe("d4");
  });
  it("rolls fair dice from the injected rng", () => {
    expect([d6(() => 0), d6(() => 0.999), d6(dice(3))]).toEqual([1, 6, 3]);
  });
});

describe("moves", () => {
  it("move exactly d holes in a straight line through empty holes", () => {
    const s = pos([EMPTY, EMPTY, EMPTY, "...M...", EMPTY, EMPTY, EMPTY]);
    const tos = movesFor(s.b, MEAD, 3).map(([, t]) => sq(t)).sort();
    expect(tos).toEqual(["a4", "d1", "d7", "g4"]);
    expect(movesFor(s.b, MEAD, 4)).toHaveLength(0);
  });
  it("cannot pass through or land on a cup", () => {
    const s = pos([EMPTY, EMPTY, EMPTY, ".W.M...", EMPTY, "...M...", EMPTY]);
    const tos = movesFor(s.b, MEAD, 2).filter(([f]) => f === at("d4")).map(([, t]) => sq(t)).sort();
    expect(tos).toEqual(["d6", "f4"]); // b4 is behind a wine cup, d2 is taken
  });
  it("the second die must move a different cup", () => {
    let s = withDice(pos([EMPTY, EMPTY, EMPTY, "...M...", EMPTY, EMPTY, "M......"]), [1, 2]);
    s = move(s, 0, at("d4"), at("d5")).s;
    const left = legalNow(s);
    expect(left.every(([k, f]) => k === 1 && f === at("a1"))).toBe(true);
    expect(left.length).toBeGreaterThan(0);
  });
  it("offers nothing while the Queen waits for her toast", () => {
    const s = withDice(newState(5), [2, 3]);
    expect(s.queenPending).toBe(true);
    expect(legalNow(s)).toEqual([]);
  });
});

describe("drinking", () => {
  it("traps a rival cup between the moved cup and another", () => {
    const s = pos([EMPTY, EMPTY, EMPTY, "M.W....", EMPTY, EMPTY, "...M..."]);
    expect(capturesFor(s.b, at("d4"), MEAD)).toEqual([]); // b4 is empty: no trap
    const t = pos([EMPTY, EMPTY, EMPTY, ".MW....", EMPTY, EMPTY, "...M..."], { dice: [3, 1] });
    const r = move(t, 0, at("d1"), at("d4"));
    expect(r.caps).toEqual([at("c4")]);
    expect(r.s.b[at("c4")]).toBe(0);
    expect(r.s.drinks[MEAD]).toBe(1);
    expect(r.s.jug[WINE]).toBe(JUG - 1);
    expect(r.s.quiet).toBe(0);
  });
  it("moving into a gap between two rival cups is safe", () => {
    const s = pos([EMPTY, EMPTY, EMPTY, "..W.W..", EMPTY, EMPTY, "...M..."], { dice: [3, 1] });
    const r = move(s, 0, at("d1"), at("d4"));
    expect(r.caps).toEqual([]);
    expect(r.s.b[at("d4")]).toBe(MEAD);
    expect(r.s.quiet).toBe(1);
  });
  it("can drink two cups with one move", () => {
    const s = pos([EMPTY, EMPTY, "...M...", "...W...", ".MW.WM.", EMPTY, "...M..."], { dice: [2, 1] });
    const r = move(s, 0, at("d1"), at("d3"));
    expect(r.caps.sort((x, y) => x - y)).toEqual([at("d4"), at("c3"), at("e3")].sort((x, y) => x - y));
    expect(r.s.jug[WINE]).toBe(1);
  });
  it("refills on the owner's back row nearest the middle, then the next row in", () => {
    const s = newState(8);
    s.b[at("d1")] = 0;
    expect(refillSpot(s.b, MEAD)).toBe(at("d1"));
    s.b[at("d1")] = MEAD; s.b[at("a1")] = 0; s.b[at("e1")] = 0;
    expect(refillSpot(s.b, MEAD)).toBe(at("e1"));
    s.b[at("a1")] = MEAD; s.b[at("e1")] = MEAD;
    expect(refillSpot(s.b, MEAD)).toBe(at("d2"));
    expect(refillSpot(s.b, WINE)).toBe(at("d6"));
  });
  it("a refill is a new cup that pours in", () => {
    const s = pos([EMPTY, EMPTY, EMPTY, ".MW....", EMPTY, EMPTY, "...M..."], { dice: [3, 1] });
    const r = move(s, 0, at("d1"), at("d4"));
    expect(r.events).toEqual([{ at: at("c4"), refill: at("d7") }]);
    const fresh = r.s.pieces.filter(p => p.fresh);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ side: WINE, pos: at("d7"), alive: true });
  });
  it("a side that must refill from an empty jug loses", () => {
    const s = pos([EMPTY, EMPTY, EMPTY, ".MW....", EMPTY, EMPTY, "...M..."], { dice: [3, 1], jug: { 1: 4, 2: 0 } });
    const r = move(s, 0, at("d1"), at("d4"));
    expect(r.s.winner).toBe(MEAD);
    expect(r.s.reason).toBe("dry");
  });
  it("after the quiet limit, whoever drank more wins; level is a draw", () => {
    const base = pos([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "...M..."], { dice: [1, 2], quiet: QUIET_LIMIT - 1, drinks: { 1: 2, 2: 1 } });
    expect(move(base, 0, at("d1"), at("d2")).s).toMatchObject({ winner: MEAD, reason: "quiet" });
    const level = { ...base, drinks: { 1: 1, 2: 1 } };
    expect(move(level, 0, at("d1"), at("d2")).s.winner).toBe(0);
    const behind = { ...base, drinks: { 1: 0, 2: 1 } };
    expect(move(behind, 0, at("d1"), at("d2")).s.winner).toBe(WINE);
  });
  it("drink stops once the game is won", () => {
    const s = pos([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "WW....M"], { jug: { 1: 4, 2: 0 } });
    drink(s, [at("a1"), at("b1")], MEAD);
    expect(s.winner).toBe(MEAD);
    expect(s.drinks[MEAD]).toBe(1);
  });
});

describe("rolls", () => {
  it("the Queen's number comes before a pass number", () => {
    expect(rollOutcome(withDice(newState(7), [3, 4]))).toBe("queen");
    expect(rollOutcome(withDice(newState(8), [3, 4]))).toBe("pass");
    expect(rollOutcome(withDice(newState(8), [5, 6]))).toBe("pass");
    expect(rollOutcome(withDice(newState(8), [6, 6]))).toBe("pass");
  });
  it("is stuck when no cup can move either die", () => {
    // Mead's back row can only move up, and row 2 is full of wine.
    const s = pos([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "WWWWWWW", "MMMMMMM"], { queen: 2 });
    expect(rollOutcome(withDice(s, [1, 2]))).toBe("stuck");
    expect(rollOutcome(withDice(newState(2), [1, 2]))).toBe("move");
  });
  it("a toast drinks any rival cup, then the roller rolls again", () => {
    const s = withDice(newState(8), [3, 5]);
    const r = toast(s, at("a7"));
    expect(r.s.turn).toBe(MEAD);
    expect(r.s.dice).toBeNull();
    expect(r.s.drinks[MEAD]).toBe(1);
    expect(r.s.jug[WINE]).toBe(JUG - 1);
  });
  it("a toast on a Queen's number that is also a pass number sends the dice across", () => {
    const r = toast(withDice(newState(7), [3, 4]), at("a7"));
    expect(r.s.turn).toBe(WINE);
  });
  it("treason: the rival drinks one of the roller's cups, and the roller rolls on", () => {
    const s = withDice(newState(8), [4, 4]);
    const r = treason(s, at("a1"));
    expect(r.s.turn).toBe(MEAD);
    expect(r.s.drinks[WINE]).toBe(1);
    expect(r.s.jug[MEAD]).toBe(JUG - 1);
    expect(r.s.dice).toBeNull();
  });
  it("passing hands the dice across with nothing used", () => {
    const s = passTurn(withDice(newState(8), [1, 2]));
    expect(s).toMatchObject({ turn: WINE, dice: null, used: [false, false], movedTo: -1, queenPending: false });
  });
});
