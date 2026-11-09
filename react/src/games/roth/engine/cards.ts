// Roth Catha card pool, second draft: five factions, rarity, hero Valour, oaths and modifying geasa.
// Every hero quality, support special, geis, oath and omen is data here; the engine reads the fields.

export type Element = "Fire" | "Wind" | "Earth" | "Water";
export type Kind = "Weapon" | "Feat" | "Ally" | "Word";
export type Alignment = "Ulaid" | "Connachta" | "Sidhe" | "Fomoire" | "Merrow" | "Deorad";
export type SupportAlignment = Alignment | "Unaligned";
export type Focus = Element | Kind;
export type Rarity = "common" | "rare" | "legendary";

export const ELEMENTS: Element[] = ["Fire", "Wind", "Earth", "Water"];
export const FACTIONS = ["ulster", "connacht", "sidhe", "fomoire", "merrow"] as const;
export type Faction = (typeof FACTIONS)[number];

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

/** Hero qualities, all optional. */
export interface HeroAb {
  strikeAll?: number; // all its Strikes +n
  rally?: { at: number; n: number }; // at <= `at` Valour, Strikes +n more
  avenger?: number; // Strikes +n once your other hero has fallen
  vsBig?: number; // Strikes +n against a hero of printed Valour 5+
  firstStrike?: number; // its first Strike each duel +n
  vsTag?: { tag: string; n: number }; // Strikes against a hero with that tag +n (may be negative)
  kinBonus?: number; // kinship gives +n instead of +1
  focusAny?: boolean; // every support counts as its Focus
  healBonus?: number; // its Heals +n
  restHeal?: number; // Heal n when it rests
  restShield?: number; // Shield n when it rests
  shieldStart?: number; // Shield n at the start of each duel
  firstHitSoak?: number; // the first Strike against it each duel −n
  capTaken?: number; // no Strike against it above n
  drain?: number; // when its Strike wounds, Heal n
  foeHealMalus?: number; // the enemy hero's Heals −n
  kingsDue?: boolean; // once per duel, may use an unused support from your other hero's quadrant
  shapeShift?: boolean; // once per match, at the start of a duel, change Focus to any element
  sparedDebility?: boolean;
}

export interface HeroDef {
  type: "hero";
  id: string;
  name: string;
  /** 'None' is used only by the AI's placeholder hero. */
  alignment: Alignment | "None";
  rarity: Rarity;
  valour: number;
  init: number;
  focus: Focus | null;
  weakness: Element | null;
  quality: string;
  tag: string | null;
  ab: HeroAb;
}
/** A champion stands in for a hero at the Ford: same shape as a hero, no Initiative or tag of its own. */
export interface ChampionDef extends Omit<HeroDef, "type"> {
  type: "champion";
}
/** Whoever is fighting a duel: a hero or the champion standing in for it. */
export type FighterDef = HeroDef | ChampionDef;
export type Scope = "global" | "targeted" | "yours";
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
  rarity: Rarity;
  /** First effect is the primary one: the +1 bonuses apply to it. */
  effects: Effect[];
  text: string;
  invoke?: string;
  nextStrike?: number;
  selfLoss?: number;
  cathbad?: boolean;
  forHero?: { id: string; n: number }; // primary Strike is n when that hero uses it
  vsHero?: { id: string; n: number }; // primary Strike is n against that hero
  firstBonus?: number; // primary +n if it is the first support used in the duel
  vsBig?: number; // primary Strike +n against a hero of printed Valour 5+
  pierce?: boolean; // its Strikes ignore Shield
  drain?: number; // if its Strike wounds, Heal n
}
/** What a geis or an oath forbids. */
export interface Forbids {
  element?: Element;
  kind?: Kind;
  rest?: boolean;
  heal?: boolean; // supports with a Heal
}
export interface GeisDef {
  type: "geis";
  id: string;
  name: string;
  rarity: Rarity;
  /** targeted: laid on one enemy hero, binds its quadrant. global: binds every hero on the wheel. */
  scope: "targeted" | "global";
  forbids: Forbids;
  invoke?: string;
  /** Modifying geasa: a bound hero of printed Valour 5+ starts its duel n lower. */
  bigLoss?: number;
  /** Modifying geasa: the bound hero's Initiative −n. */
  initLoss?: number;
  text: string;
}
export interface OathDef {
  type: "oath";
  id: string;
  name: string;
  rarity: Rarity;
  forbids: Forbids;
  boon: { strike?: number; shield?: number; valour?: number; init?: number; heal?: number };
  text: string;
}
export interface OmenEffect {
  debility?: Alignment; // board: that alignment's (and Deorad) Strikes −1
  noHeals?: boolean; // board: a breakable prohibition on Heals
  truce?: number; // board: no Strike above n
  darkness?: boolean; // board: in the first duel, the lower Initiative strikes first
  healMod?: number; // board: every Heal ±n
  shieldMod?: number; // board: every Shield effect ±n
  mist?: boolean; // owner's hero strikes first in both duels
  firstHitSoak?: number; // ward
  ignoreGeis?: boolean; // ward
  shieldStart?: number; // ward
  startValour?: { duel: 0 | 1; n: number }; // reinforcement
  strikeDuel?: { duel: 0 | 1; n: number }; // reinforcement: your hero in that duel Strikes +n
  shield?: number; // reinforcement: your Shields +n
  strikeMod?: number; // targeted: the target's Strikes ±n
  initMod?: number; // targeted: the target's Initiative ±n
  element?: { el: Element; n: number }; // reinforcement
  kind?: { kind: Kind; n: number }; // reinforcement
  heal?: number; // reinforcement: your Heals +n
}
export interface OmenDef {
  type: "omen";
  id: string;
  name: string;
  rarity: Rarity;
  omenKind: "board" | "ward" | "reinforcement" | "targeted";
  /** global: every hero; yours: your heroes; targeted: one hero chosen when it is turned. */
  scope: Scope;
  fx: OmenEffect;
  text: string;
}
export interface UnknownDef {
  type: "unknown";
  id: "unknown";
  name: "?";
}
export type CardDef = HeroDef | ChampionDef | SupportDef | GeisDef | OathDef | OmenDef | UnknownDef;

