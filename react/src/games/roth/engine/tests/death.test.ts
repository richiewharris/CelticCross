// Duels to the death: placed supports used again at a price, draws from the Reserve, cards played mid-duel, and the
// final duel between the survivors.
import { describe, expect, it } from "vitest";
import { DECKS, reuseOf, type SupportDef, ALL_DEFS } from "../cards";
import { applyDecision, nextDecision, newMatch, playOut, type Option, type Policy, type State } from "../engine";
import { NovicePolicy, CasualPolicy } from "../ai";
import { Rng } from "../rng";
import { act, card, combatState, rest, use } from "./helpers";

// Fergus (P1, spot 1: Thunder feat, Spear of Cet) against Ferdiad (P2, spot 7: Fedelm's prophecy, Láeg)
const mk = () => {
  const S = combatState({
    board: ["conall", "thunder", "cet_spear@0", "emer", "salmon", "salmon", "dagda", "fedelm@1", "laeg@1", "fergus", "salmon", "salmon"],
    rules: { duels: "death", initTie: "p1" },
  });
  S.players[0].reserve = ["salmon", "sling", "thunder"].map((id) => card(id, 0));
  S.players[1].reserve = ["salmon", "sling"].map((id) => card(id, 1));
  return S;
};
const opts = (S: State) => nextDecision(S)!.options;
const canUse = (S: State, spot: number) => opts(S).some((o) => o.t === "duel" && o.act === "use" && o.spot === spot - 1);

describe("reuse prices", () => {
  it("by kind: Weapon a turn between, Feat a rest, Ally a card off the Reserve, Word 1 Valour; a Heal needs a rest", () => {
    const s = (id: string) => reuseOf(ALL_DEFS[id] as SupportDef);
    expect(s("cet_spear")).toEqual({ turns: 1 });
    expect(s("thunder")).toEqual({ rest: 1 });
    expect(s("fedelm")).toEqual({ valour: 1 });
    expect(s("laeg")).toEqual({ draw: 1, rest: 1 });
  });
  it("a Weapon can't be used two turns running", () => {
    const S = mk();
    use(S, 3); // Conall: the spear
    rest(S); // the Dagda
    expect(canUse(S, 3)).toBe(false);
    use(S, 2); // Thunder feat
    rest(S);
    expect(canUse(S, 3)).toBe(true);
  });
  it("a Feat must be rested off before it can be used again", () => {
    const S = mk();
    use(S, 2);
    rest(S);
    expect(canUse(S, 2)).toBe(false);
    rest(S); // Conall rests
    rest(S);
    expect(canUse(S, 2)).toBe(true);
  });
  it("a Word costs 1 Valour to use again", () => {
    const S = mk();
    rest(S);
    use(S, 8); // the Dagda: Fedelm's prophecy
    rest(S);
    const v = S.combat!.valour[1];
    use(S, 8);
    expect(S.combat!.valour[1]).toBe(v - 1);
  });
});

describe("drawing from the Reserve", () => {
  it("draw, then play the card or put it aside and do something else (but not draw again)", () => {
    const S = mk();
    expect(opts(S).some((o) => o.t === "draw")).toBe(true);
    act(S, { t: "draw" });
    const top = S.combat!.drawn!;
    expect(top).toBeTruthy();
    expect(nextDecision(S)!.kind).toBe("drawn");
    act(S, { t: "drawn", how: "discard" } as Option);
    expect(S.players[0].discard.map((c) => c.uid)).toContain(top.uid);
    expect(opts(S).some((o) => o.t === "draw")).toBe(false);
    expect(S.combat!.turn).toBe(0); // still P1's turn
    use(S, 3);
    expect(S.combat!.turn).toBe(1);
  });
  it("a drawn support is played like a placed one, then discarded", () => {
    const S = mk();
    S.players[0].reserve = [card("sling", 0)];
    const v = S.combat!.valour[1];
    act(S, { t: "draw" });
    act(S, { t: "drawn", how: "play", mode: "normal" } as Option);
    expect(S.combat!.valour[1]).toBeLessThan(v);
    expect(S.players[0].discard.map((c) => c.def.id)).toEqual(["sling"]);
  });
  it("an empty Reserve takes the discards back, shuffled", () => {
    const S = mk();
    S.players[0].reserve = [];
    S.players[0].discard = [card("salmon", 0), card("sling", 0)];
    act(S, { t: "draw" });
    expect(S.combat!.drawn).toBeTruthy();
    expect(S.players[0].discard.length).toBe(0);
    expect(S.players[0].reserve.length).toBe(1);
  });
  it("an omen still face down can be turned in the duel", () => {
    const S = mk();
    S.players[0].omens = [{ card: card("o_herolight", 0), faceUp: false }];
    const i = opts(S).findIndex((o) => o.t === "duelCard" && o.target === 0);
    expect(i).toBeGreaterThanOrEqual(0);
    applyDecision(S, nextDecision(S)!, i);
    expect(S.players[0].omens[0]).toMatchObject({ faceUp: true, target: 0 });
  });
});

describe("to the death", () => {
  it("duels run until a hero falls; at one each, the survivors fight a final duel with the Valour they kept", () => {
    let finals = 0;
    for (let i = 0; i < 60; i++) {
      const S = newMatch([DECKS.ulster, DECKS.connacht], {}, 300 + i);
      const r = playOut(S, [new CasualPolicy(), new NovicePolicy()] as [Policy, Policy], [new Rng(i), new Rng(i + 7)], true);
      const C = S.combat!;
      if (C.startV[2][0] || C.startV[2][1]) {
        finals++;
        // each survivor carries the Valour it ended its own duel with
        for (const p of [0, 1]) {
          const d = C.felled[0][p] ? 1 : 0;
          expect(C.startV[2][p]).toBe(C.endValour[d][p]);
        }
      }
      expect(r.felled[0] + r.felled[1]).toBeGreaterThanOrEqual(1);
    }
    expect(finals).toBeGreaterThan(2);
  });
});
