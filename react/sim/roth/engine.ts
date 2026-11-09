// Roth Catha rules engine: a resumable state machine.
//   nextDecision(S) advances automatic steps and returns the pending decision (idempotent).
//   applyDecision(S, d, i) checks legality independently and applies option i.
// Spots are 0-based here: index i = spot i+1. Heroes at 0,3,6,9. P1 owns 0–5, P2 owns 6–11.

import {
  beats, isElement, ELEMENTS, UNKNOWN,
  type CardDef, type Element, type Focus, type HeroDef, type SupportDef, type GeisDef,
} from "./cards";
import { Rng } from "./rng";

export type Side = 0 | 1;

export interface Rules {
  startValour: number;
  maxValour: number;
  geisBreakCost: number;
  invokeLoss: number;
  omenSpots: number;
  handSize: number;
  /** Lever: face-down omens are not lost after step 6; each player may turn them before combat. */
  keepOmensUntilCombat: boolean;
  /** Lever: step-1 and step-4 heroes are placed face down and revealed together (no counter-pick). */
  blindHeroes: boolean;
  /** Initiative tie-break: P2 (rules), P1, or a coin flip (analysis lever). */
  initTie: "p2" | "p1" | "random";
}
export const DEFAULT_RULES: Rules = {
  startValour: 3, maxValour: 6, geisBreakCost: 2, invokeLoss: 2, omenSpots: 4, handSize: 12,
  keepOmensUntilCombat: false, blindHeroes: false, initTie: "p2",
};

export interface Card { uid: number; def: CardDef; owner: Side }
export interface OmenSlot { card: Card; faceUp: boolean }
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
  broken: number; // bit q (0..3): geis card on quadrant q broken; CROW_BIT: crow broken
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
}
export const CROW_BIT = 1 << 4;

export interface Result {
  winner: Side | -1;
  decidedBy: "felled" | "valour" | "firstDuel" | "draw";
  felled: [number, number]; // heroes of side p felled
  valour: [number, number]; // standing valour of side p
}

export interface MatchStats {
  exchanges: number[];
  actions: { omen: number; bind: number; supplant: number; hold: number };
  geisBroken: number;
  unwilling: number;
  invokes: number;
  guests: number;
  cathbadIgnores: number;
  initTies: number;
  placed: { side: Side; id: string; how: "draft" | "supplant" }[];
  used: { side: Side; id: string; unwilling: boolean; effect: boolean }[];
  p2First: number;
  bound: { side: Side; id: string }[];
  omensTurned: { side: Side; id: string }[];
}

export interface State {
  rules: Rules;
  players: [PlayerState, PlayerState];
  board: (Card | null)[];
  quadGeis: (Card | null)[];
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
  nextUid: number;
}

export type DuelMode = "normal" | "break" | "ignore";
export type Option =
  | { t: "musterOmen"; uid: number }
  | { t: "musterReturn"; uid: number }
  | { t: "place"; uid: number }
  | { t: "omen"; uid: number }
  | { t: "bind"; uid: number }
  | { t: "supplant"; uid: number }
  | { t: "hold" }
  | { t: "late"; uid: number }
  | { t: "lateDone" }
  | { t: "focus"; el: Element | null }
  | { t: "duel"; guest: number; act: "use" | "rest"; spot: number; mode: DuelMode };
export type DecisionKind = "musterOmen" | "musterReturn" | "place" | "action" | "late" | "focus" | "duel";
export interface Decision { kind: DecisionKind; player: Side; options: Option[]; spot?: number }

// ---------------------------------------------------------------- helpers
export const isHeroSpot = (i: number) => i % 3 === 0;
export const quadOf = (i: number) => Math.floor(i / 3);
export const ownerOfSpot = (i: number): Side => (i < 6 ? 0 : 1);
export const heroSpotsOf = (p: Side) => (p === 0 ? [0, 3] : [6, 9]);
export const draftSpot = (step: number, p: Side) => step - 1 + (p === 1 ? 6 : 0);
/** Spot faced by player p at playing step k: P1 faces 7–12, P2 faces 1–6. */
export const facedSpot = (step: number, p: Side) => (p === 0 ? 6 + step - 1 : step - 1);

