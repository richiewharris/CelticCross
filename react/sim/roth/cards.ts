// Roth Catha card pool (draft design) and the two scenario decks.

export type Element = "Fire" | "Wind" | "Earth" | "Water";
export type Kind = "Weapon" | "Feat" | "Ally" | "Word";
export type Alignment = "Ulaid" | "Connachta" | "Sidhe" | "Deorad";
export type SupportAlignment = Alignment | "Unaligned";
export type Focus = Element | Kind;

export const ELEMENTS: Element[] = ["Fire", "Wind", "Earth", "Water"];

/** Fire beats Wind beats Earth beats Water beats Fire. */
export function beats(a: Element, b: Element): boolean {
  return (
    (a === "Fire" && b === "Wind") ||
    (a === "Wind" && b === "Earth") ||
    (a === "Earth" && b === "Water") ||
    (a === "Water" && b === "Fire")
  );
}
export function isElement(x: unknown): x is Element {
  return x === "Fire" || x === "Wind" || x === "Earth" || x === "Water";
}

export interface HeroDef {
  type: "hero";
  id: string;
  name: string;
  /** 'None' is used only by the AI's placeholder hero. */
  alignment: Alignment | "None";
  init: number;
  focus: Focus | null;
  weakness: Element | null;
  quality: string;
  tag: string | null;
}
export interface Effect {
  type: "strike" | "heal" | "shield";
  n: number;
}
export interface SupportDef {
  type: "support";
  id: string;
  name: string;
  element: Element | null;
  kind: Kind | null;
  alignment: SupportAlignment;
  /** First effect is the primary one: the +1 bonuses apply to it. */
  effects: Effect[];
  text: string;
  invoke?: string;
  nextStrike?: number;
  selfLoss?: number;
  cathbad?: boolean;
  /** Added for testing: not in the design doc's pool. */
  testOnly?: boolean;
}
export interface GeisDef {
  type: "geis";
  id: string;
  name: string;
  forbids: { element?: Element; kind?: Kind; rest?: boolean };
  invoke?: string;
}
export interface OmenDef {
  type: "omen";
  id: string;
  name: string;
  omenKind: "board" | "ward" | "reinforcement";
  text: string;
}
export interface UnknownDef {
  type: "unknown";
  id: "unknown";
  name: "?";
}
export type CardDef = HeroDef | SupportDef | GeisDef | OmenDef | UnknownDef;

export const UNKNOWN: UnknownDef = { type: "unknown", id: "unknown", name: "?" };

const hero = (
  id: string,
  name: string,
  alignment: Alignment,
  init: number,
  focus: Focus,
  weakness: Element,
  quality: string,
  tag: string,
): HeroDef => ({ type: "hero", id, name, alignment, init, focus, weakness, quality, tag });

export const HEROES: Record<string, HeroDef> = {
  cu: hero("cu", "Cú Chulainn", "Ulaid", 5, "Fire", "Wind", "Ríastrad: at 1 Valour his Strikes +2; ignores the Debility of the Ulstermen", "Hound"),
  conchobar: hero("conchobar", "Conchobar mac Nessa", "Ulaid", 2, "Word", "Fire", "King's due: once per duel, may use an unused support from your other hero's quadrant", "Druid's word"),
  conall: hero("conall", "Conall Cernach", "Ulaid", 3, "Weapon", "Wind", "Avenger: if your other hero has fallen, Strikes +1", "Vengeance"),
  emer: hero("emer", "Emer", "Ulaid", 2, "Word", "Fire", "Six gifts: when she rests, Heal 1", "Hospitality"),
  fergus: hero("fergus", "Fergus mac Róich", "Deorad", 3, "Weapon", "Water", "Old oath: Strikes vs Cú Chulainn −1", "Feast"),
  medb: hero("medb", "Medb", "Connachta", 4, "Earth", "Water", "Queen of Cruachan: kinship gives her +2, not +1", "Bounty"),
  ferdiad: hero("ferdiad", "Ferdiad", "Connachta", 4, "Weapon", "Water", "Horn-skin: starts each duel with Shield 1", "Satire"),
  morrigan: hero("morrigan", "The Morrígan", "Sidhe", 3, "Wind", "Earth", "Shape-shifter: once per match, at the start of one of her duels, change her Focus to any element", "Prophecy"),
};

const sup = (
  id: string,
  name: string,
  element: Element,
  kind: Kind,
  alignment: SupportAlignment,
  effects: Effect[],
  text: string,
  extra: Partial<SupportDef> = {},
): SupportDef => ({ type: "support", id, name, element, kind, alignment, effects, text, ...extra });
const S = (n: number): Effect => ({ type: "strike", n });
const H = (n: number): Effect => ({ type: "heal", n });
const Sh = (n: number): Effect => ({ type: "shield", n });

