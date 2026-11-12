// Roth Catha card pool, second draft: five factions, rarity, hero Valour, oaths and modifying geasa.
// Every hero quality, support special, geis, oath and omen is data here; the engine reads the fields.

export type Element = "Fire" | "Wind" | "Earth" | "Water";
/** Spirit (anam) is the Slúagh's damage: outside the element wheel, it ignores Shield and steals 1 when it wounds. */
export type SupportElement = Element | "Spirit";
export type Kind = "Weapon" | "Feat" | "Ally" | "Word";
export type Alignment = "Ulaid" | "Connachta" | "Sidhe" | "Fomoire" | "Merrow" | "Deorad" | "Sluagh";
export type SupportAlignment = Alignment | "Unaligned";
export type Focus = SupportElement | Kind;
export type Rarity = "common" | "rare" | "legendary";

export const ELEMENTS: Element[] = ["Fire", "Wind", "Earth", "Water"];
export const FACTIONS = ["ulster", "connacht", "sidhe", "fomoire", "merrow", "sluagh"] as const;
export type Faction = (typeof FACTIONS)[number];

/** Fire beats Wind beats Earth beats Water beats Fire. */
export function beats(a: SupportElement, b: Element): boolean {
  return (
    (a === "Fire" && b === "Wind") ||
    (a === "Wind" && b === "Earth") ||
    (a === "Earth" && b === "Water") ||
    (a === "Water" && b === "Fire")
  );
}
export function isElement(x: unknown): x is Element { // the four of the wheel (not Spirit)
  return x === "Fire" || x === "Wind" || x === "Earth" || x === "Water";
}

/** Hero qualities, all optional. */
export interface HeroAb {
  /** Sim only (the target dummies): felled, it rises at once at its starting Valour and the duel goes on to its turn
   *  limit; each rising is counted (ledger n:undying, credited to the side that felled it). */
  undying?: boolean;
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
  armour?: number; // Armour n from the start of each duel: every Strike against it n less
  firstHitSoak?: number; // the first Strike against it each duel −n
  capTaken?: number; // no Strike against it above n
  drain?: number; // when its Strike wounds, Heal n
  foeHealMalus?: number; // the enemy hero's Heals −n
  kingsDue?: boolean; // once per duel, may use an unused support from your other hero's quadrant
  shapeShift?: boolean; // once per match, at the start of a duel, change Focus to any element
  sparedDebility?: boolean;
  reflect?: number; // when a Strike wounds it, the striker loses n Valour
  followUp?: boolean; // Connacht (duels to the death): a blow of its that wounds for 1 or less strikes again at once
  riposte?: number; // Connacht (duels to the death): when its Shield takes a blow, a free Strike n back
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
  /** A Slúagh host as fought: every weakness its monsters and host type bring (weakness is the first of them). */
  weaknesses?: Element[];
  /** A Slúagh host as fought: elements its Spirit blows also count as (from its monsters). */
  hybrids?: Element[];
  /** A Slúagh host as fought: the host card and the monsters joined to it. */
  host?: { def: HostDef; members: MonsterDef[] };
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
  element: SupportElement | null;
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
  armour?: number; // Armour n: every Strike against the hero n less for the rest of the duel (doesn't add up; the highest counts)
  /** How it's used in a duel to the death: an action on your turn (the default), passive (works just by being placed
   *  beside the hero), or a reaction (tapped when the enemy strikes, to block that blow). */
  use?: "passive" | "reaction";
  drain?: number; // if its Strike wounds, Heal n
  /** Set only on a support seen through a Channel attendant: its primary Strike +n (and the user pays n Valour). */
  channel?: number;
  /** Set only on a support one of the user's own attendants changed: its primary effect +n. */
  attuned?: number;
  /** The enemy fighter's next Strike −n. */
  foeNext?: number;
  /** The enemy fighter loses n Valour (no Shield stops it). */
  foeLoss?: number;
  /** Set only on a Spirit support a Slúagh host chose to strike with as one of its hybrid elements. */
  spiritAs?: boolean;
  /** Charm: takes up to n of the enemy fighter's Shield for your own, before the blow lands. */
  stealShield?: number;
  /** What it takes to use a placed support again in a long duel (the first use is free). Unset: reuseOf's default. */
  reuse?: Reuse;
}
/**
 * The price of using a placed support again, in duels to the death. turns: that many of your other actions must come
 * between two uses; rest: rest that many times to reset it; valour: pay that much; draw: discard that many cards off
 * the top of your Reserve, unseen.
 */
export interface Reuse { turns?: number; rest?: number; valour?: number; draw?: number }
/** A support's reuse price: its own, or by kind and effect. Weapons need a turn between blows; Feats tire (a rest);
 * Allies must be sent for again (a card off the Reserve); Words cost breath (1 Valour). A Heal or Shield also needs a rest. */
export function reuseOf(s: SupportDef): Reuse {
  if (s.reuse) return s.reuse;
  const r: Reuse = {};
  if (s.kind === "Weapon") r.turns = 1;
  else if (s.kind === "Feat") r.rest = 1;
  else if (s.kind === "Ally") r.draw = 1;
  else if (s.kind === "Word") r.valour = 1;
  // walls and mending don't come back without a breath: a Heal or a Shield also needs a rest
  if (s.effects.some((e) => e.type === "heal" || e.type === "shield")) r.rest = Math.max(1, r.rest ?? 0);
  // the dead feed on what they take, so a Spirit blow can't fall two turns running
  if (s.element === "Spirit") r.turns = Math.max(1, r.turns ?? 0);
  return r;
}
/**
 * The Slúagh, the host of the unquiet dead, fight as hosts. A host card goes on a hero spot with 2–3 monsters joined
 * to it from hand; they fight as one fighter whose numbers are the monsters' added together, changed by the host.
 */
export interface MonsterDef {
  type: "monster";
  id: string;
  name: string;
  alignment: "Sluagh";
  rarity: Rarity;
  valour: number;
  /** added to the host's Initiative (may be negative) */
  init: number;
  weakness: Element;
  /** Hybrid damage: the host's Spirit blows also count as this element (the opposite of its weakness). */
  hybrid?: Element;
  ab: HeroAb;
  quality: string;
}
export interface HostDef {
  type: "host";
  id: string;
  name: string;
  alignment: "Sluagh";
  rarity: Rarity;
  kind: "hunt" | "prey" | "taboo";
  /** the host's own Initiative, before its monsters' */
  init: number;
  /** Valour added for each monster joined */
  valourEach: number;
  /** the weakness every host of this kind carries */
  weakness: Element;
  focus: Focus;
  tag: string;
  ab: HeroAb;
  quality: string;
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
  /** Modifying geasa: the bound hero is also weak to this element (as well as its printed weakness). */
  weak?: Element;
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
  /** An oath only one people swears (it goes in that people's pool alone). */
  people?: Alignment;
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
  /** An omen tied to one people belongs to that people's pool; the rest are open to every deck. */
  people?: Alignment;
}
/**
 * An attendant (a patron, smith, druid or thrall) is called from hand in the Playing turn, like an oath, and stays
 * for the match. It changes the element supports count as, for everything an element touches: Focus, the element
 * wheel, weakness, omens, and which geasa and oaths forbid them.
 *   enchant: supports of `kind` count as `to`.
 *   turn:    supports of `from` count as `to`.
 *   channel: supports of `from` count as `to`, their primary Strike +1, and the hero using one loses 1 Valour.
 *   reforge: supports of kind `kind` count as kind `toKind` (so a Weapon can slip a "no Weapons" geis).
 *   curse:   fighters in reach are also weak to `to` (as well as their printed weakness).
 * A support changed by its user's own attendant (enchant, turn, channel or reforge) is attuned: primary effect +1.
 * scope: global (every fighter), yours (your fighters and the supports they use), enemy (the enemy's).
 */