const uc = (a: string) => a === "Ulaid" || a === "Connachta";
/** Kinship: support alignment matches hero; Deorad matches Ulaid and Connachta (both ways). */
export function kin(supAl: string, heroAl: string): boolean {
  if (supAl === "Unaligned" || heroAl === "None") return false;
  if (supAl === heroAl) return true;
  if (supAl === "Deorad" && uc(heroAl)) return true;
  if (heroAl === "Deorad" && uc(supAl)) return true;
  return false;
}
/** Unwilling: Ulaid support for a Connachta hero or the reverse. */
export function unwilling(heroAl: string, supAl: string): boolean {
  return (supAl === "Ulaid" && heroAl === "Connachta") || (supAl === "Connachta" && heroAl === "Ulaid");
}
/** Same alignment for guests (Deorad matches Ulaid and Connachta). */
export function sameAlignment(a: string, b: string): boolean {
  if (a === "None" || b === "None") return false;
  return a === b || (a === "Deorad" && uc(b)) || (b === "Deorad" && uc(a));
}
/** Debility: Ulaid heroes, and a Deorad counts as Ulaid; Cú Chulainn spared. */
export const countsUlaid = (h: HeroDef) => h.alignment === "Ulaid" || h.alignment === "Deorad";

export function hasFaceUp(S: State, p: Side, id: string): boolean {
  for (const o of S.players[p].omens) if (o.faceUp && o.card.def.id === id) return true;
  return false;
}
export const anyFaceUp = (S: State, id: string) => hasFaceUp(S, 0, id) || hasFaceUp(S, 1, id);
export const crowActive = (S: State, C: CombatState) => anyFaceUp(S, "o_crow") && !(C.broken & CROW_BIT);

export function heroAt(S: State, spot: number): HeroDef {
  const c = S.board[spot];
  if (!c || c.def.type !== "hero") throw new Error(`no hero at spot ${spot + 1}`);
  return c.def;
}
export function geisForbidsSupport(g: GeisDef, s: SupportDef): boolean {
  return (!!g.forbids.element && s.element === g.forbids.element) || (!!g.forbids.kind && s.kind === g.forbids.kind);
}

function emptyStats(): MatchStats {
  return {
    exchanges: [], actions: { omen: 0, bind: 0, supplant: 0, hold: 0 },
    geisBroken: 0, unwilling: 0, invokes: 0, guests: 0, cathbadIgnores: 0, initTies: 0, p2First: 0,
    placed: [], used: [], bound: [], omensTurned: [],
  };
}

// ---------------------------------------------------------------- setup
export function newMatch(decks: [CardDef[], CardDef[]], rules: Partial<Rules> = {}, seed = 1, trackStats = true): State {
  const R = { ...DEFAULT_RULES, ...rules };
  const rng = new Rng(seed);
  let uid = 1;
  const players = decks.map((list, p) => {
    const defs = rng.shuffle([...list]);
    const deck = defs.map((def) => ({ uid: uid++, def, owner: p as Side }));
    return { deckList: list, deck, hand: [], reserve: [], omens: [], discard: [], lost: [], musterQ: [] } as PlayerState;
  }) as [PlayerState, PlayerState];
  return {
    rules: R, players, board: Array(12).fill(null), quadGeis: [null, null, null, null],
    phase: "muster", musterP: 0, musterStage: "draw", musterReturns: 0, pendingOmen: null,
    step: 1, sub: 0, hiddenSpots: [], tieCoin: [rng.int(2) as Side, rng.int(2) as Side],
    combat: null, result: null, stats: trackStats ? emptyStats() : null, nextUid: uid,
  };
}