export const SUPPORTS: Record<string, SupportDef> = {
  gae_bolga: sup("gae_bolga", "Gáe Bolga", "Water", "Weapon", "Ulaid", [S(1)], "Strike 3 if Cú Chulainn uses it, else Strike 1"),
  caladbolg: sup("caladbolg", "Caladbolg", "Earth", "Weapon", "Deorad", [S(2)], "Strike 2"),
  ochain: sup("ochain", "Ochain, the roaring shield", "Wind", "Weapon", "Ulaid", [Sh(2)], "Shield 2"),
  sling: sup("sling", "Sling of Emain", "Wind", "Weapon", "Ulaid", [S(1)], "Strike 1; Strike 2 if it is the first support used in the duel"),
  furbaide: sup("furbaide", "Furbaide's sling-stone", "Water", "Weapon", "Ulaid", [S(1)], "Strike 1; Strike 3 against Medb"),
  thunder: sup("thunder", "Thunder feat", "Fire", "Feat", "Ulaid", [S(2)], "Strike 2"),
  warp: sup("warp", "The warp-spasm", "Fire", "Feat", "Ulaid", [S(3)], "Strike 3; your hero loses 1", { selfLoss: 1 }),
  salmon: sup("salmon", "Salmon leap", "Water", "Feat", "Unaligned", [Sh(2)], "Shield 2"),
  laeg: sup("laeg", "Láeg, the charioteer", "Wind", "Ally", "Ulaid", [H(1)], "Heal 1; your next Strike +1", { nextStrike: 1 }),
  cathbad: sup("cathbad", "Cathbad the druid", "Wind", "Ally", "Ulaid", [], "Your hero may ignore one geis this duel without cost", { cathbad: true }),
  brown_bull: sup("brown_bull", "The Brown Bull of Cúailnge", "Earth", "Ally", "Ulaid", [H(2)], "Heal 2"),
  finnbennach: sup("finnbennach", "Finnbennach, the white-horned bull", "Earth", "Ally", "Connachta", [H(2)], "Heal 2"),
  bricriu: sup("bricriu", "Bricriu's satire", "Wind", "Word", "Unaligned", [S(1)], "Strike 1; Invoke Satire", { invoke: "Satire" }),
  barach: sup("barach", "Bárach's feast", "Earth", "Word", "Connachta", [], "Invoke Feast", { invoke: "Feast" }),
  // ---- TEST-ONLY Connacht supports (added so a Connacht deck can be built; not in the design doc) ----
  cet_spear: sup("cet_spear", "Spear of Cet mac Mágach", "Earth", "Weapon", "Connachta", [S(2)], "Strike 2", { testOnly: true }),
  medb_chariot: sup("medb_chariot", "Medb's war-chariot", "Wind", "Ally", "Connachta", [H(1)], "Heal 1; your next Strike +1", { nextStrike: 1, testOnly: true }),
  fedelm: sup("fedelm", "Fedelm's prophecy", "Wind", "Word", "Connachta", [Sh(2)], "Shield 2", { testOnly: true }),
  horn_shield: sup("horn_shield", "Ferdiad's horn-shield", "Water", "Weapon", "Connachta", [Sh(2)], "Shield 2", { testOnly: true }),
  host: sup("host", "The host of Cruachan", "Earth", "Ally", "Connachta", [S(1), H(1)], "Strike 1 + Heal 1", { testOnly: true }),
  raven: sup("raven", "Raven's war-cry", "Fire", "Word", "Sidhe", [S(2)], "Strike 2", { testOnly: true }),
};

const geis = (id: string, name: string, forbids: GeisDef["forbids"], invoke?: string): GeisDef => ({ type: "geis", id, name, forbids, ...(invoke ? { invoke } : {}) });
export const GEASA: Record<string, GeisDef> = {
  g_ford: geis("g_ford", "Geis of the ford", { element: "Water" }),
  g_hearth: geis("g_hearth", "Geis of the hearth", { element: "Fire" }),
  g_spear: geis("g_spear", "Geis of the spear", { kind: "Weapon" }),
  g_silence: geis("g_silence", "Geis of silence", { kind: "Word" }),
  g_door: geis("g_door", "Geis of the open door", { rest: true }, "Hospitality"),
  g_hound: geis("g_hound", "Geis of the hound", { kind: "Feat" }, "Hound"),
};