export interface AttendantDef {
  type: "attendant";
  id: string;
  name: string;
  rarity: Rarity;
  scope: "global" | "yours" | "enemy";
  mode: "enchant" | "turn" | "channel" | "reforge" | "curse";
  kind?: Kind;
  toKind?: Kind;
  from?: Element;
  to?: Element;
  /** An attendant tied to one people belongs to that people's pool; the rest are open to every deck. */
  people?: Alignment;
  text: string;
}
export interface UnknownDef {
  type: "unknown";
  id: "unknown";
  name: "?";
}
export type CardDef = HeroDef | ChampionDef | SupportDef | GeisDef | OathDef | OmenDef | AttendantDef | HostDef | MonsterDef | UnknownDef;

export const UNKNOWN: UnknownDef = { type: "unknown", id: "unknown", name: "?" };

// ---------------------------------------------------------------- heroes
const hero = (
  id: string, name: string, alignment: Alignment, rarity: Rarity, valour: number, init: number,
  focus: Focus, weakness: Element, tag: string, quality: string, ab: HeroAb,
): HeroDef => ({ type: "hero", id, name, alignment, rarity, valour, init, focus, weakness, quality, tag, ab });
const C: Rarity = "common", R: Rarity = "rare", L: Rarity = "legendary";

export const HEROES: Record<string, HeroDef> = {
  // Ulaid: fast, fiery, Feats
  cu: hero("cu", "Cú Chulainn", "Ulaid", L, 5, 5, "Fire", "Wind", "Hound", "Ríastrad: Strikes +1; at 1 Valour, +2 more. Spared the Debility", { strikeAll: 1, rally: { at: 1, n: 2 }, sparedDebility: true }),
  conall: hero("conall", "Conall Cernach", "Ulaid", R, 5, 3, "Weapon", "Wind", "Vengeance", "Cet's bane: Strikes +1 against a hero of Valour 5 or more, +1 more once your other hero has fallen", { vsBig: 1, avenger: 1 }),
  conchobar: hero("conchobar", "Conchobar mac Nessa", "Ulaid", R, 6, 2, "Word", "Fire", "Druid's word", "King's due: once per duel, may use an unused support from your other hero's quadrant", { kingsDue: true }),
  emer: hero("emer", "Emer", "Ulaid", C, 4, 2, "Word", "Fire", "Hospitality", "Six gifts: when she rests, Heal 2", { restHeal: 2 }),
  // Connachta: Earth, weapons, attrition
  medb: hero("medb", "Medb", "Connachta", L, 4, 4, "Earth", "Water", "Bounty", "Queen of Cruachan: kinship gives her +2, not +1", { kinBonus: 2, followUp: true }),
  ferdiad: hero("ferdiad", "Ferdiad", "Connachta", R, 5, 2, "Weapon", "Water", "Satire", "Horn-skin: Armour 1 (every Strike against him 1 less)", { armour: 1, riposte: 1 }),
  fergus: hero("fergus", "Fergus mac Róich", "Deorad", R, 5, 3, "Weapon", "Wind", "Feast", "Old oath: Strikes vs Hound −1", { vsTag: { tag: "Hound", n: -1 } }),
  ailill: hero("ailill", "Ailill mac Máta", "Connachta", C, 5, 3, "Word", "Fire", "Hoard", "Pillow-talk: his Heals +1", { healBonus: 1, riposte: 1 }),
  // Sídhe (Tuatha Dé Danann): Wind and Word, many-skilled, healers
  lugh: hero("lugh", "Lugh Lámhfhada", "Sidhe", L, 4, 6, "Wind", "Fire", "Many skills", "Samildánach: every support counts as his Focus", { focusAny: true }),
  dagda: hero("dagda", "The Dagda", "Sidhe", R, 6, 1, "Earth", "Fire", "Plenty", "Cauldron: when he rests, Heal 2", { restHeal: 2 }),
  morrigan: hero("morrigan", "The Morrígan", "Sidhe", R, 4, 4, "Wind", "Earth", "Prophecy", "Battle-crow: Strikes +1; once per match, change her Focus to any element at the start of a duel", { strikeAll: 1, shapeShift: true }),
  brigid: hero("brigid", "Brigid", "Sidhe", C, 4, 3, "Fire", "Water", "Forge", "Healer's well: her Heals +1", { healBonus: 1 }),
  // Fomóire: huge, slow, blighting
  balor: hero("balor", "Balor of the Evil Eye", "Fomoire", L, 5, 1, "Fire", "Water", "Evil eye", "Evil eye: his first Strike each duel +1", { firstStrike: 1 }),
  bres: hero("bres", "Bres", "Fomoire", R, 4, 3, "Word", "Wind", "Hospitality", "Niggard king: the enemy hero's Heals −1", { foeHealMalus: 1 }),
  cethlenn: hero("cethlenn", "Cethlenn", "Fomoire", R, 3, 4, "Water", "Earth", "Prophecy", "Bloodied tooth: Strikes +1; when her Strike wounds, Heal 1", { strikeAll: 1, drain: 1 }),
  indech: hero("indech", "Indech mac Dé Domnann", "Fomoire", C, 4, 2, "Earth", "Wind", "Sea", "Sea-giant: no Strike against him above 4", { capTaken: 4 }),
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
  loch: champ("loch", "Lóch Mór mac Mo Febis", "Connachta", R, 4, "Weapon", "Water", "Lóch's fury: Strikes +1", { strikeAll: 1, followUp: true }),
  nadcrantail: champ("nadcrantail", "Nad Crantail", "Connachta", C, 4, "Earth", "Fire", "Holly spears: his first Strike +1", { firstStrike: 1, followUp: true }),
  nuada: champ("nuada", "Nuada Airgetlám", "Sidhe", R, 5, "Weapon", "Wind", "Silver hand: Shield 1 when he steps in", { shieldStart: 1 }),
  ogma: champ("ogma", "Ogma", "Sidhe", C, 4, "Word", "Earth", "Sun-face: his first Strike +1", { firstStrike: 1 }),
  elatha: champ("elatha", "Elatha mac Delbaíth", "Fomoire", C, 5, "Water", "Wind", "Golden king: no special quality; he is simply big", {}),
  tethra: champ("tethra", "Tethra", "Fomoire", R, 4, "Water", "Earth", "Sea-crow: when his Strike wounds, Heal 1", { drain: 1 }),
  roane: champ("roane", "The Roane", "Merrow", C, 4, "Water", "Fire", "Seal-hide: Shield 1 when it steps in", { shieldStart: 1 }),
  // the Slúagh: monsters that stand in for a host
  banshee: champ("banshee", "The Banshee", "Sluagh", C, 4, "Spirit", "Wind", "Her keening: the enemy's Heals −1", { foeHealMalus: 1 }),
  fear_doirich: champ("fear_doirich", "Fear Doirich, the dark man", "Sluagh", R, 5, "Spirit", "Fire", "Lord of the host: his first Strike +1", { firstStrike: 1 }),
  muirdris: champ("muirdris", "The Muirdris", "Merrow", R, 5, "Water", "Earth", "Sea-beast: no Strike against it above 3", { capTaken: 3 }),
};