export function cloneCombat(C: CombatState): CombatState {
  return {
    duel: C.duel, stage: C.stage, hs: [C.hs[0], C.hs[1]], valour: [C.valour[0], C.valour[1]], shield: [C.shield[0], C.shield[1]],
    first: C.first, turn: C.turn, used: C.used, broken: C.broken, nextStrike: [C.nextStrike[0], C.nextStrike[1]],
    cathbad: [C.cathbad[0], C.cathbad[1]], kingsDue: [C.kingsDue[0], C.kingsDue[1]], supportsUsed: C.supportsUsed,
    struck: [C.struck[0], C.struck[1]], guestUsed: [C.guestUsed[0], C.guestUsed[1]],
    // copy-on-write fields: never mutated in place (replaced on change)
    guests: C.guests, focus: C.focus, focusTodo: C.focusTodo, felled: C.felled, endValour: C.endValour,
  };
}
function clonePlayer(P: PlayerState): PlayerState {
  return {
    deckList: P.deckList, deck: P.deck.slice(), hand: P.hand.slice(), reserve: P.reserve.slice(),
    omens: P.omens.map((o) => ({ card: o.card, faceUp: o.faceUp })), discard: P.discard.slice(), lost: P.lost.slice(), musterQ: P.musterQ.slice(),
  };
}
export function cloneState(S: State): State {
  return {
    ...S, players: [clonePlayer(S.players[0]), clonePlayer(S.players[1])], board: S.board.slice(), quadGeis: S.quadGeis.slice(),
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
  O.deck = O.deck.map(unk);
  O.hand = O.hand.map(unk);
  O.reserve = O.reserve.map(unk);
  O.musterQ = O.musterQ.map(unk);
  O.lost = O.lost.map(unk);
  O.omens = O.omens.map((s) => (s.faceUp ? s : { card: unk(s.card), faceUp: false }));
  if (V.pendingOmen && V.pendingOmen.owner === o) V.pendingOmen = unk(V.pendingOmen);
  for (const s of V.hiddenSpots) { const c = V.board[s]; if (c && c.owner === o) V.board[s] = unk(c); }
  if (V.combat) V.combat.guests = V.combat.guests.map((g, q) => (q === o ? g.map(unk) : g));
  return V;
}

// ---------------------------------------------------------------- muster
const countType = (cs: Card[], t: string) => { let n = 0; for (const c of cs) if (c.def.type === t) n++; return n; };

function musterFetch(S: State, p: Side): number {
  const P = S.players[p];
  let taken = 0;
  const need = (t: "hero" | "support", min: number) => {
    let miss = min - countType(P.hand, t);
    for (const src of [P.reserve, P.deck]) {
      for (let i = 0; i < src.length && miss > 0; ) {
        if (src[i].def.type === t) { P.hand.push(src.splice(i, 1)[0]); miss--; taken++; } else i++;
      }
    }
  };
  need("hero", 2);
  need("support", 4);
  return taken;
}
function musterReturnLegal(P: PlayerState, c: Card): boolean {
  const h = countType(P.hand, "hero") - (c.def.type === "hero" ? 1 : 0);
  const s = countType(P.hand, "support") - (c.def.type === "support" ? 1 : 0);
  return h >= 2 && s >= 4;
}
function musterStep(S: State): Decision | null {
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
      const c = P.musterQ.shift()!;
      if (c.def.type === "omen") {
        if (P.omens.length < S.rules.omenSpots) P.omens.push({ card: c, faceUp: false });
        else S.pendingOmen = c;
      } else if (P.hand.length < S.rules.handSize) P.hand.push(c);
      else P.reserve.push(c);
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
  const options = S.players[p].hand.filter((c) => c.def.type === (hero ? "hero" : "support")).map((c) => ({ t: "place" as const, uid: c.uid }));
  if (options.length === 0) { advanceDraft(S); return null; } // cannot happen after a legal muster
  return { kind: "place", player: p, options, spot };
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
  const spot = facedSpot(S.step, p);
  const P = S.players[p];
  const options: Option[] = [];
  for (const o of P.omens) if (!o.faceUp) options.push({ t: "omen", uid: o.card.uid });
  const seen = new Set<string>();
  if (isHeroSpot(spot)) {
    if (!S.quadGeis[quadOf(spot)]) for (const c of P.hand) if (c.def.type === "geis" && !seen.has(c.def.id)) { seen.add(c.def.id); options.push({ t: "bind", uid: c.uid }); }
  } else if (S.board[spot]) {
    for (const c of P.hand) if (c.def.type === "support" && !seen.has(c.def.id)) { seen.add(c.def.id); options.push({ t: "supplant", uid: c.uid }); }
  }
  options.push({ t: "hold" });
  return { kind: "action", player: p, options, spot };
}
function loseFaceDown(S: State) {
  for (const P of S.players) {
    P.lost.push(...P.omens.filter((o) => !o.faceUp).map((o) => o.card));
    P.omens = P.omens.filter((o) => o.faceUp);
  }
}
function advancePlay(S: State) {
  if (S.sub === 0) { S.sub = 1; return; }
  S.sub = 0;
  S.step++;
  if (S.step > 6) {
    if (S.rules.keepOmensUntilCombat) { S.phase = "late"; S.sub = 0; }
    else { loseFaceDown(S); startCombat(S); }
  }
}
function lateDecision(S: State): Decision | null {
  const P = S.players[S.sub];
  const fd = P.omens.filter((o) => !o.faceUp);
  if (fd.length === 0) { advanceLate(S); return null; }
  return { kind: "late", player: S.sub, options: [...fd.map((o) => ({ t: "late" as const, uid: o.card.uid })), { t: "lateDone" }] };
}
function advanceLate(S: State) {
  if (S.sub === 0) S.sub = 1;
  else { loseFaceDown(S); startCombat(S); }
}

// ---------------------------------------------------------------- combat
export function newCombat(S: State): CombatState {
  const guests = [0, 1].map((p) => S.players[p].hand.filter((c) => c.def.type === "hero"));
  const C: CombatState = {
    duel: 0, stage: "turns", hs: [0, 6], valour: [0, 0], shield: [0, 0], first: 1, turn: 0, used: 0, broken: 0,
    nextStrike: [0, 0], cathbad: [false, false], kingsDue: [false, false], supportsUsed: 0, struck: [false, false],
    guestUsed: [false, false], guests, focus: [null, null], focusTodo: [],
    felled: [[false, false], [false, false]], endValour: [[0, 0], [0, 0]],
  };
  startDuel(S, C, 0, S.stats);
  return C;
}
function startCombat(S: State) {
  S.phase = "combat";
  S.combat = newCombat(S);
}

export function startDuel(S: State, C: CombatState, d: number, stats: MatchStats | null) {
  C.duel = d;
  C.hs = d === 0 ? [0, 6] : [3, 9];
  C.turn = 0; C.supportsUsed = 0;
  C.nextStrike = [0, 0]; C.cathbad = [false, false]; C.kingsDue = [false, false];
  C.struck = [false, false]; C.guestUsed = [false, false]; C.focus = [null, null];
  const todo: Side[] = [];
  const R = S.rules;
  const h = [heroAt(S, C.hs[0]), heroAt(S, C.hs[1])];
  for (const p of [0, 1] as Side[]) {
    let v = R.startValour;
    if (d === 0 && hasFaceUp(S, p, "o_boyhood")) v = Math.max(v, R.startValour + 1);
    v = Math.min(v, R.maxValour);
    const g = S.quadGeis[quadOf(C.hs[p])];
    if (g && g.def.type === "geis" && g.def.invoke && g.def.invoke === h[p].tag && !hasFaceUp(S, p, "o_emain")) {
      v -= R.invokeLoss;
      if (stats) stats.invokes++;
    }
    C.valour[p] = v;
    C.shield[p] = h[p].id === "ferdiad" ? 1 : 0;
    if (h[p].id === "morrigan") todo.push(p);
  }
  C.focusTodo = todo;
  if (anyFaceUp(S, "o_mist")) C.first = 1;
  else if (h[0].init > h[1].init) C.first = 0;
  else if (h[1].init > h[0].init) C.first = 1;
  else {
    if (stats) stats.initTies++;
    C.first = R.initTie === "p2" ? 1 : R.initTie === "p1" ? 0 : S.tieCoin[d];
  }
  if (stats && C.first === 1) stats.p2First++;
  C.stage = C.focusTodo.length ? "focus" : "turns";
  if (C.valour[0] <= 0 || C.valour[1] <= 0) endDuel(S, C, stats);
}

export const actorOf = (C: CombatState): Side => (C.turn % 2 === 0 ? C.first : ((1 - C.first) as Side));
export const focusOf = (C: CombatState, p: Side, h: HeroDef): Focus | null => C.focus[p] ?? h.focus;

/** Geasa forbidding support s for side a's hero: bit set of geasa (quadrant bit, CROW_BIT). */
export function forbidMask(S: State, C: CombatState, a: Side, s: SupportDef): number {
  let m = 0;
  const q = quadOf(C.hs[a]);
  const g = S.quadGeis[q];
  if (g && g.def.type === "geis" && !(C.broken & (1 << q)) && !hasFaceUp(S, a, "o_emain") && geisForbidsSupport(g.def, s)) m |= 1 << q;
  if (crowActive(S, C) && s.effects.some((e) => e.type === "heal")) m |= CROW_BIT;
  return m;
}
export function restForbidMask(S: State, C: CombatState, a: Side): number {
  const q = quadOf(C.hs[a]);
  const g = S.quadGeis[q];
  if (g && g.def.type === "geis" && g.def.forbids.rest && !(C.broken & (1 << q)) && !hasFaceUp(S, a, "o_emain")) return 1 << q;
  return 0;
}
const bitCount = (m: number) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };

/** Support spots side a's hero may use now: own quadrant, plus King's due. */
export function usableSpots(S: State, C: CombatState, a: Side): { spot: number; borrowed: boolean }[] {
  const hs = C.hs[a];
  const out: { spot: number; borrowed: boolean }[] = [];
  for (const s of [hs + 1, hs + 2]) if (S.board[s] && S.board[s]!.def.type === "support" && !(C.used & (1 << s))) out.push({ spot: s, borrowed: false });
  if (heroAt(S, hs).id === "conchobar" && !C.kingsDue[a]) {
    const other = heroSpotsOf(a).find((x) => x !== hs)!;
    for (const s of [other + 1, other + 2]) if (S.board[s] && S.board[s]!.def.type === "support" && !(C.used & (1 << s))) out.push({ spot: s, borrowed: true });
  }
  return out;
}

export function duelActs(S: State, C: CombatState, a: Side): Option[] {
  const h = heroAt(S, C.hs[a]);
  const acts: Option[] = [];
  for (const { spot } of usableSpots(S, C, a)) {
    const s = S.board[spot]!.def as SupportDef;
    if (unwilling(h.alignment, s.alignment)) { acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "normal" }); continue; }
    const m = forbidMask(S, C, a, s);
    if (!m) acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "normal" });
    else {
      acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "break" });
      if (C.cathbad[a] && bitCount(m) === 1) acts.push({ t: "duel", guest: -1, act: "use", spot, mode: "ignore" });
    }
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
export function eligibleGuests(S: State, C: CombatState, a: Side): Card[] {
  if (C.guestUsed[a] || crowActive(S, C)) return [];
  const h = heroAt(S, C.hs[a]);
  return C.guests[a].filter((g) => g.def.type === "hero" && sameAlignment(g.def.alignment, h.alignment));
}

