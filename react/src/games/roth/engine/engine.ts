// Roth Catha rules engine: a resumable state machine.
//   nextDecision(S) advances automatic steps and returns the pending decision (idempotent).
//   applyDecision(S, d, i) checks legality independently and applies option i.
// Spots are 0-based here: index i = spot i+1. Heroes at 0,3,6,9. P1 owns 0–5, P2 owns 6–11.

import {
  beats, composeHost, isElement, reuseOf, unwillingPair, ELEMENTS, UNKNOWN,
  type CardDef, type MonsterDef, type Element, type FighterDef, type Focus, type Forbids, type HeroDef, type OathDef, type OmenEffect, type SupportDef, type GeisDef,
} from "./cards";
import { hashSeed, Rng } from "./rng";
import { SETTINGS, settingDef, settingMod } from "./settings";
import { param, settingOf, type ParamKey, type Params } from "./params";

export type Side = 0 | 1;

export interface Rules {
  /** The rules as numbers (engine/params.ts): any parameter's value, overriding the older fields below. */
  params?: Params;
  /** Lever: added to every hero's starting Valour. */
  /** The Aos Sídhe are veiled: the first Strike against each of their fighters each duel −1. */
  veiled?: boolean;
  valourBonus: number;
  /** Duels to the death: every fighter enters the ford with this much more Valour (default 3). */
  fordValour?: number;
  /** Where the duels are fought (engine/settings.ts). Unset in a duel to the death: the second player chooses it
   *  after the decks, before the Muster (settingBy "p2", the default; "none" to fight at the ford's flat +3). */
  setting?: string;
  settingBy?: "p2" | "none";
  /** The Aos Sídhe's mound (duels to the death): how much it soaks off each blow, and in all over the match. */
  moundAC?: number;
  moundValour?: number;
  /** Sim levers: turn Connacht's bleed off; cap how far it stacks. */
  noBleed?: boolean;
  bleedCap?: number;
  /** Switch off the Hound's cry (Ulster), for experiments. */
  noCry?: boolean;
  /** The Slúagh's dead-flesh aura: switch it off, or round the half up, for experiments. */
  noAura?: boolean;
  /** Trial: the western crossing's drain doesn't heal a Slúagh host. */
  drainNoFeed?: boolean;
  /** The Samhain watch: an Ulaid hero's Strike +n against a fighter whose Focus is Spirit (the dead). Default: 1 in a
   *  duel to the death (SAMHAIN_WATCH); 0 switches it off. */
  ulaidVsSpirit?: number;
  /** A Slúagh host's summon spends the top card of the Reserve (and needs one to spend). Default: on in a duel to the death. */
  summonCost?: boolean;
  /** Trial: the western crossing drains only a fighter whose foe is Slúagh. */
  drainVsSluagh?: boolean;
  /** Trial: settings don't change Heals (the crossing's −1, Cruachan's +1). */
  noSettingHeal?: boolean;
  /** Trial: switch the aura on (off by default while it is tuned). */
  aura?: boolean;
  /** The Slúagh heal this much when their enemy rests: they walk in its dreams (default DREAMS; 0 switches it off). */
  dreams?: number;
  /** Spirit blows can't be Blocked (default true in duels to the death; false switches it off). */
  spiritUnblock?: boolean;
  /** Switch off the Sídhe's and Merrow's resistance to Spirit, for experiments. */
  noSpiritResist?: boolean;
  /** Override the Sídhe's resistance to Spirit, for experiments. */
  resistSidhe?: number;
  /** Merrow powers: "water" (standing) a blow that ignores Shield still meets a Merrow's Block. Trials: "ebb" the Merrow
   *  fighter gains Shield 1 whenever its enemy heals; "tide" / "tide2" / "tideh" a Water blow that wounds a Merrow
   *  heals it 1 / 2 / half the wound back. Combine with "+"; "none" for no powers. */
  merrow?: string;
  auraUp?: boolean;
  /** The share of their full Valour that one blow can take (default 1/2). */
  auraFrac?: number;
  /** The aura never holds a blow below this (default 1). */
  auraMin?: number;
  /** Trial Ulster powers (duels to the death): "light" first Strike each duel +2; "fury" Strikes +1 at half Valour or
   *  less; "stand" a felled Ulster hero strikes once more (Strike 3). */
  ulster?: string;
  /** Heals can raise a hero this far above its starting Valour (printed + boons). Duels to the death have no cap. */
  capOver: number;
  /** Geasa cost their break each time instead of breaking once (default: on in duels to the death). */
  geisEachTime?: boolean;
  /** Trial: in duels to the death, how far heals may go above the duel's starting Valour (unset: no limit). */
  deathCapOver?: number;
  geisBreakCost: number;
  oathBreakCost: number;
  invokeLoss: number;
  omenSpots: number;
  handSize: number;
  /** Lever: face-down omens are not lost after step 6; each player may turn them before combat. */
  keepOmensUntilCombat: boolean;
  /** Lever: step-1 and step-4 heroes are placed face down and revealed together (no counter-pick). */
  blindHeroes: boolean;
  /** Initiative tie-break: P1 (rules), P2 (first draft), or a coin flip (analysis lever). */
  initTie: "p2" | "p1" | "random";
  /** Lever: champions may be called at the Ford. */
  champions: boolean;
  /** Tie-break when felled and wounds are level: run the round backwards ("reverse") or go straight to the first-duel rule ("none"). */
  tiebreak: "reverse" | "none";
  /** Who acts first at each step of the backwards round. */
  reverseFirst: "p2" | "p1";
  /**
   * "death": duels run until a hero falls; each turn a hero may draw from its Reserve, and placed supports can be used
   * again at a price; at one hero felled each, the survivors fight a final duel. "ford" (the first rules, and every
   * saved position without this field): two turns each, every support once.
   */
  duels?: "death" | "ford";
  /** In duels to the death: after this many turns a duel stops with both standing. */
  maxTurns?: number;
}
export const DEFAULT_RULES: Rules = {
  veiled: true, valourBonus: 0, capOver: 2, geisBreakCost: 2, oathBreakCost: 2, invokeLoss: 2, omenSpots: 4, handSize: 12,
  keepOmensUntilCombat: false, blindHeroes: false, initTie: "p1", champions: true, tiebreak: "reverse", reverseFirst: "p2",
  duels: "death", maxTurns: 60,
};
/** Duels to the death (the current rules) rather than the two-turn Ford. */
export const toDeath = (S: State) => S.rules.duels === "death";

export interface Card { uid: number; def: CardDef; owner: Side }
export interface OmenSlot { card: Card; faceUp: boolean; target?: number }
export interface PlayerState {
  deckList: CardDef[]; // public knowledge
  deck: Card[];
  hand: Card[];
  reserve: Card[];
  omens: OmenSlot[];
  discard: Card[];
  lost: Card[]; // omens lost face down
  musterQ: Card[];
}

export type Phase = "muster" | "draft" | "play" | "late" | "combat" | "end";

export interface CombatState {
  duel: number;
  stage: "focus" | "turns" | "done";
  hs: [number, number]; // hero spot per side in the current duel
  valour: number[];
  shield: number[];
  first: Side;
  turn: number; // 0..3 within the duel
  used: number; // bitmask of board spots whose support has been used (match-wide)
  broken: number; // bit q (0..3): geis card on quadrant q broken; CROW_BIT: crow broken; OATH_BIT<<q: oath on q broken
  nextStrike: number[];
  cathbad: boolean[];
  kingsDue: boolean[];
  supportsUsed: number; // in this duel
  struck: boolean[]; // a Strike has already hit hero of side p this duel
  guestUsed: boolean[];
  guests: Card[][];
  focus: (Focus | null)[];
  focusTodo: Side[];
  felled: boolean[][]; // [duel][side]
  endValour: number[][];
  startV: number[][]; // [duel][side] Valour each hero started its duel with
  cap: number[]; // Heal cap per side this duel
  init: number[]; // Initiative per side this duel
  hit: boolean[]; // side p has already made a Strike this duel
  champ: (Card | null)[]; // the champion standing in for side p's hero this duel (copy-on-write)
  champs: Card[][]; // champions side p still holds (copy-on-write)
  /** Slúagh hosts changed in combat, per quadrant: monsters sacrificed or lent away, monsters summoned in (copy-on-write). */
  hostAdj: (HostAdj | null)[];
  /** A host has sacrificed a monster this duel, per side. */
  sacrificed: boolean[];
  /** A host has summoned a monster from its other host this match, per side. */
  summoned: boolean[];
  // ---- duels to the death
  /** Per board spot: times its support has been used this match. */
  uses: number[];
  /** Per board spot: the user's action count when it was last used. */
  lastUse: number[];
  /** Per board spot: rests its side has taken since it was last used. */
  restsSince: number[];
  /** Duels to the death: rests in a row by each side (0–2), for the next Shield or Heal. */
  rested?: number[];
  /** What the Aos Sídhe's mound can still soak, per side, over the whole match (0: none, or spent). */
  mound?: number[];
  /** Connacht's bleed on each side: that side's Heals −n until the end of its next turn. */
  bleed?: number[];
  /** Staggered by an Ulster blow: each blow that wounds +1, until it rests (trial power). */
  stagger?: number[];
  /** The Hound's cry given this duel (Ulster: once a duel each). */
  cried?: number[];
  /** Ebb and flow given this enemy turn (trial "ebb1": once per enemy turn). */
  ebbed?: number[];
  /** Drains dodged by resting at the western crossing this duel (only the computer's judgement reads it). */
  dodged?: number[];
  /** Rests in a row by each side, this duel (only the computer's judgement reads it). */
  restRun?: number[];
  /** Duels to the death: each side's Armour (every Strike against it this much less; ignored by what ignores Shield). */
  armour?: number[];
  /** A blow waiting for the defender to block or take it: the attacker's chosen option. */
  pending?: Option | null;
  /** Block to take off the next Strike against each side (set by a reaction, used once). */
  block?: number[];
  /** Actions each side has taken this match. */
  acts: number[];
  /** The card the side to act has just drawn and not yet played or put aside. */
  drawn: Card | null;
  /** The side to act has already drawn this turn (and put the card aside). */
  drew: boolean;
  /** Per duel and side: the champion standing in when the duel ended (it fights on in a final duel). */
  endChamp: (Card | null)[][];
}
export interface HostAdj { add: MonsterDef[]; remove: string[] }
export const CROW_BIT = 1 << 4;
export const OATH_BIT = 1 << 5; // shifted by the quadrant: OATH_BIT << q
/** In a duel to the death (rules.geisEachTime, default on there) a geis is never broken for good: every forbidden act
 *  pays its cost again, and a geis that lays a weakness keeps it. Oaths and the crow still break once. This is the
 *  part of a break mask that stays broken. */
const keptBroken = (S: State, m: number) => (toDeath(S) && param(S.rules, "geis.eachTime") ? m & (CROW_BIT | (15 * OATH_BIT)) : m);
/** Global geis i broken by the hero of quadrant q. */
export const globalBit = (i: number, q: number) => 1 << (9 + 4 * i + q);
export const MAX_GLOBAL_GEASA = 4;

export interface Result {
  winner: Side | -1;
  decidedBy: "felled" | "valour" | "firstDuel" | "draw";
  felled: [number, number]; // heroes of side p felled
  /** The result came from the backwards tie-break round. */
  tiebreak?: boolean;
  /** Wounds dealt by side p: the Valour its enemies lost over both duels (felled heroes count their whole start). */
  valour: [number, number];
}

/** One blow, step by step through the damage formula (sim measurement; see TRACE). Every number is that step's
 *  contribution in Valour: the use-stage bonuses add to printed, the strike-stage adds (atk), then what the floor at 0
 *  and the caps cut, what the defence took off, what the halving and the aura cut, and what a stagger added. */
export interface BlowRow {
  side: number; duel: number; src: string; el: string | null; spirit: number; pierce: number;
  printed: number; base: number; kin: number; focus: number; watch: number; wheel: number; weak: number; fx: number; setting: number; extra: number;
  atk: number; floor: number; cap: number; ward: number; block: number; resist: number; armour: number; mound: number; shield: number;
  halved: number; aura: number; stagger: number; final: number;
}
/** Set by a simulation to record every blow of the real match in stats.blows (off in play). */
export const TRACE = { on: false, cur: null as Partial<BlowRow> | null };
/** One duel as it began and ended (sim measurement: the duel is the game's atomic contest). */
export interface DuelRow {
  duel: number; fighters: [string, string]; init: [number, number]; first: number; startV: [number, number]; endV: [number, number];
  felled: [number, number]; turns: number; hand: [number, number]; reserve: [number, number];
}
export interface MatchStats {
  /** Every blow, when TRACE is on. */
  blows?: BlowRow[];
  /** Every duel. */
  duels?: DuelRow[];
  exchanges: number[];
  actions: { omen: number; bind: number; supplant: number; hold: number; swear: number; attend: number };
  champions: number;
  championsBySide: [number, number];
  tiebreaks: number;
  geisBroken: number;
  oathBroken: number;
  unwilling: number;
  invokes: number;
  guests: number;
  cathbadIgnores: number;
  initTies: number;
  placed: { side: Side; id: string; how: "draft" | "supplant" }[];
  used: { side: Side; id: string; unwilling: boolean; effect: boolean }[];
  p2First: number;
  /** Per side (the side that dealt it, or suffered it for startLoss/initLoss): where damage came from. */
  fx: Record<"strikes" | "dmg" | "soaked" | "blunted" | "weakHits" | "beatsHits" | "focusHits" | "kinHits" | "healed" | "startLoss" | "initLoss" | "first" | "broke" | "duels" | "bled" | "ripostes" | "swift", [number, number]>;
  /** What each card or power was worth, side by side: "deal:<id>" wounds dealt, "save:<id>" wounds prevented,
   *  "heal:<id>" Valour healed, "shield:<id>" Shield raised, "deny:<id>" enemy heals denied, "cost:<id>" Valour paid. */
  ledger: Record<string, [number, number]>;
  /** The card behind each side's standing Block and Armour (for the ledger). */
  blockSrc: [string, string];
  armourSrc: [string, string];
  bound: { side: Side; id: string }[];
  sworn: { side: Side; id: string; hero: string }[];
  omensTurned: { side: Side; id: string }[];
}

export interface State {
  rules: Rules;
  players: [PlayerState, PlayerState];
  board: (Card | null)[];
  quadGeis: (Card | null)[];
  quadOath: (Card | null)[];
  globalGeis: Card[];
  /** Attendants called in the Playing turn, in the order they were called. */
  attendants: Card[];
  phase: Phase;
  musterP: Side;
  musterStage: "draw" | "check";
  musterReturns: number;
  pendingOmen: Card | null;
  step: number;
  sub: Side;
  hiddenSpots: number[];
  tieCoin: [Side, Side];
  combat: CombatState | null;
  result: Result | null;
  stats: MatchStats | null;
  /** In the backwards tie-break round. */
  reversed: boolean;
  nextUid: number;
  /** Seed for shuffling the Reserves in duels to the death, and how many shuffles so far. */
  shuffleSeed?: number;
  shuffles?: number;
}

export type DuelMode = "normal" | "break" | "ignore";
export type Option =
  /** The Muster: the first of the four cards drawn goes to hand, to the Reserve, or (an omen) to an Omen spot,
   *  in place of the omen `swap` when the spots are full. */
  | { t: "muster"; uid: number; how: "keep" | "aside" | "omen"; swap?: number }
  | { t: "musterOmen"; uid: number }
  | { t: "musterReturn"; uid: number }
  | { t: "place"; uid: number; join?: number[] }
  | { t: "omen"; uid: number; target?: number }
  | { t: "bind"; uid: number }
  | { t: "supplant"; uid: number }
  | { t: "swear"; uid: number; spot: number }
  | { t: "attend"; uid: number }
  | { t: "hold" }
  | { t: "late"; uid: number; target?: number }
  | { t: "lateDone" }
  | { t: "focus"; el: Element | null }
  | { t: "champion"; uid: number }
  | { t: "sacrifice"; id: string }
  | { t: "summon"; id: string }
  | { t: "duel"; guest: number; act: "use" | "rest"; spot: number; mode: DuelMode; as?: Element; cry?: boolean }
  /** Duels to the death: draw the top card of your Reserve. */
  | { t: "draw" }
  /** ...then play it (keep it, for a hero or champion: into your hand) or put it aside on the discard. */
  | { t: "drawn"; how: "play" | "keep" | "discard"; mode?: DuelMode; target?: number; as?: Element; cry?: boolean }
  /** Duels to the death: turn a face-down omen, lay a geis, swear an oath or call an attendant, from hand. */
  | { t: "duelCard"; uid: number; target?: number }
  /** A reaction: tap the Block card at `spot` against the blow coming (−1: take it). */
  | { t: "block"; spot: number }
  /** Duels to the death: the second player chooses where the duels are fought, before the Muster. */
  | { t: "setting"; id: string };
export type DecisionKind = "setting" | "muster" | "musterOmen" | "musterReturn" | "place" | "action" | "late" | "focus" | "duel" | "drawn" | "block";
export interface Decision { kind: DecisionKind; player: Side; options: Option[]; spot?: number }

// ---------------------------------------------------------------- helpers
export const isHeroSpot = (i: number) => i % 3 === 0;
export const quadOf = (i: number) => Math.floor(i / 3);
export const ownerOfSpot = (i: number): Side => (i < 6 ? 0 : 1);
export const heroSpotsOf = (p: Side) => (p === 0 ? [0, 3] : [6, 9]);
export const draftSpot = (step: number, p: Side) => step - 1 + (p === 1 ? 6 : 0);
/** Spot faced by player p at playing step k: P1 faces 7–12, P2 faces 1–6. */
export const facedSpot = (step: number, p: Side, reversed = false) =>
  reversed ? (p === 0 ? 12 - step : 6 - step) : p === 0 ? 6 + step - 1 : step - 1;
/** Who acts first at each step of the Playing turn (and the late omens): P1, except P2 in the backwards round by default. */
export const firstActor = (S: State): Side => (S.reversed && S.rules.reverseFirst === "p2" ? 1 : 0);
const spotFaced = (S: State, p: Side) => facedSpot(S.step, p, S.reversed);