export const UNKNOWN: UnknownDef = { type: "unknown", id: "unknown", name: "?" };

// ---------------------------------------------------------------- heroes
const hero = (
  id: string, name: string, alignment: Alignment, rarity: Rarity, valour: number, init: number,
  focus: Focus, weakness: Element, tag: string, quality: string, ab: HeroAb,
): HeroDef => ({ type: "hero", id, name, alignment, rarity, valour, init, focus, weakness, quality, tag, ab });
const C: Rarity = "common", R: Rarity = "rare", L: Rarity = "legendary";

export const HEROES: Record<string, HeroDef> = {
  // Ulaid: fast, fiery, Feats
  cu: hero("cu", "Cú Chulainn", "Ulaid", L, 4, 5, "Fire", "Wind", "Hound", "Ríastrad: Strikes +1; at 1 Valour, +2 more. Spared the Debility", { strikeAll: 1, rally: { at: 1, n: 2 }, sparedDebility: true }),
  conall: hero("conall", "Conall Cernach", "Ulaid", R, 5, 3, "Weapon", "Wind", "Vengeance", "Cet's bane: Strikes +1 against a hero of Valour 5 or more, +1 more once your other hero has fallen", { vsBig: 1, avenger: 1 }),
  conchobar: hero("conchobar", "Conchobar mac Nessa", "Ulaid", R, 5, 2, "Word", "Fire", "Druid's word", "King's due: once per duel, may use an unused support from your other hero's quadrant", { kingsDue: true }),
  emer: hero("emer", "Emer", "Ulaid", C, 4, 2, "Word", "Fire", "Hospitality", "Six gifts: when she rests, Heal 2", { restHeal: 2 }),
  // Connachta: Earth, weapons, attrition
  medb: hero("medb", "Medb", "Connachta", L, 4, 4, "Earth", "Water", "Bounty", "Queen of Cruachan: kinship gives her +2, not +1", { kinBonus: 2 }),
  ferdiad: hero("ferdiad", "Ferdiad", "Connachta", R, 5, 2, "Weapon", "Water", "Satire", "Horn-skin: Shield 1 at the start of each duel", { shieldStart: 1 }),
  fergus: hero("fergus", "Fergus mac Róich", "Deorad", R, 5, 3, "Weapon", "Wind", "Feast", "Old oath: Strikes vs Hound −1", { vsTag: { tag: "Hound", n: -1 } }),
  ailill: hero("ailill", "Ailill mac Máta", "Connachta", C, 4, 3, "Word", "Fire", "Hoard", "Pillow-talk: his Heals +1", { healBonus: 1 }),
  // Sídhe (Tuatha Dé Danann): Wind and Word, many-skilled, healers
  lugh: hero("lugh", "Lugh Lámhfhada", "Sidhe", L, 4, 6, "Wind", "Fire", "Many skills", "Samildánach: every support counts as his Focus", { focusAny: true }),
  dagda: hero("dagda", "The Dagda", "Sidhe", R, 6, 1, "Earth", "Fire", "Plenty", "Cauldron: when he rests, Heal 2", { restHeal: 2 }),
  morrigan: hero("morrigan", "The Morrígan", "Sidhe", R, 3, 4, "Wind", "Earth", "Prophecy", "Battle-crow: Strikes +1; once per match, change her Focus to any element at the start of a duel", { strikeAll: 1, shapeShift: true }),
  brigid: hero("brigid", "Brigid", "Sidhe", C, 4, 3, "Fire", "Water", "Forge", "Healer's well: her Heals +1", { healBonus: 1 }),
  // Fomóire: huge, slow, blighting
  balor: hero("balor", "Balor of the Evil Eye", "Fomoire", L, 5, 1, "Fire", "Water", "Evil eye", "Evil eye: his first Strike each duel +2", { firstStrike: 2 }),
  bres: hero("bres", "Bres", "Fomoire", R, 4, 3, "Word", "Wind", "Hospitality", "Niggard king: the enemy hero's Heals −1", { foeHealMalus: 1 }),
  cethlenn: hero("cethlenn", "Cethlenn", "Fomoire", R, 3, 4, "Water", "Earth", "Prophecy", "Bloodied tooth: Strikes +1; when her Strike wounds, Heal 1", { strikeAll: 1, drain: 1 }),
  indech: hero("indech", "Indech mac Dé Domnann", "Fomoire", C, 5, 2, "Earth", "Wind", "Sea", "Sea-giant: no Strike against him above 3", { capTaken: 3 }),
  // Merrow: Water, shields, slippery
  manannan: hero("manannan", "Manannán mac Lir", "Merrow", L, 4, 4, "Water", "Earth", "Sea", "Cloak of mist: the first Strike against him each duel misses", { firstHitSoak: 9 }),
  fand: hero("fand", "Fand", "Merrow", R, 3, 5, "Wind", "Fire", "Beauty", "Sea-glamour: Strikes +1", { strikeAll: 1 }),
  liban: hero("liban", "Lí Ban", "Merrow", C, 4, 3, "Water", "Wind", "Sea", "Salmon-shape: when she rests, Shield 2", { restShield: 2 }),
  coomara: hero("coomara", "The Coomara", "Merrow", R, 6, 1, "Feat", "Fire", "Feast", "Soul cages: when his Strike wounds, Heal 1", { drain: 1 }),
};