export function combatDecision(S: State, C: CombatState): Decision | null {
  if (C.stage === "done") return null;
  if (C.stage === "focus") {
    const p = C.focusTodo[0];
    const h = heroAt(S, C.hs[p]);
    const opts: Option[] = [{ t: "focus", el: null }];
    for (const el of ELEMENTS) if (el !== h.focus) opts.push({ t: "focus", el });
    return { kind: "focus", player: p, options: opts };
  }
  const a = actorOf(C);
  const acts = duelActs(S, C, a);
  const options = acts.slice();
  const seen = new Set<string>();
  for (const g of eligibleGuests(S, C, a)) {
    if (seen.has(g.def.id)) continue;
    seen.add(g.def.id);
    for (const o of acts) options.push({ ...(o as Extract<Option, { t: "duel" }>), guest: g.uid });
  }
  return { kind: "duel", player: a, options };
}

function heal(S: State, C: CombatState, p: Side, n: number) {
  C.valour[p] = Math.min(S.rules.maxValour, C.valour[p] + n);
}

function strike(S: State, C: CombatState, a: Side, n: number) {
  const b = (1 - a) as Side;
  const h = heroAt(S, C.hs[a]);
  const e = heroAt(S, C.hs[b]);
  if (h.id === "cu" && C.valour[a] === 1) n += 2; // Ríastrad
  if (h.id === "conall" && C.duel === 1 && C.felled[0][a]) n += 1; // Avenger
  if (h.id === "fergus" && e.id === "cu") n -= 1; // Old oath
  n += C.nextStrike[a];
  C.nextStrike[a] = 0;
  if (anyFaceUp(S, "o_debility") && countsUlaid(h) && h.id !== "cu") n -= 1;
  n = Math.max(0, n);
  if (anyFaceUp(S, "o_truce")) n = Math.min(n, 2);
  if (!C.struck[b]) {
    C.struck[b] = true;
    if (hasFaceUp(S, b, "o_lugh")) n = Math.max(0, n - 1);
  }
  const soak = Math.min(C.shield[b], n);
  C.shield[b] -= soak;
  C.valour[b] -= n - soak;
}