const uc = (a: string) => a === "Ulaid" || a === "Connachta";
/** Kinship: support alignment matches hero; Deorad matches Ulaid and Connachta (both ways). */
export function kin(supAl: string, heroAl: string): boolean {
  if (supAl === "Unaligned" || heroAl === "None") return false;
  if (supAl === heroAl) return true;
  if (supAl === "Deorad" && uc(heroAl)) return true;
  if (heroAl === "Deorad" && uc(supAl)) return true;
  return false;
}
/** Unwilling: Ulaid and Connachta for each other; Sídhe and Fomóire for each other. */
export function unwilling(heroAl: string, supAl: string): boolean {
  return unwillingPair(heroAl, supAl);
}
/** Same alignment for guests (Deorad matches Ulaid and Connachta). */
export function sameAlignment(a: string, b: string): boolean {
  if (a === "None" || b === "None") return false;
  return a === b || (a === "Deorad" && uc(b)) || (b === "Deorad" && uc(a));
}
/** Debility of an alignment hits that alignment and Deorad heroes, unless the hero is spared. */
export const debilitated = (h: FighterDef, al: string) => !h.ab.sparedDebility && (h.alignment === al || (h.alignment === "Deorad" && (al === "Ulaid" || al === "Connachta")));

export function hasFaceUp(S: State, p: Side, id: string): boolean {
  for (const o of S.players[p].omens) if (o.faceUp && o.card.def.id === id) return true;
  return false;
}
export const anyFaceUp = (S: State, id: string) => hasFaceUp(S, 0, id) || hasFaceUp(S, 1, id);
/** Face-up "yours" omens of side p (wards, reinforcements, the Mist). */
export function fxOf(S: State, p: Side): OmenEffect[] {
  const out: OmenEffect[] = [];
  for (const o of S.players[p].omens) if (o.faceUp && o.card.def.type === "omen" && o.card.def.scope === "yours") out.push(o.card.def.fx);
  return out;
}
/** Face-up global omens of both players (board geasa and modifiers). */
export function boardFx(S: State): OmenEffect[] {
  const out: OmenEffect[] = [];
  for (const P of S.players) for (const o of P.omens) if (o.faceUp && o.card.def.type === "omen" && o.card.def.scope === "global") out.push(o.card.def.fx);
  return out;
}
/** Face-up targeted omens (either player's) aimed at hero spot `spot`. */
/**
 * The guided game sets this to a list, and the rules then write down each number that goes into what happens
 * ("+1 kinship", "Culann's hound −1"...). Off (null) in play and in the solver.
 */
export const NARRATE: { lines: string[] | null } = { lines: null };
const say = (t: string) => { NARRATE.lines!.push(t); };
const sgn = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
/** heroFx with the omen each effect comes from (for the guided game). */
function namedHeroFx(S: State, C: CombatState, p: Side): { name: string; fx: OmenEffect }[] {
  const out: { name: string; fx: OmenEffect }[] = [];
  for (const o of S.players[p].omens) if (o.faceUp && o.card.def.type === "omen" && o.card.def.scope === "yours") out.push({ name: o.card.def.name, fx: o.card.def.fx });
  for (const P of S.players) for (const o of P.omens) if (o.faceUp && o.target === C.hs[p] && o.card.def.type === "omen") out.push({ name: o.card.def.name, fx: o.card.def.fx });
  return out;
}
function namedBoardFx(S: State): { name: string; fx: OmenEffect }[] {
  const out: { name: string; fx: OmenEffect }[] = [];
  for (const P of S.players) for (const o of P.omens) if (o.faceUp && o.card.def.type === "omen" && o.card.def.scope === "global") out.push({ name: o.card.def.name, fx: o.card.def.fx });
  return out;
}

export function targetFx(S: State, spot: number): OmenEffect[] {
  const out: OmenEffect[] = [];
  for (const P of S.players) for (const o of P.omens) if (o.faceUp && o.target === spot && o.card.def.type === "omen") out.push(o.card.def.fx);
  return out;
}
/** Everything touching side p's fighter in this duel: its side's own omens and omens targeted at its spot. */
export const heroFx = (S: State, C: CombatState, p: Side): OmenEffect[] => [...fxOf(S, p), ...targetFx(S, C.hs[p])];
const sumFx = (fx: OmenEffect[], f: (e: OmenEffect) => number | undefined) => fx.reduce((a, e) => a + (f(e) ?? 0), 0);
export const crowActive = (S: State, C: CombatState) => boardFx(S).some((e) => e.noHeals) && !(C.broken & CROW_BIT);
export const ignoresGeis = (S: State, p: Side) => fxOf(S, p).some((e) => e.ignoreGeis);
/** The fighter of side a in the current duel: its champion if one stands in, else its hero. */
export function fighter(S: State, C: CombatState, a: number): FighterDef {
  const c = C.champ[a];
  return c && c.def.type === "champion" ? c.def : hostAt(S, C, C.hs[a]);
}
const adjCache = new Map<string, HeroDef>();
/** The hero at a hero spot, with any Slúagh host changes made in this combat. */
export function hostAt(S: State, C: CombatState, spot: number): HeroDef {
  const base = heroAt(S, spot);
  const adj = C.hostAdj?.[quadOf(spot)];
  if (!adj || !base.host) return base;
  const key = base.id + "|" + adj.remove.join(",") + "|" + adj.add.map((m) => m.id).join(",");
  let h = adjCache.get(key);
  if (!h) {
    const members = [...base.host.members.filter((m) => !adj.remove.includes(m.id)), ...adj.add];
    h = composeHost(base.host.def, members);
    if (adjCache.size > 5000) adjCache.clear();
    adjCache.set(key, h);
  }
  return h;
}
/** The unbroken oath sworn on side a's current hero, if any. */
export function activeOath(S: State, C: CombatState, a: Side): OathDef | null {
  const q = quadOf(C.hs[a]);
  const o = S.quadOath[q];
  if (C.champ[a] || !o || o.def.type !== "oath" || C.broken & (OATH_BIT << q)) return null;
  return o.def;
}

export function heroAt(S: State, spot: number): HeroDef {
  const c = S.board[spot];
  if (!c || c.def.type !== "hero") throw new Error(`no hero at spot ${spot + 1}`);
  return c.def;
}
export function forbidsSupport(f: Forbids, s: SupportDef): boolean {
  return (!!f.element && s.element === f.element) || (!!f.kind && s.kind === f.kind) || (!!f.heal && s.effects.some((e) => e.type === "heal"));
}
export const geisForbidsSupport = (g: GeisDef, s: SupportDef) => forbidsSupport(g.forbids, s);

function emptyStats(): MatchStats {
  return {
    exchanges: [], actions: { omen: 0, bind: 0, supplant: 0, hold: 0, swear: 0, attend: 0 }, champions: 0, championsBySide: [0, 0], tiebreaks: 0,
    geisBroken: 0, oathBroken: 0, unwilling: 0, invokes: 0, guests: 0, cathbadIgnores: 0, initTies: 0, p2First: 0,
    fx: Object.fromEntries(["strikes", "dmg", "soaked", "blunted", "weakHits", "beatsHits", "focusHits", "kinHits", "healed", "startLoss", "initLoss", "first", "broke", "duels", "bled", "ripostes", "swift"].map((k) => [k, [0, 0]])) as MatchStats["fx"],
    placed: [], used: [], bound: [], sworn: [], omensTurned: [], ledger: {}, blockSrc: ["", ""], armourSrc: ["", ""],
  };
}

// ---------------------------------------------------------------- setup
export function newMatch(decks: [CardDef[], CardDef[]], rules: Partial<Rules> = {}, seed = 1, trackStats = true): State {
  const R = { ...DEFAULT_RULES, ...rules };
  // a setting given up front (otherwise the second player chooses it before the Muster)
  if (R.setting) Object.assign(R, withSetting(R, R.setting));
  const rng = new Rng(seed);
  let uid = 1;
  // the layers (engine/params.ts): a kind of card switched off is taken out of both decks
  const layerOf: Partial<Record<CardDef["type"], ParamKey>> = { champion: "layer.champion", geis: "layer.geis", oath: "layer.oath", omen: "layer.omen", attendant: "layer.attendant" };
  const players = decks.map((list0, p) => {
    const list = list0.filter((d) => { const k = layerOf[d.type]; return !k || param(R, k) > 0; });
    const defs = rng.shuffle([...list]);
    const deck = defs.map((def) => ({ uid: uid++, def, owner: p as Side }));
    return { deckList: list, deck, hand: [], reserve: [], omens: [], discard: [], lost: [], musterQ: [] } as PlayerState;
  }) as [PlayerState, PlayerState];
  return {
    rules: R, players, board: Array(12).fill(null), quadGeis: [null, null, null, null], quadOath: [null, null, null, null], globalGeis: [], attendants: [],
    phase: "muster", musterP: 0, musterStage: "draw", musterReturns: 0, pendingOmen: null,
    reversed: false, step: 1, sub: 0, hiddenSpots: [], tieCoin: [rng.int(2) as Side, rng.int(2) as Side],
    combat: null, result: null, stats: trackStats ? emptyStats() : null, nextUid: uid, shuffleSeed: rng.int(0x7fffffff), shuffles: 0,
  };
}

export function cloneCombat(C: CombatState): CombatState {
  return {
    duel: C.duel, stage: C.stage, hs: [C.hs[0], C.hs[1]], valour: [C.valour[0], C.valour[1]], shield: [C.shield[0], C.shield[1]],
    first: C.first, turn: C.turn, used: C.used, broken: C.broken, nextStrike: [C.nextStrike[0], C.nextStrike[1]],
    cathbad: [C.cathbad[0], C.cathbad[1]], kingsDue: [C.kingsDue[0], C.kingsDue[1]], supportsUsed: C.supportsUsed,
    struck: [C.struck[0], C.struck[1]], guestUsed: [C.guestUsed[0], C.guestUsed[1]],
    // copy-on-write fields: never mutated in place (replaced on change)
    guests: C.guests, focus: C.focus, focusTodo: C.focusTodo, felled: C.felled, endValour: C.endValour, startV: C.startV,
    cap: [C.cap[0], C.cap[1]], init: [C.init[0], C.init[1]], hit: [C.hit[0], C.hit[1]],
    champ: C.champ, champs: C.champs, hostAdj: C.hostAdj, sacrificed: [C.sacrificed[0], C.sacrificed[1]], summoned: [C.summoned[0], C.summoned[1]],
    uses: C.uses.slice(), lastUse: C.lastUse.slice(), restsSince: C.restsSince.slice(), rested: C.rested ? [C.rested[0], C.rested[1]] : [0, 0], mound: C.mound ? [C.mound[0], C.mound[1]] : [0, 0], bleed: C.bleed ? [C.bleed[0], C.bleed[1]] : [0, 0], stagger: C.stagger ? [C.stagger[0], C.stagger[1]] : [0, 0], cried: C.cried ? [C.cried[0], C.cried[1]] : [0, 0], ebbed: C.ebbed ? [C.ebbed[0], C.ebbed[1]] : [0, 0], dodged: C.dodged ? [C.dodged[0], C.dodged[1]] : [0, 0], restRun: C.restRun ? [C.restRun[0], C.restRun[1]] : [0, 0], armour: C.armour ? [C.armour[0], C.armour[1]] : [0, 0], pending: C.pending ?? null, block: C.block ? [C.block[0], C.block[1]] : [0, 0], acts: [C.acts[0], C.acts[1]], drawn: C.drawn, drew: C.drew,
    endChamp: C.endChamp,
  };
}
function clonePlayer(P: PlayerState): PlayerState {
  return {
    deckList: P.deckList, deck: P.deck.slice(), hand: P.hand.slice(), reserve: P.reserve.slice(),
    omens: P.omens.map((o) => ({ card: o.card, faceUp: o.faceUp, target: o.target })), discard: P.discard.slice(), lost: P.lost.slice(), musterQ: P.musterQ.slice(),
  };
}
/** Fills in fields added since a state was saved (puzzle positions, a match saved in the browser). */
export function upgradeState(S: State): State {
  if (!S.attendants) S.attendants = [];
  if (S.combat) {
    S.combat.hostAdj ??= [null, null, null, null];
    S.combat.sacrificed ??= [false, false];
    S.combat.summoned ??= [false, false];
    S.combat.uses ??= Array(12).fill(0);
    S.combat.lastUse ??= Array(12).fill(-99);
    S.combat.restsSince ??= Array(12).fill(0);
    S.combat.acts ??= [0, 0];
    S.combat.drawn ??= null;
    S.combat.drew ??= false;
    S.combat.endChamp ??= [[null, null], [null, null], [null, null]];
    if (S.combat.felled.length < 3) { S.combat.felled = [...S.combat.felled, [false, false]]; S.combat.endValour = [...S.combat.endValour, [0, 0]]; S.combat.startV = [...S.combat.startV, [0, 0]]; }
  }
  return S;
}
export function cloneState(S: State): State {
  return {
    ...S, players: [clonePlayer(S.players[0]), clonePlayer(S.players[1])], board: S.board.slice(), quadGeis: S.quadGeis.slice(), quadOath: S.quadOath.slice(), globalGeis: S.globalGeis.slice(), attendants: (S.attendants ?? []).slice(),
    hiddenSpots: S.hiddenSpots.slice(), tieCoin: [S.tieCoin[0], S.tieCoin[1]], combat: S.combat ? cloneCombat(S.combat) : null,
    result: S.result ? { ...S.result } : null, stats: null,
  };
}

/** What player p may see: the opponent's hidden zones become UNKNOWN cards (uids kept; they were assigned after shuffling). */
export function observe(S: State, p: Side): State {
  const V = cloneState(S);
  const o = (1 - p) as Side;
  const unk = (c: Card): Card => ({ uid: c.uid, def: UNKNOWN, owner: c.owner });
  const O = V.players[o];
  // nobody knows the order of their own Reserve: show it sorted
  if (toDeath(S)) V.players[p].reserve = V.players[p].reserve.slice().sort((x, y) => (x.def.id < y.def.id ? -1 : x.def.id > y.def.id ? 1 : x.uid - y.uid));
  O.deck = O.deck.map(unk);
  O.hand = O.hand.map(unk);
  O.reserve = O.reserve.map(unk);
  O.musterQ = O.musterQ.map(unk);
  O.lost = O.lost.map(unk);
  O.omens = O.omens.map((s) => (s.faceUp ? s : { card: unk(s.card), faceUp: false }));
  if (V.pendingOmen && V.pendingOmen.owner === o) V.pendingOmen = unk(V.pendingOmen);
  for (const s of V.hiddenSpots) { const c = V.board[s]; if (c && c.owner === o) V.board[s] = unk(c); }
  if (V.combat) {
    V.combat.guests = V.combat.guests.map((g, q) => (q === o ? g.map(unk) : g));
    V.combat.champs = V.combat.champs.map((g, q) => (q === o ? g.map(unk) : g));
  }
  return V;
}

// ---------------------------------------------------------------- muster
const countType = (cs: Card[], t: string) => { let n = 0; for (const c of cs) if (c.def.type === t) n++; return n; };

function musterFetch(S: State, p: Side): number {
  const P = S.players[p];
  let taken = 0;
  // a host counts as a hero for the Muster
  const is = (c: Card, t: string) => c.def.type === t || (t === "hero" && c.def.type === "host");
  const need = (t: "hero" | "support" | "monster", min: number) => {
    let miss = min - P.hand.filter((c) => is(c, t)).length;
    for (const src of [P.reserve, P.deck]) {
      for (let i = 0; i < src.length && miss > 0; ) {
        if (is(src[i], t)) { P.hand.push(src.splice(i, 1)[0]); miss--; taken++; } else i++;
      }
    }
  };
  need("hero", 2);
  need("support", 4);
  if (hostDeck(P)) need("monster", 4);
  return taken;
}
const hostDeck = (P: PlayerState) => P.deckList.some((d) => d.type === "host");
/** What the Muster must leave in hand: 2 heroes (a host counts), 4 supports, and 4 monsters for a deck of hosts. */
export function musterNeeds(P: PlayerState): { t: "hero" | "support" | "monster"; n: number; label: string }[] {
  const out: { t: "hero" | "support" | "monster"; n: number; label: string }[] = [{ t: "hero", n: 2, label: hostDeck(P) ? "heroes or hosts" : "heroes" }, { t: "support", n: 4, label: "supports" }];
  if (hostDeck(P)) out.push({ t: "monster", n: 4, label: "monsters" });
  return out;
}
const musterIs = (c: Card, t: string) => c.def.type === t || (t === "hero" && c.def.type === "host");
/** The choices for the first card of the four drawn. You may not set aside a card you would then be short of, nor keep
 *  one that leaves too few places in hand for what you still need. */