// ---------------------------------------------------------------- champions
const champ = (
  id: string, name: string, alignment: Alignment, rarity: Rarity, valour: number,
  focus: Focus, weakness: Element, quality: string, ab: HeroAb,
): ChampionDef => ({ type: "champion", id, name, alignment, rarity, valour, init: 0, focus, weakness, quality, tag: null, ab });
export const CHAMPIONS: Record<string, ChampionDef> = {
  loegaire: champ("loegaire", "Lóegaire Búadach", "Ulaid", C, 4, "Feat", "Water", "Victorious: his first Strike +1", { firstStrike: 1 }),
  fiacha: champ("fiacha", "Fiacha mac Fir Febe", "Ulaid", R, 5, "Weapon", "Earth", "Shield-bearer: Shield 1 when he steps in", { shieldStart: 1 }),
  loch: champ("loch", "Lóch Mór mac Mo Febis", "Connachta", R, 4, "Weapon", "Water", "Lóch's fury: Strikes +1", { strikeAll: 1 }),
  nadcrantail: champ("nadcrantail", "Nad Crantail", "Connachta", C, 4, "Earth", "Fire", "Holly spears: his first Strike +1", { firstStrike: 1 }),
  nuada: champ("nuada", "Nuada Airgetlám", "Sidhe", R, 5, "Weapon", "Wind", "Silver hand: Shield 1 when he steps in", { shieldStart: 1 }),
  ogma: champ("ogma", "Ogma", "Sidhe", C, 4, "Word", "Earth", "Sun-face: his first Strike +1", { firstStrike: 1 }),
  elatha: champ("elatha", "Elatha mac Delbaíth", "Fomoire", C, 5, "Water", "Wind", "Golden king: no special quality; he is simply big", {}),
  tethra: champ("tethra", "Tethra", "Fomoire", R, 4, "Water", "Earth", "Sea-crow: when his Strike wounds, Heal 1", { drain: 1 }),
  roane: champ("roane", "The Roane", "Merrow", C, 4, "Water", "Fire", "Seal-hide: Shield 1 when it steps in", { shieldStart: 1 }),
  muirdris: champ("muirdris", "The Muirdris", "Merrow", R, 5, "Water", "Earth", "Sea-beast: no Strike against it above 3", { capTaken: 3 }),
};

