// Duels to the death: placed supports used again at a price, draws from the Reserve, cards played mid-duel, and the
// final duel between the survivors.
import { describe, expect, it } from "vitest";
import { DECKS, reuseOf, type SupportDef, ALL_DEFS } from "../cards";
import { applyDecision, effWeakness, fighter, nextDecision, newMatch, observe, quadOf, NARRATE, type Option, type Policy, type State } from "../engine";
import { NovicePolicy, CasualPolicy } from "../ai";
import { Rng } from "../rng";
import { act, card, combatState, rest, use } from "./helpers";

// Conall (P1, spot 1: Thunder feat, Sling of Emain) against the Dagda (P2, spot 7: Fedelm's prophecy, Láeg)
const mk = () => {
  const S = combatState({
    board: ["conall", "thunder", "sling", "emer", "salmon", "salmon", "dagda", "fedelm@1", "laeg@1", "fergus", "salmon", "salmon"],
    rules: { duels: "death", initTie: "p1", valourBonus: 10 }, // sturdy heroes: these tests are about turns, not falls
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
      const pol = [new CasualPolicy(), new NovicePolicy()] as Policy[];
      const rng = [new Rng(i), new Rng(i + 7)];
      let seen = false;
      for (;;) {
        const d = nextDecision(S);
        if (!d) break;
        const C = S.combat;
        if (C && C.duel === 2 && !seen) {
          seen = true;
          finals++;
          // each survivor carries the Valour it ended its own duel with
          for (const p of [0, 1]) expect(C.valour[p]).toBe(C.endValour[C.felled[0][p] ? 1 : 0][p]);
        }
        applyDecision(S, d, d.options.length === 1 ? 0 : pol[d.player].choose(observe(S, d.player), d, rng[d.player]));
      }
      expect(S.result!.felled[0] + S.result!.felled[1]).toBeGreaterThanOrEqual(1);
    }
    expect(finals).toBeGreaterThan(2);
  });
});

describe("the ford's defence", () => {
  // Conall (P1, spot 1) against the Dagda (P2, spot 7); P1 acts first
  const duel = (board: string[]) => {
    const S = combatState({ board, rules: { duels: "death", initTie: "p1" } });
    S.players[0].reserve = ["salmon", "sling"].map((id) => card(id, 0));
    S.players[1].reserve = ["salmon", "sling"].map((id) => card(id, 1));
    return S;
  };
  it("fighters enter the ford with Valour +3, and heals have no cap", () => {
    const S = duel(["conall", "thunder", "sling", "emer", "salmon", "salmon", "dagda", "laeg@1", "laeg@1", "fergus", "salmon", "salmon"]);
    expect(S.combat!.valour).toEqual([ALL_DEFS.conall.type === "hero" ? (ALL_DEFS.conall as { valour: number }).valour + 3 : 0, (ALL_DEFS.dagda as { valour: number }).valour + 3]);
    const v = S.combat!.valour[1];
    rest(S); // Conall
    use(S, 8); // the Dagda: Láeg, Heal 1 (+1 rested? no: he hasn't rested) — above his start
    expect(S.combat!.valour[1]).toBeGreaterThan(v);
  });
  it("a rest braces: Shield 1, and the next Shield or Heal +1 (+2 after two rests in a row)", () => {
    const S = duel(["conall", "thunder", "sling", "emer", "salmon", "salmon", "dagda", "laeg@1", "fedelm@1", "fergus", "salmon", "salmon"]);
    rest(S); // Conall
    expect(S.combat!.shield[0]).toBe(1);
    expect(S.combat!.rested![0]).toBe(1);
    rest(S); // the Dagda
    rest(S); // Conall again
    expect(S.combat!.shield[0]).toBe(2);
    expect(S.combat!.rested![0]).toBe(2);
    rest(S);
    use(S, 2); // a Strike: the rested count goes
    expect(S.combat!.rested![0]).toBe(0);
  });
  it("a passive card gives Armour from the start of the duel; every blow is less", () => {
    const S = duel(["conall", "ochain", "sling", "emer", "salmon", "salmon", "dagda", "sling@1", "fedelm@1", "fergus", "salmon", "salmon"]);
    expect(S.combat!.armour).toEqual([1, 0]);
    expect(canUse(S, 2)).toBe(false); // nothing to use: it works by being there
    rest(S);
    const v = S.combat!.valour[0];
    use(S, 8); // the Dagda's sling: Strike 2, 1 less for the Armour
    expect(v - S.combat!.valour[0]).toBe(1);
  });
  it("a reaction card blocks: when struck, tap it to take its Block off the blow; again after one of your turns", () => {
    const S = duel(["conall", "sling", "salmon", "emer", "salmon", "salmon", "dagda", "sling@1", "sling@1", "fergus", "salmon", "salmon"]);
    expect(canUse(S, 3)).toBe(false); // not an action on your own turn
    rest(S); // Conall
    use(S, 8); // the Dagda strikes: Conall may block
    const d = nextDecision(S)!;
    expect(d.kind).toBe("block");
    expect(d.player).toBe(0);
    const v = S.combat!.valour[0];
    act(S, { t: "block", spot: 2 });
    expect(S.combat!.valour[0]).toBeGreaterThan(v - 2); // Salmon leap's Block soaked the Sling
    expect(S.combat!.turn).toBe(2); // and the Dagda's turn is over
    rest(S); // Conall's own turn
    use(S, 9); // the Dagda's second sling (a Weapon each): the Salmon leap may block again
    expect(nextDecision(S)!.kind).toBe("block");
  });
  it("a long duel wears both down: from the 20th turn each turn costs the side acting Valour", () => {
    const S = duel(["conall", "salmon", "salmon", "emer", "salmon", "salmon", "dagda", "salmon@1", "salmon@1", "fergus", "salmon", "salmon"]);
    S.players[0].reserve = []; S.players[1].reserve = [];
    for (let i = 0; i < 20; i++) rest(S);
    const v = S.combat!.valour[0];
    rest(S);
    expect(S.combat!.valour[0]).toBe(v - 1);
  });
});