export function musterOptions(S: State, p: Side): Option[] {
  const P = S.players[p], c = P.musterQ[0];
  if (!c) return [];
  if (c.def.type === "omen") {
    const out: Option[] = [];
    if (P.omens.length < S.rules.omenSpots) out.push({ t: "muster", uid: c.uid, how: "omen" });
    else for (const o of P.omens) out.push({ t: "muster", uid: c.uid, how: "omen", swap: o.card.uid });
    out.push({ t: "muster", uid: c.uid, how: "aside" });
    return out;
  }
  const needs = musterNeeds(P);
  const room = S.rules.handSize - P.hand.length;
  const has = (t: string) => P.hand.filter((x) => musterIs(x, t)).length;
  const supply = (t: string) => P.musterQ.slice(1).filter((x) => musterIs(x, t)).length + P.deck.filter((x) => musterIs(x, t)).length;
  const shortAfterKeep = needs.reduce((a, q) => a + Math.max(0, q.n - has(q.t) - (musterIs(c, q.t) ? 1 : 0)), 0);
  const canKeep = room > 0 && shortAfterKeep <= room - 1;
  const canAside = needs.every((q) => has(q.t) + supply(q.t) >= q.n || !musterIs(c, q.t));
  const out: Option[] = [];
  if (canKeep) out.push({ t: "muster", uid: c.uid, how: "keep" });
  if (canAside || !canKeep) out.push({ t: "muster", uid: c.uid, how: "aside" });
  return out;
}
function applyMuster(S: State, p: Side, o: Extract<Option, { t: "muster" }>) {
  const P = S.players[p];
  const c = P.musterQ.shift()!;
  if (o.how === "keep") P.hand.push(c);
  else if (o.how === "aside") P.reserve.push(c);
  else if (o.swap !== undefined) {
    const i = P.omens.findIndex((x) => x.card.uid === o.swap);
    P.reserve.push(P.omens[i].card);
    P.omens[i] = { card: c, faceUp: false };
  } else P.omens.push({ card: c, faceUp: false });
}
function musterReturnLegal(P: PlayerState, c: Card): boolean {
  const h = countType(P.hand, "hero") + countType(P.hand, "host") - (c.def.type === "hero" || c.def.type === "host" ? 1 : 0);
  const s = countType(P.hand, "support") - (c.def.type === "support" ? 1 : 0);
  const m = countType(P.hand, "monster") - (c.def.type === "monster" ? 1 : 0);
  return h >= 2 && s >= 4 && (!hostDeck(P) || m >= 4);
}
/** The rules with a setting in force: its Valour in place of the ford's, its mound. */
function withSetting(R: Rules, id: string): Rules {
  const SET = settingOf(R, id);
  return { ...R, setting: id, fordValour: R.fordValour ?? SET?.valour, moundValour: SET?.mound !== undefined ? R.moundValour ?? SET.mound : R.moundValour };
}
/** Duels to the death: the setting is still to be chosen (by the second player, before the Muster). */
export const needsSetting = (S: State) => toDeath(S) && !S.rules.setting && param(S.rules, "setting.choose") > 0;
function musterStep(S: State): Decision | null {
  if (needsSetting(S)) return { kind: "setting", player: 1, options: SETTINGS.map((x) => ({ t: "setting" as const, id: x.id })) };
  while (S.phase === "muster") {
    const p = S.musterP;
    const P = S.players[p];
    if (S.musterStage === "draw") {
      if (S.pendingOmen) {
        return { kind: "musterOmen", player: p, options: [...P.omens.map((o) => ({ t: "musterOmen" as const, uid: o.card.uid })), { t: "musterOmen", uid: S.pendingOmen.uid }] };
      }
      const full = P.hand.length >= S.rules.handSize && P.omens.length >= S.rules.omenSpots;
      if (full || (P.musterQ.length === 0 && P.deck.length === 0)) {
        P.reserve.push(...P.musterQ);
        P.musterQ = [];
        S.musterStage = "check";
        S.musterReturns = musterFetch(S, p);
        continue;
      }
      if (P.musterQ.length === 0) P.musterQ = P.deck.splice(0, 4);
      // each card of the four: keep it, set it aside for the Reserve, or put an omen in an Omen spot.
      // A card with only one place to go goes there by itself.
      const options = musterOptions(S, p);
      if (options.length === 1) { applyMuster(S, p, options[0] as Extract<Option, { t: "muster" }>); continue; }
      return { kind: "muster", player: p, options };
    } else {
      if (S.musterReturns > 0) {
        return { kind: "musterReturn", player: p, options: P.hand.filter((c) => musterReturnLegal(P, c)).map((c) => ({ t: "musterReturn" as const, uid: c.uid })) };
      }
      if (p === 0) { S.musterP = 1; S.musterStage = "draw"; }
      else {
        for (const Q of S.players) { Q.reserve.push(...Q.deck); Q.deck = []; }
        S.phase = "draft"; S.step = 1; S.sub = 0;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- draft / play / late
function draftDecision(S: State): Decision | null {
  const p = S.sub;
  const spot = draftSpot(S.step, p);
  const hero = isHeroSpot(spot);
  const hand = S.players[p].hand;
  const options: Option[] = hand.filter((c) => c.def.type === (hero ? "hero" : "support")).map((c) => ({ t: "place" as const, uid: c.uid }));
  if (hero) {
    // a Slúagh host goes down with 2 or 3 of the monsters in hand joined to it (all of them, if fewer than 2)
    const mons = hand.filter((c) => c.def.type === "monster");
    const seen = new Set<string>();
    for (const h of hand) {
      if (h.def.type !== "host") continue;
      for (const join of joinSets(mons)) {
        const key = h.def.id + ":" + join.map((c) => c.def.id).sort().join("+");
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ t: "place", uid: h.uid, join: join.map((c) => c.uid) });
      }
    }
  }
  if (options.length === 0) { advanceDraft(S); return null; } // cannot happen after a legal muster
  return { kind: "place", player: p, options, spot };
}
/** The ways to join monsters to a host: every set of 2 or 3, or all of them when there are fewer than 2. */
export function joinSets(mons: Card[]): Card[][] {
  if (mons.length < 2) return [mons];
  const out: Card[][] = [];
  for (let i = 0; i < mons.length; i++) for (let j = i + 1; j < mons.length; j++) {
    out.push([mons[i], mons[j]]);
    for (let k = j + 1; k < mons.length; k++) out.push([mons[i], mons[j], mons[k]]);
  }
  return out;
}
function advanceDraft(S: State) {
  if (S.sub === 0) S.sub = 1;
  else {
    S.hiddenSpots = [];
    S.sub = 0;
    S.step++;
    if (S.step > 6) { S.phase = "play"; S.step = 1; }
  }
}
function playDecision(S: State): Decision {
  const p = S.sub;
  const spot = spotFaced(S, p);
  const P = S.players[p];
  const options: Option[] = [];
  for (const o of P.omens) if (!o.faceUp) {
    if (o.card.def.type === "omen" && o.card.def.scope === "targeted") for (const t of [0, 3, 6, 9]) options.push({ t: "omen", uid: o.card.uid, target: t });
    else options.push({ t: "omen", uid: o.card.uid });
  }
  const seen = new Set<string>();
  if (isHeroSpot(spot)) {
    for (const c of P.hand) {
      if (c.def.type !== "geis" || seen.has(c.def.id)) continue;
      if (c.def.scope === "global" ? S.globalGeis.length >= MAX_GLOBAL_GEASA : !!S.quadGeis[quadOf(spot)]) continue;
      seen.add(c.def.id);
      options.push({ t: "bind", uid: c.uid });
    }
  } else if (S.board[spot]) {
    for (const c of P.hand) if (c.def.type === "support" && !seen.has(c.def.id)) { seen.add(c.def.id); options.push({ t: "supplant", uid: c.uid }); }
  }
  for (const hs of heroSpotsOf(p)) {
    if (S.quadOath[quadOf(hs)]) continue;
    for (const c of P.hand) if (c.def.type === "oath" && !seen.has("o:" + hs + c.def.id)) { seen.add("o:" + hs + c.def.id); options.push({ t: "swear", uid: c.uid, spot: hs }); }
  }
  for (const c of P.hand) if (c.def.type === "attendant" && !seen.has("a:" + c.def.id)) { seen.add("a:" + c.def.id); options.push({ t: "attend", uid: c.uid }); }
  options.push({ t: "hold" });
  return { kind: "action", player: p, options, spot };
}
function loseFaceDown(S: State) {
  if (toDeath(S)) return; // in duels to the death, omens still face down can be turned in the duels
  for (const P of S.players) {
    P.lost.push(...P.omens.filter((o) => !o.faceUp).map((o) => o.card));
    P.omens = P.omens.filter((o) => o.faceUp);
  }
}
function advancePlay(S: State) {
  const f = firstActor(S);
  if (S.sub === f) { S.sub = (1 - f) as Side; return; }
  S.sub = f;
  S.step++;
  if (S.step > 6) {
    if (S.rules.keepOmensUntilCombat) { S.phase = "late"; S.sub = f; }
    else { loseFaceDown(S); startCombat(S); }
  }
}
function lateDecision(S: State): Decision | null {
  const P = S.players[S.sub];
  const fd = P.omens.filter((o) => !o.faceUp);
  if (fd.length === 0) { advanceLate(S); return null; }
  const opts: Option[] = [];
  for (const o of fd) {
    if (o.card.def.type === "omen" && o.card.def.scope === "targeted") for (const t of [0, 3, 6, 9]) opts.push({ t: "late", uid: o.card.uid, target: t });
    else opts.push({ t: "late", uid: o.card.uid });
  }
  return { kind: "late", player: S.sub, options: [...opts, { t: "lateDone" }] };
}
function advanceLate(S: State) {
  if (S.sub === firstActor(S)) S.sub = (1 - S.sub) as Side;
  else { loseFaceDown(S); startCombat(S); }
}

/**
 * Tie-break: the round runs backwards. Laid geasa and sworn oaths go back to their owners' hands, turned omens go
 * back face down, and the wheel turns counter-clockwise through the Playing turn again; then the duels are fought
 * afresh, the second pair first, with every hero back at its starting Valour and every support unused.
 */
function startTiebreak(S: State) {
  const back = (c: Card | null) => { if (c) S.players[c.owner].hand.push(c); };
  S.quadGeis.forEach(back);
  S.quadOath.forEach(back);
  S.globalGeis.forEach(back);
  (S.attendants ?? []).forEach(back);
  S.attendants = [];
  S.quadGeis = [null, null, null, null];
  S.quadOath = [null, null, null, null];
  S.globalGeis = [];
  for (const P of S.players) P.omens = P.omens.map((o) => ({ card: o.card, faceUp: false }));
  if (S.stats) S.stats.tiebreaks++;
  S.reversed = true;
  S.combat = null;
  S.phase = "play";
  S.step = 1;
  S.sub = firstActor(S);
}

// ---------------------------------------------------------------- combat
export function newCombat(S: State): CombatState {
  const guests = [0, 1].map((p) => S.players[p].hand.filter((c) => c.def.type === "hero"));
  const champs = [0, 1].map((p) => S.players[p].hand.filter((c) => c.def.type === "champion"));
  const C: CombatState = {
    duel: 0, stage: "turns", hs: [0, 6], valour: [0, 0], shield: [0, 0], first: 1, turn: 0, used: 0, broken: 0,
    nextStrike: [0, 0], cathbad: [false, false], kingsDue: [false, false], supportsUsed: 0, struck: [false, false],
    guestUsed: [false, false], guests, focus: [null, null], focusTodo: [],
    felled: [[false, false], [false, false], [false, false]], endValour: [[0, 0], [0, 0], [0, 0]], startV: [[0, 0], [0, 0], [0, 0]],
    cap: [0, 0], init: [0, 0], hit: [false, false], champ: [null, null], champs,
    hostAdj: [null, null, null, null], sacrificed: [false, false], summoned: [false, false],
    uses: Array(12).fill(0), lastUse: Array(12).fill(-99), restsSince: Array(12).fill(0), rested: [0, 0], acts: [0, 0], drawn: null, drew: false,
    endChamp: [[null, null], [null, null], [null, null]],
    mound: [0, 1].map((p) => (hasMound(S, p as Side) ? param(S.rules, "people.sidhe.moundValour") : 0)),
  };
  startDuel(S, C, 0, S.stats);
  return C;
}
/** Shuffle side p's Reserve (in duels to the death; seeded, so a match replays the same). */
export function shuffleReserve(S: State, p: Side) {
  const r = new Rng(hashSeed(S.shuffleSeed ?? 1, S.shuffles ?? 0, p));
  S.shuffles = (S.shuffles ?? 0) + 1;
  r.shuffle(S.players[p].reserve);
}
function startCombat(S: State) {
  if (toDeath(S)) for (const p of [0, 1] as Side[]) shuffleReserve(S, p);
  S.phase = "combat";
  S.combat = newCombat(S);
}

export function startDuel(S: State, C: CombatState, d: number, stats: MatchStats | null) {
  C.rested = [0, 0]; // a new duel: no rests yet
  C.armour = [0, 0];
  C.pending = null; C.block = [0, 0]; C.bleed = [0, 0]; C.stagger = [0, 0]; C.cried = [0, 0]; C.dodged = [0, 0]; C.restRun = [0, 0];
  C.duel = d;
  // the backwards round fights the second pair of heroes first
  C.hs = (d === 0) !== S.reversed ? [0, 6] : [3, 9];
  C.turn = 0; C.supportsUsed = 0;
  C.nextStrike = [0, 0]; C.cathbad = [false, false]; C.kingsDue = [false, false];
  C.struck = [false, false]; C.hit = [false, false]; C.guestUsed = [false, false]; C.focus = [null, null]; C.champ = [null, null];
  C.sacrificed = [false, false];
  C.drawn = null; C.drew = false;
  // the final duel: each side's survivor, with the Valour it ended its duel with (a champion who won fights on)
  const carry: number[] = [0, 0];
  if (d === 2) {
    const hs: number[] = [0, 0], ch: (Card | null)[] = [null, null];
    for (const p of [0, 1] as Side[]) {
      const dd = C.felled[0][p] ? 1 : 0;
      hs[p] = dd === 0 ? (p === 0 ? 0 : 6) : (p === 0 ? 3 : 9);
      carry[p] = C.endValour[dd][p];
      ch[p] = C.endChamp[dd][p];
    }
    C.hs = [hs[0], hs[1]];
    C.champ = ch;
  }
  const todo: Side[] = [];
  const R = S.rules;
  const h = [fighter(S, C, 0), fighter(S, C, 1)];
  const sv = C.startV.slice();
  sv[d] = [0, 0];
  for (const p of [0, 1] as Side[]) {
    const fx = heroFx(S, C, p);
    const oath = activeOath(S, C, p);
    let v = h[p].valour + R.valourBonus + (toDeath(S) ? param(R, "duel.fordValour") : 0) + (oath?.boon.valour ?? 0);
    for (const e of fx) if (e.startValour && e.startValour.duel === d) v += e.startValour.n;
    C.cap[p] = v + (toDeath(S) ? R.deathCapOver ?? NO_CAP : R.capOver);
    // the dead do not sleep: nothing lowers a Slúagh host's Initiative below its own
    const sleepless = h[p].type === "hero" && !!h[p].host;
    const initFx = sumFx(fx, (e) => (sleepless ? Math.max(0, e.initMod ?? 0) : e.initMod ?? 0));
    let init = h[p].init + (oath?.boon.init ?? 0) + initFx;
    const g = S.quadGeis[quadOf(C.hs[p])];
    const binding = [...(g && g.def.type === "geis" ? [g.def] : []), ...S.globalGeis.flatMap((x) => (x.def.type === "geis" ? [x.def] : []))];
    if (!ignoresGeis(S, p)) for (const gd of binding) {
      if (gd.invoke && gd.invoke === h[p].tag) { v -= R.invokeLoss; if (stats) { stats.invokes++; stats.fx.startLoss[p] += R.invokeLoss; } }
      if (gd.bigLoss && h[p].valour >= 5) { v -= gd.bigLoss; if (stats) stats.fx.startLoss[p] += gd.bigLoss; }
      if (gd.initLoss) { init -= gd.initLoss; if (stats) stats.fx.initLoss[p] += gd.initLoss; }
    }
    if (stats) stats.fx.initLoss[p] -= initFx;
    if (stats) stats.fx.duels[p]++;
    if (d === 2) { v = carry[p]; C.cap[p] = Math.max(C.cap[p], v); }
    C.valour[p] = v;
    C.init[p] = init;
    sv[d][p] = Math.max(0, v);
    C.shield[p] = (h[p].ab.shieldStart ?? 0) + (oath?.boon.shield ?? 0) + sumFx(fx, (e) => e.shieldStart) + (toDeath(S) ? settingOf(R)?.shield ?? 0 : 0);
    if (toDeath(S)) {
      // passive cards beside the hero: their Armour holds from the start (the highest counts)
      let arm = h[p].ab.armour ?? 0, src = arm ? "hero:" + h[p].id : "";
      for (const sp of [C.hs[p] + 1, C.hs[p] + 2]) {
        const c = S.board[sp]?.def;
        if (c?.type === "support" && c.use === "passive" && !unwilling(h[p].alignment, c.alignment) && (c.armour ?? 0) > arm) { arm = c.armour ?? 0; src = c.id; }
      }
      C.armour![p] = arm;
      if (stats) (stats.armourSrc ??= ["", ""])[p] = src;
    }
    if (h[p].ab.shapeShift) todo.push(p); // each hero fights one duel, so this is once per match
  }
  C.startV = sv;
  C.focusTodo = todo;
  // the Mist hides the host in the first duel only
  const mist = d === 0 ? [fxOf(S, 0).some((e) => e.mist), fxOf(S, 1).some((e) => e.mist)] : [false, false];
  const dark = d === 0 && boardFx(S).some((e) => e.darkness);
  const [i0, i1] = dark ? [-C.init[0], -C.init[1]] : [C.init[0], C.init[1]];
  if (mist[0] !== mist[1]) C.first = mist[0] ? 0 : 1;
  else if (i0 > i1) C.first = 0;
  else if (i1 > i0) C.first = 1;
  else {
    if (stats) stats.initTies++;
    C.first = R.initTie === "p2" ? 1 : R.initTie === "p1" ? 0 : S.tieCoin[d % 2];
  }
  if (stats && C.first === 1) stats.p2First++;
  if (stats) stats.fx.first[C.first]++;
  C.stage = C.focusTodo.length ? "focus" : "turns";
  if (C.valour[0] <= 0 || C.valour[1] <= 0) endDuel(S, C, stats);
}

export const actorOf = (C: CombatState): Side => (C.turn % 2 === 0 ? C.first : ((1 - C.first) as Side));
export const focusOf = (C: CombatState, p: Side, h: FighterDef): Focus | null => C.focus[p] ?? h.focus;

/** Geasa forbidding support s for side a's hero: bit set of geasa (quadrant bit, CROW_BIT). */
export function forbidMask(S: State, C: CombatState, a: Side, s0: SupportDef, as?: Element): number {
  if (C.champ[a]) return 0; // a champion is bound by no geis or oath
  const s = asHybrid(effSupport(S, a, s0), as);
  let m = 0;
  const q = quadOf(C.hs[a]);
  const g = S.quadGeis[q];
  const free = ignoresGeis(S, a);
  if (g && g.def.type === "geis" && !(C.broken & (1 << q)) && !free && geisForbidsSupport(g.def, s)) m |= 1 << q;
  S.globalGeis.forEach((x, i) => { if (x.def.type === "geis" && !free && !(C.broken & globalBit(i, q)) && geisForbidsSupport(x.def, s)) m |= globalBit(i, q); });
  if (crowActive(S, C) && s.effects.some((e) => e.type === "heal")) m |= CROW_BIT;
  const o = activeOath(S, C, a);
  if (o && forbidsSupport(o.forbids, s)) m |= OATH_BIT << q;
  return m;
}
export function restForbidMask(S: State, C: CombatState, a: Side): number {
  if (C.champ[a]) return 0;
  const q = quadOf(C.hs[a]);
  const g = S.quadGeis[q];
  let m = 0;
  const free = ignoresGeis(S, a);
  if (g && g.def.type === "geis" && g.def.forbids.rest && !(C.broken & (1 << q)) && !free) m |= 1 << q;
  S.globalGeis.forEach((x, i) => { if (x.def.type === "geis" && x.def.forbids.rest && !free && !(C.broken & globalBit(i, q))) m |= globalBit(i, q); });
  const o = activeOath(S, C, a);
  if (o && o.forbids.rest) m |= OATH_BIT << q;
  return m;
}
/** Valour cost of breaking the geasa/oaths in mask m. */
export function breakCost(S: State, m: number, al?: string): number {
  const oaths = bitCount((m >>> 5) & 15);
  // the Aos Sídhe know geasa from the inside: in a duel to the death a break costs them 1
  const g = al === "Sidhe" && toDeath(S) ? param(S.rules, "people.sidhe.geisCost") : S.rules.geisBreakCost;
  return g * (bitCount(m) - oaths) + S.rules.oathBreakCost * oaths;
}
export const SIDHE_GEIS_COST = 1;
/** The dead-flesh aura never holds a blow below this. */
export const AURA_MIN = 5;
const bitCount = (m: number) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };

/** Support spots side a's hero may use now: own quadrant, plus King's due. */
export function usableSpots(S: State, C: CombatState, a: Side): { spot: number; borrowed: boolean }[] {
  const hs = C.hs[a];
  const out: { spot: number; borrowed: boolean }[] = [];
  const ok = (s: number) => !!S.board[s] && S.board[s]!.def.type === "support" && (toDeath(S) ? supportReady(S, C, a, s) : !(C.used & (1 << s)));
  for (const s of [hs + 1, hs + 2]) if (ok(s)) out.push({ spot: s, borrowed: false });
  if (fighter(S, C, a).ab.kingsDue && !C.kingsDue[a]) {
    const other = heroSpotsOf(a).find((x) => x !== hs)!;
    for (const s of [other + 1, other + 2]) if (ok(s)) out.push({ spot: s, borrowed: true });
  }
  return out;
}
/** Cards side p could still draw (its Reserve, and the discards that would be shuffled back). */
export const drawable = (S: State, p: Side) => S.players[p].reserve.length + S.players[p].discard.length;
/** Duels to the death: may side a use the support at spot s now? The first use is free; again, at its price. */
export function supportReady(S: State, C: CombatState, a: Side, s: number): boolean {
  if (!C.uses[s]) return true;
  const r = reuseOf(S.board[s]!.def as SupportDef);
  if (r.turns && C.acts[a] - C.lastUse[s] <= r.turns) return false;
  if (r.rest && C.restsSince[s] < r.rest) return false;
  if (r.valour && C.valour[a] <= r.valour) return false;
  if (r.draw && drawable(S, a) < r.draw) return false;
  return true;
}
/** Take the top card of side p's Reserve, shuffling the discards back in when it is empty. */
export function takeTop(S: State, p: Side): Card | null {
  const P = S.players[p];
  if (!P.reserve.length) {
    if (!P.discard.length) return null;
    P.reserve = P.discard;
    P.discard = [];
    shuffleReserve(S, p);
  }
  return P.reserve.shift()!;
}

/** The Block cards side b could tap now: reactions beside its hero, willing, and not used since its own last turn. */
export function blockSpots(S: State, C: CombatState, b: Side): number[] {
  if (!toDeath(S)) return [];
  const h = fighter(S, C, b);
  const out: number[] = [];
  for (const sp of [C.hs[b] + 1, C.hs[b] + 2]) {
    const c = S.board[sp]?.def;
    if (c?.type !== "support" || c.use !== "reaction" || unwilling(h.alignment, c.alignment)) continue;
    if (C.uses[sp] && C.acts[b] <= C.lastUse[sp]) continue; // like a Weapon: it needs one of your turns between
    out.push(sp);
  }
  return out;
}
/** Would this option strike the defender with a blow a Block can meet (not one that ignores Shield)? */
function blockable(S: State, C: CombatState, a: Side, o: Option): boolean {
  let s: SupportDef | null = null;
  if (o.t === "duel" && o.act === "use") s = S.board[o.spot]!.def as SupportDef;
  else if (o.t === "drawn" && o.how === "play" && C.drawn?.def.type === "support") s = C.drawn.def;
  if (!s || !s.effects.some((e) => e.type === "strike")) return false;
  const h = fighter(S, C, a);
  if (unwilling(h.alignment, s.alignment)) return false;
  // a blow that ignores Shield ignores Blocks too, unless (trial) it meets a Merrow: water can't be pierced
  if (s.pierce && !(toDeath(S) && fighter(S, C, (1 - a) as Side).alignment === "Merrow" && param(S.rules, "people.merrow.waterUnpierced") > 0)) return false;
  // trial: a Spirit blow can't be Blocked either (Armour still meets it)
  const asEl = o.t === "duel" || o.t === "drawn" ? o.as : undefined;
  if (toDeath(S) && param(S.rules, "people.sluagh.spiritUnblock") > 0 && !asEl && effSupport(S, a, s).element === "Spirit") return false;
  return true;
}
/** What a Block card takes off the blow: its Block, +1 kinship, +1 Focus, and +1 or +2 if its hero has rested. */
export function blockValue(S: State, C: CombatState, b: Side, spot: number): number {
  const s = S.board[spot]!.def as SupportDef;
  const h = fighter(S, C, b);
  let n = s.effects.find((e) => e.type === "shield")?.n ?? 0;
  if (kin(s.alignment, h.alignment)) n += h.ab.kinBonus ?? 1;
  if (h.ab.focusAny || h.focus === s.element || h.focus === s.kind) n += 1;
  return n + (C.rested?.[b] ?? 0);
}
/** A hero still in hand heals its side 1 as a guest, then leaves the hand. */
function guestHeals(S: State, C: CombatState, a: Side, uid: number, stats: MatchStats | null) {
  const gs = C.guests.slice();
  gs[a] = C.guests[a].filter((x) => x.uid !== uid);
  C.guests = gs;
  C.guestUsed[a] = true;
  { const src = SRC.id; SRC.id = "guest"; try { heal(S, C, a, 1); } finally { SRC.id = src; } }
  if (stats) stats.guests++;
  if (C === S.combat) { // real match: the guest leaves the hand
    const P = S.players[a];
    const j = P.hand.findIndex((c) => c.uid === uid);
    if (j >= 0) P.discard.push(P.hand.splice(j, 1)[0]);
  }
}
/** Set while a pending blow is being carried out, so it isn't paused again. */
const RESUMING = { on: false };

export function duelActs(S: State, C: CombatState, a: Side): Option[] {
  const h = fighter(S, C, a);
  const acts: Option[] = [];
  for (const { spot } of usableSpots(S, C, a)) {
    const s = S.board[spot]!.def as SupportDef;
    if (toDeath(S) && s.use) continue; // passive cards work by being there; reactions wait for the enemy's blow
    if (unwilling(h.alignment, s.alignment)) { acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "normal" }); continue; }
    const from = acts.length;
    // a host with hybrid monsters may strike with a Spirit support as Spirit, or as any of its hybrids
    const ways: (Element | undefined)[] = [undefined];
    if (h.type === "hero" && h.hybrids?.length && effSupport(S, a, s).element === "Spirit") ways.push(...h.hybrids);
    for (const as of ways) {
      const m = forbidMask(S, C, a, s, as);
      const x = as ? { as } : {};
      if (!m) acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "normal", ...x });
      else {
        acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "break", ...x });
        if (C.cathbad[a] && bitCount(m) === 1) acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "ignore", ...x });
      }
    }
    for (const o of acts.slice(from)) if (o.t === "duel" && canCry(S, C, a, s, o.as)) acts.push({ ...o, cry: true });
  }
  const rm = restForbidMask(S, C, a);
  // DECISION: a geis cannot demand the impossible: with no support left, resting is allowed.
  if (!rm || acts.length === 0) acts.push({ t: "duel", guest: -1, act: "rest", spot: -1, mode: "normal" });
  else {
    acts.push({ t: "duel", guest: -1, act: "rest", spot: -1, mode: "break" });
    if (C.cathbad[a]) acts.push({ t: "duel", guest: -1, act: "rest", spot: -1, mode: "ignore" });
  }
  return acts;
}
/** The other hero spot of side a's (the host that is not fighting now), if it is a host that can still lend a monster. */
function otherHostSpot(S: State, C: CombatState, a: Side): number | null {
  const os = heroSpotsOf(a).find((x) => x !== C.hs[a])!;
  const c = S.board[os];
  if (!c || c.def.type !== "hero" || !c.def.host) return null;
  const od = C.duel === 0 ? 1 : 0;
  if (od < C.duel && C.felled[od][a]) return null; // a felled host has nothing left to give
  return os;
}
/** A Slúagh host's own actions: sacrifice one of its monsters (once a duel), or summon one from its other host (once a match). */
/** Does a summon spend a Reserve card? (On by default in a duel to the death.) */
export const summonCosts = (S: State) => param(S.rules, "people.sluagh.summonCost") > 0 && (toDeath(S) || S.rules.summonCost === true || S.rules.params?.["people.sluagh.summonCost"] !== undefined);
export function hostActs(S: State, C: CombatState, a: Side): Option[] {
  if (C.champ[a]) return [];
  const h = fighter(S, C, a);
  if (h.type !== "hero" || !h.host) return [];
  const out: Option[] = [];
  if (!C.sacrificed[a] && h.host.members.length >= 2) for (const m of h.host.members) out.push({ t: "sacrifice", id: m.id });
  if (!C.summoned[a] && (!summonCosts(S) || drawable(S, a) > 0)) {
    const os = otherHostSpot(S, C, a);
    if (os !== null) {
      const other = hostAt(S, C, os);
      if (other.host && other.host.members.length >= 2) for (const m of other.host.members) out.push({ t: "summon", id: m.id });
    }
  }
  return out;
}
const adjOf = (C: CombatState, q: number): HostAdj => C.hostAdj[q] ?? { add: [], remove: [] };
function setAdj(C: CombatState, q: number, v: HostAdj) { const x = C.hostAdj.slice(); x[q] = v; C.hostAdj = x; }