// ---------------------------------------------------------------- supports
const sup = (
  id: string, name: string, element: SupportElement, kind: Kind, alignment: SupportAlignment, rarity: Rarity,
  effects: Effect[], text: string, extra: Partial<SupportDef> = {},
): SupportDef => ({ type: "support", id, name, element, kind, alignment, rarity, effects, text, ...extra });
const S = (n: number): Effect => ({ type: "strike", n });
const H = (n: number): Effect => ({ type: "heal", n });
const Sh = (n: number): Effect => ({ type: "shield", n });

export const SUPPORTS: Record<string, SupportDef> = {
  salmon: sup("salmon", "Salmon leap", "Water", "Feat", "Unaligned", C, [Sh(2)], "Reaction: Block 2", { use: "reaction" }),
  // Ulaid
  gae_bolga: sup("gae_bolga", "Gáe Bolga", "Water", "Weapon", "Ulaid", L, [S(2)], "Strike 2, ignores Shield; Strike 4 if Cú Chulainn uses it", { forHero: { id: "cu", n: 4 }, pierce: true }),
  thunder: sup("thunder", "Thunder feat", "Fire", "Feat", "Ulaid", C, [S(3)], "Strike 3; ignores Shield", { pierce: true }),
  warp: sup("warp", "The warp-spasm", "Fire", "Feat", "Ulaid", R, [S(4)], "Strike 4; your hero loses 1", { selfLoss: 1 }),
  sling: sup("sling", "Sling of Emain", "Wind", "Weapon", "Ulaid", C, [S(2)], "Strike 2; +1 if it is the first support used in the duel", { firstBonus: 1 }),
  ochain: sup("ochain", "Ochain, the roaring shield", "Wind", "Weapon", "Ulaid", R, [], "Passive: Armour 1", { armour: 1, use: "passive" }),
  laeg: sup("laeg", "Láeg, the charioteer", "Wind", "Ally", "Ulaid", R, [H(1)], "Heal 1; your next Strike +1", { nextStrike: 1 }),
  brown_bull: sup("brown_bull", "The Brown Bull of Cúailnge", "Earth", "Ally", "Ulaid", R, [H(2)], "Heal 2"),
  cathbad: sup("cathbad", "Cathbad the druid", "Wind", "Word", "Ulaid", R, [S(1)], "Strike 1; your hero may ignore one geis or oath this duel without cost", { cathbad: true }),
  // Connachta
  cet_spear: sup("cet_spear", "Spear of Cet mac Mágach", "Earth", "Weapon", "Connachta", C, [S(2)], "Strike 2"),
  host: sup("host", "The host of Cruachan", "Earth", "Ally", "Connachta", C, [S(1), H(1)], "Strike 1 + Heal 1"),
  medb_chariot: sup("medb_chariot", "Medb's war-chariot", "Wind", "Ally", "Connachta", R, [H(1)], "Heal 1; your next Strike +1", { nextStrike: 1 }),
  fedelm: sup("fedelm", "Fedelm's prophecy", "Wind", "Word", "Connachta", R, [S(1)], "Strike 1; your next Strike +1", { nextStrike: 1 }),
  horn_shield: sup("horn_shield", "Ferdiad's horn-shield", "Water", "Weapon", "Connachta", C, [], "Passive: Armour 1", { armour: 1, use: "passive" }),
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
  fe_fiada: sup("fe_fiada", "The féth fíada", "Water", "Word", "Sidhe", C, [Sh(2)], "Reaction: Block 2", { use: "reaction" }),
  // Fomóire
  gaze: sup("gaze", "The gaze of Balor", "Fire", "Feat", "Fomoire", L, [S(2)], "Strike 2; Strike 3 if Balor uses it", { forHero: { id: "balor", n: 3 } }),
  tower: sup("tower", "Conand's tower", "Earth", "Ally", "Fomoire", R, [Sh(3)], "Reaction: Block 3", { use: "reaction" }),
  sea_raid: sup("sea_raid", "Sea-raid", "Water", "Feat", "Fomoire", C, [S(2)], "Strike 2"),
  galley: sup("galley", "Fomorian galley", "Water", "Ally", "Fomoire", C, [S(2), Sh(1)], "Strike 2 + Shield 1"),
  club: sup("club", "Club of the Fomóire", "Earth", "Weapon", "Fomoire", C, [S(2)], "Strike 2"),
  tribute: sup("tribute", "Tribute of Mag Céidne", "Earth", "Word", "Fomoire", R, [S(1), H(1)], "Strike 1 + Heal 1; Invoke Plenty", { invoke: "Plenty" }),
  octriallach: sup("octriallach", "Stones of Octriallach", "Water", "Word", "Fomoire", R, [S(1)], "Strike 1; if it wounds, Heal 1", { drain: 1 }),
  blight: sup("blight", "Blight of the Fomóire", "Wind", "Word", "Fomoire", C, [S(2)], "Strike 2; Invoke Forge", { invoke: "Forge" }),
  // Merrow
  cohuleen: sup("cohuleen", "The cohuleen druith", "Water", "Ally", "Merrow", L, [Sh(2), H(1)], "Shield 2 + Heal 1"),
  cliodhna: sup("cliodhna", "Clíodhna's wave", "Water", "Feat", "Merrow", R, [S(2)], "Strike 2; ignores Shield", { pierce: true }),
  undertow: sup("undertow", "Undertow", "Water", "Feat", "Merrow", C, [S(2)], "Strike 2"),
  riptide: sup("riptide", "Riptide", "Wind", "Feat", "Merrow", C, [S(1)], "Strike 1; your next Strike +1", { nextStrike: 1 }),
  sealskin: sup("sealskin", "Sealskin", "Water", "Word", "Merrow", C, [Sh(3)], "Reaction: Block 3", { use: "reaction" }),
  pearl: sup("pearl", "Pearl of the deep", "Earth", "Word", "Merrow", R, [H(2)], "Heal 2"),
  soul_cage: sup("soul_cage", "The soul cage", "Earth", "Ally", "Merrow", R, [S(1)], "Strike 1; if it wounds, Heal 1", { drain: 1 }),
  scuab: sup("scuab", "Scuabtuinne, the wave-sweeper", "Wind", "Ally", "Merrow", R, [S(2)], "Strike 2"),

  // ---- the Slúagh: weaker, and turned against the enemy more than to their own good; Spirit ignores Shield and steals 1
  cold_touch: sup("cold_touch", "The cold touch", "Spirit", "Feat", "Sluagh", C, [S(1)], "Strike 1 (Spirit)"),
  keening_dead: sup("keening_dead", "The keening dead", "Spirit", "Word", "Sluagh", C, [S(1)], "Strike 1 (Spirit); the enemy's next Strike −1", { foeNext: 1 }),
  grave_chill: sup("grave_chill", "Grave-chill", "Water", "Word", "Sluagh", R, [S(1)], "Strike 1; the enemy loses 1 Valour", { foeLoss: 1 }),
  spine_whip: sup("spine_whip", "The Dullahan's whip", "Spirit", "Weapon", "Sluagh", R, [S(2)], "Strike 2 (Spirit)"),
  corpse_candle: sup("corpse_candle", "Corpse-candle", "Fire", "Word", "Sluagh", C, [S(1)], "Strike 1; the enemy's next Strike −1", { foeNext: 1 }),
  death_coach: sup("death_coach", "The cóiste bodhar", "Spirit", "Ally", "Sluagh", R, [S(2)], "Strike 2 (Spirit); your host loses 1 Valour", { selfLoss: 1 }),
  bone_dust: sup("bone_dust", "Bone-dust", "Earth", "Word", "Sluagh", C, [Sh(1)], "Reaction: Block 1", { use: "reaction" }),
  hungry_grass: sup("hungry_grass", "The hungry grass", "Spirit", "Ally", "Sluagh", C, [S(1)], "Strike 1 (Spirit); Invoke Feast", { invoke: "Feast" }),
  hunt_horn: sup("hunt_horn", "The horn of the hunt", "Wind", "Ally", "Sluagh", R, [S(1)], "Strike 1; your next Strike +1", { nextStrike: 1 }),
  wail: sup("wail", "The wail", "Wind", "Word", "Sluagh", R, [S(1)], "Strike 1; the enemy loses 1 Valour", { foeLoss: 1 }),
  grave_dirt: sup("grave_dirt", "Grave-dirt", "Earth", "Weapon", "Sluagh", C, [S(2)], "Strike 2"),
  harvest: sup("harvest", "The harvest of souls", "Spirit", "Feat", "Sluagh", L, [S(3)], "Strike 3 (Spirit)"),
  black_mass: sup("black_mass", "The withering", "Spirit", "Word", "Sluagh", C, [S(1)], "Strike 1 (Spirit); the enemy's next Strike −1", { foeNext: 1 }),
  famine: sup("famine", "Famine-wind", "Wind", "Feat", "Sluagh", C, [S(2)], "Strike 2"),

  // ---- the second half of each people's pool (deck building) ----
  // Ulaid: Words at last for Conchobar and Emer, and tricks against the other peoples' geasa
  cruaidin: sup("cruaidin", "Cruaidín Catutchenn", "Fire", "Weapon", "Ulaid", R, [S(2)], "Strike 2; Strike 3 if Cú Chulainn uses it", { forHero: { id: "cu", n: 3 } }),
  beheading: sup("beheading", "The beheading game", "Fire", "Word", "Ulaid", L, [S(3)], "Strike 3"),
  bricriu: sup("bricriu", "Bricriu's feast", "Fire", "Word", "Ulaid", C, [S(1)], "Strike 1; Invoke Feast", { invoke: "Feast" }),
  athirne: sup("athirne", "Athirne's satire", "Wind", "Word", "Ulaid", C, [S(1)], "Strike 1; Invoke Bounty", { invoke: "Bounty" }),
  leborcham: sup("leborcham", "Leborcham's tidings", "Wind", "Word", "Ulaid", R, [S(1)], "Strike 1; your next Strike +1", { nextStrike: 1 }),
  sencha: sup("sencha", "Sencha's judgement", "Earth", "Word", "Ulaid", R, [H(1), Sh(1)], "Heal 1 + Shield 1"),
  grey_macha: sup("grey_macha", "The Grey of Macha", "Wind", "Ally", "Ulaid", R, [S(2)], "Strike 2; your next Strike +1", { nextStrike: 1 }),
  scathach: sup("scathach", "Scáthach's teaching", "Fire", "Feat", "Ulaid", R, [S(1)], "Strike 1; +2 against a hero of Valour 5 or more", { vsBig: 2 }),
  dubsainglend: sup("dubsainglend", "The Black of Saingliu", "Water", "Ally", "Ulaid", C, [Sh(1), H(1)], "Shield 1 + Heal 1"),
  // Connachta (and one exile's card)
  tain: sup("tain", "The Táin", "Earth", "Ally", "Connachta", L, [S(2), H(2)], "Strike 2 + Heal 2"),
  fraech: sup("fraech", "Fráech's spear", "Water", "Weapon", "Connachta", R, [S(2), Sh(1)], "Strike 2 + Shield 1"),
  cruachan_gold: sup("cruachan_gold", "The gold of Cruachan", "Earth", "Word", "Connachta", R, [H(2), Sh(1)], "Heal 2 + Shield 1"),
  mac_roth: sup("mac_roth", "Mac Roth's herald-cry", "Wind", "Word", "Connachta", C, [S(1)], "Strike 1; Invoke Hound", { invoke: "Hound" }),
  gamanrad: sup("gamanrad", "The charge of the Gamanrad", "Earth", "Ally", "Connachta", C, [S(2)], "Strike 2; +1 if it is the first support used in the duel", { firstBonus: 1 }),
  ferdiad_sword: sup("ferdiad_sword", "Ferdiad's gilded sword", "Earth", "Weapon", "Connachta", R, [S(2)], "Strike 2; Strike 3 if Ferdiad uses it", { forHero: { id: "ferdiad", n: 3 } }),
  medb_druids: sup("medb_druids", "Medb's druids", "Fire", "Word", "Connachta", C, [S(2)], "Strike 2; Invoke Druid's word", { invoke: "Druid's word" }),
  finnabair: sup("finnabair", "Finnabair's favour", "Wind", "Ally", "Connachta", R, [H(2)], "Heal 2; your next Strike +1", { nextStrike: 1 }),
  fergus_shield: sup("fergus_shield", "Fergus's shield", "Water", "Weapon", "Deorad", R, [], "Passive: Armour 1", { armour: 1, use: "passive" }),
  // Sídhe
  cauldron: sup("cauldron", "The Dagda's cauldron", "Earth", "Ally", "Sidhe", L, [H(3)], "Heal 3"),
  dagda_club: sup("dagda_club", "The Dagda's club", "Earth", "Weapon", "Sidhe", R, [S(2)], "Strike 2; Strike 4 if the Dagda uses it", { forHero: { id: "dagda", n: 4 } }),
  credne: sup("credne", "Credne's rivets", "Fire", "Weapon", "Sidhe", C, [], "Passive: Armour 1", { armour: 1, use: "passive" }),
  failinis: sup("failinis", "Failinis, Lugh's hound", "Wind", "Ally", "Sidhe", R, [S(2)], "Strike 2; +1 if it is the first support used in the duel", { firstBonus: 1 }),
  ogham: sup("ogham", "Ogma's ogham", "Earth", "Word", "Sidhe", C, [S(1)], "Strike 1; Invoke Evil eye", { invoke: "Evil eye" }),
  airmed: sup("airmed", "Airmed's herbs", "Earth", "Word", "Sidhe", C, [H(1), Sh(1)], "Heal 1 + Shield 1"),
  morrigan_word: sup("morrigan_word", "The Morrígan's prophecy", "Wind", "Word", "Sidhe", R, [S(1)], "Strike 1; your next Strike +1", { nextStrike: 1 }),
  bodb: sup("bodb", "Bodb Derg's war-band", "Wind", "Ally", "Sidhe", C, [S(2)], "Strike 2"),
  sword_light: sup("sword_light", "Claíomh Solais, the sword of light", "Wind", "Weapon", "Sidhe", R, [S(3)], "Strike 3"),
  // Charm: a light blow that goes through Shield, takes the enemy's Shield for your own, and dulls its next Strike
  glamour: sup("glamour", "Glamour", "Wind", "Word", "Sidhe", C, [S(1)], "Charm: Strike 1, ignores Shield; take 1 of the enemy's Shield", { pierce: true, stealShield: 1 }),
  fairy_music: sup("fairy_music", "The music of the mounds", "Wind", "Ally", "Sidhe", R, [S(1)], "Charm: Strike 1, ignores Shield; take 1 of the enemy's Shield; the enemy's next Strike −1", { pierce: true, stealShield: 1, foeNext: 1 }),
  aengus_kiss: sup("aengus_kiss", "Aengus's kisses", "Fire", "Word", "Sidhe", R, [S(1)], "Charm: Strike 1, ignores Shield; the enemy's next Strike −2", { pierce: true, foeNext: 2 }),
  mound_song: sup("mound_song", "Song of the mounds", "Wind", "Word", "Sidhe", C, [S(1)], "Strike 1; Invoke Sea", { invoke: "Sea" }),
  // Fomóire
  unlidded: sup("unlidded", "The Evil Eye unlidded", "Fire", "Feat", "Fomoire", L, [S(3)], "Strike 3; ignores Shield", { pierce: true }),
  glare: sup("glare", "Scorching glare", "Fire", "Feat", "Fomoire", C, [S(2)], "Strike 2"),
  tethra_host: sup("tethra_host", "Tethra's sea-host", "Water", "Ally", "Fomoire", C, [S(2)], "Strike 2; if it wounds, Heal 1", { drain: 1 }),
  bres_tax: sup("bres_tax", "Bres's tax", "Earth", "Word", "Fomoire", C, [S(2)], "Strike 2; Invoke Many skills", { invoke: "Many skills" }),
  cethlenn_spear: sup("cethlenn_spear", "Cethlenn's spear", "Water", "Weapon", "Fomoire", R, [S(2)], "Strike 2; if it wounds, Heal 1", { drain: 1 }),
  seawall: sup("seawall", "Indech's sea-wall", "Earth", "Ally", "Fomoire", R, [S(2), Sh(2)], "Strike 2 + Shield 2"),
  bitter_well: sup("bitter_well", "The bitter well", "Water", "Word", "Fomoire", C, [S(2)], "Strike 2; Invoke Prophecy", { invoke: "Prophecy" }),
  lochlann: sup("lochlann", "The host of Lochlann", "Water", "Ally", "Fomoire", R, [S(3)], "Strike 3"),
  sea_mist: sup("sea_mist", "Sea-mist of Lochlann", "Water", "Word", "Fomoire", C, [Sh(2)], "Reaction: Block 2", { use: "reaction" }),
  domnann: sup("domnann", "Spears of the Domnann", "Earth", "Weapon", "Fomoire", C, [S(2)], "Strike 2; +1 if it is the first support used in the duel", { firstBonus: 1 }),
  // Merrow (still no Weapons)
  tide_wrath: sup("tide_wrath", "The tide's wrath", "Water", "Feat", "Merrow", L, [S(3)], "Strike 3"),
  enbarr: sup("enbarr", "Enbarr of the flowing mane", "Water", "Ally", "Merrow", R, [S(1)], "Strike 1; your next Strike +1", { nextStrike: 1 }),
  fand_tears: sup("fand_tears", "Fand's tears", "Water", "Word", "Merrow", C, [H(1), Sh(1)], "Heal 1 + Shield 1"),
  wave_break: sup("wave_break", "The wave breaks", "Water", "Feat", "Merrow", C, [S(1), Sh(1)], "Strike 1 + Shield 1"),
  net: sup("net", "The drowning net", "Earth", "Feat", "Merrow", R, [S(1)], "Strike 1; +2 against a hero of Valour 5 or more", { vsBig: 2 }),
  kelp: sup("kelp", "Kelp-wrack", "Earth", "Ally", "Merrow", C, [Sh(2)], "Reaction: Block 2", { use: "reaction" }),
  siren: sup("siren", "The merrow's song", "Wind", "Word", "Merrow", C, [S(1)], "Strike 1; Invoke Vengeance", { invoke: "Vengeance" }),
  crane_bag: sup("crane_bag", "Manannán's crane-bag", "Earth", "Word", "Merrow", R, [S(1), H(1)], "Strike 1 + Heal 1"),
  roane_lament: sup("roane_lament", "The roane's lament", "Wind", "Word", "Merrow", C, [S(1)], "Strike 1; Invoke Satire", { invoke: "Satire" }),
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
  // the second half of the pool
  g_plough: geis("g_plough", "Geis of the plough", C, { element: "Earth" }, "Forbids Earth"),
  g_deer: geis("g_deer", "Geis of the deer", C, { kind: "Feat" }, "Forbids Feats"),
  g_gift: geis("g_gift", "Geis of the gift", C, { kind: "Ally" }, "Forbids Allies"),
  g_salmon: geis("g_salmon", "Geis of the salmon", R, { element: "Water" }, "Forbids Water; Invoke Sea", { invoke: "Sea" }),
  g_satirist: geis("g_satirist", "Geis of the satirist", R, { kind: "Word" }, "Forbids Words; Invoke Satire", { invoke: "Satire" }),
  g_bounty: geis("g_bounty", "Geis of the open purse", R, { heal: true }, "Forbids Heals; Invoke Bounty", { invoke: "Bounty" }),
  g_feast: geis("g_feast", "Geis of the feast", R, { rest: true }, "Forbids resting; Invoke Feast", { invoke: "Feast" }),
  g_eye: geis("g_eye", "Geis of the shut eye", R, { element: "Fire" }, "Forbids Fire; Invoke Evil eye", { invoke: "Evil eye" }),
  g_road: geis("g_road", "Geis of the long road", R, { element: "Wind" }, "Forbids Wind; Invoke Many skills", { invoke: "Many skills" }),
  g_hoard: geis("g_hoard", "Geis of the hoard", R, { kind: "Weapon" }, "Forbids Weapons; Invoke Hoard", { invoke: "Hoard" }),
  g_burning: geis("g_burning", "Geis of the burning", R, { element: "Fire" }, "Global: every hero is forbidden Fire", { scope: "global" }),
  g_tuired: geis("g_tuired", "Geis of Mag Tuired", R, { element: "Wind" }, "Forbids Wind; the hero is also weak to Water", { weak: "Water" }),
  g_iron: geis("g_iron", "Geis of cold iron", R, { kind: "Weapon" }, "Forbids Weapons; the hero is also weak to Earth", { weak: "Earth" }),
  g_pyre: geis("g_pyre", "Geis of the pyre", R, { element: "Water" }, "Forbids Water; the hero is also weak to Fire", { weak: "Fire" }),
  g_gale: geis("g_gale", "Geis of the gale", R, { element: "Earth" }, "Forbids Earth; the hero is also weak to Wind", { weak: "Wind" }),
  g_still: geis("g_still", "Geis of the still water", R, { element: "Water" }, "Global: every hero is forbidden Water", { scope: "global" }),
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
  // the second half of the pool
  v_ford: oath("v_ford", "Oath of the ford", C, { strike: 1 }, { element: "Water" }, "Strikes +1. Vow: no Water"),
  v_open_hand: oath("v_open_hand", "Oath of the open hand", C, { heal: 1, valour: 1 }, { kind: "Feat" }, "Heals +1 and Valour +1. Vow: no Feats"),
  v_swift: oath("v_swift", "Oath of the swift", R, { init: 2, strike: 1 }, { rest: true }, "Initiative +2 and Strikes +1. Vow: never rest"),
  v_watch: oath("v_watch", "Oath of the long watch", R, { shield: 3 }, { kind: "Feat", rest: true }, "Shield 3 at the start of each duel. Vow: no Feats, never rest"),
  v_deep: oath("v_deep", "Oath of the deep", C, { valour: 2 }, { element: "Wind" }, "Valour +2. Vow: no Wind"),
  v_earth: oath("v_earth", "Oath on the earth", R, { valour: 1, strike: 1 }, { element: "Earth" }, "Valour +1 and Strikes +1. Vow: no Earth"),
  v_poet: oath("v_poet", "Poet's oath", C, { heal: 1, init: 2 }, { element: "Fire" }, "Heals +1 and Initiative +2. Vow: no Fire"),
  v_vengeance: oath("v_vengeance", "Oath of vengeance", R, { strike: 2 }, { kind: "Word", rest: true }, "Strikes +2. Vow: no Words, never rest"),
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
  o_mist: omen("o_mist", "Mist of the druids", R, "ward", { mist: true }, "Your hero strikes first in the first duel (two Mists cancel)"),
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

// ---------------------------------------------------------------- the Slúagh: hosts and monsters
const host = (id: string, name: string, rarity: Rarity, kind: HostDef["kind"], init: number, valourEach: number, weakness: Element, focus: Focus, tag: string, ab: HeroAb, quality: string): HostDef =>
  ({ type: "host", id, name, alignment: "Sluagh", rarity, kind, init, valourEach, weakness, focus, tag, ab, quality });
export const HOSTS: Record<string, HostDef> = {
  hunt: host("hunt", "The Hunt", R, "hunt", 0, 0, "Fire", "Spirit", "Night", { firstStrike: 1 }, "The host rides: its first Strike each duel +1. Torches drive it off: weak to Fire"),
  prey: host("prey", "The Prey", C, "prey", 1, 0, "Earth", "Spirit", "Night", { firstHitSoak: 1 }, "The host flees and scatters: the first Strike against it each duel −1. Cold earth holds it: weak to Earth"),
  taboo: host("taboo", "The Taboo", R, "taboo", 1, 0, "Water", "Spirit", "Night", { foeHealMalus: 1 }, "The host is a curse: the enemy's Heals −1. It cannot cross running water: weak to Water"),
};
const mon = (id: string, name: string, rarity: Rarity, valour: number, init: number, weakness: Element, ab: HeroAb, quality: string, hybrid?: Element): MonsterDef =>
  ({ type: "monster", id, name, alignment: "Sluagh", rarity, valour, init, weakness, ab, quality, ...(hybrid ? { hybrid } : {}) });
export const MONSTERS: Record<string, MonsterDef> = {
  // hybrid damage: the element opposite a monster's weakness (Fire against Water, Wind against Earth)
  dullahan: mon("dullahan", "The Dullahan", L, 4, 0, "Water", { strikeAll: 1 }, "Headless rider: Strikes +1; the host's Spirit blows burn as Fire too", "Fire"),
  puca: mon("puca", "The Púca", R, 2, 1, "Earth", { firstStrike: 1 }, "Shape-shifter: Initiative +1; its first Strike each duel +1"),
  dearg_due: mon("dearg_due", "The Dearg-due", R, 2, 0, "Fire", { foeHealMalus: 1 }, "Blood-drinker: the enemy's Heals −1; the host's Spirit blows run as Water too", "Water"),
  fear_dearg: mon("fear_dearg", "The Fear Dearg", C, 2, 1, "Earth", { foeHealMalus: 1, reflect: 1 }, "The red man: Initiative +1; the enemy's Heals −1. Uninvited guest: when a Strike wounds the host, the striker loses 1 Valour. The host's Spirit blows blow as Wind too", "Wind"),
  bean_nighe: mon("bean_nighe", "The Bean Nighe", C, 2, 0, "Wind", { firstHitSoak: 1 }, "Washer at the ford: the first Strike against the host each duel −1; the host's Spirit blows strike as Earth too", "Earth"),
  marbh: mon("marbh", "The restless dead", C, 3, -1, "Fire", {}, "Many and slow: Initiative −1"),
  each_uisce: mon("each_uisce", "The Each-uisce", R, 2, 1, "Earth", {}, "Water-horse: Initiative +1"),
  fear_gorta: mon("fear_gorta", "The Fear Gorta", C, 3, -1, "Wind", { foeHealMalus: 1 }, "The hungry man: Initiative −1; the enemy's Heals −1"),
  bananach: mon("bananach", "The Bánánach", C, 1, 1, "Water", { firstStrike: 1 }, "Shrieker of the air: Initiative +1; its first Strike each duel +1"),
};

// ---------------------------------------------------------------- attendants
const att = (id: string, name: string, rarity: Rarity, scope: AttendantDef["scope"], mode: AttendantDef["mode"], spec: { kind?: Kind; toKind?: Kind; from?: Element; to?: Element }, people?: Alignment): AttendantDef => {
  if (mode === "curse") {
    const whoC = scope === "global" ? "Every hero is" : scope === "yours" ? "Your heroes are" : "The enemy's heroes are";
    return { type: "attendant", id, name, rarity, scope, mode, ...spec, people, text: `${whoC} also weak to ${spec.to}` };
  }
  const what = mode === "enchant" ? `${spec.kind}s count as ${spec.to}` : mode === "reforge" ? `${spec.kind}s count as ${spec.toKind}s`
    : `${spec.from} supports count as ${spec.to}${mode === "channel" ? ", Strike +1, and the user loses 1 Valour" : ""}`;
  const who = scope === "global" ? "Every hero's" : scope === "yours" ? "Your heroes'" : "The enemy's";
  return { type: "attendant", id, name, rarity, scope, mode, ...spec, people, text: `${who} ${what}` };
};
export const ATTENDANTS: Record<string, AttendantDef> = {
  // open to every deck
  a_apprentice: att("a_apprentice", "The smith's apprentice", C, "yours", "enchant", { kind: "Weapon", to: "Fire" }),
  a_fordkeeper: att("a_fordkeeper", "The ford-keeper", C, "yours", "enchant", { kind: "Weapon", to: "Water" }),
  a_curse: att("a_curse", "The satirist's curse", R, "enemy", "curse", { to: "Earth" }),
  a_weather: att("a_weather", "The weather-worker", R, "global", "turn", { from: "Wind", to: "Water" }),
  a_poet: att("a_poet", "The poet's fosterling", R, "yours", "channel", { from: "Earth", to: "Fire" }),
  a_bard: att("a_bard", "The bard of the hall", R, "yours", "channel", { from: "Water", to: "Wind" }),
  // tied to a people
  a_culann: att("a_culann", "Culann the smith", R, "yours", "enchant", { kind: "Weapon", to: "Fire" }, "Ulaid"),
  a_sualtam: att("a_sualtam", "Sualtam's warning", C, "enemy", "turn", { from: "Wind", to: "Fire" }, "Ulaid"),
  a_handmaid: att("a_handmaid", "Medb's handmaid", C, "yours", "turn", { from: "Water", to: "Earth" }, "Connachta"),
  a_cailitin: att("a_cailitin", "The children of Calatín", R, "enemy", "turn", { from: "Water", to: "Earth" }, "Connachta"),
  // the Sídhe lean on Fire and Weapons; their attendants slip the geasa that shut those off, and turn the tables
  a_goibniu: att("a_goibniu", "Goibniu's apprentice", R, "yours", "enchant", { kind: "Weapon", to: "Wind" }, "Sidhe"),
  a_airmed: att("a_airmed", "Airmed's attendant", C, "yours", "channel", { from: "Fire", to: "Wind" }, "Sidhe"),
  a_scribe: att("a_scribe", "Ogma's scribe", C, "yours", "reforge", { kind: "Weapon", toKind: "Word" }, "Sidhe"),
  a_changeling: att("a_changeling", "The changeling", R, "enemy", "turn", { from: "Fire", to: "Earth" }, "Sidhe"),
  a_benet: att("a_benet", "Bé Néit's shriek", R, "enemy", "curse", { to: "Wind" }, "Sidhe"),
  a_thrall: att("a_thrall", "Tethra's thrall", C, "yours", "turn", { from: "Wind", to: "Water" }, "Fomoire"),
  a_eyebearers: att("a_eyebearers", "The eye-bearers", R, "enemy", "turn", { from: "Water", to: "Fire" }, "Fomoire"),
  a_selkie: att("a_selkie", "The selkie's daughter", C, "yours", "enchant", { kind: "Feat", to: "Water" }, "Merrow"),
  a_bell: att("a_bell", "The drowned bell", R, "global", "turn", { from: "Fire", to: "Water" }, "Merrow"),
};

/** Omens that belong to one people's pool (deck building). The others are open to every deck. */
const OMEN_PEOPLE: Record<string, Alignment> = {
  o_emain: "Ulaid", o_culann: "Ulaid", o_redbranch: "Ulaid",
  o_rath: "Connachta", o_cruachan: "Connachta", o_debility: "Connachta",
  o_mist: "Sidhe", o_lugh: "Sidhe", o_crow: "Sidhe", o_brugh: "Sidhe",
  o_darkness: "Fomoire", o_tory: "Fomoire", o_tribute: "Fomoire",
  o_fog: "Merrow", o_tide: "Merrow", o_ford: "Merrow",
};
for (const [id, p] of Object.entries(OMEN_PEOPLE)) OMENS[id].people = p;

export const ALL_DEFS: Record<string, CardDef> = { ...HEROES, ...CHAMPIONS, ...SUPPORTS, ...GEASA, ...OATHS, ...OMENS, ...ATTENDANTS, ...HOSTS, ...MONSTERS };

const HERO_AB_SUM: (keyof HeroAb)[] = ["strikeAll", "firstStrike", "vsBig", "kinBonus", "healBonus", "restHeal", "restShield", "shieldStart", "firstHitSoak", "drain", "foeHealMalus", "avenger", "reflect"];
/** The fighter a host makes with its monsters: their Valour, Initiative and qualities added up, every weakness kept. */
export function composeHost(h: HostDef, members: MonsterDef[]): HeroDef {
  const ab: HeroAb = {};
  for (const src of [h.ab, ...members.map((m) => m.ab)]) {
    for (const k of HERO_AB_SUM) {
      const v = src[k];
      if (typeof v === "number") (ab as Record<string, number>)[k] = ((ab as Record<string, number>)[k] ?? 0) + v;
    }
    if (src.capTaken !== undefined) ab.capTaken = Math.min(ab.capTaken ?? 99, src.capTaken);
  }
  // the host's own weakness always holds; a monster's only when the host or another monster shares it
  const all = [h.weakness, ...members.map((m) => m.weakness)];
  const weaknesses: Element[] = [h.weakness];
  for (const w of all) if (!weaknesses.includes(w) && all.filter((x) => x === w).length >= 2) weaknesses.push(w);
  // a host of the dead is a ragged thing: one Valour less for each monster in it
  const valour = members.reduce((a, m) => a + m.valour + h.valourEach - 1, 0);
  const init = h.init + members.reduce((a, m) => a + m.init, 0);
  const short = members.map((m) => m.name.replace(/^The /, ""));
  const names = short.length > 1 ? `${short.slice(0, -1).join(", ")} and ${short[short.length - 1]}` : short.join("");
  return {
    type: "hero", id: `${h.id}:${members.map((m) => m.id).join("+")}`, name: members.length ? `${h.name}, ${names}` : h.name,
    alignment: "Sluagh", rarity: h.rarity, valour: Math.max(1, valour), init, focus: h.focus, weakness: weaknesses[0], weaknesses,
    quality: [h.quality, ...members.map((m) => `${m.name}: ${m.quality}`)].join(". "), tag: h.tag, ab, host: { def: h, members },
    hybrids: [...new Set(members.flatMap((m) => (m.hybrid ? [m.hybrid] : [])))],
  };
}

/**
 * The cards as first printed, before the balance changes for duels to the death. The board puzzles were worked out
 * with these numbers under the first Ford rules, so their positions keep them.
 */
const reprint = <T extends CardDef>(id: string, f: (d: T) => T): CardDef => f(structuredClone(ALL_DEFS[id]) as T);
export const FIRST_PRINTING: Record<string, CardDef> = {
  cu: reprint<HeroDef>("cu", (d) => ({ ...d, valour: 4 })),
  conchobar: reprint<HeroDef>("conchobar", (d) => ({ ...d, valour: 5 })),
  ailill: reprint<HeroDef>("ailill", (d) => ({ ...d, valour: 4 })),
  ferdiad: reprint<HeroDef>("ferdiad", (d) => { const { armour: _a, ...ab } = d.ab; return { ...d, quality: "Horn-skin: Shield 1 at the start of each duel", ab: { ...ab, shieldStart: 1 } }; }),
  salmon: reprint<SupportDef>("salmon", (d) => ({ ...d, text: "Shield 2", use: undefined })),
  fe_fiada: reprint<SupportDef>("fe_fiada", (d) => ({ ...d, text: "Shield 2", use: undefined })),
  tower: reprint<SupportDef>("tower", (d) => ({ ...d, text: "Shield 3", use: undefined })),
  sealskin: reprint<SupportDef>("sealskin", (d) => ({ ...d, text: "Shield 3", use: undefined })),
  bone_dust: reprint<SupportDef>("bone_dust", (d) => ({ ...d, text: "Shield 1", use: undefined })),
  sea_mist: reprint<SupportDef>("sea_mist", (d) => ({ ...d, text: "Shield 2", use: undefined })),
  kelp: reprint<SupportDef>("kelp", (d) => ({ ...d, text: "Shield 2", use: undefined })),
  ochain: reprint<SupportDef>("ochain", (d) => ({ ...d, use: undefined, effects: [{ type: "shield", n: 2 }], text: "Shield 2", armour: undefined })),
  horn_shield: reprint<SupportDef>("horn_shield", (d) => ({ ...d, use: undefined, effects: [{ type: "shield", n: 2 }], text: "Shield 2", armour: undefined })),
  fergus_shield: reprint<SupportDef>("fergus_shield", (d) => ({ ...d, use: undefined, effects: [{ type: "shield", n: 3 }], text: "Shield 3", armour: undefined })),
  credne: reprint<SupportDef>("credne", (d) => ({ ...d, use: undefined, effects: [{ type: "strike", n: 1 }, { type: "shield", n: 1 }], text: "Strike 1 + Shield 1", armour: undefined })),
  indech: reprint<HeroDef>("indech", (d) => ({ ...d, valour: 5, quality: "Sea-giant: no Strike against him above 3", ab: { ...d.ab, capTaken: 3 } })),
  balor: reprint<HeroDef>("balor", (d) => ({ ...d, quality: "Evil eye: his first Strike each duel +2", ab: { ...d.ab, firstStrike: 2 } })),
  dullahan: reprint<MonsterDef>("dullahan", (d) => ({ ...d, valour: 3 })),
  galley: reprint<SupportDef>("galley", (d) => ({ ...d, effects: [{ type: "strike", n: 1 }, { type: "shield", n: 1 }], text: "Strike 1 + Shield 1" })),
  blight: reprint<SupportDef>("blight", (d) => ({ ...d, effects: [{ type: "strike", n: 1 }], text: "Strike 1; Invoke Forge" })),
  thunder: reprint<SupportDef>("thunder", (d) => ({ ...d, effects: [{ type: "strike", n: 2 }], text: "Strike 2; ignores Shield" })),
};

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
  // three hosts, two champions, five monsters, eight supports, two geasa, four omens
  sluagh: [
    "hunt", "prey", "taboo",
    "banshee", "fear_doirich",
    "dullahan", "puca", "dearg_due", "fear_dearg", "bean_nighe",
    "cold_touch", "cold_touch", "keening_dead", "spine_whip", "grave_chill", "corpse_candle", "grave_dirt", "hunt_horn",
    "g_hearth", "g_salmon",
    "o_sleep", "o_keen", "o_blight", "o_herolight",
  ],
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
    "cet_spear", "cet_spear", "host", "fraech", "medb_chariot", "fedelm", "finnbennach", "caladbolg", "barach",
    "g_hound", "g_hosting", "g_slow",
    "v_shieldwall", "v_stone",
    "o_herolight", "o_truce", "o_cruachan", "o_rath",
  ],
  sidhe: [
    "lugh", "dagda", "morrigan", "brigid",
    "nuada", "ogma",
    "spear_assal", "fragarach", "tathlum", "goibniu", "raven", "glamour", "dian_cecht", "uaithne", "fe_fiada",
    "g_hosting", "g_door", "g_giant",
    "v_druid", "v_champion",
    "o_lugh", "o_sleep", "o_mist", "o_keen",
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
    (supAl === "Sidhe" && heroAl === "Fomoire") || (supAl === "Fomoire" && heroAl === "Sidhe") ||
    (supAl === "Sidhe" && heroAl === "Sluagh") || (supAl === "Sluagh" && heroAl === "Sidhe")
  );
}