const omen = (id: string, name: string, omenKind: OmenDef["omenKind"], text: string): OmenDef => ({ type: "omen", id, name, omenKind, text });
export const OMENS: Record<string, OmenDef> = {
  o_debility: omen("o_debility", "Debility of the Ulstermen", "board", "Ulaid heroes' Strikes −1 (Cú Chulainn spared)"),
  o_crow: omen("o_crow", "The Morrígan's crow", "board", "No Heals"),
  o_truce: omen("o_truce", "Truce of Samhain", "board", "No Strike above 2"),
  o_mist: omen("o_mist", "Mist of the druids", "board", "Ignore Initiative: P2's hero strikes first in both duels"),
  o_lugh: omen("o_lugh", "Lugh's protection", "ward", "The first Strike against each of your heroes each duel −1"),
  o_emain: omen("o_emain", "Emain's ward", "ward", "Your heroes may ignore the geis card laid on them"),
  o_ford: omen("o_ford", "Blessing of the ford", "reinforcement", "Your Water supports +1"),
  o_boyhood: omen("o_boyhood", "The boyhood deeds", "reinforcement", "Your hero at spot 1 or 7 starts its duel with 4 Valour"),
};

export const ALL_DEFS: Record<string, CardDef> = { ...HEROES, ...SUPPORTS, ...GEASA, ...OMENS };

export function defsFromIds(ids: string[]): CardDef[] {
  return ids.map((id) => {
    const d = ALL_DEFS[id];
    if (!d) throw new Error(`unknown card id ${id}`);
    return d;
  });
}

/** Ulster deck: 4 heroes, 12 supports (Ulaid/Unaligned), 4 geasa, 4 omens = 24. */
export const ULSTER_IDS: string[] = [
  "cu", "conchobar", "conall", "emer",
  "gae_bolga", "thunder", "thunder", "warp", "sling", "ochain", "laeg", "cathbad", "brown_bull", "salmon", "bricriu", "furbaide",
  "g_spear", "g_spear", "g_silence", "g_ford",
  "o_boyhood", "o_lugh", "o_emain", "o_crow",
];
/** Connacht deck: 4 heroes, 12 supports (Connachta/Deorad/Sídhe/Unaligned), 4 geasa, 4 omens = 24. */
export const CONNACHT_IDS: string[] = [
  "medb", "ferdiad", "fergus", "morrigan",
  "cet_spear", "cet_spear", "host", "host", "medb_chariot", "fedelm", "horn_shield", "raven", "finnbennach", "caladbolg", "barach", "salmon",
  "g_hound", "g_hearth", "g_spear", "g_door",
  "o_debility", "o_truce", "o_ford", "o_mist",
];
export const ULSTER = defsFromIds(ULSTER_IDS);
export const CONNACHT = defsFromIds(CONNACHT_IDS);
export const DECKS: Record<string, CardDef[]> = { ulster: ULSTER, connacht: CONNACHT };

/** Deck legality. Returns a list of problems (empty = legal). */
export function deckErrors(deck: CardDef[]): string[] {
  const errs: string[] = [];
  if (deck.length !== 24) errs.push(`deck has ${deck.length} cards, needs 24`);
  const count = (t: CardDef["type"]) => deck.filter((d) => d.type === t).length;
  const h = count("hero"), s = count("support"), g = count("geis"), o = count("omen");
  if (count("unknown") > 0) errs.push("unknown card");
  if (h < 4 || h > 6) errs.push(`heroes ${h} (4–6)`);
  if (s < 8 || s > 12) errs.push(`supports ${s} (8–12)`);
  if (g < 3 || g > 6) errs.push(`geasa ${g} (3–6)`);
  if (o < 4 || o > 6) errs.push(`omens ${o} (4–6)`);
  const copies: Record<string, number> = {};
  for (const d of deck) copies[d.id] = (copies[d.id] ?? 0) + 1;
  for (const [id, n] of Object.entries(copies)) {
    const d = ALL_DEFS[id];
    if (!d) continue;
    const max = d.type === "hero" || d.type === "omen" ? 1 : 2;
    if (n > max) errs.push(`${id} x${n} (max ${max})`);
  }
  // Alignments: a Deorad hero counts as one of yours (it does not add a third alignment
  // when the deck already has Ulaid or Connachta heroes).
  const al = new Set<string>();
  let deorad = false;
  for (const d of deck) if (d.type === "hero") { if (d.alignment === "Deorad") deorad = true; else al.add(d.alignment); }
  if (deorad && !al.has("Ulaid") && !al.has("Connachta")) al.add("Deorad");
  if (al.size > 2) errs.push(`hero alignments ${[...al].join(",")} (max 2)`);
  return errs;
}
