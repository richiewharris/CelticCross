import { describe, expect, it } from "vitest";
import {
  CENTRE, DROP, LO, NN, RI, SP, SUMMIT, TIER, apply, from, gen, key, mv, sqName, to, total, zoneOk,
} from "./rules";
import { at, sparse } from "./testkit";

const has = (ms: number[], f: string, t: string) => ms.includes(mv(at(f), at(t)));
const targets = (ms: number[], f: string) => new Set(ms.filter(m => from(m) === at(f)).map(m => sqName(to(m))));
const drops = (ms: number[]) => ms.filter(m => from(m) === DROP).map(to);

describe("the hill", () => {
  it("has 32 outer, 24 lower-slope, 20 upper-slope and 5 summit holes", () => {
    expect(TIER.filter(t => t === 1)).toHaveLength(32);
    expect(TIER.filter(t => t === 2)).toHaveLength(24);
    expect(TIER.filter(t => t === 3)).toHaveLength(20);
    expect(TIER.filter(t => t === 4)).toHaveLength(5);
    expect(["d5", "e5", "f5", "e4", "e6"].every(s => SUMMIT[at(s)])).toBe(true);
  });
  it("has the cairn at the centre, e5", () => {
    expect(CENTRE).toBe(40);
    expect(sqName(CENTRE)).toBe("e5");
    expect(at("a9")).toBe(0);
    expect(at("i1")).toBe(80);
  });
  it("setup zones: Host on the outer ring, Sí on the upper slope or summit", () => {
    expect([...Array(NN).keys()].filter(i => zoneOk(0, i))).toHaveLength(32);
    expect([...Array(NN).keys()].filter(i => zoneOk(1, i))).toHaveLength(25);
    expect(zoneOk(1, at("b2"))).toBe(false);
  });
});

describe("spearmen", () => {
  it("step one hole any way, but a diagonal step can't climb", () => {
    const ms = gen(sparse({ b5: "S", i1: "L", a9: "R" }));
    expect(targets(ms, "b5")).toEqual(new Set(["a6", "a5", "a4", "b6", "b4", "c5"]));
  });
  it("step diagonally downhill or along a tier", () => {
    const ms = gen(sparse({ c3: "S", i1: "L", a9: "R" }));
    expect(targets(ms, "c3")).toEqual(new Set(["b4", "c4", "d4", "b3", "d3", "b2", "c2", "d2"]));
  });
  it("on the outer ring corner, never climb diagonally", () => {
    const ms = gen(sparse({ a1: "S", i9: "L", e9: "R" }));
    expect(targets(ms, "a1")).toEqual(new Set(["a2", "b1"]));
  });
  it("may take a piece on the cairn", () => {
    const ms = gen(sparse({ d5: "S", e5: "R", i1: "L" }));
    expect(has(ms, "d5", "e5")).toBe(true);
  });
});

describe("the Lord", () => {
  it("steps one hole any way, no further", () => {
    const ms = gen(sparse({ d3: "L", a9: "R" }));
    expect(targets(ms, "d3")).toEqual(new Set(["c4", "d4", "e4", "c3", "e3", "c2", "d2", "e2"]));
  });
  it("can't take a piece standing on the cairn", () => {
    const ms = gen(sparse({ d4: "L", e5: "R" }));
    expect(has(ms, "d4", "e5")).toBe(false);
  });
  it("can take a piece on another summit hole", () => {
    const ms = gen(sparse({ d4: "L", d5: "R", a9: "R" }));
    expect(has(ms, "d4", "d5")).toBe(true);
  });
});

describe("riders and the chariot", () => {
  it("riders slide diagonally any distance downhill", () => {
    const ms = gen(sparse({ e5: "R", a9: "L" }, 1));
    expect(targets(ms, "e5")).toEqual(new Set(["d4", "c3", "b2", "a1", "f6", "g7", "h8", "i9", "d6", "c7", "b8", "f4", "g3", "h2", "i1"].filter(s => s !== "a9")));
  });
  it("a rider's slide stops when it climbs a tier", () => {
    const ms = gen(sparse({ a1: "R", i9: "L", e9: "S" }, 1));
    expect(targets(ms, "a1").has("b2")).toBe(true);
    expect(targets(ms, "a1").has("c3")).toBe(false);
  });
  it("riders can't take the Lord on the outer ring", () => {
    const ms = gen(sparse({ c3: "R", a1: "L", e5: "S" }, 1));
    expect(has(ms, "c3", "a1")).toBe(false);
    expect(has(ms, "c3", "b2")).toBe(true);
  });
  it("riders can take the Lord off the outer ring", () => {
    const ms = gen(sparse({ c3: "R", b2: "L", e5: "S" }, 1));
    expect(has(ms, "c3", "b2")).toBe(true);
  });
  it("the Chariot can take the Lord on the outer ring", () => {
    const s = sparse({ a5: "C", a1: "L", e5: "S" }, 1);
    expect(has(gen(s), "a5", "a1")).toBe(true);
    expect(apply(s, mv(at("a5"), at("a1")))).toMatchObject({ res: 2, why: "lord" });
  });
  it("the Chariot slides along rows and columns, stopping when it climbs", () => {
    const ms = gen(sparse({ a5: "C", i1: "L", e5: "S" }, 1));
    expect(targets(ms, "a5")).toEqual(new Set(["a9", "a8", "a7", "a6", "a4", "a3", "a2", "a1", "b5"]));
    const down = gen(sparse({ e5: "C", a1: "L", a9: "S" }, 1));
    expect(targets(down, "e5")).toEqual(new Set(["e9", "e8", "e7", "e6", "e4", "e3", "e2", "e1", "a5", "b5", "c5", "d5", "f5", "g5", "h5", "i5"]));
  });
});

