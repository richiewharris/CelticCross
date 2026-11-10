// The guided game's notes are written against one recorded match. If a rules change makes it play out differently,
// this fails: regenerate with sim/roth/walkgen.ts and rewrite walkthrough/notes.ts to match.
import { describe, expect, it } from "vitest";
import { replayScript } from "../../walkthrough/Walkthrough";
import { COACH } from "../../walkthrough/notes";

describe("the guided game", () => {
  it("replays to the game the notes describe", () => {
    const g = replayScript();
    expect(g.end.result).toMatchObject({ winner: 0, decidedBy: "felled", felled: [1, 2] });
    expect(g.steps.length).toBe(89);
    expect(Math.max(...Object.keys(COACH).map(Number))).toBeLessThan(g.steps.length);
    expect(g.steps[16].line).toContain("supplanted Fráech's spear with Salmon leap");
    expect(g.steps[30].line).toContain("Cast out Medb's war-chariot");
    expect(g.steps[49].maths.join(" ")).toContain("Lóegaire Búadach 3 → 0");
    expect(g.steps[53].maths.join(" ")).toContain("Medb 6 → 3");
    expect(g.steps[88].maths.join(" ")).toContain("Nad Crantail 1 → -2");
  });
});
