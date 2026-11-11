// The guided game's notes are written against one recorded match. If a rules change makes it play out differently,
// this fails: regenerate with sim/roth/walkgen.ts and rewrite walkthrough/notes.ts to match.
import { describe, expect, it } from "vitest";
import { replayScript } from "../../walkthrough/Walkthrough";
import { COACH } from "../../walkthrough/notes";

describe("the guided game", () => {
  it("replays to the game the notes describe", () => {
    const g = replayScript();
    expect(g.end.result).toMatchObject({ winner: 0, decidedBy: "felled", felled: [0, 2] });
    expect(g.steps.length).toBe(114);
    expect(Math.max(...Object.keys(COACH).map(Number))).toBeLessThan(g.steps.length);
    expect(g.steps[29].maths.join(" ")).toContain("Fergus mac Róich 8 → 5");
    expect(g.steps[33].maths.join(" ")).toContain("Armour 1");
    expect(g.steps[73].maths.join(" ")).toContain("blocks with Salmon leap");
    expect(g.steps[73].maths.join(" ")).toContain("bleeds");
    expect(g.steps[81].maths.join(" ")).toContain("Valour 8 → 12");
    expect(g.steps[99].maths.join(" ")).toContain("is swift");
    expect(g.steps[113].maths.join(" ")).toContain("Lóch Mór mac Mo Febis 1 → 0");
  });
});