// ---------------------------------------------------------------- supports
const sup = (
  id: string, name: string, element: Element, kind: Kind, alignment: SupportAlignment, rarity: Rarity,
  effects: Effect[], text: string, extra: Partial<SupportDef> = {},
): SupportDef => ({ type: "support", id, name, element, kind, alignment, rarity, effects, text, ...extra });
const S = (n: number): Effect => ({ type: "strike", n });
const H = (n: number): Effect => ({ type: "heal", n });
const Sh = (n: number): Effect => ({ type: "shield", n });

export const SUPPORTS: Record<string, SupportDef> = {
  salmon: sup("salmon", "Salmon leap", "Water", "Feat", "Unaligned", C, [Sh(2)], "Shield 2"),
  // Ulaid
  gae_bolga: sup("gae_bolga", "Gáe Bolga", "Water", "Weapon", "Ulaid", L, [S(2)], "Strike 2, ignores Shield; Strike 4 if Cú Chulainn uses it", { forHero: { id: "cu", n: 4 }, pierce: true }),
  thunder: sup("thunder", "Thunder feat", "Fire", "Feat", "Ulaid", C, [S(2)], "Strike 2; ignores Shield", { pierce: true }),
  warp: sup("warp", "The warp-spasm", "Fire", "Feat", "Ulaid", R, [S(4)], "Strike 4; your hero loses 1", { selfLoss: 1 }),
  sling: sup("sling", "Sling of Emain", "Wind", "Weapon", "Ulaid", C, [S(2)], "Strike 2; +1 if it is the first support used in the duel", { firstBonus: 1 }),
  ochain: sup("ochain", "Ochain, the roaring shield", "Wind", "Weapon", "Ulaid", R, [Sh(2)], "Shield 2"),
  laeg: sup("laeg", "Láeg, the charioteer", "Wind", "Ally", "Ulaid", R, [H(1)], "Heal 1; your next Strike +1", { nextStrike: 1 }),
  brown_bull: sup("brown_bull", "The Brown Bull of Cúailnge", "Earth", "Ally", "Ulaid", R, [H(2)], "Heal 2"),
  cathbad: sup("cathbad", "Cathbad the druid", "Wind", "Word", "Ulaid", R, [S(1)], "Strike 1; your hero may ignore one geis or oath this duel without cost", { cathbad: true }),
  // Connachta
  cet_spear: sup("cet_spear", "Spear of Cet mac Mágach", "Earth", "Weapon", "Connachta", C, [S(2)], "Strike 2"),
  host: sup("host", "The host of Cruachan", "Earth", "Ally", "Connachta", C, [S(1), H(1)], "Strike 1 + Heal 1"),
  medb_chariot: sup("medb_chariot", "Medb's war-chariot", "Wind", "Ally", "Connachta", R, [H(1)], "Heal 1; your next Strike +1", { nextStrike: 1 }),
  fedelm: sup("fedelm", "Fedelm's prophecy", "Wind", "Word", "Connachta", R, [S(1)], "Strike 1; your next Strike +1", { nextStrike: 1 }),
  horn_shield: sup("horn_shield", "Ferdiad's horn-shield", "Water", "Weapon", "Connachta", C, [Sh(2)], "Shield 2"),
  finnbennach: sup("finnbennach", "Finnbennach, the white-horned bull", "Earth", "Ally", "Connachta", R, [H(2)], "Heal 2"),
  caladbolg: sup("caladbolg", "Caladbolg", "Earth", "Weapon", "Deorad", L, [S(3)], "Strike 3"),
  barach: sup("barach", "Bárach's feast", "Fire", "Word", "Connachta", C, [S(1)], "Strike 1; Invoke Hospitality", { invoke: "Hospitality" }),
  // Sídhe
  spear_assal: sup("spear_assal", "The spear of Assal", "Wind", "Weapon", "Sidhe", L, [S(3)], "Strike 3"),
  fragarach: sup("fragarach", "Fragarach, the answerer", "Wind", "Weapon", "Sidhe", R, [S(2)], "Strike 2; ignores Shield", { pierce: true }),
  tathlum: sup("tathlum", "The tathlum", "Water", "Weapon", "Sidhe", R, [S(1)], "Strike 1; +2 against a hero of Valour 5 or more", { vsBig: 2 }),
  goibniu: sup("goibniu", "Goibniu's forge", "Fire", "Weapon", "Sidhe", C, [S(2)], "Strike 2"),
  raven: sup("raven", "Raven's war-cry", "Fire", "Word", "Sidhe", C, [S(2)], "Strike 2"),
  dian_cecht: sup("dian_cecht", "Dian Cécht's well", "Earth", "Ally", "Sidhe", R, [H(2)], "Heal 2"),
  uaithne: sup("uaithne", "Uaithne, the Dagda's harp", "Wind", "Word", "Sidhe", R, [H(1)], "Heal 1; your next Strike +1", { nextStrike: 1 }),
  fe_fiada: sup("fe_fiada", "The féth fíada", "Water", "Word", "Sidhe", C, [Sh(2)], "Shield 2"),
  // Fomóire
  gaze: sup("gaze", "The gaze of Balor", "Fire", "Feat", "Fomoire", L, [S(2)], "Strike 2; Strike 3 if Balor uses it", { forHero: { id: "balor", n: 3 } }),
  tower: sup("tower", "Conand's tower", "Earth", "Ally", "Fomoire", R, [Sh(3)], "Shield 3"),
  sea_raid: sup("sea_raid", "Sea-raid", "Water", "Feat", "Fomoire", C, [S(2)], "Strike 2"),
  galley: sup("galley", "Fomorian galley", "Water", "Ally", "Fomoire", C, [S(1), Sh(1)], "Strike 1 + Shield 1"),
  club: sup("club", "Club of the Fomóire", "Earth", "Weapon", "Fomoire", C, [S(2)], "Strike 2"),
  tribute: sup("tribute", "Tribute of Mag Céidne", "Earth", "Word", "Fomoire", R, [S(1), H(1)], "Strike 1 + Heal 1; Invoke Plenty", { invoke: "Plenty" }),
  octriallach: sup("octriallach", "Stones of Octriallach", "Water", "Word", "Fomoire", R, [S(1)], "Strike 1; if it wounds, Heal 1", { drain: 1 }),
  blight: sup("blight", "Blight of the Fomóire", "Wind", "Word", "Fomoire", C, [S(1)], "Strike 1; Invoke Forge", { invoke: "Forge" }),
  // Merrow
  cohuleen: sup("cohuleen", "The cohuleen druith", "Water", "Ally", "Merrow", L, [Sh(2), H(1)], "Shield 2 + Heal 1"),
  cliodhna: sup("cliodhna", "Clíodhna's wave", "Water", "Feat", "Merrow", R, [S(2)], "Strike 2; ignores Shield", { pierce: true }),
  undertow: sup("undertow", "Undertow", "Water", "Feat", "Merrow", C, [S(2)], "Strike 2"),
  riptide: sup("riptide", "Riptide", "Wind", "Feat", "Merrow", C, [S(2)], "Strike 2; your next Strike +1", { nextStrike: 1 }),
  sealskin: sup("sealskin", "Sealskin", "Water", "Word", "Merrow", C, [Sh(3)], "Shield 3"),
  pearl: sup("pearl", "Pearl of the deep", "Earth", "Word", "Merrow", R, [H(2)], "Heal 2"),
  soul_cage: sup("soul_cage", "The soul cage", "Earth", "Ally", "Merrow", R, [S(1)], "Strike 1; if it wounds, Heal 1", { drain: 1 }),
  scuab: sup("scuab", "Scuabtuinne, the wave-sweeper", "Wind", "Ally", "Merrow", R, [S(2)], "Strike 2"),
};

