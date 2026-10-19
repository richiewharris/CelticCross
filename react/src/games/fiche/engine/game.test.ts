import { describe, expect, it } from "vitest";
import { ALL, bit, seeded, type Die } from "./dice";
import { DEFAULT_SETTINGS, applyRoll, legalDie, need, newMatch, newRound, nextRound, takeDie, type Game, type Player, type Settings } from "./game";

/** A match where `starter` rolls first, with the round's total and hands set. */
function at(total: number, hands: [number, number] = [ALL, ALL], starter: Player = 1, st: Partial<Settings> = {}): Game {
  const g = newMatch({ ...DEFAULT_SETTINGS, ...st }, () => 0);
  const R = newRound(starter);
  R.total = total; R.hands = { 1: hands[0], 2: hands[1] };
  return { M: g.M, R };
}

describe("a new match", () => {
  it("tosses for who starts", () => {
    expect(newMatch(DEFAULT_SETTINGS, () => 0.1).R.turn).toBe(1);
    expect(newMatch(DEFAULT_SETTINGS, () => 0.9).R.turn).toBe(2);
    expect(newMatch(DEFAULT_SETTINGS, () => 0.1).R.msg).toBe("You won the toss and roll first.");
    expect(newMatch(DEFAULT_SETTINGS, () => 0.9).R.msg).toBe("Rival wins the toss and rolls first.");
    expect(newMatch({ ...DEFAULT_SETTINGS, mode: "pvp" }, () => 0.9).R.msg).toBe("Player 2 wins the toss and rolls first.");
  });
  it("first to 2 in best of 3, first to 3 in best of 5", () => {
    expect(need(at(0).M)).toBe(2);
    expect(need(at(0, undefined, 1, { best: 5 }).M)).toBe(3);
  });
});

describe("turns", () => {
  it("each die is used once; turns alternate on a plain roll", () => {
    let g = at(0);
    expect(legalDie(g, 1)).toBe(1);
    g = applyRoll(g, 1, 4);
    expect(g.R.total).toBe(4);
    expect(g.R.hands[1]).toBe(ALL & ~bit(1));
    expect(g.R.turn).toBe(2);
    expect(g.M.log.at(-1)).toEqual({ p: 1, text: "Wire cube 4 → 4" });
    g = applyRoll(g, 0, 2);
    expect(g.R.turn).toBe(1);
    expect(legalDie(g, 1)).toBeNull();
  });
  it("takeDie removes the die before it lands", () => {
    const g = takeDie(at(0), 2);
    expect(g.R.hands[1]).toBe(3);
    expect(g.R.total).toBe(0);
  });
  it("a three rolls again", () => {
    const g = applyRoll(at(0), 0, 3);
    expect(g.R.turn).toBe(1);
    expect(g.R.kind).toBe("again");
    expect(g.R.msg).toBe("A three on the caltrop. You roll again.");
    expect(g.R.forced).toBe(-1);
  });
  it("landing on 7 rolls again", () => {
    const g = applyRoll(at(2), 1, 5);
    expect(g.R.turn).toBe(1);
    expect(g.R.msg).toBe("The total lands on 7. You roll again.");
  });
  it("a three onto 7 says both", () => {
    expect(applyRoll(at(4), 1, 3).R.msg).toBe("A three, and the total is 7. You roll again.");
  });
  it("a three with the last die rolls the same die again", () => {
    let g = at(0, [bit(1), ALL]);
    g = applyRoll(g, 1, 3);
    expect(g.R.forced).toBe(1);
    expect(g.R.msg).toBe("A three on the wire cube. You roll again with the same wire cube.");
    expect(legalDie(g, 0)).toBe(1); // whatever is picked, the forced die is rolled
    const g2 = applyRoll(g, 1, 2);
    expect(g2.R.hands[1]).toBe(0);
    expect(g2.R.forced).toBe(-1);
    expect(g2.R.total).toBe(5);
    expect(g2.R.turn).toBe(2);
  });
  it("when the other side is out of dice you keep rolling", () => {
    const g = applyRoll(at(0, [ALL, 0]), 0, 2);
    expect(g.R.turn).toBe(1);
    expect(g.R.msg).toBe("Rival has no dice left, so you keep rolling.");
    const p = applyRoll(at(0, [0, ALL], 2, { mode: "pvp" }), 0, 2);
    expect(p.R.msg).toBe("Player 1 has no dice left, so Player 2 keeps rolling.");
  });
});