export function eligibleGuests(S: State, C: CombatState, a: Side): Card[] {
  if (C.guestUsed[a] || crowActive(S, C)) return [];
  const h = fighter(S, C, a);
  return C.guests[a].filter((g) => g.def.type === "hero" && sameAlignment(g.def.alignment, h.alignment));
}

/** The first player may call a champion in either duel, the second player only in the second; one per duel. */
export const canCallChampion = (C: CombatState, a: Side, on = true) => on && !C.champ[a] && (a === 0 || C.duel >= 1) && C.champs[a].length > 0;

/** What can be done with a card just drawn: play it (or keep a hero or champion in hand), or put it aside. */
export function drawnOptions(S: State, C: CombatState, a: Side, c: Card): Option[] {
  const out: Option[] = [];
  const d = c.def;
  const h = fighter(S, C, a);
  if (d.type === "support") {
    if (unwilling(h.alignment, d.alignment)) out.push({ t: "drawn", how: "play", mode: "normal" });
    else {
      const from = out.length;
      const ways: (Element | undefined)[] = [undefined];
      if (h.type === "hero" && h.hybrids?.length && effSupport(S, a, d).element === "Spirit") ways.push(...h.hybrids);
      for (const as of ways) {
        const m = forbidMask(S, C, a, d, as);
        const x = as ? { as } : {};
        if (!m) out.push({ t: "drawn", how: "play", mode: "normal", ...x });
        else {
          out.push({ t: "drawn", how: "play", mode: "break", ...x });
          if (C.cathbad[a] && bitCount(m) === 1) out.push({ t: "drawn", how: "play", mode: "ignore", ...x });
        }
      }
      for (const o of out.slice(from)) if (o.t === "drawn" && canCry(S, C, a, d, o.as)) out.push({ ...o, cry: true });
    }
  } else if (d.type === "hero") out.push({ t: "drawn", how: "keep" });
  else if (d.type === "champion") {
    if (canCallChampion(C, a, S.rules.champions)) out.push({ t: "drawn", how: "play" });
    out.push({ t: "drawn", how: "keep" });
  } else if (d.type === "monster") {
    if (!C.champ[a] && h.type === "hero" && h.host) out.push({ t: "drawn", how: "play" });
  } else if (d.type === "omen" || d.type === "geis" || d.type === "oath" || d.type === "attendant") {
    for (const target of cardTargets(S, C, a, d)) out.push(target === undefined ? { t: "drawn", how: "play" } : { t: "drawn", how: "play", target });
  }
  out.push({ t: "drawn", how: "discard" });
  return out;
}
/** Where an omen, geis, oath or attendant can go in the middle of a duel ([undefined] = it needs no target; [] = nowhere). */
function cardTargets(S: State, C: CombatState, a: Side, d: CardDef): (number | undefined)[] {
  const b = (1 - a) as Side;
  if (d.type === "omen") return d.scope === "targeted" ? [C.hs[a], C.hs[b]] : [undefined];
  if (d.type === "geis") return d.scope === "global" ? (S.globalGeis.length < MAX_GLOBAL_GEASA ? [undefined] : []) : S.quadGeis[quadOf(C.hs[b])] ? [] : [undefined];
  if (d.type === "oath") return C.champ[a] || S.quadOath[quadOf(C.hs[a])] ? [] : [undefined];
  if (d.type === "attendant") return [undefined];
  return [];
}
/** Duels to the death: a face-down omen to turn, or a geis, oath or attendant from hand. */
function handCardOptions(S: State, C: CombatState, a: Side): Option[] {
  const out: Option[] = [];
  const P = S.players[a];
  const seen = new Set<string>();
  for (const o of P.omens) if (!o.faceUp && !seen.has(o.card.def.id)) {
    seen.add(o.card.def.id);
    for (const target of cardTargets(S, C, a, o.card.def)) out.push(target === undefined ? { t: "duelCard", uid: o.card.uid } : { t: "duelCard", uid: o.card.uid, target });
  }
  for (const c of P.hand) {
    if ((c.def.type !== "geis" && c.def.type !== "oath" && c.def.type !== "attendant") || seen.has(c.def.id)) continue;
    seen.add(c.def.id);
    for (const target of cardTargets(S, C, a, c.def)) out.push(target === undefined ? { t: "duelCard", uid: c.uid } : { t: "duelCard", uid: c.uid, target });
  }
  return out;
}
/** An omen, geis, oath or attendant comes into play in the middle of a duel. */
function playCardMidDuel(S: State, C: CombatState, a: Side, c: Card, target: number | undefined, stats: MatchStats | null) {
  const b = (1 - a) as Side;
  const d = c.def;
  const P = S.players[a];
  if (d.type === "omen") {
    const slot = P.omens.find((o) => o.card.uid === c.uid);
    if (slot) { slot.faceUp = true; if (target !== undefined) slot.target = target; }
    else P.omens.push({ card: c, faceUp: true, target });
    if (stats) stats.omensTurned.push({ side: a, id: d.id });
    // what an omen does at the start of a duel, it does now
    const to: Side[] = d.scope === "yours" ? [a] : d.scope === "targeted" ? [target === C.hs[a] ? a : b] : [a, b];
    for (const p of to) if (d.fx.shieldStart) C.shield[p] += d.fx.shieldStart;
    if (NARRATE.lines) say(`${d.name} is turned${target !== undefined ? ` on ${fighter(S, C, target === C.hs[a] ? a : b).name}` : ""}.`);
  } else if (d.type === "geis") {
    if (d.scope === "global") S.globalGeis.push(c); else S.quadGeis[quadOf(C.hs[b])] = c;
    if (stats) stats.bound.push({ side: a, id: d.id });
    const e = fighter(S, C, b);
    if (!ignoresGeis(S, b) && !C.champ[b]) {
      if (d.invoke && d.invoke === e.tag) C.valour[b] -= S.rules.invokeLoss;
      if (d.bigLoss && e.valour >= 5) C.valour[b] -= d.bigLoss;
    }
    if (NARRATE.lines) say(`${d.name} is laid${d.scope === "global" ? " on everyone" : ` on ${e.name}`}.`);
  } else if (d.type === "oath") {
    S.quadOath[quadOf(C.hs[a])] = c;
    if (stats) stats.sworn.push({ side: a, id: d.id, hero: fighter(S, C, a).id });
    if (d.boon.valour) { C.valour[a] += d.boon.valour; C.cap[a] += d.boon.valour; }
    if (d.boon.shield) C.shield[a] += d.boon.shield;
    if (NARRATE.lines) say(`${fighter(S, C, a).name} swears ${d.name}.`);
  } else if (d.type === "attendant") {
    S.attendants = [...(S.attendants ?? []), c];
    if (NARRATE.lines) say(`${d.name} is called.`);
  }
}

export function combatDecision(S: State, C: CombatState): Decision | null {
  if (C.stage === "done") return null;
  if (C.stage === "focus") {
    const p = C.focusTodo[0];
    const h = fighter(S, C, p);
    const opts: Option[] = [{ t: "focus", el: null }];
    for (const el of ELEMENTS) if (el !== h.focus) opts.push({ t: "focus", el });
    return { kind: "focus", player: p, options: opts };
  }
  const a = actorOf(C);
  if (C.pending) return { kind: "block", player: (1 - a) as Side, options: [...blockSpots(S, C, (1 - a) as Side).map((spot) => ({ t: "block" as const, spot })), { t: "block", spot: -1 }] };
  if (C.drawn) return { kind: "drawn", player: a, options: drawnOptions(S, C, a, C.drawn) };
  const acts = duelActs(S, C, a);
  const options = acts.slice();
  if (toDeath(S)) {
    if (!C.drew && drawable(S, a) > 0) options.push({ t: "draw" });
    options.push(...handCardOptions(S, C, a));
  }
  if (canCallChampion(C, a, S.rules.champions)) {
    const seenC = new Set<string>();
    for (const c of C.champs[a]) if (c.def.type === "champion" && !seenC.has(c.def.id)) { seenC.add(c.def.id); options.push({ t: "champion", uid: c.uid }); }
  }
  options.push(...hostActs(S, C, a));
  const seen = new Set<string>();
  for (const g of eligibleGuests(S, C, a)) {
    if (seen.has(g.def.id)) continue;
    seen.add(g.def.id);
    for (const o of acts) options.push({ ...(o as Extract<Option, { t: "duel" }>), guest: g.uid });
  }
  return { kind: "duel", player: a, options };
}