// ---------------------------------------------------------------- geasa
const geis = (id: string, name: string, rarity: Rarity, forbids: Forbids, text: string, extra: Partial<GeisDef> = {}): GeisDef =>
  ({ type: "geis", id, name, rarity, scope: "targeted", forbids, text, ...extra });
export const GEASA: Record<string, GeisDef> = {
  g_ford: geis("g_ford", "Geis of the ford", C, { element: "Water" }, "Forbids Water"),
  g_hearth: geis("g_hearth", "Geis of the hearth", C, { element: "Fire" }, "Forbids Fire"),
  g_spear: geis("g_spear", "Geis of the spear", C, { kind: "Weapon" }, "Forbids Weapons"),
  g_silence: geis("g_silence", "Geis of silence", C, { kind: "Word" }, "Forbids Words"),
  g_door: geis("g_door", "Geis of the open door", R, { rest: true }, "Forbids resting; Invoke Hospitality", { invoke: "Hospitality" }),
  g_hound: geis("g_hound", "Geis of the hound", R, { kind: "Feat" }, "Forbids Feats; Invoke Hound", { invoke: "Hound" }),
  g_giant: geis("g_giant", "Geis of the giant's portion", R, { kind: "Ally" }, "Forbids Allies; a hero of Valour 5 or more starts its duel 2 lower", { bigLoss: 2 }),
  g_peace: geis("g_peace", "Geis of the king's peace", R, { kind: "Weapon" }, "Global: every hero is forbidden Weapons", { scope: "global" }),
  g_hosting: geis("g_hosting", "Geis of the hosting", R, { rest: true }, "Global: every hero is forbidden to rest", { scope: "global" }),
  g_samhain: geis("g_samhain", "Geis of Samhain night", R, { heal: true }, "Global: every hero is forbidden Heals", { scope: "global" }),
  g_slow: geis("g_slow", "Geis of the slow hand", R, { element: "Wind" }, "Forbids Wind; the hero's Initiative −3", { initLoss: 3 }),
};

