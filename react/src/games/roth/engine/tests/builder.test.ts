import { describe, expect, it } from "vitest";
import { ALL_DEFS, DECKS, FACTIONS, GEASA, OATHS, deckErrors, deckPeoples, poolOf, type CardDef } from "../cards";
import { buildDeck } from "../builder";
import { computerDeck } from "../computerDecks";
import { Rng } from "../rng";
import { faceLines } from "../../faceText";

describe("pools", () => {
  it("doubles each people's supports, and the shared geasa and oaths", () => {
    for (const f of FACTIONS.filter((x) => x !== "sluagh")) { // the Slúagh are a smaller monster deck
      const own = poolOf(f).filter((d) => d.type === "support" && d.alignment !== "Unaligned");
      expect(own.length, f).toBeGreaterThanOrEqual(17);
      const starter = new Set(DECKS[f].filter((d) => d.type === "support").map((d) => d.id));
      expect(own.length, f).toBeGreaterThanOrEqual(2 * starter.size - 1);
    }
    expect(Object.keys(GEASA).length).toBeGreaterThanOrEqual(22);
    expect(Object.keys(OATHS).length).toBeGreaterThanOrEqual(14);
  });
  it("keeps exiles in both Ulster's and Connacht's pools only", () => {
    const fergus = ALL_DEFS.fergus;
    expect(FACTIONS.filter((f) => poolOf(f).includes(fergus))).toEqual(["ulster", "connacht"]);
  });
  it("gives every card words on its face", () => {
    for (const d of Object.values(ALL_DEFS)) if (d.type !== "unknown") expect(faceLines(d).length, d.id).toBeGreaterThan(0);
  });
});

describe("deck rules", () => {
  it("allows cards from at most two peoples", () => {
    const deck: CardDef[] = DECKS.ulster.slice();
    const i = deck.findIndex((d) => d.id === "salmon");
    deck[i] = ALL_DEFS.raven; // Sídhe
    expect(deckErrors(deck)).toEqual([]);
    const j = deck.findIndex((d) => d.id === "sling");
    deck[j] = ALL_DEFS.undertow; // Merrow: a third people
    expect(deckErrors(deck).some((e) => e.startsWith("peoples"))).toBe(true);
    expect(deckPeoples(deck).length).toBe(3);
  });
  it("still accepts all five starter decks", () => {
    for (const f of FACTIONS) expect(deckErrors(DECKS[f]), f).toEqual([]);
  });
});

describe("the computer's deck builder", () => {
  it("builds legal decks from one or two peoples at any noise", () => {
    const r = new Rng(42);
    for (const a of FACTIONS) for (const b of FACTIONS) for (const noise of [0, 1, 3]) {
      const deck = buildDeck({ factions: a === b ? [a] : [a, b], noise }, r);
      expect(deckErrors(deck), `${a}+${b} ${noise}`).toEqual([]);
      expect(deck.length).toBe(24);
    }
  });
  it("fills round cards already chosen", () => {
    const start = [ALL_DEFS.lugh, ALL_DEFS.cu, ALL_DEFS.dagda_club];
    const deck = buildDeck({ factions: ["ulster", "sidhe"], noise: 0, start }, new Rng(1));
    expect(deck.length).toBe(24);
    for (const d of start) expect(deck).toContain(d);
    expect(deckErrors(deck)).toEqual([]);
  });
  it("plays a legal stored deck for every faction", () => {
    for (const f of FACTIONS) expect(deckErrors(computerDeck(f, new Rng(3))), f).toEqual([]);
  });
});