describe("back to the hill", () => {
  it("a Sí piece may jump to any empty summit hole while no Host piece is on it", () => {
    const ms = gen(sparse({ a9: "R", i1: "L" }, 1));
    expect(targets(ms, "a9")).toEqual(new Set(["b8", "d5", "e5", "f5", "e4", "e6"]));
  });
  it("not while a Host piece stands on the summit", () => {
    const ms = gen(sparse({ a9: "R", e4: "S", i1: "L" }, 1));
    expect(targets(ms, "a9")).toEqual(new Set(["b8"]));
  });
  it("only onto empty summit holes, and not from the summit itself", () => {
    const ms = gen(sparse({ a9: "C", d5: "R", i1: "L" }, 1));
    expect(targets(ms, "a9").has("d5")).toBe(false);
    expect(targets(ms, "a9").has("e5")).toBe(true);
    // the Rider on d5 slides as usual but gains no jumps
    expect(targets(ms, "d5")).toEqual(new Set(["c6", "b7", "a8", "c4", "b3", "a2", "e6", "f7", "g8", "h9", "e4", "f3", "g2", "h1"]));
  });
});

describe("reserves", () => {
  it("Host spearmen enter on any empty outer-ring hole", () => {
    const s = sparse({ a1: "L", e5: "R" }, 0, 3, 1);
    const d = drops(gen(s));
    expect(d).toHaveLength(31);
    expect(d.every(j => TIER[j] === 1)).toBe(true);
    const t = apply(s, mv(DROP, at("c1")));
    expect(t.b[at("c1")]).toBe(SP);
    expect(t.rh).toBe(2);
    expect(t.rs).toBe(1);
    expect(t.res).toBe(0);
  });
  it("the Sí Rider enters on the upper slope or summit (tier 3 and up)", () => {
    const s = sparse({ a1: "L", e5: "C" }, 1, 3, 1);
    const d = drops(gen(s));
    expect(d).toHaveLength(24);
    expect(d.every(j => TIER[j] >= 3)).toBe(true);
    const t = apply(s, mv(DROP, at("c3")));
    expect(t.b[at("c3")]).toBe(RI);
    expect(t.rs).toBe(0);
  });
  it("no entries once the reserve is empty", () => {
    expect(drops(gen(sparse({ a1: "L", e5: "R" }, 0, 0, 1)))).toHaveLength(0);
    expect(drops(gen(sparse({ a1: "L", e5: "R" }, 1, 3, 0)))).toHaveLength(0);
  });
  it("encode as DROP * 128 + hole", () => {
    expect(DROP).toBe(127);
    expect(mv(DROP, 5)).toBe(127 * 128 + 5);
  });
  it("count towards the side's total", () => {
    const s = sparse({ a1: "L", e5: "R" }, 0, 3, 1);
    expect(total(s, 0)).toBe(4);
    expect(total(s, 1)).toBe(2);
  });
});

describe("winning", () => {
  it("the Lord standing on the cairn wins for the Host", () => {
    const s = sparse({ d4: "L", a9: "R" });
    expect(apply(s, mv(at("d4"), at("e5")))).toMatchObject({ res: 1, why: "crown" });
  });
  it("other summit holes are not the cairn", () => {
    const s = sparse({ d4: "L", a9: "R" });
    expect(apply(s, mv(at("d4"), at("d5"))).res).toBe(0);
  });
  it("taking the Lord wins for the Sí", () => {
    const s = sparse({ c3: "R", b2: "L", e5: "S" }, 1);
    expect(apply(s, mv(at("c3"), at("b2")))).toMatchObject({ res: 2, why: "lord" });
  });
  it("taking the last Sí piece wins for the Host, but only with the Sí reserve empty", () => {
    const s = sparse({ a2: "S", a3: "R", i1: "L" }, 0, 0, 0);
    expect(apply(s, mv(at("a2"), at("a3")))).toMatchObject({ res: 1, why: "wipe" });
    const s2 = sparse({ a2: "S", a3: "R", i1: "L" }, 0, 0, 1);
    expect(apply(s2, mv(at("a2"), at("a3"))).res).toBe(0);
  });
  it("each move counts a ply", () => {
    const s = sparse({ a2: "S", a9: "R", i1: "L" }, 0, 0, 0, 41);
    expect(apply(s, mv(at("a2"), at("a1"))).ply).toBe(42);
  });
});

describe("position keys", () => {
  it("count the reserves but not the ply", () => {
    const a = sparse({ a1: "L", e5: "R" }, 0, 3, 1, 0);
    expect(key(a)).not.toBe(key({ ...a, rh: 2 }));
    expect(key(a)).not.toBe(key({ ...a, rs: 0 }));
    expect(key(a)).toBe(key({ ...a, ply: 9 }));
    expect(key(a)).not.toBe(key({ ...a, turn: 1 }));
  });
  it("the Lord piece code is 2", () => expect(LO).toBe(2));
});
