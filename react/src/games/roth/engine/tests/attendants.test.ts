// Attendants: called in the Playing turn, they change what element (or kind) supports count as, or what a hero
// is weak to, for one side or for everyone.
import { describe, expect, it } from "vitest";
import { ATTENDANTS, DECKS, GEASA, deckErrors, type CardDef } from "../cards";
import { effSupport, effWeakness, forbidMask, fighter, legalityError, newMatch, nextDecision, applyDecision, playOut, type Policy, type Side, type State } from "../engine";
import { NovicePolicy } from "../ai";
import { Rng } from "../rng";
import { ALL_DEFS } from "../cards";
import { card, combatState } from "./helpers";

const sup = (id: string) => ALL_DEFS[id] as Extract<CardDef, { type: "support" }>;
const withAtt = (S: State, ...xs: [string, Side][]) => { S.attendants = xs.map(([id, o]) => card(id, o)); return S; };
// Fergus (P1, spot 1) against Lí Ban (P2, spot 7); supports don't matter here
const base = () => combatState({ board: ["fergus", "salmon", "salmon", "emer", "salmon", "salmon", "liban", "salmon", "salmon", "conall", "salmon", "salmon"] });

describe("attendants", () => {
  it("enchant: your Weapons count as the element, for you only", () => {
    const S = withAtt(base(), ["a_apprentice", 0]);
    expect(effSupport(S, 0, sup("cet_spear")).element).toBe("Fire"); // Earth Weapon → Fire
    expect(effSupport(S, 1, sup("cet_spear")).element).toBe("Earth"); // the enemy's own weapons unchanged
    expect(effSupport(S, 0, sup("thunder")).element).toBe("Fire"); // a Feat is untouched (already Fire)
    expect(effSupport(S, 0, sup("salmon"))).toBe(sup("salmon")); // nothing to change: the same card
  });
  it("turn on the enemy: their Fire supports count as Earth", () => {
    const S = withAtt(base(), ["a_changeling", 0]);
    expect(effSupport(S, 1, sup("thunder")).element).toBe("Earth");
    expect(effSupport(S, 0, sup("thunder")).element).toBe("Fire");
  });
  it("global turn reaches both sides", () => {
    const S = withAtt(base(), ["a_weather", 1]);
    expect(effSupport(S, 0, sup("sling")).element).toBe("Water");
    expect(effSupport(S, 1, sup("sling")).element).toBe("Water");
  });
  it("channel: element changes, Strike +1, and the user pays 1 Valour", () => {
    const S = withAtt(base(), ["a_poet", 0]);
    const s = effSupport(S, 0, sup("cet_spear"));
    expect(s.element).toBe("Fire");
    expect(s.channel).toBe(1);
    expect(s.selfLoss).toBe(1);
  });
  it("reforge: a Weapon counted as a Word slips the king's peace", () => {
    const S = base();
    S.globalGeis = [card("g_peace", 1)];
    const C = S.combat!;
    expect(forbidMask(S, C, 0, sup("cet_spear"))).not.toBe(0);
    withAtt(S, ["a_scribe", 0]);
    expect(forbidMask(S, C, 0, sup("cet_spear"))).toBe(0);
    expect(effSupport(S, 0, sup("cet_spear")).kind).toBe("Word");
  });
  it("a turned element can walk into a geis too", () => {
    const S = base();
    S.globalGeis = [card("g_burning", 1)]; // global: no hero may use Fire
    const C = S.combat!;
    expect(forbidMask(S, C, 1, sup("cet_spear"))).toBe(0);
    withAtt(S, ["a_apprentice", 1]); // P2's weapons now count as Fire
    expect(forbidMask(S, C, 1, sup("cet_spear"))).not.toBe(0);
  });
  it("curse: the enemy's heroes are weak to the element", () => {
    const S = withAtt(base(), ["a_benet", 0]);
    expect(effWeakness(S, 1, fighter(S, S.combat!, 1))).toBe("Wind");
    expect(effWeakness(S, 0, fighter(S, S.combat!, 0))).toBe(fighter(S, S.combat!, 0).weakness); // your own heroes keep theirs
  });
  it("attendants in order: the later one sees the earlier one's change", () => {
    const S = withAtt(base(), ["a_apprentice", 0], ["a_bell", 1]); // Weapons → Fire, then every Fire → Water
    expect(effSupport(S, 0, sup("cet_spear")).element).toBe("Water");
  });
  it("is called in the Playing turn, and is legal only from hand", () => {
    const deck = DECKS.sidhe.slice();
    deck[deck.findIndex((d) => d.id === "o_keen")] = ATTENDANTS.a_scribe; // swap an omen for an attendant... keep 24
    deck[deck.findIndex((d) => d.id === "fe_fiada")] = ALL_DEFS.o_keen;
    expect(deckErrors(deck)).toEqual([]);
    const S = newMatch([deck, DECKS.ulster], {}, 3);
    const r = new Rng(9);
    let saw = false;
    for (let k = 0; k < 400; k++) {
      const d = nextDecision(S);
      if (!d) break;
      const j = d.options.findIndex((o) => o.t === "attend");
      if (j >= 0) {
        saw = true;
        expect(legalityError(S, d.player, d.options[j])).toBeNull();
        applyDecision(S, d, j);
        expect(S.attendants.map((c) => c.def.id)).toContain("a_scribe");
        break;
      }
      applyDecision(S, d, r.int(d.options.length));
    }
    expect(saw).toBe(true);
  });
  it("random play with attendants in both decks stays legal to the end", () => {
    const atts = Object.keys(ATTENDANTS);
    for (let g = 0; g < 30; g++) {
      const r = new Rng(100 + g);
      const mkDeck = (base: CardDef[]) => {
        const d = base.slice();
        // two attendants in place of a geis and a support (still 24, still legal)
        d[d.findIndex((x) => x.type === "geis")] = ATTENDANTS[atts[r.int(6)]];
        d[d.findIndex((x) => x.type === "support")] = ATTENDANTS[atts[r.int(6)]];
        return d;
      };
      const a = mkDeck(DECKS.sidhe), b = mkDeck(DECKS.merrow);
      const S = newMatch([a, b], {}, 500 + g);
      const res = playOut(S, [new NovicePolicy(), new NovicePolicy()] as [Policy, Policy], [new Rng(1 + g), new Rng(2 + g)], true);
      expect([-1, 0, 1]).toContain(res.winner);
    }
    expect(Object.keys(GEASA).length).toBeGreaterThan(0);
  });
});