// ---------------------------------------------------------------- oaths
const oath = (id: string, name: string, rarity: Rarity, boon: OathDef["boon"], forbids: Forbids, text: string): OathDef =>
  ({ type: "oath", id, name, rarity, boon, forbids, text });
export const OATHS: Record<string, OathDef> = {
  v_champion: oath("v_champion", "Champion's oath", C, { strike: 1 }, { rest: true }, "Strikes +1. Vow: never rest"),
  v_first: oath("v_first", "Oath of the first blow", C, { init: 3 }, { kind: "Word" }, "Initiative +3. Vow: no Words"),
  v_blood: oath("v_blood", "Blood-oath", R, { strike: 2 }, { heal: true, rest: true }, "Strikes +2. Vow: no Heals, never rest"),
  v_shieldwall: oath("v_shieldwall", "Oath of the shield-wall", C, { shield: 2 }, { kind: "Feat" }, "Shield 2 at the start of each duel. Vow: no Feats"),
  v_hearthguard: oath("v_hearthguard", "Hearth-guard's oath", C, { valour: 2 }, { kind: "Weapon" }, "Valour +2. Vow: no Weapons"),
  v_stone: oath("v_stone", "Oath on the stone", R, { valour: 1, shield: 1 }, { element: "Fire" }, "Valour +1 and Shield 1. Vow: no Fire"),
  v_druid: oath("v_druid", "Druid's oath", C, { heal: 1, shield: 1 }, { kind: "Weapon" }, "Heals +1 and Shield 1. Vow: no Weapons"),
};

// ---------------------------------------------------------------- omens
const omen = (id: string, name: string, rarity: Rarity, omenKind: OmenDef["omenKind"], fx: OmenEffect, text: string): OmenDef =>
  ({ type: "omen", id, name, rarity, omenKind, scope: omenKind === "board" ? "global" : omenKind === "targeted" ? "targeted" : "yours", fx, text });