/** The support's own base numbers (special cards). */
export function baseEffects(s: SupportDef, h: HeroDef, e: HeroDef, firstSupport: boolean) {
  if (s.id === "gae_bolga") return [{ type: "strike" as const, n: h.id === "cu" ? 3 : 1 }];
  if (s.id === "sling") return [{ type: "strike" as const, n: firstSupport ? 2 : 1 }];
  if (s.id === "furbaide") return [{ type: "strike" as const, n: e.id === "medb" ? 3 : 1 }];
  return s.effects;
}
/** +1 bonuses for the primary effect (step 4) and Reinforcement (step 5, the omen). */
export function primaryBonus(S: State, C: CombatState, a: Side, s: SupportDef, isStrike: boolean): number {
  const b = (1 - a) as Side;
  const h = heroAt(S, C.hs[a]);
  const e = heroAt(S, C.hs[b]);
  let n = 0;
  if (kin(s.alignment, h.alignment)) n += h.id === "medb" ? 2 : 1;
  const f = focusOf(C, a, h);
  if (f && (f === s.element || f === s.kind)) n += 1;
  if (isStrike && s.element) {
    const ef = focusOf(C, b, e);
    if (isElement(ef) && beats(s.element, ef)) n += 1;
    if (e.weakness && s.element === e.weakness) n += 1;
  }
  if (s.element === "Water" && hasFaceUp(S, a, "o_ford")) n += 1;
  return n;
}

function resolveSupport(S: State, C: CombatState, a: Side, s: SupportDef, firstSupport: boolean, stats: MatchStats | null) {
  const b = (1 - a) as Side;
  const h = heroAt(S, C.hs[a]);
  const e = heroAt(S, C.hs[b]);
  const effs = baseEffects(s, h, e, firstSupport);
  for (let i = 0; i < effs.length; i++) {
    const eff = effs[i];
    const n = eff.n + (i === 0 ? primaryBonus(S, C, a, s, eff.type === "strike") : 0);
    if (eff.type === "strike") strike(S, C, a, n);
    else if (eff.type === "heal") heal(S, C, a, n);
    else C.shield[a] += n;
  }
  if (s.invoke && s.invoke === e.tag) { C.valour[b] -= S.rules.invokeLoss; if (stats) stats.invokes++; }
  if (s.nextStrike) C.nextStrike[a] += s.nextStrike;
  if (s.selfLoss) C.valour[a] -= s.selfLoss;
  if (s.cathbad) C.cathbad[a] = true;
}