// ---------------------------------------------------------------- deck building
/** The people each faction's pool is drawn from. */
export const PEOPLE: Record<Faction, Alignment> = { ulster: "Ulaid", connacht: "Connachta", sidhe: "Sidhe", fomoire: "Fomoire", merrow: "Merrow", sluagh: "Sluagh" };
/** The people of a card, or null when any deck may take it (geasa, oaths, omens, unaligned supports). */
export function peopleOf(d: CardDef): Alignment | null {
  if (d.type === "hero" || d.type === "champion") return d.alignment === "None" ? null : d.alignment;
  if (d.type === "host" || d.type === "monster") return "Sluagh";
  if (d.type === "support") return d.alignment === "Unaligned" ? null : d.alignment;
  if (d.type === "omen" || d.type === "attendant" || d.type === "oath") return d.people ?? null;
  return null;
}
/** Whether a card belongs to faction f's pool. Exiles (Deorad) belong to both Ulster's and Connacht's. */
export function inPool(d: CardDef, f: Faction): boolean {
  const p = peopleOf(d);
  if (p === null) return true;
  if (p === "Deorad") return f === "ulster" || f === "connacht";
  return p === PEOPLE[f];
}
/** Every card a deck of faction f may draw on. */
export function poolOf(f: Faction): CardDef[] {
  return Object.values(ALL_DEFS).filter((d) => inPool(d, f));
}
/** The peoples a deck draws on: heroes, champions and supports. Exiles count only when no Ulaid or Connachta card is there. */
export function deckPeoples(deck: CardDef[]): Alignment[] {
  const al = new Set<Alignment>();
  let deorad = false;
  for (const d of deck) {
    const p = peopleOf(d);
    if (p === "Deorad") deorad = true;
    else if (p) al.add(p);
  }
  if (deorad && !al.has("Ulaid") && !al.has("Connachta")) al.add("Deorad");
  return [...al];
}