describe("giant-kin: the Fomóire", () => {
  // Conall (P1, spot 1: the warp-spasm, Fire; the Sling, Wind) against Indech (P2, spot 7: weak to Wind, no Strike above 4)
  const duel = () => {
    const S = combatState({ board: ["conall", "warp", "sling", "emer", "salmon", "salmon", "indech", "laeg@1", "laeg@1", "fergus", "salmon", "salmon"], rules: { duels: "death", initTie: "p1" } });
    S.players[0].reserve = ["salmon", "sling"].map((id) => card(id, 0));
    S.players[1].reserve = ["salmon", "sling"].map((id) => card(id, 1));
    return S;
  };
  it("take half the wounds of a blow that is not of their weakness (rounded up)", () => {
    const S = duel();
    const v = S.combat!.valour[1];
    use(S, 2); // the warp-spasm: Fire, at least 4, held to 4 by Indech, then halved
    expect(v - S.combat!.valour[1]).toBe(2);
  });
  it("take their weakness in full, but with no +1", () => {
    const S = duel();
    NARRATE.lines = [];
    use(S, 3); // the Sling: Wind
    const txt = NARRATE.lines.join(" ");
    NARRATE.lines = null;
    expect(txt).toContain("lands in full");
    expect(txt).not.toContain("+1 weakness");
    expect(txt).not.toContain("giant-kin");
  });
  it("a geis can lay another weakness on them, until it is broken", () => {
    const S = duel();
    const C = S.combat!;
    const q = quadOf(C.hs[1]);
    S.quadGeis[q] = card("g_iron", 0);
    expect(effWeakness(S, 1, fighter(S, C, 1))).toEqual(["Wind", "Earth"]);
    C.broken |= 1 << q;
    expect(effWeakness(S, 1, fighter(S, C, 1))).toEqual(["Wind"]);
  });
});

describe("the mound of the Aos Sídhe", () => {
  // Conall (P1, spot 1: the Sling, Thunder feat) against the Dagda (P2, spot 7), whose side fights from a mound
  const duel = (pool: number) => {
    const S = combatState({ board: ["conall", "sling", "thunder", "emer", "salmon", "salmon", "dagda", "sling@1", "laeg@1", "fergus", "salmon", "salmon"], rules: { duels: "death", initTie: "p1" } });
    S.players[0].reserve = ["salmon", "sling"].map((id) => card(id, 0));
    S.players[1].reserve = ["salmon", "sling"].map((id) => card(id, 1));
    S.combat!.mound = [0, pool];
    return S;
  };
  it("takes 2 off every Strike against an Aos Sídhe fighter, like Armour, and keeps count", () => {
    const hit = (pool: number) => { const S = duel(pool); const v = S.combat!.valour[1]; use(S, 2); return { S, d: v - S.combat!.valour[1] }; };
    const bare = hit(0).d, { S, d } = hit(10); // the Sling
    expect(d).toBe(bare - 2);
    expect(S.combat!.mound![1]).toBe(8);
  });
  it("soaks no more than it has left, across the whole match", () => {
    const S0 = duel(0), S = duel(1);
    const v = S.combat!.valour[1];
    use(S0, 2); use(S, 2);
    expect(v - S.combat!.valour[1]).toBe(v - S0.combat!.valour[1] - 1);
    expect(S.combat!.mound![1]).toBe(0);
  });
  it("nothing pierces it: even a blow that ignores Shield and Armour", () => {
    const S = duel(10);
    use(S, 3); // Thunder feat
    expect(S.combat!.mound![1]).toBe(8);
  });
});