/** Heal side p by n plus every Heal modifier (hero, oath, own reinforcement, board, the enemy's blight). */
export function heal(S: State, C: CombatState, p: Side, n: number, capTo?: number) {
  const h = fighter(S, C, p);
  const e = fighter(S, C, 1 - p);
  const n1 = n;
  n += (h.ab.healBonus ?? 0) + (activeOath(S, C, p)?.boon.heal ?? 0) + sumFx(heroFx(S, C, p), (x) => x.heal)
    + sumFx(boardFx(S), (x) => x.healMod) - (e.ab.foeHealMalus ?? 0) - (C.bleed?.[p] ?? 0) + (toDeath(S) ? param(S.rules, "setting.heals") * (settingOf(S.rules)?.heal ?? 0) : 0);
  const v0 = C.valour[p];
  const cap = capTo ?? C.cap[p];
  if (C.bleed?.[p] && S.stats && C === S.combat) S.stats.fx.bled[p] += Math.min(C.bleed[p], Math.max(0, n + C.bleed[p]));
  if (n > 0) C.valour[p] = Math.min(Math.max(cap, C.valour[p]), C.valour[p] + n);
  led(S, C, p, "heal:" + SRC.id, C.valour[p] - v0);
  // measurement only: which hero the heal went to, and how much of it went above the duel's starting Valour
  if (C.valour[p] > v0) {
    led(S, C, p, "hh:" + h.id, C.valour[p] - v0);
    led(S, C, p, "over:" + SRC.id, Math.max(0, C.valour[p] - Math.max(v0, C.startV[C.duel]?.[p] ?? Infinity)));
  }
  // trial: the ebb and flow: when the enemy of a Merrow heals, the Merrow rises with the tide (Shield 1)
  const ebb = param(S.rules, "people.merrow.ebb"), ebbOnce = param(S.rules, "people.merrow.ebbOnce") > 0;
  if (C.valour[p] > v0 && toDeath(S) && e.alignment === "Merrow" && ebb > 0 && C.valour[1 - p] > 0 && !(ebbOnce && C.ebbed?.[1 - p])) {
    if (ebbOnce) { const eb = [C.ebbed?.[0] ?? 0, C.ebbed?.[1] ?? 0]; eb[1 - p] = 1; C.ebbed = eb; }
    C.shield[1 - p] += ebb;
    led(S, C, 1 - p, "shield:people:ebb", ebb);
    if (NARRATE.lines) say(`${e.name} rises with the tide: Shield +${ebb}.`);
  }
  if (C.bleed?.[p]) led(S, C, 1 - p, "deny:people:bleed", Math.min(C.bleed[p], Math.max(0, n + C.bleed[p])));
  if (NARRATE.lines) {
    const bits: string[] = [];
    if (h.ab.healBonus) bits.push(`${sgn(h.ab.healBonus)} ${h.name}'s quality`);
    const oh = activeOath(S, C, p)?.boon.heal; if (oh) bits.push(`${sgn(oh)} ${activeOath(S, C, p)!.name}`);
    for (const x of namedHeroFx(S, C, p)) if (x.fx.heal) bits.push(`${sgn(x.fx.heal)} ${x.name}`);
    for (const x of namedBoardFx(S)) if (x.fx.healMod) bits.push(`${sgn(x.fx.healMod)} ${x.name}`);
    if (e.ab.foeHealMalus) bits.push(`−${e.ab.foeHealMalus} ${e.name}'s quality`);
    if (C.bleed?.[p]) bits.push(`−${C.bleed[p]} bleeding`);
    const capped = n > 0 && C.valour[p] - v0 < n;
    say(`${h.name} heals: ${n1}${bits.length ? " " + bits.join(" ") + ` = ${Math.max(0, n)}` : ""}${n <= 0 ? ", so nothing" : ""}${capped ? ` (capped: no more than ${Math.max(cap, v0)})` : ""}. Valour ${v0} → ${C.valour[p]}.`);
  }
}

/** Duels to the death: extra Valour at the ford, no heal cap, and what a rest gives. */
export const FORD_VALOUR = 3;
function withSpirit<T>(on: boolean, f: () => T): T { const was = SPIRIT_BLOW.on; SPIRIT_BLOW.on = on; try { return f(); } finally { SPIRIT_BLOW.on = was; } }
/** Resistance to Spirit blows, by people: the otherworldly take 2 off, flowing water 1. */
export const spiritResist = (al: string) => (al === "Sidhe" ? 2 : al === "Merrow" ? 1 : 0);
/** ...as the rules have it (people.sidhe.spiritResist, people.merrow.spiritResist). */
export const spiritResistOf = (S: State, al: string) => (al === "Sidhe" ? param(S.rules, "people.sidhe.spiritResist") : al === "Merrow" ? param(S.rules, "people.merrow.spiritResist") : 0);
/** Merrow's standing powers (rules.merrow): "water", a blow that ignores Shield still meets a Merrow's Block.
 *  ("tide", a Water blow that wounds a Merrow heals it 1, was tried and left out: it overshot against the Fomóire.) */
export const MERROW_DEFAULT = "water";
/** Dream-walking: what the Slúagh heal when their enemy rests. */
export const DREAMS = 1;
const NO_CAP = 1000;
export const REST_SHIELD = 1;
/** Valour lost at the end of each turn of a long duel: 1 after the 20th turn, 2 after the 40th. */
export const weariness = (turn: number): number => (turn >= 40 ? 2 : turn >= 20 ? 1 : 0);
/** Set while a rest is resolving, so the turn's end keeps the side's rested count. */
const RESTED_NOW = { on: false };
export const HALF = { up: true };
/** A riposte being struck (so it is not itself answered by one). */
const RIPOSTE = { on: false };
/** The card or power whose effect is resolving now (for the ledger). */
const SRC = { id: "other" };
/** Set while a Spirit support's blow lands (Spirit isn't one of the four elements, so strike()'s el can't say). */
const SPIRIT_BLOW = { on: false };
/** The dead-flesh aura (the Slúagh, duels to the death): no blow wounds them for more than half their full Valour
 *  (all the host's monsters together, as printed; rounded down). Hacking at dead flesh does them little harm. Infinity when it doesn't apply. */
export function auraCap(S: State, C: CombatState, b: Side): number {
  if (!toDeath(S) || !param(S.rules, "people.sluagh.aura") || fighter(S, C, b).alignment !== "Sluagh") return Infinity;
  // the host's full Valour in a duel: all its monsters together, as printed, and the ford's Valour
  const full = fighter(S, C, b).valour + S.rules.valourBonus + param(S.rules, "duel.fordValour");
  const half = full * param(S.rules, "people.sluagh.auraFrac");
  return Math.max(param(S.rules, "people.sluagh.auraMin"), param(S.rules, "people.sluagh.auraRoundUp") ? Math.ceil(half) : Math.floor(half));
}
/** Set while a support used with the Hound's cry resolves. */
const CRY = { on: false };
/** The Hound's cry (Ulster, duels to the death): once a duel, when an Ulster hero uses a support that ignores Shield
 *  against giant-kin, it may spend the top card of its Reserve (to the discard) so the blow lands in full. */
export function canCry(S: State, C: CombatState, a: Side, s: SupportDef, as?: Element): boolean {
  if (!toDeath(S) || !param(S.rules, "people.ulster.cry") || C.cried?.[a] || drawable(S, a) <= 0) return false;
  const h = fighter(S, C, a), e = fighter(S, C, (1 - a) as Side);
  if (h.alignment !== "Ulaid" || !giantKin(S, e)) return false;
  const es = effSupport(S, a, s);
  if (!es.pierce || !es.effects.some((x) => x.type === "strike")) return false;
  return !effWeakness(S, (1 - a) as Side, e, C).includes((as ?? es.element) as Element); // its weakness lands in full anyway
}
/** Give the Hound's cry: spend the top card of the Reserve, once this duel. */
function giveCry(S: State, C: CombatState, a: Side) {
  const cr = [C.cried?.[0] ?? 0, C.cried?.[1] ?? 0]; cr[a] = 1; C.cried = cr;
  if (C === S.combat) { const c = takeTop(S, a); if (c) S.players[a].discard.push(c); }
  led(S, C, a, "n:cry", 1);
  if (NARRATE.lines) say(`${fighter(S, C, a).name} gives the Hound's cry: the top card of the Reserve is spent.`);
}
/** Credit v to key for side p in the match's ledger (the real match only). */
function led(S: State, C: CombatState, p: Side | number, key: string, v: number) {
  if (!v || !S.stats || C !== S.combat) return;
  const L = (S.stats.ledger ??= {});
  (L[key] ??= [0, 0])[p] += v;
}
/** The Aos Sídhe's mound: like Armour, it takes MOUND_AC off every blow against an Aos Sídhe fighter (even one that
 *  ignores Shield and Armour), until it has soaked MOUND_VALOUR in all, over the whole match. */
export const MOUND_AC = 1;
export const MOUND_VALOUR = 5;
/** Connacht's blows bleed (duels to the death): every one that wounds makes the enemy's Heals 1 less until the end of
 *  its next turn, and it stacks. */
export const bleeds = (S: State, h: FighterDef) => toDeath(S) && h.alignment === "Connachta" && param(S.rules, "people.connacht.bleed") > 0;
/** Side p fights from a mound: in a duel to the death, with Aos Sídhe heroes in its deck. */
export function hasMound(S: State, p: Side): boolean {
  return toDeath(S) && S.players[p].deckList.some((d) => d.type === "hero" && d.alignment === "Sidhe");
}
/** Side p's mound can still soak. */
export const moundUp = (C: CombatState, p: Side) => (C.mound?.[p] ?? 0) > 0;
/** Set while a placed support is being used again: a Spirit blow steals only the first time a card is used. */
const REUSING = { on: false };
/** The sea is no road for the dead: a Merrow's Water Strike against a Slúagh host is 1 more. */
function seaVsDead(h: CardDef, e: CardDef, s: SupportDef, t: string) {
  return t === "strike" && s.element === "Water" && h.type === "hero" && h.alignment === "Merrow" && e.type === "hero" && !!e.host;
}

