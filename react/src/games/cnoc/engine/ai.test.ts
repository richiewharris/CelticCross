import { describe, expect, it } from "vitest";
import { MATE, analyse, search } from "./ai";
import { immediateWin, mv, type Rules } from "./rules";
import { at, pos } from "./testkit";

const R7: Rules = { holdN: 7 };
const opts = { depth: 4, ms: 2000, noise: 0 };

describe("the computer", () => {
  it("crowns the Lord when it can", () => {
    const s = pos([".......", ".......", ".......", ".......", "..L....", ".......", "R......"]);
    const m = search(s, opts, new Map(), R7)!;
    expect(immediateWin(s, m, R7)).toBe(true); // any summit hole will do
  });
  it("takes the Lord when it can", () => {
    const s = pos([".......", ".......", ".......", ".......", "..L....", ".R.....", "S......"], 1);
    expect(search(s, opts, new Map(), R7)).toBe(mv(at("b2"), at("c3")));
  });
  it("sees a forced win as a mate score", () => {
    const s = pos([".......", ".......", ".......", ".......", "..L....", ".......", "R......"]);
    expect(analyse(s, 4, 2000, new Map(), R7).v).toBeGreaterThan(MATE / 2);
  });
});
