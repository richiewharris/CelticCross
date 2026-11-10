// The guided game's notes are written against one recorded match. If a rules change makes it play out differently,
// this fails: regenerate with sim/roth/walkgen.ts and rewrite walkthrough/notes.ts to match.
import { describe, expect, it } from "vitest";
import { replayScript } from "../../walkthrough/Walkthrough";
import { COACH } from "../../walkthrough/notes";

describe("the guided game", () => {
  it("replays to the game the notes describe", () => {
    const g = replayScript();
    expect(g.end.result).toMatchObject({ winner: 0, decidedBy: "felled", felled: [0, 1] });
    expect(g.steps.length).toBe(Object.keys(COACH).length);
    expect(g.steps[16].line).toContain("supplanted Fedelm's prophecy with Salmon leap");
    expect(g.steps[27].line).toContain("Break the geis or oath and use Salmon leap");
    expect(g.steps[24].maths.join(" ")).toContain("Ferdiad 5 → 2");
    expect(g.steps[31].maths.join(" ")).toContain("Medb 5 → 3");
  });
});