/** `pierce`: ignores Shield, Armour and Blocks; `spirit`: a Spirit blow, which passes Shield but not Armour or Blocks. */
/** The Fomóire are giant-kin: in a duel to the death, half the wounds of any blow but one of their weaknesses. */
export const giantKin = (S: State, f: FighterDef) => toDeath(S) && f.alignment === "Fomoire" && param(S.rules, "people.fomoire.giantKin") > 0;
export function strike(S: State, C: CombatState, a: Side, n: number, pierce = false, drain = 0, spirit = false, el: Element | null = null): number {
  const b = (1 - a) as Side;
  const h = fighter(S, C, a);
  const e = fighter(S, C, b);
  const ab = h.ab;
  const N = NARRATE.lines ? [] as string[] : null;
  const n1 = n;
  // the trace of this blow (a riposte or a follow-up blow starts its own, from what it was given)
  const T: Partial<BlowRow> | null = TRACE.on && C === S.combat && S.stats ? (TRACE.cur ?? { printed: n, base: 0 }) : null;
  TRACE.cur = null;
  if (N) {
    if (ab.strikeAll) N.push(`${sgn(ab.strikeAll)} ${h.name}'s quality`);
    if (ab.rally && C.valour[a] <= ab.rally.at) N.push(`${sgn(ab.rally.n)} ${h.name} at ${ab.rally.at} Valour`);
    if (ab.avenger && C.duel === 1 && C.felled[0][a]) N.push(`${sgn(ab.avenger)} ${h.name} avenging`);
    if (ab.firstStrike && !C.hit[a]) N.push(`${sgn(ab.firstStrike)} first Strike this duel`);
    if (param(S.rules, "people.sidhe.veil") && h.alignment === "Sidhe" && !C.hit[a]) N.push(`−${param(S.rules, "people.sidhe.veil")} the veil (an Aos Sídhe's own first Strike)`);
    if (ab.vsBig && e.valour >= 5) N.push(`${sgn(ab.vsBig)} against a big hero`);
    if (ab.vsTag && e.tag === ab.vsTag.tag) N.push(`${sgn(ab.vsTag.n)} ${h.name} against the ${e.tag}`);
    const oath = activeOath(S, C, a); if (oath?.boon.strike) N.push(`${sgn(oath.boon.strike)} ${oath.name}`);
    for (const x of namedHeroFx(S, C, a)) {
      if (x.fx.strikeDuel && x.fx.strikeDuel.duel === C.duel) N.push(`${sgn(x.fx.strikeDuel.n)} ${x.name}`);
      if (x.fx.strikeMod) N.push(`${sgn(x.fx.strikeMod)} ${x.name}`);
    }
    if (C.nextStrike[a]) N.push(`${sgn(C.nextStrike[a])} carried over to this Strike`);
    for (const x of namedBoardFx(S)) if (x.fx.debility && debilitated(h, x.fx.debility)) N.push(`−1 ${x.name}`);
  }
  n += ab.strikeAll ?? 0;
  if (ab.rally && C.valour[a] <= ab.rally.at) n += ab.rally.n;
  if (ab.avenger && C.duel === 1 && C.felled[0][a]) n += ab.avenger;
  if (ab.firstStrike && !C.hit[a]) n += ab.firstStrike;
  const ul = toDeath(S) && h.alignment === "Ulaid";
  const lt = ul ? param(S.rules, "people.ulster.light") : 0, fury = ul ? param(S.rules, "people.ulster.fury") : 0;
  if (lt && !C.hit[a] && !RIPOSTE.on) { n += lt; if (N) N.push(`+${lt} the hero's light (first Strike this duel)`); }
  if (fury && C.valour[a] * 2 <= (C.startV[C.duel]?.[a] ?? 0)) { n += fury; if (N) N.push(`+${fury} battle-fury (at half Valour)`); }
  // ...and the veil cuts both ways: their own first Strike each duel −1
  if (h.alignment === "Sidhe" && !C.hit[a]) n -= param(S.rules, "people.sidhe.veil");
  if (ab.vsBig && e.valour >= 5) n += ab.vsBig;
  if (ab.vsTag && e.tag === ab.vsTag.tag) n += ab.vsTag.n;
  n += activeOath(S, C, a)?.boon.strike ?? 0;
  for (const fx of heroFx(S, C, a)) {
    if (fx.strikeDuel && fx.strikeDuel.duel === C.duel) n += fx.strikeDuel.n;
    if (fx.strikeMod) n += fx.strikeMod;
  }
  n += C.nextStrike[a];
  C.nextStrike[a] = 0;
  C.hit[a] = true;
  for (const fx of boardFx(S)) if (fx.debility && debilitated(h, fx.debility)) n -= 1;
  const nAtk = n;
  n = Math.max(0, n);
  const nFloor = n;
  for (const fx of boardFx(S)) if (fx.truce !== undefined) n = Math.min(n, fx.truce);
  if (e.ab.capTaken !== undefined) n = Math.min(n, e.ab.capTaken);
  const n0 = n;
  if (T) { T.atk = nAtk - n1; T.floor = nFloor - nAtk; T.cap = n0 - nFloor; }
  // an Ulster blow that, before anything takes off it, is more than half the enemy's starting Valour staggers it
  const staggers = toDeath(S) && h.alignment === "Ulaid" && param(S.rules, "people.ulster.stagger") > 0 && n * 2 > (C.startV[C.duel]?.[b] ?? 99);
  if (N) {
    for (const x of namedBoardFx(S)) if (x.fx.truce !== undefined) N.push(`(${x.name}: no Strike above ${x.fx.truce})`);
    if (e.ab.capTaken !== undefined) N.push(`(${e.name}: no Strike against him above ${e.ab.capTaken})`);
    if (!C.struck[b]) {
      if (e.ab.firstHitSoak) N.push(`−${e.ab.firstHitSoak} ${e.name}'s quality (first Strike against it)`);
      if (param(S.rules, "people.sidhe.veil") && e.alignment === "Sidhe") N.push(`−${param(S.rules, "people.sidhe.veil")} the veil (first Strike against an Aos Sídhe)`);
      for (const x of namedHeroFx(S, C, b)) if (x.fx.firstHitSoak) N.push(`−${x.fx.firstHitSoak} ${x.name} (first Strike against it)`);
    }
  }
  if (!C.struck[b]) {
    C.struck[b] = true;
    // the Aos Sídhe are veiled: the first Strike against them each duel −1 (positions saved before this rule leave it out)
    const veil = e.alignment === "Sidhe" ? param(S.rules, "people.sidhe.veil") : 0;
    // in a duel to the death no ward softens the first blow by more than 2 (a cloak that makes it miss outright
    // would be worth a whole hero in a long fight)
    const ward = (e.ab.firstHitSoak ?? 0) + veil + sumFx(heroFx(S, C, b), (x) => x.firstHitSoak);
    const nw = Math.max(0, n - (toDeath(S) ? Math.min(2, ward) : ward));
    const wv = Math.min(veil, n - nw);
    led(S, C, b, "save:people:veil", wv);
    led(S, C, b, "save:ward:" + e.id, n - nw - wv);
    if (T) T.ward = n - nw;
    n = nw;
  }
  // a Block meets this blow (once)
  const blk = !pierce || (toDeath(S) && e.alignment === "Merrow" && param(S.rules, "people.merrow.waterUnpierced") > 0) ? C.block?.[b] ?? 0 : 0;
  if (C.block?.[b]) { C.block = [C.block[0], C.block[1]]; C.block[b] = 0; }
  if (T) T.block = blk && n > 0 ? Math.min(blk, n) : 0;
  if (blk && n > 0) { if (N) N.push(`−${Math.min(blk, n)} blocked`); led(S, C, b, "save:" + (S.stats?.blockSrc?.[b] || "block"), Math.min(blk, n)); n = Math.max(0, n - blk); }
  // Armour takes its share off every blow (what ignores Shield ignores it too)
  const arm = toDeath(S) && !pierce ? C.armour?.[b] ?? 0 : 0;
  // resistance to Spirit: the otherworldly (Aos Sídhe) take 2 off a Spirit blow, flowing water (Merrow) 1
  const sr = SPIRIT_BLOW.on && toDeath(S) ? spiritResistOf(S, e.alignment) : 0;
  if (T) T.resist = sr && n > 0 ? Math.min(sr, n) : 0;
  if (sr && n > 0) { if (N) N.push(`−${Math.min(sr, n)} ${e.alignment === "Sidhe" ? "otherworldly" : "flowing water"} (Spirit)`); led(S, C, b, `save:people:resist-${e.alignment}`, Math.min(sr, n)); n = Math.max(0, n - sr); }
  if (T) T.armour = arm && n > 0 ? Math.min(arm, n) : 0;
  if (arm && n > 0) { if (N) N.push(`−${Math.min(arm, n)} ${e.name}'s Armour`); led(S, C, b, "save:" + (S.stats?.armourSrc?.[b] || "armour"), Math.min(arm, n)); n = Math.max(0, n - arm); }
  // the mound shelters the Aos Sídhe, like Armour, until it has soaked all it can
  if (n > 0 && e.alignment === "Sidhe" && moundUp(C, b)) {
    const t = Math.min(param(S.rules, "people.sidhe.moundAC"), n, C.mound![b]);
    const m = C.mound!.slice(); m[b] -= t; C.mound = m;
    n -= t;
    led(S, C, b, "save:people:mound", t);
    if (T) T.mound = t;
    if (N) N.push(`−${t} the mound (${m[b]} left to soak${m[b] === 0 ? ": spent" : ""})`);
  }
  const soak = pierce || spirit ? 0 : Math.min(C.shield[b], n);
  C.shield[b] -= soak;
  let dmg = n - soak;
  if (T) T.shield = soak;
  // giant-kin: half the wounds (rounded up) unless the blow is of a weakness
  let halved = dmg > 0 && giantKin(S, e) && !(el && effWeakness(S, b, e, C).includes(el));
  // the Hound's cry: an Ulster blow that ignores Shield, given with the cry, goes through the giant's hide
  if (halved && CRY.on && pierce && h.alignment === "Ulaid") {
    halved = false;
    const h2 = HALF.up ? Math.ceil(dmg / 2) : Math.floor(dmg / 2);
    led(S, C, a, "deal:people:cry", dmg - h2); led(S, C, a, "deal:" + SRC.id, -(dmg - h2));
    if (N) N.push(`through the giant's hide (the Hound's cry)`);
  }
  if (halved) { const h2 = HALF.up ? Math.ceil(dmg / 2) : Math.floor(dmg / 2); led(S, C, b, "save:people:giant-kin", dmg - h2); if (T) T.halved = dmg - h2; dmg = h2; }
  // the dead-flesh aura: no blow wounds the Slúagh for more than half their full Valour
  const ac = auraCap(S, C, b);
  if (dmg > ac) { if (T) T.aura = dmg - ac; led(S, C, b, "save:people:aura", dmg - ac); if (N) N.push(`held to ${ac} by the dead-flesh aura`); dmg = ac; }
  // staggered: every blow that wounds it lands 1 more
  if (dmg > 0 && C.stagger?.[b]) { const k = param(S.rules, "people.ulster.stagger") || 1; dmg += k; if (T) T.stagger = k; led(S, C, a, "deal:people:stagger", k); }
  if (T) {
    const z = (k: keyof BlowRow) => ((T as Record<string, number>)[k] ?? 0);
    const row = { side: a, duel: C.duel, src: SRC.id || "?", el: SPIRIT_BLOW.on ? "Spirit" : el, spirit: spirit ? 1 : 0, pierce: pierce ? 1 : 0 } as BlowRow;
    for (const k of ["printed", "base", "kin", "focus", "watch", "wheel", "weak", "fx", "setting", "extra", "atk", "floor", "cap", "ward", "block", "resist", "armour", "mound", "shield", "halved", "aura", "stagger"] as const) (row as unknown as Record<string, number>)[k] = z(k);
    row.final = dmg;
    (S.stats!.blows ??= []).push(row);
  }
  const wasUp = C.valour[b] > 0;
  const newly = staggers && !C.stagger?.[b];
  if (staggers) { const st = [C.stagger?.[0] ?? 0, C.stagger?.[1] ?? 0]; st[b] = 1; C.stagger = st; }
  C.valour[b] -= dmg;
  led(S, C, b, "save:shield", soak);
  // a Spirit blow passes Shield: what the Shield would have soaked is the Spirit's own worth
  const passed = spirit && !pierce ? Math.min(C.shield[b], dmg) : 0;
  led(S, C, a, "deal:people:spirit", passed);
  led(S, C, a, "deal:" + SRC.id, dmg - passed);
  // Connacht's blows bleed: each that wounds makes the enemy's Heals 1 less until the end of its next turn
  if (dmg > 0 && bleeds(S, h)) { const bl = [C.bleed?.[0] ?? 0, C.bleed?.[1] ?? 0]; bl[b] = Math.min(param(S.rules, "people.connacht.bleedCap"), bl[b] + 1); C.bleed = bl; }
  // what a blow steals back: never more than 1 a Strike
  const dr = Math.min(1, (ab.drain ?? 0) + drain);
    if (dmg > 0 && dr > 0 && C.valour[a] > 0) heal(S, C, a, dr);
  // the uninvited guest: wound it and pay for it
  // where the wounds come from, by element, and how many land on a weakness (for the ledger only)
  if (dmg > 0) { led(S, C, a, "el:" + (SPIRIT_BLOW.on ? "Spirit" : el ?? "none"), dmg); if (el && effWeakness(S, b, e, C).includes(el)) led(S, C, a, "weak:" + el, dmg); }
  // trial: born of the tide: a Water blow that wounds a Merrow gives some of it back
  const tide = toDeath(S) && e.alignment === "Merrow" && el === "Water" && dmg > 0 && C.valour[b] > 0
    ? (param(S.rules, "people.merrow.tideHalf") ? Math.ceil(dmg / 2) : param(S.rules, "people.merrow.tide")) : 0;
  if (tide) {
    const k = tide;
    if (NARRATE.lines) say(`${e.name} drinks the tide.`);
    const src = SRC.id; SRC.id = "people:tide";
    try { heal(S, C, b, Math.min(k, dmg)); } finally { SRC.id = src; }
  }
  if (dmg > 0 && e.ab.reflect) { C.valour[a] -= e.ab.reflect; led(S, C, b, "deal:hero:" + e.id, e.ab.reflect); }
  if (N) {
    const shown = N.length ? `${n1} ${N.join(" ")} = ${n}` : `${n1}`;
    const sh = pierce ? " It ignores Shield." : spirit && C.shield[b] ? " Spirit passes Shield." : soak ? ` ${e.name}'s Shield soaks ${soak}.` : "";
    if (newly) N.push(`(${e.name} is staggered: each blow that wounds +1 until it rests)`);
    say(`${h.name} strikes: ${shown}.${sh}${halved ? ` ${e.name} is giant-kin: half the wounds.` : ""} ${dmg} wound${dmg === 1 ? "" : "s"}: ${e.name} ${C.valour[b] + dmg} → ${C.valour[b]}.${dr > 0 && dmg > 0 ? ` (It steals back ${dr}.)` : ""}${dmg > 0 && e.ab.reflect ? ` ${e.name}'s quality makes ${h.name} pay ${e.ab.reflect}.` : ""}${dmg > 0 && bleeds(S, h) ? ` ${e.name} bleeds: Heals −${C.bleed![b]} until the end of its next turn.` : ""}`);
  }
  // an Ulster hero's last stand: felled, it strikes once more
  if (wasUp && C.valour[b] <= 0 && toDeath(S) && e.alignment === "Ulaid" && param(S.rules, "people.ulster.stand") > 0 && !RIPOSTE.on && C.valour[a] > 0) {
    if (NARRATE.lines) say(`${e.name} makes a last stand.`);
    RIPOSTE.on = true;
    const src = SRC.id; SRC.id = "power:last-stand";
    try { strike(S, C, b, param(S.rules, "people.ulster.stand")); } finally { RIPOSTE.on = false; SRC.id = src; }
  }
  // a Connacht riposte: when its Shield takes a blow, a free Strike back (not answered by another riposte)
  if (soak > 0 && toDeath(S) && e.ab.riposte && !RIPOSTE.on && C.valour[b] > 0 && C.valour[a] > 0) {
    if (NARRATE.lines) say(`${e.name} ripostes off the Shield.`);
    if (S.stats && C === S.combat) S.stats.fx.ripostes[b]++;
    RIPOSTE.on = true;
    const src = SRC.id; SRC.id = "power:riposte";
    try { strike(S, C, b, e.ab.riposte); } finally { RIPOSTE.on = false; SRC.id = src; }
  }
  const F = S.stats?.fx;
  if (F && C === S.combat) { F.strikes[a]++; F.dmg[a] += dmg; F.soaked[a] += soak; F.blunted[a] += n0 - n; }
  return dmg;
}

/** The support's own base numbers (special cards). */
export function baseEffects(s: SupportDef, h: FighterDef, e: FighterDef, firstSupport: boolean) {
  if (!s.forHero && !s.vsHero && !s.firstBonus && !s.vsBig) return s.effects;
  const effs = s.effects.map((x) => ({ ...x }));
  if (s.forHero && h.id === s.forHero.id) effs[0].n = s.forHero.n;
  if (s.vsHero && e.id === s.vsHero.id) effs[0].n = s.vsHero.n;
  if (s.firstBonus && firstSupport) effs[0].n += s.firstBonus;
  if (s.vsBig && e.valour >= 5) effs[0].n += s.vsBig;
  return effs;
}
/** The Samhain watch: the Ulaid kept watch against the host of the dead. */
export const SAMHAIN_WATCH = 1;
/** +1 bonuses for the primary effect (step 4) and Reinforcement (step 5, the omen). */
export function primaryBonus(S: State, C: CombatState, a: Side, s: SupportDef, isStrike: boolean): number {
  const b = (1 - a) as Side;
  const h = fighter(S, C, a);
  const e = fighter(S, C, b);
  let n = 0;
  const N = NARRATE.lines;
  // the blow being traced (the real match only)
  const T = TRACE.cur && C === S.combat && isStrike ? TRACE.cur : null;
  const part = (k: keyof BlowRow, v: number) => { if (T) (T as Record<string, number>)[k] = ((T as Record<string, number>)[k] ?? 0) + v; };
  if (kin(s.alignment, h.alignment)) { n += h.ab.kinBonus ?? 1; part("kin", h.ab.kinBonus ?? 1); if (N) N.push(`${sgn(h.ab.kinBonus ?? 1)} kinship (${s.alignment} card, ${h.alignment} hero)`); }
  const f = focusOf(C, a, h);
  if (h.ab.focusAny || (f && (f === s.element || f === s.kind || (s.spiritAs && f === "Spirit")))) { n += 1; part("focus", 1); if (N) N.push(`+1 Focus (${h.name}'s Focus is ${h.ab.focusAny ? "every support" : f})`); }
  const watch = toDeath(S) ? param(S.rules, "people.ulster.samhainWatch") : 0;
  if (isStrike && watch && h.alignment === "Ulaid" && focusOf(C, b, e) === "Spirit") {
    n += watch; part("watch", watch); if (N) N.push(`${sgn(watch)} the Samhain watch (${e.name}'s Focus is Spirit)`);
  }
  if (isStrike && s.element) {
    const ef = focusOf(C, b, e);
    if (isElement(ef) && beats(s.element, ef)) { n += 1; part("wheel", 1); if (N) N.push(`+1 the wheel (${s.element} beats ${e.name}'s Focus, ${ef})`); }
    if (isElement(s.element) && effWeakness(S, b, e, C).includes(s.element)) {
      if (giantKin(S, e)) { if (N) N.push(`(${e.name} is weak to ${s.element}: the blow lands in full)`); }
      else { n += 1; part("weak", 1); if (N) N.push(`+1 weakness (${e.name} is weak to ${s.element})`); }
    }
  }
  for (const x of N ? namedHeroFx(S, C, a) : heroFx(S, C, a).map((fx) => ({ name: "", fx }))) {
    const fx = x.fx;
    if (fx.element && s.element === fx.element.el) { n += fx.element.n; part("fx", fx.element.n); if (N) N.push(`${sgn(fx.element.n)} ${x.name}`); }
    if (fx.kind && s.kind === fx.kind.kind) { n += fx.kind.n; part("fx", fx.kind.n); if (N) N.push(`${sgn(fx.kind.n)} ${x.name}`); }
  }
  return n;
}

/**
 * Support s as side a's fighter sees it, through every attendant in play (in the order they were called): its element
 * may change, and a Channel adds to its primary Strike and costs the user Valour.
 */
export function effSupport(S: State, a: Side, s: SupportDef): SupportDef {
  const list = S.attendants;
  if (!list || !list.length) return s;
  let el = s.element;
  let kind = s.kind;
  let ch = 0;
  let own = false;
  for (const c of list) {
    const d = c.def;
    if (d.type !== "attendant") continue;
    if (d.scope !== "global" && (d.scope === "yours") !== (c.owner === a)) continue;
    if (d.mode === "curse") continue;
    const hit = d.mode === "reforge" || d.mode === "enchant" ? kind === d.kind : el === d.from;
    if (!hit) continue;
    if (d.mode === "reforge") kind = d.toKind ?? kind;
    else el = d.to ?? el;
    if (d.mode === "channel") ch++;
    if (c.owner === a) own = true;
  }
  if (el === s.element && kind === s.kind && !ch) return s;
  return { ...s, element: el, kind, ...(own ? { attuned: 1 } : {}), ...(ch ? { channel: ch, selfLoss: (s.selfLoss ?? 0) + ch } : {}) };
}
/** Side p's fighter's weaknesses: its printed one, plus one for each Curse attendant in reach and each unbroken geis
 * binding it that lays a weakness. */
export function effWeakness(S: State, p: Side, f: FighterDef, C: CombatState | null = S.combat ?? null): Element[] {
  const w: Element[] = f.weaknesses ? f.weaknesses.slice() : f.weakness ? [f.weakness] : [];
  if (C && C.hs && !ignoresGeis(S, p)) {
    const q = quadOf(C.hs[p]);
    const g = S.quadGeis[q];
    if (g && g.def.type === "geis" && g.def.weak && !(C.broken & (1 << q)) && !w.includes(g.def.weak)) w.push(g.def.weak);
    S.globalGeis.forEach((x, i) => { if (x.def.type === "geis" && x.def.weak && !(C.broken & globalBit(i, q)) && !w.includes(x.def.weak)) w.push(x.def.weak); });
  }
  for (const c of S.attendants ?? []) {
    const d = c.def;
    if (d.type !== "attendant" || d.mode !== "curse") continue;
    if (d.scope !== "global" && (d.scope === "yours") !== (c.owner === p)) continue;
    if (d.to && !w.includes(d.to)) w.push(d.to);
  }
  return w;
}

/**
 * A Slúagh host with hybrid monsters chooses how each Spirit blow lands: as Spirit (through Shield, stealing 1) or as
 * one of its hybrid elements (the element wheel and weaknesses count, Shield soaks it, nothing is stolen). Either
 * way it is still the host's own blow, so its Spirit Focus counts.
 */
export function asHybrid(s: SupportDef, as?: Element): SupportDef {
  return as && s.element === "Spirit" ? { ...s, element: as, spiritAs: true } : s;
}
function resolveSupport(S: State, C: CombatState, a: Side, s0: SupportDef, firstSupport: boolean, stats: MatchStats | null, as?: Element) {
  const s = asHybrid(effSupport(S, a, s0), as);
  const b = (1 - a) as Side;
  if (stats) {
    const h0 = fighter(S, C, a), e0 = fighter(S, C, b), F = stats.fx;
    if (kin(s.alignment, h0.alignment)) F.kinHits[a]++;
    const f0 = focusOf(C, a, h0);
    if (h0.ab.focusAny || (f0 && (f0 === s.element || f0 === s.kind || (s.spiritAs && f0 === "Spirit")))) F.focusHits[a]++;
    if (s.effects[0]?.type === "strike" && s.element) {
      const ef = focusOf(C, b, e0);
      if (isElement(ef) && beats(s.element, ef)) F.beatsHits[a]++;
      if (isElement(s.element) && effWeakness(S, b, e0, C).includes(s.element)) F.weakHits[a]++;
    }
  }
  const h = fighter(S, C, a);
  const e = fighter(S, C, b);
  const effs = baseEffects(s, h, e, firstSupport);
  // Charm: take the enemy's Shield for your own before the blow lands
  if (s.stealShield) { const t = Math.min(s.stealShield, C.shield[b]); C.shield[b] -= t; C.shield[a] += t; }
  for (let i = 0; i < effs.length; i++) {
    const eff = effs[i];
    if (NARRATE.lines && i === 0) {
      const raw = s.effects[0].n;
      say(`${s0.name}${s !== s0 && s.element !== s0.element ? ` (counting as ${s.element})` : ""}: ${eff.type === "strike" ? "Strike" : eff.type === "heal" ? "Heal" : "Shield"} ${raw}${eff.n !== raw ? `, ${eff.n} here` : ""}.`);
    }
    if (TRACE.on && C === S.combat && eff.type === "strike") TRACE.cur = { printed: s.effects[i]?.n ?? eff.n, base: eff.n - (s.effects[i]?.n ?? eff.n) };
    const setB = i === 0 && toDeath(S) ? settingMod(settingOf(S.rules), s) : 0;
    const extra = i === 0 ? (s.attuned ?? 0) + (eff.type === "strike" ? s.channel ?? 0 : 0) + (seaVsDead(h, e, s, eff.type) ? 1 : 0) : 0;
    const n = eff.n + (i === 0 ? primaryBonus(S, C, a, s, eff.type === "strike") + setB + extra : 0);
    if (TRACE.cur && C === S.combat && eff.type === "strike") { TRACE.cur.setting = setB; TRACE.cur.extra = extra; }
    if (NARRATE.lines && i === 0) {
      if (s.attuned) say(`+${s.attuned} attuned by an attendant`);
      if (eff.type === "strike" && s.channel) say(`+${s.channel} channelled by an attendant`);
      if (seaVsDead(h, e, s, eff.type)) say("+1 running water (a Merrow's Water against the dead)");
      say(`= ${n}.`);
    }
    // Spirit (anam): ignores Shield and steals 1 when it wounds; but the dead cannot cross running water, so a
    // Merrow's Shield holds against it
    if (eff.type === "strike") {
      const hit = () => withSpirit(s.element === "Spirit", () => strike(S, C, a, n, !!s.pierce, (s.drain ?? 0) + (s.element === "Spirit" && !REUSING.on ? 1 : 0), s.element === "Spirit" && e.alignment !== "Merrow", isElement(s.element) ? s.element : null));
      const dmg = hit();
      // a swift Connacht hero: a blow that wounds for 1 or less is followed at once by a second
      if (i === 0 && dmg <= 1 && toDeath(S) && h.ab.followUp && C.valour[b] > 0 && C.valour[a] > 0) {
        if (NARRATE.lines) say(`${h.name} is swift: a second blow.`);
        if (S.stats && C === S.combat) S.stats.fx.swift[a]++;
        const src = SRC.id; SRC.id = "power:swift";
        try { hit(); } finally { SRC.id = src; }
      }
    }
    else if (eff.type === "heal") {
      const rb = toDeath(S) ? C.rested?.[a] ?? 0 : 0;
      if (rb && NARRATE.lines) say(`+${rb} rested.`);
      // measurement only: what a heal is made of (printed, kinship, Focus, rested, the hero's own bonus, the rest)
      if (S.stats && C === S.combat) {
        const kb = i === 0 && kin(s.alignment, h.alignment) ? h.ab.kinBonus ?? 1 : 0;
        const f0 = focusOf(C, a, h);
        const fb = i === 0 && (h.ab.focusAny || (f0 && (f0 === s.element || f0 === s.kind))) ? 1 : 0;
        led(S, C, a, "hb:printed", eff.n); led(S, C, a, "hb:kinship", kb); led(S, C, a, "hb:focus", fb); led(S, C, a, "hb:rested", rb);
        led(S, C, a, "hb:hero", h.ab.healBonus ?? 0); led(S, C, a, "hb:other", n - eff.n - kb - fb);
        led(S, C, a, "hb:bled", -(C.bleed?.[a] ?? 0)); led(S, C, a, "hb:count", 1);
      }
      heal(S, C, a, n + rb);
    } else {
      const rb = toDeath(S) ? C.rested?.[a] ?? 0 : 0;
      if (rb && NARRATE.lines) say(`+${rb} rested.`);
      const add = Math.max(0, n + rb + sumFx(boardFx(S), (x) => x.shieldMod) + sumFx(heroFx(S, C, a), (x) => x.shield));
      if (NARRATE.lines) {
        const bits = [...namedBoardFx(S).filter((x) => x.fx.shieldMod).map((x) => `${sgn(x.fx.shieldMod!)} ${x.name}`), ...namedHeroFx(S, C, a).filter((x) => x.fx.shield).map((x) => `${sgn(x.fx.shield!)} ${x.name}`)];
        say(`${h.name} raises Shield: ${n}${bits.length ? " " + bits.join(" ") + ` = ${add}` : ""}. Shield ${C.shield[a]} → ${C.shield[a] + add}.`);
      }
      C.shield[a] += add;
      led(S, C, a, "shield:" + SRC.id, add);
    }
  }
  if (s.armour && toDeath(S)) {
    const cur = C.armour?.[a] ?? 0;
    if (s.armour > cur) {
      C.armour = [C.armour?.[0] ?? 0, C.armour?.[1] ?? 0]; C.armour[a] = s.armour;
      if (S.stats && C === S.combat) S.stats.armourSrc[a] = s0.id;
      if (NARRATE.lines) say(`${h.name} puts on Armour ${s.armour}: every Strike against ${h.name} ${s.armour} less.`);
    }
  }
  if (s.invoke && s.invoke === e.tag) { C.valour[b] -= S.rules.invokeLoss; if (stats) stats.invokes++; led(S, C, a, "deal:" + SRC.id, S.rules.invokeLoss); }
  if (s.nextStrike) C.nextStrike[a] += s.nextStrike;
  // dulling doesn't stack: the enemy's next Strike is never cut by more than one card's worth
  if (s.foeNext) C.nextStrike[b] = Math.max(Math.min(C.nextStrike[b], -s.foeNext), C.nextStrike[b] - s.foeNext);
  if (s.foeLoss) { C.valour[b] -= s.foeLoss; led(S, C, a, "deal:" + SRC.id, s.foeLoss); }
  if (s.selfLoss) { C.valour[a] -= s.selfLoss; led(S, C, a, "cost:" + SRC.id, s.selfLoss); }
  if (s.cathbad) C.cathbad[a] = true;
}

export function combatApply(S: State, C: CombatState, o: Option, stats: MatchStats | null) {
  if (o.t === "block") {
    const b = (1 - actorOf(C)) as Side;
    if (o.spot >= 0) {
      const v = blockValue(S, C, b, o.spot);
      C.block = [C.block?.[0] ?? 0, C.block?.[1] ?? 0]; C.block[b] = v;
      if (S.stats && C === S.combat) S.stats.blockSrc[b] = S.board[o.spot]!.def.id;
      C.uses[o.spot]++; C.lastUse[o.spot] = C.acts[b];
      if (NARRATE.lines) say(`${fighter(S, C, b).name} blocks with ${S.board[o.spot]!.def.name}: the blow ${v} less.`);
    }
    const p = C.pending!;
    C.pending = null;
    RESUMING.on = true;
    try { combatApply(S, C, p, stats); } finally { RESUMING.on = false; }
    return;
  }
  // a blow the defender could block: wait for their answer first (a guest's heal happens now, so the paused blow
  // carries nothing from the attacker's hand)
  if (!RESUMING.on && toDeath(S) && C.stage === "turns" && blockable(S, C, actorOf(C), o) && blockSpots(S, C, (1 - actorOf(C)) as Side).length) {
    if (o.t === "duel" && o.guest >= 0) { guestHeals(S, C, actorOf(C), o.guest, stats); o = { ...o, guest: -1 }; }
    C.pending = o;
    return;
  }
  if (o.t === "focus") {
    const p = C.focusTodo[0];
    C.focusTodo = C.focusTodo.slice(1);
    if (o.el) { const f = C.focus.slice(); f[p] = o.el; C.focus = f; }
    if (C.focusTodo.length === 0) C.stage = "turns";
    return;
  }
  if (o.t === "champion") {
    const a = actorOf(C);
    const card = C.champs[a].find((x) => x.uid === o.uid)!;
    const cs = C.champs.slice();
    cs[a] = C.champs[a].filter((x) => x.uid !== o.uid);
    C.champs = cs;
    callChampion(S, C, a, card, stats);
    endTurn(S, C, stats);
    return;
  }
  if (o.t === "draw") {
    const a = actorOf(C);
    C.drawn = takeTop(S, a);
    if (NARRATE.lines && C.drawn) say(`${fighter(S, C, a).name} draws ${C.drawn.def.name}.`);
    return;
  }
  if (o.t === "drawn") {
    const a = actorOf(C);
    const c = C.drawn!;
    C.drawn = null;
    const P = S.players[a];
    if (o.how === "discard") { P.discard.push(c); C.drew = true; return; }
    if (o.how === "keep") {
      P.hand.push(c);
      if (c.def.type === "hero") { const g = C.guests.slice(); g[a] = [...g[a], c]; C.guests = g; }
      if (c.def.type === "champion") { const g = C.champs.slice(); g[a] = [...g[a], c]; C.champs = g; }
      C.drew = true;
      return;
    }
    const d = c.def;
    if (d.type === "support") {
      if (o.cry) giveCry(S, C, a);
      CRY.on = !!o.cry;
      try { useSupport(S, C, a, d, o.mode ?? "normal", o.as, stats); } finally { CRY.on = false; }
      P.discard.push(c);
    } else if (d.type === "champion") callChampion(S, C, a, c, stats);
    else if (d.type === "monster") {
      // a monster off the Reserve joins the host now fighting: its Valour, weakness and quality come with it
      const q = quadOf(C.hs[a]);
      const host = fighter(S, C, a) as HeroDef;
      const cur = adjOf(C, q);
      setAdj(C, q, { add: [...cur.add, d], remove: cur.remove });
      const v = d.valour + host.host!.def.valourEach;
      C.valour[a] += v; C.cap[a] += v;
      led(S, C, a, "heal:people:join", v);
      const sv = C.startV.slice(); sv[C.duel] = sv[C.duel].slice(); sv[C.duel][a] += v; C.startV = sv;
    } else playCardMidDuel(S, C, a, c, o.target, stats);
    endTurn(S, C, stats);
    return;
  }
  if (o.t === "duelCard") {
    const a = actorOf(C);
    const P = S.players[a];
    const slot = P.omens.find((x) => x.card.uid === o.uid);
    const c = slot ? slot.card : removeFrom(P.hand, o.uid);
    playCardMidDuel(S, C, a, c, o.target, stats);
    endTurn(S, C, stats);
    return;
  }
  return combatApplyRest(S, C, o, stats);
}
function callChampion(S: State, C: CombatState, a: Side, card: Card, stats: MatchStats | null) {
  {
    const ch = C.champ.slice();
    ch[a] = card;
    C.champ = ch;
    if (C === S.combat) { const P = S.players[a]; const j = P.hand.findIndex((c) => c.uid === card.uid); if (j >= 0) P.hand.splice(j, 1); }
    const def = card.def as FighterDef;
    const d = C.duel;
    // wounds so far stay counted: the duel's start becomes (Valour already lost) + the champion's Valour
    const sv = C.startV.slice();
    sv[d] = sv[d].slice();
    const cv = def.valour + S.rules.valourBonus + (toDeath(S) ? param(S.rules, "duel.fordValour") : 0);
    sv[d][a] = Math.max(0, C.startV[d][a] - C.valour[a]) + cv;
    C.startV = sv;
    C.valour[a] = cv;
    C.cap[a] = C.valour[a] + (toDeath(S) ? S.rules.deathCapOver ?? NO_CAP : S.rules.capOver);
    C.shield[a] = def.ab.shieldStart ?? 0;
    if (toDeath(S)) { C.armour = [C.armour?.[0] ?? 0, C.armour?.[1] ?? 0]; C.armour[a] = def.ab.armour ?? 0; }
    C.nextStrike[a] = 0; C.struck[a] = false; C.hit[a] = false;
    const f = C.focus.slice(); f[a] = null; C.focus = f;
    if (stats) { stats.champions++; stats.championsBySide[a]++; }
    if (NARRATE.lines) say(`${def.name} stands in.`);
  }
}
function combatApplyRest(S: State, C: CombatState, o: Option, stats: MatchStats | null) {
  if (o.t === "sacrifice" || o.t === "summon") {
    const a = actorOf(C);
    const q = quadOf(C.hs[a]);
    const host = fighter(S, C, a) as HeroDef;
    if (o.t === "sacrifice") {
      // the monster is given up: its Valour comes back to the host, and its weakness and quality leave with it
      const m = host.host!.members.find((x) => x.id === o.id)!;
      const cur = adjOf(C, q);
      setAdj(C, q, cur.add.some((x) => x.id === m.id) ? { add: cur.add.filter((x) => x.id !== m.id), remove: cur.remove } : { add: cur.add, remove: [...cur.remove, m.id] });
      const v = m.valour + host.host!.def.valourEach - (toDeath(S) ? 1 : 0); // in a long duel, a ragged return
      const v0 = C.valour[a];
      C.valour[a] = Math.min(Math.max(C.cap[a], C.valour[a]), C.valour[a] + v);
      led(S, C, a, "heal:people:sacrifice", C.valour[a] - v0);
      const sc = C.sacrificed.slice(); sc[a] = true; C.sacrificed = sc;
    } else {
      // a monster comes over from the other host: its Valour, weakness and quality join this one
      const os = otherHostSpot(S, C, a)!;
      const oq = quadOf(os);
      const other = hostAt(S, C, os);
      const m = other.host!.members.find((x) => x.id === o.id)!;
      const ocur = adjOf(C, oq);
      setAdj(C, oq, ocur.add.some((x) => x.id === m.id) ? { add: ocur.add.filter((x) => x.id !== m.id), remove: ocur.remove } : { add: ocur.add, remove: [...ocur.remove, m.id] });
      const cur = adjOf(C, q);
      setAdj(C, q, { add: [...cur.add, m], remove: cur.remove });
      const v = m.valour + host.host!.def.valourEach;
      C.valour[a] += v; C.cap[a] += v;
      led(S, C, a, "heal:people:summon", v);
      const sv = C.startV.slice(); sv[C.duel] = sv[C.duel].slice(); sv[C.duel][a] += v; C.startV = sv;
      const sm = C.summoned.slice(); sm[a] = true; C.summoned = sm;
      if (summonCosts(S)) {
        if (C === S.combat) { const c = takeTop(S, a); if (c) S.players[a].discard.push(c); }
        led(S, C, a, "n:summonCost", 1);
        if (NARRATE.lines) say(`The summoning spends the top card of the Reserve.`);
      }
    }
    endTurn(S, C, stats);
    return;
  }
  if (o.t !== "duel") throw new Error("bad combat option");
  const a = actorOf(C);
  if (o.guest >= 0) guestHeals(S, C, a, o.guest, stats);
  if (o.act === "use" && toDeath(S) && unwilling(fighter(S, C, a).alignment, (S.board[o.spot]!.def as SupportDef).alignment)) {
    // in a duel to the death an unwilling support is cast out: it goes back to its owner's discards, and the hero
    // draws in its place (and must play or put aside what comes)
    const c = S.board[o.spot]!;
    S.board[o.spot] = null;
    S.players[c.owner].discard.push(c);
    if (o.spot % 3 !== 0 && quadOf(o.spot) !== quadOf(C.hs[a])) C.kingsDue[a] = true;
    if (NARRATE.lines) say(`${c.def.name} will not serve ${fighter(S, C, a).name}: it is cast out.`);
    const top = takeTop(S, a);
    if (top) { C.drawn = top; C.drew = true; if (NARRATE.lines) say(`${fighter(S, C, a).name} draws ${top.def.name}.`); return; }
    endTurn(S, C, stats);
    return;
  }
  if (o.act === "use") {
    const s = S.board[o.spot]!.def as SupportDef;
    const borrowed = quadOf(o.spot) !== quadOf(C.hs[a]);
    C.used |= 1 << o.spot;
    if (borrowed) C.kingsDue[a] = true;
    if (toDeath(S)) {
      // a support used again pays its price
      if (C.uses[o.spot]) {
        const r = reuseOf(s);
        if (r.valour) { C.valour[a] -= r.valour; led(S, C, a, "cost:" + s.id, r.valour); }
        for (let k = 0; k < (r.draw ?? 0); k++) { const c = takeTop(S, a); if (c) S.players[a].discard.push(c); }
        if (NARRATE.lines && (r.valour || r.draw)) say(`Using ${s.name} again costs ${[r.valour ? `${r.valour} Valour` : "", r.draw ? `the top ${r.draw === 1 ? "card" : `${r.draw} cards`} of the Reserve` : ""].filter(Boolean).join(" and ")}.`);
      }
      REUSING.on = C.uses[o.spot] > 0;
      C.uses[o.spot]++; C.lastUse[o.spot] = C.acts[a]; C.restsSince[o.spot] = 0;
    }
    if (o.cry && C.valour[a] > 0) giveCry(S, C, a);
    CRY.on = !!o.cry;
    try { if (C.valour[a] > 0) useSupport(S, C, a, s, o.mode, o.as, stats); } finally { REUSING.on = false; CRY.on = false; }
  } else {
    if (o.mode === "break") {
      const m = restForbidMask(S, C, a);
      C.broken |= keptBroken(S, m);
      const bc = breakCost(S, m, fighter(S, C, a).alignment);
      C.valour[a] -= bc;
      if (stats) stats.fx.broke[a] += bc;
      led(S, C, a, "cost:break", bc);
      if (stats) { stats.oathBroken += bitCount((m >>> 5) & 15); stats.geisBroken += bitCount(m & 31) + bitCount(m >>> 9); }
    } else if (o.mode === "ignore") { C.cathbad[a] = false; if (stats) stats.cathbadIgnores++; }
    const ab = fighter(S, C, a).ab;
    const hid = "hero:" + fighter(S, C, a).id;
    if (C.valour[a] > 0 && ab.restHeal && !crowActive(S, C)) { const src = SRC.id; SRC.id = hid; try { heal(S, C, a, ab.restHeal); } finally { SRC.id = src; } }
    if (C.valour[a] > 0 && ab.restShield) { C.shield[a] += ab.restShield; led(S, C, a, "shield:" + hid, ab.restShield); }
    if (toDeath(S)) {
      for (const hs of heroSpotsOf(a)) for (const sp of [hs + 1, hs + 2]) C.restsSince[sp]++;
      // a rest braces the hero: Shield 1, and the next Shield or Heal is stronger for each rest in a row (up to 2)
      if (C.valour[a] > 0) {
        if (C.stagger?.[a]) { C.stagger = [C.stagger[0], C.stagger[1]]; C.stagger[a] = 0; if (NARRATE.lines) say(`${fighter(S, C, a).name} steadies: no longer staggered.`); }
        C.shield[a] += REST_SHIELD;
        led(S, C, a, "shield:rest", REST_SHIELD);
        const rh = toDeath(S) ? settingOf(S.rules)?.restHeal ?? 0 : 0;
        if (rh && C.valour[a] > 0) { const src = SRC.id; SRC.id = "setting"; try { heal(S, C, a, rh); } finally { SRC.id = src; } }
        const r = C.rested ?? [0, 0];
        C.rested = [r[0], r[1]];
        C.rested[a] = Math.min(2, r[a] + 1);
        if (NARRATE.lines) say(`${fighter(S, C, a).name} rests and braces: Shield ${C.shield[a] - REST_SHIELD} → ${C.shield[a]}; the next Shield or Heal +${C.rested[a]}.`);
        // the Slúagh walk in dreams: when their enemy rests, they feed on its sleep
        const o = (1 - a) as Side;
        const dr = param(S.rules, "people.sluagh.dreams");
        // ...but not at the western crossing, where the dead drain the waking instead
        if (toDeath(S) && dr > 0 && !settingOf(S.rules)?.drain && C.valour[o] > 0 && fighter(S, C, o).alignment === "Sluagh") {
          if (NARRATE.lines) say(`${fighter(S, C, o).name} walks in ${fighter(S, C, a).name}'s dreams.`);
          const src = SRC.id; SRC.id = "people:dreams";
          try { heal(S, C, o, dr); } finally { SRC.id = src; }
        }
      }
      RESTED_NOW.on = true;
    }
  }
  endTurn(S, C, stats);
}
/** Side a's fighter uses support s (placed, or just drawn): break a geis or oath first if it must, then resolve it. */
function useSupport(S: State, C: CombatState, a: Side, s: SupportDef, mode: DuelMode, as: Element | undefined, stats: MatchStats | null) {
  const h = fighter(S, C, a);
  const first = C.supportsUsed === 0;
  C.supportsUsed++;
  const unw = unwilling(h.alignment, s.alignment);
  const rec = stats ? { side: a, id: s.id, unwilling: unw, effect: false } : null;
  if (stats) stats.used.push(rec!);
  if (unw) { if (stats) stats.unwilling++; if (NARRATE.lines) say(`${s.name} will not serve ${h.name}: it does nothing.`); return; }
  if (mode === "break") {
    const m = forbidMask(S, C, a, s, as);
    C.broken |= keptBroken(S, m);
    const bc = breakCost(S, m, h.alignment);
    C.valour[a] -= bc;
    if (NARRATE.lines) say(`${h.name} breaks a geis or oath first: −${bc} Valour.`);
    if (stats) stats.fx.broke[a] += bc;
    led(S, C, a, "cost:break", bc);
    if (stats) { stats.oathBroken += bitCount((m >>> 5) & 15); stats.geisBroken += bitCount(m & 31) + bitCount(m >>> 9); }
  } else if (mode === "ignore") { C.cathbad[a] = false; if (stats) stats.cathbadIgnores++; }
  if (C.valour[a] > 0) {
    const src = SRC.id; SRC.id = s.id;
    try { resolveSupport(S, C, a, s, first, stats, as); } finally { SRC.id = src; }
    if (rec) rec.effect = s.effects.length > 0 || !!s.cathbad || (!!s.invoke && s.invoke === fighter(S, C, 1 - a).tag);
  }
}
/** A turn is over: count it, and end the duel if a hero has fallen (or the duel has run its length). */
function endTurn(S: State, C: CombatState, stats: MatchStats | null) {
  const a = actorOf(C);
  if (toDeath(S)) {
    C.acts[a]++; C.drew = false;
    if (C.bleed?.[a]) { C.bleed = [C.bleed[0], C.bleed[1]]; C.bleed[a] = 0; } // the bleeding stops after its turn
    if (C.ebbed?.[0] || C.ebbed?.[1]) C.ebbed = [0, 0]; // the tide turns with the turn
    // the western crossing: the dead drain the living; a fighter that rested this turn is spared
    // ...only while it is above half its starting Valour: the dead wear the living down but can't finish them
    const dr0 = settingOf(S.rules)?.drain ?? 0;
    const dr = dr0 && C.valour[a] * 2 > (C.startV[C.duel]?.[a] ?? 0) && (!param(S.rules, "setting.drainVsSluaghOnly") || fighter(S, C, (1 - a) as Side).alignment === "Sluagh") ? dr0 : 0;
    if (dr && RESTED_NOW.on && fighter(S, C, a).alignment !== "Sluagh") { const dd = [C.dodged?.[0] ?? 0, C.dodged?.[1] ?? 0]; dd[a] += dr; C.dodged = dd; }
    if (dr && !RESTED_NOW.on && C.valour[a] > 0 && fighter(S, C, a).alignment !== "Sluagh") {
      C.valour[a] -= dr;
      const o = (1 - a) as Side;
      led(S, C, o, "deal:setting:drain", dr);
      if (NARRATE.lines) say(`The dead of the western crossing drain ${fighter(S, C, a).name}: −${dr} Valour.`);
      if (param(S.rules, "setting.drainFeeds") && fighter(S, C, o).alignment === "Sluagh" && C.valour[o] > 0) { const src = SRC.id; SRC.id = "setting:drain"; try { heal(S, C, o, dr); } finally { SRC.id = src; } }
    }
    { const rr = [C.restRun?.[0] ?? 0, C.restRun?.[1] ?? 0]; rr[a] = RESTED_NOW.on ? rr[a] + 1 : 0; C.restRun = rr; }
    if (!RESTED_NOW.on && C.rested?.[a]) { C.rested = [C.rested[0], C.rested[1]]; C.rested[a] = 0; }
    RESTED_NOW.on = false;
    // weariness: a long duel wears both down, so no stalemate lasts (Shield and Armour don't help)
    const w = weariness(C.turn);
    if (w && C.valour[a] > 0) {
      C.valour[a] -= w;
      if (NARRATE.lines) say(`${fighter(S, C, a).name} is weary: −${w} Valour.`);
    }
  }
  C.turn++;
  const lim = toDeath(S) ? S.rules.maxTurns ?? 60 : 4;
  if (C.valour[0] <= 0 || C.valour[1] <= 0 || C.turn >= lim) endDuel(S, C, stats);
}

function endDuel(S: State, C: CombatState, stats: MatchStats | null) {
  const d = C.duel;
  const f = C.felled.slice(), e = C.endValour.slice();
  f[d] = [C.valour[0] <= 0, C.valour[1] <= 0];
  e[d] = [Math.max(0, C.valour[0]), Math.max(0, C.valour[1])];
  C.felled = f; C.endValour = e;
  const ec = C.endChamp.slice(); ec[d] = [C.champ[0], C.champ[1]]; C.endChamp = ec;
  if (stats) stats.exchanges.push(C.turn);
  if (stats && C === S.combat) {
    const fs = [fighter(S, C, 0), fighter(S, C, 1)];
    (stats.duels ??= []).push({
      duel: d, fighters: [fs[0].id, fs[1].id], init: [C.init[0], C.init[1]], first: C.first, startV: [C.startV[d][0], C.startV[d][1]],
      endV: [e[d][0], e[d][1]], felled: [f[d][0] ? 1 : 0, f[d][1] ? 1 : 0], turns: C.turn,
      hand: [S.players[0].hand.length, S.players[1].hand.length], reserve: [S.players[0].reserve.length, S.players[1].reserve.length],
    });
  }
  if (d === 0) startDuel(S, C, 1, stats);
  else if (d === 1 && toDeath(S) && f[0][0] !== f[1][0] && f[0][1] !== f[1][1] && (f[0][0] || f[1][0]) && (f[0][1] || f[1][1])) startDuel(S, C, 2, stats);
  else C.stage = "done";
}

export function combatResult(C: CombatState): Result {
  const felled: [number, number] = [0, 0];
  const valour: [number, number] = [0, 0]; // wounds dealt by p
  for (let d = 0; d < C.felled.length; d++) for (const p of [0, 1]) {
    if (C.felled[d][p]) felled[p]++;
    valour[1 - p] += Math.max(0, C.startV[d][p] - C.endValour[d][p]);
  }
  // felled[p] = heroes of p felled; p's tally of enemy heroes felled = felled[1-p]
  if (felled[1] !== felled[0]) return { winner: felled[1] > felled[0] ? 0 : 1, decidedBy: "felled", felled, valour };
  if (valour[0] !== valour[1]) return { winner: valour[0] > valour[1] ? 0 : 1, decidedBy: "valour", felled, valour };
  const st = [!C.felled[0][0], !C.felled[0][1]];
  if (st[0] !== st[1]) return { winner: st[0] ? 0 : 1, decidedBy: "firstDuel", felled, valour };
  return { winner: -1, decidedBy: "draw", felled, valour };
}

// ---------------------------------------------------------------- main loop
export function nextDecision(S: State): Decision | null {
  for (;;) {
    switch (S.phase) {
      case "muster": { const d = musterStep(S); if (d) return d; break; }
      case "draft": { const d = draftDecision(S); if (d) return d; break; }
      case "play": return playDecision(S);
      case "late": { const d = lateDecision(S); if (d) return d; break; }
      case "combat": {
        const d = combatDecision(S, S.combat!);
        if (d) return d;
        const r = combatResult(S.combat!);
        if (!S.reversed && !toDeath(S) && S.rules.tiebreak === "reverse" && (r.decidedBy === "firstDuel" || r.decidedBy === "draw")) {
          startTiebreak(S);
          break;
        }
        S.result = S.reversed ? { ...r, tiebreak: true } : r;
        S.phase = "end";
        break;
      }
      case "end": return null;
    }
  }
}

const removeFrom = (cs: Card[], uid: number): Card => {
  const i = cs.findIndex((c) => c.uid === uid);
  if (i < 0) throw new Error(`card ${uid} not found`);
  return cs.splice(i, 1)[0];
};

/** Independent legality check from the rules (not from the option generator). */
export function legalityError(S: State, p: Side, o: Option): string | null {
  const P = S.players[p];
  const inHand = (uid: number) => P.hand.find((c) => c.uid === uid);
  switch (o.t) {
    case "setting":
      if (!needsSetting(S) || p !== 1) return "no setting to choose";
      return settingDef(o.id) ? null : "no such setting";
    case "muster":
      if (S.phase !== "muster" || S.musterP !== p || S.musterStage !== "draw" || S.pendingOmen) return "no Muster choice pending";
      if (P.musterQ[0]?.uid !== o.uid) return "not the card drawn";
      return musterOptions(S, p).some((x) => sameOption(x, o)) ? null : "the Muster would leave you short";
    case "musterOmen":
      if (S.phase !== "muster" || S.musterP !== p || !S.pendingOmen) return "no omen choice pending";
      if (o.uid !== S.pendingOmen.uid && !P.omens.some((s) => s.card.uid === o.uid)) return "not one of your omens";
      return null;
    case "musterReturn": {
      if (S.phase !== "muster" || S.musterP !== p || S.musterStage !== "check" || S.musterReturns <= 0) return "no return pending";
      const c = inHand(o.uid);
      if (!c) return "card not in hand";
      if (!musterReturnLegal(P, c)) return "return would break the muster guarantee";
      return null;
    }
    case "place": {
      if (S.phase !== "draft" || S.sub !== p) return "not your drafting turn";
      const c = inHand(o.uid);
      if (!c) return "card not in hand";
      const spot = draftSpot(S.step, p);
      if (S.board[spot]) return "spot occupied";
      if (isHeroSpot(spot) ? c.def.type !== "hero" && c.def.type !== "host" : c.def.type !== "support") return "wrong card type for spot";
    if (c.def.type === "host") {
      const mons = P.hand.filter((x) => x.def.type === "monster");
      const join = o.join ?? [];
      if (new Set(join).size !== join.length || join.some((u) => !mons.some((m) => m.uid === u))) return "join only monsters from your hand";
      if (mons.length >= 2 ? join.length < 2 || join.length > 3 : join.length !== mons.length) return "a host takes 2 or 3 monsters";
    } else if (o.join && o.join.length) return "only a host takes monsters";
      return null;
    }
    case "swear": {
      if (S.phase !== "play" || S.sub !== p) return "not your playing turn";
      const c = inHand(o.uid);
      if (!c || c.def.type !== "oath") return "swear needs an oath in hand";
      if (!heroSpotsOf(p).includes(o.spot)) return "swear only on your own hero";
      if (S.quadOath[quadOf(o.spot)]) return "that hero is already sworn";
      return null;
    }
    case "attend": {
      if (S.phase !== "play" || S.sub !== p) return "not your playing turn";
      const c = inHand(o.uid);
      if (!c || c.def.type !== "attendant") return "attend needs an attendant in hand";
      return null;
    }
    case "omen": case "bind": case "supplant": case "hold": {
      if (S.phase !== "play" || S.sub !== p) return "not your playing turn";
      const spot = spotFaced(S, p);
      if (ownerOfSpot(spot) === p) return "must face an enemy spot";
      if (o.t === "hold") return null;
      if (o.t === "omen") {
        const sl = P.omens.find((s) => !s.faceUp && s.card.uid === o.uid);
        if (!sl) return "no such face-down omen";
        const tg = sl.card.def.type === "omen" && sl.card.def.scope === "targeted";
        if (tg !== (o.target !== undefined)) return tg ? "a targeted omen needs a hero" : "this omen takes no target";
        if (tg && !isHeroSpot(o.target!)) return "target must be a hero";
        return null;
      }
      const c = inHand(o.uid);
      if (!c) return "card not in hand";
      if (o.t === "bind") {
        if (!isHeroSpot(spot)) return "bind only on a hero spot";
        if (c.def.type !== "geis") return "bind needs a geis";
        if (c.def.scope === "global") return S.globalGeis.length >= MAX_GLOBAL_GEASA ? "too many global geasa" : null;
        if (S.quadGeis[quadOf(spot)]) return "already bound";
        return null;
      }
      if (isHeroSpot(spot)) return "supplant only on a support spot";
      if (c.def.type !== "support") return "supplant needs a support";
      if (!S.board[spot]) return "nothing to supplant";
      return null;
    }
    case "late": case "lateDone":
      if (S.phase !== "late" || S.sub !== p) return "not your late-omen turn";
      if (o.t === "late") {
        const sl = P.omens.find((s) => !s.faceUp && s.card.uid === o.uid);
        if (!sl) return "no such omen";
        const tg = sl.card.def.type === "omen" && sl.card.def.scope === "targeted";
        if (tg !== (o.target !== undefined) || (tg && !isHeroSpot(o.target!))) return "bad omen target";
      }
      return null;
    case "focus": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || C.stage !== "focus" || C.focusTodo[0] !== p) return "no focus choice pending";
      if (!fighter(S, C, p).ab.shapeShift) return "this hero cannot shape-shift";
      if (o.el !== null && !isElement(o.el)) return "focus must be an element";
      return null;
    }
    case "sacrifice": case "summon": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || C.stage !== "turns" || actorOf(C) !== p) return "not your duel turn";
      return hostActs(S, C, p).some((x) => x.t === o.t && x.id === o.id) ? null : "that host cannot do that now";
    }
    case "champion": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || C.stage !== "turns" || actorOf(C) !== p) return "not your duel turn";
      const c = P.hand.find((x) => x.uid === o.uid);
      if (!c || c.def.type !== "champion") return "no such champion in hand";
      if (!S.rules.champions) return "champions are off";
      if (C.champ[p]) return "a champion already stands in this duel";
      if (p === 1 && C.duel === 0) return "the second player may call a champion only in the second duel";
      return null;
    }
    case "block": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || !C.pending || actorOf(C) === p) return "no blow to block";
      const d = combatDecision(S, C);
      return d && d.player === p && d.options.some((x) => sameOption(x, o)) ? null : "that can't block now";
    }
    case "draw": case "drawn": case "duelCard": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || C.stage !== "turns" || actorOf(C) !== p) return "not your duel turn";
      if (!toDeath(S)) return "only in duels to the death";
      const d = combatDecision(S, C);
      return d && d.options.some((x) => sameOption(x, o)) ? null : "not possible now";
    }
    case "duel": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || C.stage !== "turns" || actorOf(C) !== p) return "not your duel turn";
      if (C.drawn) return "deal with the drawn card first";
      if (toDeath(S)) {
        const d = combatDecision(S, C);
        return d && d.options.some((x) => sameOption(x, o)) ? null : "not possible now";
      }
      const h = fighter(S, C, p);
      if (o.guest >= 0) {
        const g = C.guests[p].find((c) => c.uid === o.guest);
        if (!g || g.def.type !== "hero") return "guest not a hero in hand";
        if (C.guestUsed[p]) return "guest already used this duel";
        if (crowActive(S, C)) return "no Heals under the crow";
        if (!sameAlignment(g.def.alignment, h.alignment)) return "guest of another alignment";
        if (!P.hand.some((c) => c.uid === o.guest)) return "guest not in hand";
      }
      if (o.act === "use") {
        const c = S.board[o.spot];
        if (!c || c.def.type !== "support") return "no support there";
        if (C.used & (1 << o.spot)) return "support already used";
        const own = quadOf(o.spot) === quadOf(C.hs[p]);
        if (!own) {
          if (!h.ab.kingsDue || C.kingsDue[p]) return "not your quadrant";
          const other = heroSpotsOf(p).find((x) => x !== C.hs[p])!;
          if (quadOf(o.spot) !== quadOf(other)) return "not your other hero's quadrant";
        }
        const s = c.def;
        if (o.as && !(h.type === "hero" && h.hybrids?.includes(o.as) && effSupport(S, p, s).element === "Spirit")) return "this blow cannot land as that element";
        const forb = unwilling(h.alignment, s.alignment) ? 0 : forbidMask(S, C, p, s, o.as);
        if (o.mode === "normal" && forb) return "forbidden by a geis";
        if (o.mode === "break" && !forb) return "nothing to break";
        if (o.mode === "ignore" && (!forb || !C.cathbad[p] || bitCount(forb) !== 1)) return "cannot ignore";
        return null;
      }
      const forb = restForbidMask(S, C, p);
      const anySupport = usableSpots(S, C, p).length > 0;
      if (o.mode === "normal" && forb && anySupport) return "resting forbidden";
      if (o.mode === "break" && !forb) return "nothing to break";
      if (o.mode === "ignore" && (!forb || !C.cathbad[p])) return "cannot ignore";
      return null;
    }
  }
}

