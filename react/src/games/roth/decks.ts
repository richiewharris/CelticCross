// Your decks: the five starter decks and the ones you build, saved in this browser.
import { useStoredState } from "../../kit/useStoredState";
import { ALL_DEFS, DECKS, DECK_IDS, FACTIONS, MAX_LEGENDARIES, RARITY_LIMIT, deckErrors, type CardDef, type Faction } from "./engine/cards";
import { FACTION_TITLE } from "./text";

export interface SavedDeck { id: string; name: string; factions: Faction[]; ids: string[] }
export const DECKS_KEY = "roth-react-decks";

export function useSavedDecks() {
  return useStoredState<SavedDeck[]>(DECKS_KEY, []);
}
export function loadSavedDecks(): SavedDeck[] {
  try { const raw = localStorage.getItem(DECKS_KEY); return raw ? (JSON.parse(raw) as SavedDeck[]) : []; } catch { return []; }
}

/** Card ids → cards, dropping any id this version doesn't know. */
export function defsOf(ids: string[]): CardDef[] {
  return ids.map((id) => ALL_DEFS[id]).filter((d): d is CardDef => !!d);
}

/** A deck choice: a faction name (its starter deck) or "custom:<id>". */
export function resolveDeck(choice: string, saved: SavedDeck[]): { deck: CardDef[]; label: string; faction: Faction } | null {
  if ((FACTIONS as readonly string[]).includes(choice)) return { deck: DECKS[choice], label: `the ${FACTION_TITLE[choice as Faction]} starter deck`, faction: choice as Faction };
  if (choice.startsWith("custom:")) {
    const s = saved.find((x) => `custom:${x.id}` === choice);
    if (!s) return null;
    const deck = defsOf(s.ids);
    if (deckErrors(deck).length) return null;
    return { deck, label: `“${s.name}”`, faction: s.factions[0] ?? "ulster" };
  }
  return null;
}

export const starterIds = (f: Faction) => DECK_IDS[f].slice();

/** How many copies of a card a deck may hold. */
export const maxCopies = (d: CardDef) =>
  d.type === "hero" || d.type === "champion" || d.type === "omen" ? 1 : d.type === "unknown" ? 0 : RARITY_LIMIT[d.rarity];

/** The type ranges, in the order the builder lists them. */
export const RANGES: { type: Exclude<CardDef["type"], "unknown">; title: string; min: number; max: number }[] = [
  { type: "hero", title: "Heroes", min: 4, max: 6 },
  { type: "champion", title: "Champions", min: 0, max: 2 },
  { type: "support", title: "Supports", min: 8, max: 12 },
  { type: "geis", title: "Geasa", min: 2, max: 6 },
  { type: "oath", title: "Oaths", min: 0, max: 4 },
  { type: "omen", title: "Omens", min: 4, max: 6 },
];

/** Why a card can't go in (or null if it can). */
export function cannotAdd(deck: CardDef[], d: CardDef): string | null {
  if (deck.length >= 24) return "The deck already has 24 cards.";
  const n = deck.filter((x) => x.id === d.id).length;
  const max = maxCopies(d);
  if (n >= max) return max === 1 ? "Only one copy allowed." : `At most ${max} copies of a common card.`;
  if (d.type !== "unknown" && d.rarity === "legendary" && deck.filter((x) => x.type !== "unknown" && x.rarity === "legendary").length >= MAX_LEGENDARIES) return `At most ${MAX_LEGENDARIES} legendary cards.`;
  const r = RANGES.find((x) => x.type === d.type);
  if (r && deck.filter((x) => x.type === d.type).length >= r.max) return `At most ${r.max} ${r.title.toLowerCase()}.`;
  return null;
}

/** deckErrors in plain words. */
export function deckProblems(deck: CardDef[]): string[] {
  return deckErrors(deck).map((e) => {
    let m: RegExpMatchArray | null;
    if ((m = e.match(/^deck has (\d+) cards/))) return `${m[1]} cards: a deck needs exactly 24.`;
    if ((m = e.match(/^(heroes|supports|geasa|oaths|champions|omens) (\d+) \((\d+)–(\d+)\)/))) return `${m[2]} ${m[1]}: needs ${m[3]}–${m[4]}.`;
    if ((m = e.match(/^(\w+) x(\d+) \(max (\d+)\)/))) return `${ALL_DEFS[m[1]]?.name ?? m[1]}: ${m[2]} copies, at most ${m[3]}.`;
    if ((m = e.match(/^legendaries (\d+)/))) return `${m[1]} legendary cards: at most ${MAX_LEGENDARIES}.`;
    if ((m = e.match(/^hero alignments (.*) \(max 2\)/))) return `Heroes from ${m[1].split(",").length} peoples: at most 2.`;
    if ((m = e.match(/^peoples (.*) \(max 2\)/))) return `Cards from ${m[1].split(",").length} peoples: at most 2.`;
    return e;
  });
}

export const newDeckId = () => Math.random().toString(36).slice(2, 10);