export function combatApply(S: State, C: CombatState, o: Option, stats: MatchStats | null) {
  if (o.t === "focus") {
    const p = C.focusTodo[0];
    C.focusTodo = C.focusTodo.slice(1);
    if (o.el) { const f = C.focus.slice(); f[p] = o.el; C.focus = f; }
    if (C.focusTodo.length === 0) C.stage = "turns";
    return;
  }
  if (o.t !== "duel") throw new Error("bad combat option");
  const a = actorOf(C);
  const R = S.rules;
  if (o.guest >= 0) {
    const g = C.guests[a].find((x) => x.uid === o.guest)!;
    const gs = C.guests.slice();
    gs[a] = C.guests[a].filter((x) => x.uid !== o.guest);
    C.guests = gs;
    C.guestUsed[a] = true;
    heal(S, C, a, 1);
    if (stats) stats.guests++;
    if (C === S.combat) { // real match: the guest leaves the hand
      const P = S.players[a];
      const j = P.hand.findIndex((c) => c.uid === g.uid);
      if (j >= 0) P.discard.push(P.hand.splice(j, 1)[0]);
    }
  }
  if (o.act === "use") {
    const s = S.board[o.spot]!.def as SupportDef;
    const h = heroAt(S, C.hs[a]);
    const borrowed = quadOf(o.spot) !== quadOf(C.hs[a]);
    C.used |= 1 << o.spot;
    if (borrowed) C.kingsDue[a] = true;
    const first = C.supportsUsed === 0;
    C.supportsUsed++;
    const unw = unwilling(h.alignment, s.alignment);
    const rec = stats ? { side: a, id: s.id, unwilling: unw, effect: false } : null;
    if (stats) stats.used.push(rec!);
    if (unw) { if (stats) stats.unwilling++; }
    else {
      if (o.mode === "break") {
        const m = forbidMask(S, C, a, s);
        C.broken |= m;
        C.valour[a] -= R.geisBreakCost * bitCount(m);
        if (stats) stats.geisBroken += bitCount(m);
      } else if (o.mode === "ignore") { C.cathbad[a] = false; if (stats) stats.cathbadIgnores++; }
      if (C.valour[a] > 0) {
        resolveSupport(S, C, a, s, first, stats);
        if (rec) rec.effect = s.effects.length > 0 || !!s.cathbad || (!!s.invoke && s.invoke === heroAt(S, C.hs[1 - a]).tag);
      }
    }
  } else {
    if (o.mode === "break") {
      const m = restForbidMask(S, C, a);
      C.broken |= m;
      C.valour[a] -= R.geisBreakCost * bitCount(m);
      if (stats) stats.geisBroken += bitCount(m);
    } else if (o.mode === "ignore") { C.cathbad[a] = false; if (stats) stats.cathbadIgnores++; }
    if (C.valour[a] > 0 && heroAt(S, C.hs[a]).id === "emer" && !crowActive(S, C)) heal(S, C, a, 1);
  }
  C.turn++;
  if (C.valour[0] <= 0 || C.valour[1] <= 0 || C.turn >= 4) endDuel(S, C, stats);
}

function endDuel(S: State, C: CombatState, stats: MatchStats | null) {
  const d = C.duel;
  const f = C.felled.slice(), e = C.endValour.slice();
  f[d] = [C.valour[0] <= 0, C.valour[1] <= 0];
  e[d] = [Math.max(0, C.valour[0]), Math.max(0, C.valour[1])];
  C.felled = f; C.endValour = e;
  if (stats) stats.exchanges.push(C.turn);
  if (d === 0) startDuel(S, C, 1, stats);
  else C.stage = "done";
}