export const OMENS: Record<string, OmenDef> = {
  // board
  o_debility: omen("o_debility", "Debility of the Ulstermen", R, "board", { debility: "Ulaid" }, "Ulaid (and Deorad) heroes' Strikes −1"),
  o_crow: omen("o_crow", "The Morrígan's crow", R, "board", { noHeals: true }, "No Heals (a breakable geis on everyone)"),
  o_truce: omen("o_truce", "Truce of Samhain", C, "board", { truce: 3 }, "No Strike above 3"),
  o_darkness: omen("o_darkness", "Night of the Fomóire", R, "board", { darkness: true }, "In the first duel, the lower Initiative strikes first"),
  o_blight: omen("o_blight", "Blighted harvest", C, "board", { healMod: -1 }, "Every Heal −1"),
  o_tide: omen("o_tide", "The flood tide", C, "reinforcement", { heal: 1 }, "Your Heals +1"),
  o_mist: omen("o_mist", "Mist of the druids", R, "ward", { mist: true }, "Your hero strikes first in both duels (two Mists cancel)"),
  // targeted: one hero, chosen when turned
  o_herolight: omen("o_herolight", "The hero's light", C, "targeted", { strikeMod: 1 }, "Targeted: that hero's Strikes +1"),
  o_keen: omen("o_keen", "Keening of the bean sídhe", C, "targeted", { strikeMod: -1 }, "Targeted: that hero's Strikes −1"),
  o_sleep: omen("o_sleep", "Druid's sleep", C, "targeted", { initMod: -3 }, "Targeted: that hero's Initiative −3"),
  o_mantle: omen("o_mantle", "Brigid's mantle", R, "targeted", { shieldStart: 1 }, "Targeted: that hero starts its duel with Shield 1"),
  // ward
  o_lugh: omen("o_lugh", "Lugh's protection", R, "ward", { firstHitSoak: 1 }, "The first Strike against each of your heroes each duel −1"),
  o_fog: omen("o_fog", "Fog of Manannán", C, "ward", { firstHitSoak: 1 }, "The first Strike against each of your heroes each duel −1"),
  o_emain: omen("o_emain", "Emain's ward", R, "ward", { ignoreGeis: true }, "Your heroes ignore geasa, targeted and global"),
  o_culann: omen("o_culann", "Culann's hound", C, "ward", { firstHitSoak: 1 }, "The first Strike against each of your heroes each duel −1"),
  o_rath: omen("o_rath", "The ráth of Cruachan", C, "ward", { shieldStart: 1 }, "Your heroes start each duel with Shield 1"),
  o_tory: omen("o_tory", "Tory's tower", C, "ward", { shieldStart: 1 }, "Your heroes start each duel with Shield 1"),
  // reinforcement
  o_boyhood: omen("o_boyhood", "The boyhood deeds", C, "reinforcement", { strikeDuel: { duel: 0, n: 1 } }, "Your first-duel hero's Strikes +1"),
  o_portion: omen("o_portion", "The champion's portion", C, "reinforcement", { startValour: { duel: 1, n: 1 } }, "Your second-duel hero starts +1 Valour"),
  o_tribute: omen("o_tribute", "Samhain tribute", C, "reinforcement", { strikeDuel: { duel: 1, n: 1 } }, "Your second-duel hero's Strikes +1"),
  o_wave: omen("o_wave", "The ninth wave", C, "reinforcement", { shield: 1 }, "Your Shields +1"),
  o_redbranch: omen("o_redbranch", "Muster of the Red Branch", C, "reinforcement", { kind: { kind: "Feat", n: 1 } }, "Your Feats +1"),
  o_brugh: omen("o_brugh", "Brú na Bóinne", C, "reinforcement", { kind: { kind: "Word", n: 1 } }, "Your Words +1"),
  o_ford: omen("o_ford", "Blessing of the ford", C, "reinforcement", { element: { el: "Water", n: 1 } }, "Your Water supports +1"),
  o_cruachan: omen("o_cruachan", "Cruachan's plenty", C, "reinforcement", { heal: 1 }, "Your Heals +1"),
};

export const ALL_DEFS: Record<string, CardDef> = { ...HEROES, ...CHAMPIONS, ...SUPPORTS, ...GEASA, ...OATHS, ...OMENS };

export function defsFromIds(ids: string[]): CardDef[] {
  return ids.map((id) => {
    const d = ALL_DEFS[id];
    if (!d) throw new Error(`unknown card id ${id}`);
    return d;
  });
}