export function applyDecision(S: State, d: Decision, idx: number, check = true): void {
  const o = d.options[idx];
  if (!o) throw new Error(`illegal option index ${idx} for ${d.kind}`);
  if (check) {
    const err = legalityError(S, d.player, o);
    if (err) throw new Error(`illegal ${o.t}: ${err}`);
  }
  const p = d.player;
  const P = S.players[p];
  const st = S.stats;
  switch (o.t) {
    case "setting": S.rules = withSetting(S.rules, o.id); return;
    case "muster": applyMuster(S, p, o); return;
    case "musterOmen": {
      const pend = S.pendingOmen!;
      S.pendingOmen = null;
      if (o.uid === pend.uid) P.reserve.push(pend);
      else {
        const i = P.omens.findIndex((s) => s.card.uid === o.uid);
        P.reserve.push(P.omens[i].card);
        P.omens[i] = { card: pend, faceUp: false };
      }
      return;
    }
    case "musterReturn":
      P.reserve.push(removeFrom(P.hand, o.uid));
      S.musterReturns--;
      return;
    case "place": {
      const spot = draftSpot(S.step, p);
      let c = removeFrom(P.hand, o.uid);
      if (c.def.type === "host") {
        // the host and its monsters become one fighter on the hero spot (it keeps the host card's uid);
        // a host short of two monsters takes the rest from the Reserve
        const members = (o.join ?? []).map((u) => removeFrom(P.hand, u).def as MonsterDef);
        while (members.length < 2) {
          const i = P.reserve.findIndex((x) => x.def.type === "monster");
          if (i < 0) break;
          members.push(P.reserve.splice(i, 1)[0].def as MonsterDef);
        }
        c = { uid: c.uid, def: composeHost(c.def, members), owner: c.owner };
      }
      S.board[spot] = c;
      if (st) st.placed.push({ side: p, id: c.def.id, how: "draft" });
      if (S.rules.blindHeroes && isHeroSpot(spot) && p === 0) S.hiddenSpots.push(spot);
      advanceDraft(S);
      return;
    }
    case "omen": {
      const s = P.omens.find((x) => x.card.uid === o.uid)!;
      s.faceUp = true;
      if (o.target !== undefined) s.target = o.target;
      if (st) { st.actions.omen++; st.omensTurned.push({ side: p, id: s.card.def.id }); }
      advancePlay(S);
      return;
    }
    case "bind": {
      const spot = spotFaced(S, p);
      const g = removeFrom(P.hand, o.uid);
      if (g.def.type === "geis" && g.def.scope === "global") S.globalGeis.push(g);
      else S.quadGeis[quadOf(spot)] = g;
      if (st) { st.actions.bind++; st.bound.push({ side: p, id: g.def.id }); }
      advancePlay(S);
      return;
    }
    case "supplant": {
      const spot = spotFaced(S, p);
      const old = S.board[spot]!;
      S.players[old.owner].discard.push(old);
      const c = removeFrom(P.hand, o.uid);
      S.board[spot] = c;
      if (st) { st.actions.supplant++; st.placed.push({ side: p, id: c.def.id, how: "supplant" }); }
      advancePlay(S);
      return;
    }
    case "attend": {
      // calling an attendant is free: the same player then takes their action for this step
      const v = removeFrom(P.hand, o.uid);
      S.attendants = [...(S.attendants ?? []), v];
      if (st) st.actions.attend++;
      return;
    }
    case "swear": {
      const v = removeFrom(P.hand, o.uid);
      S.quadOath[quadOf(o.spot)] = v;
      if (st) { st.actions.swear++; st.sworn.push({ side: p, id: v.def.id, hero: S.board[o.spot]?.def.id ?? "?" }); }
      advancePlay(S);
      return;
    }
    case "hold":
      if (st) st.actions.hold++;
      advancePlay(S);
      return;
    case "late": {
      const s = P.omens.find((x) => x.card.uid === o.uid)!;
      s.faceUp = true;
      if (o.target !== undefined) s.target = o.target;
      if (st) st.omensTurned.push({ side: p, id: s.card.def.id });
      return;
    }
    case "lateDone":
      advanceLate(S);
      return;
    case "focus":
    case "duel":
    case "champion":
    case "sacrifice":
    case "summon":
    case "draw":
    case "drawn":
    case "duelCard":
    case "block":
      combatApply(S, S.combat!, o, st);
      return;
  }
}

// ---------------------------------------------------------------- policies & match runner
export interface Policy {
  name: string;
  choose(view: State, d: Decision, rng: Rng): number;
}

export function playOut(S: State, policies: [Policy, Policy], rngs: [Rng, Rng], check = true): Result {
  for (;;) {
    const d = nextDecision(S);
    if (!d) return S.result!;
    const i = d.options.length === 1 ? 0 : policies[d.player].choose(observe(S, d.player), d, rngs[d.player]);
    applyDecision(S, d, i, check);
  }
}

export function sameOption(a: Option, b: Option): boolean {
  if (a.t !== b.t) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  for (const k of Object.keys(x)) if (x[k] !== y[k]) return false;
  return true;
}