describe("special totals end the round", () => {
  it("exact 20 wins", () => {
    const g = applyRoll(at(14), 1, 6);
    expect(g.R.over).toMatchObject({ winner: 1, why: "win", text: "You land on 20 and take the round!" });
    expect(g.R.kind).toBe("win");
    expect(g.M.wins[1]).toBe(1);
  });
  it("over 20 loses", () => {
    const g = applyRoll(at(18), 2, 5);
    expect(g.R.over).toMatchObject({ winner: 2, why: "bust", text: "23. You go over 20 and lose the round." });
    expect(g.R.kind).toBe("lose");
  });
  it("9 hands the round to the other side, even on a three", () => {
    const g = applyRoll(at(6, undefined, 2), 0, 3);
    expect(g.R.over).toMatchObject({ winner: 1, why: "nine", text: "Nine! You take the round." });
    expect(g.R.kind).toBe("win");
  });
  it("12 is a draw", () => {
    const g = applyRoll(at(4), 2, 8);
    expect(g.R.over).toMatchObject({ winner: 0, why: "draw", text: "Twelve. The round is drawn." });
    expect(g.M.draws).toBe(1);
  });
  it("all six dice spent short of 20 is a draw", () => {
    const g = applyRoll(at(14, [0, bit(0)], 2), 0, 1);
    expect(g.R.over).toMatchObject({ winner: 0, why: "spent", text: "All six dice are spent at 15. The round is drawn." });
  });
  it("whoever rolled last starts the next round", () => {
    const g = applyRoll(at(18, undefined, 2), 0, 4);
    expect(g.R.over?.winner).toBe(1);
    const n = nextRound(g);
    expect(n.R.turn).toBe(2);
    expect(n.R.total).toBe(0);
    expect(n.M.round).toBe(2);
  });
  it("the match ends at the needed number of wins", () => {
    let g = at(14);
    g = applyRoll(g, 1, 6);
    expect(g.M.over).toBe(0);
    g = nextRound(g);
    g = { ...g, R: { ...g.R, total: 14 } };
    g = applyRoll(g, 1, 6);
    expect(g.M.over).toBe(1);
    expect(legalDie(g, 0)).toBeNull();
  });
});

describe("whole matches", () => {
  it("always finish, with consistent bookkeeping", () => {
    const rng = seeded(3);
    for (let m = 0; m < 300; m++) {
      let g = newMatch({ mode: m % 2 ? "pvp" : "cpu", lvl: 2, best: m % 3 ? 3 : 5 }, rng);
      for (let steps = 0; !g.M.over; steps++) {
        expect(steps).toBeLessThan(500);
        if (g.R.over) { g = nextRound(g); continue; }
        const hand = g.R.hands[g.R.turn];
        const opts = ([0, 1, 2] as Die[]).filter(d => legalDie(g, d) !== null);
        expect(opts.length).toBeGreaterThan(0);
        const d = legalDie(g, opts[(rng() * opts.length) | 0])!;
        const before = g.R.total;
        g = applyRoll(g, d, [1, 2, 3, 4, 5, 6, 7, 8][(rng() * [4, 6, 8][d]) | 0]);
        expect(g.R.total).toBeGreaterThan(before);
        if (g.R.forced < 0 && hand) expect(g.R.hands[g.R.rolls.at(-1)!.p] & bit(d)).toBe(0);
      }
      const n = Math.ceil(g.M.best / 2);
      expect(Math.max(g.M.wins[1], g.M.wins[2])).toBe(n);
      expect(Math.min(g.M.wins[1], g.M.wins[2])).toBeLessThan(n);
      expect(g.M.wins[1] + g.M.wins[2] + g.M.draws).toBe(g.M.round);
    }
  });
});
