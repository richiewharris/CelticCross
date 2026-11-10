// The guided game's notes are written against one recorded match. If a rules change makes it play out differently,
// this fails: regenerate with sim/roth/walkgen.ts and rewrite walkthrough/notes.ts to match.
import { describe, expect, it } from "vitest";
import { replayScript } from "../../walkthrough/Walkthrough";
import { COACH } from "../../walkthrough/notes";

describe("the guided game", () => {
  it("replays to the game the notes describe", () => {
    const g = replayScript();
    expect(g.end.result).toMatchObject({ winner: 0, decidedBy: "felled", felled: [1, 2] });
    expect(g.steps.length).toBe(107);
    expect(Math.max(...Object.keys(COACH).map(Number))).toBeLessThan(g.steps.length);
    expect(g.steps[24].line).toContain("Cast out Finnbennach");
    expect(g.steps[29].maths.join(" ")).toContain("blocks with Salmon leap");
    expect(g.steps[37].maths.join(" ")).toContain("Armour 1");
    expect(g.steps[41].maths.join(" ")).toContain("Fiacha mac Fir Febe 8 → 8");
    expect(g.steps[58].maths.join(" ")).toContain("+1 rested");
    expect(g.steps[94].maths.join(" ")).toContain("Lóegaire Búadach is weary");
    expect(g.steps[106].maths.join(" ")).toContain("Lóch Mór mac Mo Febis 3 → 0");
  });
});
