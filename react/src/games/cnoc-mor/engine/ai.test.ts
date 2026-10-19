import { describe, expect, it } from "vitest";
import { LEVELS, MATE, analyse, cpuPick, cpuPlace, evalHost, search } from "./ai";
import { CENTRE, CH, LO, NN, RI, SP, apply, emptyState, gen, immediateWin, mv, zoneOk, type State } from "./rules";
import { at, sparse } from "./testkit";

const opts = { depth: 3, ms: 3000, noise: 0 };
const canWinNow = (s: State) => gen(s).some(m => immediateWin(s, m));

describe("the computer", () => {
  it("stands the Lord on the cairn when it can", () => {
    const s = sparse({ d4: "L", a9: "R" });
    expect(search(s, opts, new Map())).toBe(mv(at("d4"), CENTRE));
  });
  it("takes the Lord when it can", () => {
    const s = sparse({ c3: "R", b2: "L", i9: "S" }, 1);
    expect(search(s, opts, new Map())).toBe(mv(at("c3"), at("b2")));
  });
  it("as the Sí, blocks the cairn", () => {
    const s = sparse({ d4: "L", a9: "R", i9: "S" }, 1);
    expect(canWinNow({ ...s, turn: 0 })).toBe(true);
    const m = search(s, opts, new Map())!;
    expect(canWinNow(apply(s, m))).toBe(false);
  });
  it("as the Host, saves the Lord", () => {
    const s = sparse({ b2: "L", c3: "R", i9: "C", a9: "S" }, 0, 0, 0);
    const m = search(s, opts, new Map())!;
    expect(canWinNow(apply(s, m))).toBe(false);
  });
  it("sees a forced win as a mate score", () => {
    const s = sparse({ d4: "L", a9: "R" });
    expect(analyse(s, 4, 2000, new Map()).v).toBeGreaterThan(MATE / 2);
  });
  it("has four levels", () => {
    expect(Object.values(LEVELS).map(l => l.name)).toEqual(["Novice", "Warrior", "Champion", "High King"]);
  });
  it("values reserves and the Lord's climb", () => {
    const a = sparse({ a1: "L", e9: "R" }, 0, 3, 1), b = { ...a, rh: 2 };
    expect(evalHost(a)).toBeGreaterThan(evalHost(b));
    expect(evalHost(sparse({ d4: "L", e9: "R" }))).toBeGreaterThan(evalHost(sparse({ a1: "L", e9: "R" })));
  });
  it("sets pieces only in its own zone at every level", () => {
    for (const lvl of [1, 2, 3, 4]) {
      for (const side of [0, 1] as const) {
        const s = emptyState();
        s.b[at("a1")] = SP; s.b[at("c3")] = RI;
        const i = cpuPlace(s, side, side === 0 ? SP : RI, lvl);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(NN);
        expect(s.b[i]).toBe(0);
        expect(zoneOk(side, i)).toBe(true);
      }
    }
  });
  it("picks a piece it still has", () => {
    expect(cpuPick({ [LO]: 1, [SP]: 0 }, 0)).toBe(LO);
    expect(cpuPick({ [LO]: 0, [SP]: 3 }, 0)).toBe(SP);
    expect(cpuPick({ [CH]: 1, [RI]: 4 }, 1, () => 0)).toBe(CH);
    expect(cpuPick({ [CH]: 1, [RI]: 4 }, 1, () => 0.99)).toBe(RI);
  });
  it("returns null with no move", () => {
    expect(search(sparse({ a1: "L" }, 1), opts, new Map())).toBeNull();
  });
});
