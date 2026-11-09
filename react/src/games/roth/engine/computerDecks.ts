// The decks the stronger computer levels play: one per faction, found by hill-climbing in the simulator
// (sim/roth/optimize.ts writes computerDecks.json). Any card id this version no longer knows falls back to a fresh build.
import { ALL_DEFS, deckErrors, type CardDef, type Faction } from "./cards";
import { buildDeck } from "./builder";
import type { Rng } from "./rng";
import DATA from "./computerDecks.json";

const STORED = DATA as Record<string, string[]>;

export function computerDeck(f: Faction, rng: Rng): CardDef[] {
  const ids = STORED[f];
  if (ids && ids.every((id) => ALL_DEFS[id])) {
    const deck = ids.map((id) => ALL_DEFS[id]);
    if (!deckErrors(deck).length) return deck;
  }
  return buildDeck({ factions: [f], noise: 0.15 }, rng);
}