// ---------------------------------------------------------------- the five decks
// Each: 4 heroes, 2 champions, 9 supports, 3 geasa (1 global), 2 oaths, 4 omens (1 targeted) = 24.
export const DECK_IDS: Record<Faction, string[]> = {
  ulster: [
    "cu", "conall", "conchobar", "emer",
    "loegaire", "fiacha",
    "gae_bolga", "thunder", "thunder", "warp", "sling", "ochain", "laeg", "brown_bull", "salmon",
    "g_hosting", "g_hearth", "g_giant",
    "v_champion", "v_blood",
    "o_mantle", "o_culann", "o_emain", "o_redbranch",
  ],
  connacht: [
    "medb", "ferdiad", "fergus", "ailill",
    "loch", "nadcrantail",
    "cet_spear", "cet_spear", "host", "horn_shield", "medb_chariot", "fedelm", "finnbennach", "caladbolg", "barach",
    "g_hound", "g_hosting", "g_slow",
    "v_shieldwall", "v_stone",
    "o_herolight", "o_truce", "o_cruachan", "o_rath",
  ],
  sidhe: [
    "lugh", "dagda", "morrigan", "brigid",
    "nuada", "ogma",
    "spear_assal", "fragarach", "tathlum", "goibniu", "raven", "raven", "dian_cecht", "uaithne", "fe_fiada",
    "g_hosting", "g_door", "g_giant",
    "v_druid", "v_champion",
    "o_lugh", "o_crow", "o_mist", "o_keen",
  ],
  fomoire: [
    "balor", "bres", "cethlenn", "indech",
    "elatha", "tethra",
    "gaze", "tower", "sea_raid", "sea_raid", "club", "galley", "tribute", "octriallach", "blight",
    "g_hearth", "g_samhain", "g_slow",
    "v_stone", "v_blood",
    "o_darkness", "o_sleep", "o_tory", "o_tribute",
  ],
  merrow: [
    "manannan", "fand", "liban", "coomara",
    "roane", "muirdris",
    "cohuleen", "cliodhna", "undertow", "undertow", "riptide", "sealskin", "pearl", "soul_cage", "scuab",
    "g_door", "g_peace", "g_giant",
    "v_shieldwall", "v_druid",
    "o_ford", "o_tide", "o_fog", "o_keen",
  ],
};
export const DECKS: Record<string, CardDef[]> = Object.fromEntries(
  Object.entries(DECK_IDS).map(([k, ids]) => [k, defsFromIds(ids)]),
);
export const ULSTER = DECKS.ulster;
export const CONNACHT = DECKS.connacht;

export const RARITY_LIMIT: Record<Rarity, number> = { common: 2, rare: 1, legendary: 1 };
export const MAX_LEGENDARIES = 2;

/** Ulaid and Connachta are Unwilling for each other; so are Sídhe and Fomóire. */
export function unwillingPair(heroAl: string, supAl: string): boolean {
  return (
    (supAl === "Ulaid" && heroAl === "Connachta") || (supAl === "Connachta" && heroAl === "Ulaid") ||
    (supAl === "Sidhe" && heroAl === "Fomoire") || (supAl === "Fomoire" && heroAl === "Sidhe")
  );
}

/** Deck legality. Returns a list of problems (empty = legal). */
export function deckErrors(deck: CardDef[]): string[] {
  const errs: string[] = [];
  if (deck.length !== 24) errs.push(`deck has ${deck.length} cards, needs 24`);
  const count = (t: CardDef["type"]) => deck.filter((d) => d.type === t).length;
  const h = count("hero"), s = count("support"), g = count("geis"), v = count("oath"), o = count("omen"), ch = count("champion");
  if (count("unknown") > 0) errs.push("unknown card");
  if (h < 4 || h > 6) errs.push(`heroes ${h} (4–6)`);
  if (s < 8 || s > 12) errs.push(`supports ${s} (8–12)`);
  if (g < 2 || g > 6) errs.push(`geasa ${g} (2–6)`);
  if (v > 4) errs.push(`oaths ${v} (0–4)`);
  if (ch > 2) errs.push(`champions ${ch} (0–2)`);
  if (o < 4 || o > 6) errs.push(`omens ${o} (4–6)`);
  const copies: Record<string, number> = {};
  for (const d of deck) copies[d.id] = (copies[d.id] ?? 0) + 1;
  let legends = 0;
  for (const [id, n] of Object.entries(copies)) {
    const d = ALL_DEFS[id];
    if (!d || d.type === "unknown") continue;
    const max = d.type === "hero" || d.type === "champion" || d.type === "omen" ? 1 : RARITY_LIMIT[d.rarity];
    if (n > max) errs.push(`${id} x${n} (max ${max})`);
    if (d.rarity === "legendary") legends += n;
  }
  if (legends > MAX_LEGENDARIES) errs.push(`legendaries ${legends} (max ${MAX_LEGENDARIES})`);
  const al = new Set<string>();
  let deorad = false;
  for (const d of deck) if (d.type === "hero") { if (d.alignment === "Deorad") deorad = true; else al.add(d.alignment); }
  if (deorad && !al.has("Ulaid") && !al.has("Connachta")) al.add("Deorad");
  if (al.size > 2) errs.push(`hero alignments ${[...al].join(",")} (max 2)`);
  return errs;
}