export function combatResult(C: CombatState): Result {
  const felled: [number, number] = [0, 0];
  const valour: [number, number] = [0, 0];
  for (const d of [0, 1]) for (const p of [0, 1]) {
    if (C.felled[d][p]) felled[p]++;
    else valour[p] += C.endValour[d][p];
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
        S.result = combatResult(S.combat!);
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
      if (isHeroSpot(spot) ? c.def.type !== "hero" : c.def.type !== "support") return "wrong card type for spot";
      return null;
    }
    case "omen": case "bind": case "supplant": case "hold": {
      if (S.phase !== "play" || S.sub !== p) return "not your playing turn";
      const spot = facedSpot(S.step, p);
      if (ownerOfSpot(spot) === p) return "must face an enemy spot";
      if (o.t === "hold") return null;
      if (o.t === "omen") return P.omens.some((s) => !s.faceUp && s.card.uid === o.uid) ? null : "no such face-down omen";
      const c = inHand(o.uid);
      if (!c) return "card not in hand";
      if (o.t === "bind") {
        if (!isHeroSpot(spot)) return "bind only on a hero spot";
        if (c.def.type !== "geis") return "bind needs a geis";
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
      if (o.t === "late" && !P.omens.some((s) => !s.faceUp && s.card.uid === o.uid)) return "no such omen";
      return null;
    case "focus": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || C.stage !== "focus" || C.focusTodo[0] !== p) return "no focus choice pending";
      if (heroAt(S, C.hs[p]).id !== "morrigan") return "only the Morrígan shape-shifts";
      if (o.el !== null && !isElement(o.el)) return "focus must be an element";
      return null;
    }
    case "duel": {
      const C = S.combat;
      if (S.phase !== "combat" || !C || C.stage !== "turns" || actorOf(C) !== p) return "not your duel turn";
      const h = heroAt(S, C.hs[p]);
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
          if (h.id !== "conchobar" || C.kingsDue[p]) return "not your quadrant";
          const other = heroSpotsOf(p).find((x) => x !== C.hs[p])!;
          if (quadOf(o.spot) !== quadOf(other)) return "not your other hero's quadrant";
        }
        const s = c.def;
        const forb = unwilling(h.alignment, s.alignment) ? 0 : forbidMask(S, C, p, s);
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
      const c = removeFrom(P.hand, o.uid);
      S.board[spot] = c;
      if (st) st.placed.push({ side: p, id: c.def.id, how: "draft" });
      if (S.rules.blindHeroes && isHeroSpot(spot) && p === 0) S.hiddenSpots.push(spot);
      advanceDraft(S);
      return;
    }
    case "omen": {
      const s = P.omens.find((x) => x.card.uid === o.uid)!;
      s.faceUp = true;
      if (st) { st.actions.omen++; st.omensTurned.push({ side: p, id: s.card.def.id }); }
      advancePlay(S);
      return;
    }
    case "bind": {
      const spot = facedSpot(S.step, p);
      const g = removeFrom(P.hand, o.uid);
      S.quadGeis[quadOf(spot)] = g;
      if (st) { st.actions.bind++; st.bound.push({ side: p, id: g.def.id }); }
      advancePlay(S);
      return;
    }
    case "supplant": {
      const spot = facedSpot(S.step, p);
      const old = S.board[spot]!;
      S.players[old.owner].discard.push(old);
      const c = removeFrom(P.hand, o.uid);
      S.board[spot] = c;
      if (st) { st.actions.supplant++; st.placed.push({ side: p, id: c.def.id, how: "supplant" }); }
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
      if (st) st.omensTurned.push({ side: p, id: s.card.def.id });
      return;
    }
    case "lateDone":
      advanceLate(S);
      return;
    case "focus":
    case "duel":
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
