import { describe, expect, it } from "vitest";
import { SUMMIT, TIER, apply, gen, mv, presence, type Rules } from "./rules";
import { at, pos } from "./testkit";

const R7: Rules = { holdN: 7 };
const has = (ms: number[], f: string, t: string) => ms.includes(mv(at(f), at(t)));

describe("the board", () => {
  it("has 24 low, 20 slope and 5 summit holes", () => {
    expect(TIER.filter(t => t === 1)).toHaveLength(24);
    expect(TIER.filter(t => t === 2)).toHaveLength(20);
    expect(SUMMIT.filter(Boolean)).toHaveLength(5);
  });
});

describe("moves", () => {
  it("spearmen step one hole, straight only", () => {
    const s = pos([".......", ".......", ".......", ".......", ".......", ".......", "S......"]);
    const ms = gen(s);
    expect(ms).toHaveLength(2);
    expect(has(ms, "a1", "a2")).toBe(true);
    expect(has(ms, "a1", "b1")).toBe(true);
  });
  it("a slide that climbs a tier stops there", () => {
    // Chariot on a4 (low ground) sliding right climbs onto b4 (slope) and must stop.
    const s = pos([".......", ".......", ".......", "C......", ".......", ".......", "......L"], 1);
    const ms = gen(s);
    expect(has(ms, "a4", "b4")).toBe(true);
    expect(has(ms, "a4", "c4")).toBe(false);
    // Downhill is free: along the a-file it runs the whole way.
    expect(has(ms, "a4", "a7")).toBe(true);
  });
  it("the Lord may climb onto the summit only when no Sí piece holds it", () => {
    const held = pos([".......", ".......", "...R...", ".......", "..L....", ".......", "......."]);
    expect(has(gen(held), "c3", "d4")).toBe(false);
    const clear = pos([".......", ".......", ".......", ".......", "..L....", ".......", "......."]);
    expect(has(gen(clear), "c3", "d4")).toBe(true);
  });
});

describe("winning", () => {
  it("crowning the Lord wins for the Host", () => {
    const s = pos([".......", ".......", ".......", ".......", "..L....", ".......", "R......"]);
    expect(apply(s, mv(at("c3"), at("d4")), R7)).toMatchObject({ res: 1, why: "crown" });
  });
  it("taking the Lord wins for the Sí", () => {
    const s = pos([".......", ".......", ".......", ".......", "..L....", ".R.....", "S......"], 1);
    expect(apply(s, mv(at("b2"), at("c3")), R7)).toMatchObject({ res: 2, why: "lord" });
  });
  it("taking the last Sí piece wins for the Host", () => {
    const s = pos([".......", ".......", ".......", ".......", ".......", "R......", "S.....L"]);
    expect(apply(s, mv(at("a1"), at("a2")), R7)).toMatchObject({ res: 1, why: "wipe" });
  });
});

describe("the hold", () => {
  it("counts Sí turns that end holding the summit", () => {
    const s2 = pos([".......", ".......", "...R...", ".......", ".......", "R......", "L.....S"], 1, 3);
    expect(apply(s2, mv(at("a2"), at("b3")), R7).hold).toBe(4);
  });
  it("is reset by any Host piece on the summit", () => {
    const s = pos([".......", ".......", "...R...", "..S....", ".......", ".......", "L......"], 0, 5);
    const t = apply(s, mv(at("c4"), at("d4")), R7);
    expect(presence(t.b, 0)).toBe(true);
    expect(t.hold).toBe(0);
  });
  it("wins when it reaches the hold length", () => {
    const s = pos([".......", ".......", "...R...", ".......", ".......", "R......", "L......"], 1, 6);
    expect(apply(s, mv(at("a2"), at("b3")), R7)).toMatchObject({ res: 2, why: "hold" });
  });
});