/** Deck legality. Returns a list of problems (empty = legal). */
export function deckErrors(deck: CardDef[]): string[] {
  const errs: string[] = [];
  if (deck.length !== 24) errs.push(`deck has ${deck.length} cards, needs 24`);
  const count = (t: CardDef["type"]) => deck.filter((d) => d.type === t).length;
  const hosts = count("host"), mons = count("monster");
  const h = count("hero") + hosts, s = count("support"), g = count("geis"), v = count("oath"), o = count("omen"), ch = count("champion"), at = count("attendant");
  if (count("unknown") > 0) errs.push("unknown card");
  // a host with its monsters fights as a hero: a deck with hosts needs 3 hosts and heroes, and 4–6 monsters (of the 9)
  if (hosts ? h < 3 || h > 6 : h < 4 || h > 6) errs.push(`heroes ${h} (${hosts ? 3 : 4}–6)`);
  if (hosts && (mons < 4 || mons > 6)) errs.push(`monsters ${mons} (4–6)`);
  if (!hosts && mons) errs.push(`monsters ${mons} without a host`);
  if (s < 8 || s > 12) errs.push(`supports ${s} (8–12)`);
  if (g < 2 || g > 6) errs.push(`geasa ${g} (2–6)`);
  if (v > 4) errs.push(`oaths ${v} (0–4)`);
  if (ch > 2) errs.push(`champions ${ch} (0–2)`);
  if (at > 2) errs.push(`attendants ${at} (0–2)`);
  if (o < 4 || o > 6) errs.push(`omens ${o} (4–6)`);
  const copies: Record<string, number> = {};
  for (const d of deck) copies[d.id] = (copies[d.id] ?? 0) + 1;
  let legends = 0;
  for (const [id, n] of Object.entries(copies)) {
    const d = ALL_DEFS[id];
    if (!d || d.type === "unknown") continue;
    const max = d.type === "hero" || d.type === "champion" || d.type === "omen" || d.type === "host" || d.type === "monster" ? 1 : RARITY_LIMIT[d.rarity];
    if (n > max) errs.push(`${id} x${n} (max ${max})`);
    if (d.rarity === "legendary") legends += n;
  }
  if (legends > MAX_LEGENDARIES) errs.push(`legendaries ${legends} (max ${MAX_LEGENDARIES})`);
  const heroAl = new Set<string>();
  let deorad = false;
  for (const d of deck) if (d.type === "hero") { if (d.alignment === "Deorad") deorad = true; else heroAl.add(d.alignment); }
  if (deorad && !heroAl.has("Ulaid") && !heroAl.has("Connachta")) heroAl.add("Deorad");
  if (heroAl.size > 2) errs.push(`hero alignments ${[...heroAl].join(",")} (max 2)`);
  else {
    const al = deckPeoples(deck);
    if (al.length > 2) errs.push(`peoples ${al.join(",")} (max 2)`);
  }
  return errs;
}
