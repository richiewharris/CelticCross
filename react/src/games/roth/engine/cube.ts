// The rules cube as a function: a duel position reduced to what the rules read (the side to act always side 0, each
// side's fighting quadrant first, the clocks made relative), every action open there played once by the rules, and
// what it did recorded with the position it leads to. Positions that reduce alike share one entry, so the cube is
// filled once and read many times, by the computer's search (it can order its options by it, and look past its horizon:
// the "/q" switches of the fair search). The offline cubes of the rules' numbers are sim/roth/rulescube.ts's.
//
// What a position keeps: the whole board (fighters, supports, geasa, oaths), the face-up omens, every duel counter of
// both sides (Valour and its cap and starting value, Shield, rests, bleed, stagger, mound, Armour, the cry, sacrifices
// and summons, focus...), each card's use and how long ago (relative to its side's own actions), the turn (only as far
// as weariness and the turn limit can tell it apart over the next few turns), and how many cards each side could
// still draw (to three). What it drops: hands, the order of the Reserve, the discards, face-down omens. So the cube
// covers the actions taken on the board (supports, the cry, rests, geasa broken, a host's sacrifice and summon); a
// draw, a card from hand, a guest or a champion called are left to the search itself.
import { actorOf, applyDecision, cloneState, emptyStats, fighter, heroSpotsOf, nextDecision, ownerOfSpot, quadOf, TRACE, type BlowRow, type Card, type CombatState, type Option, type Side, type State } from "./engine";
import { param } from "./params";
import type { CardDef } from "./cards";
import calcWeights from "./calcWeights.json";

export const CROW = 1 << 4, OATH = 1 << 5;
/** The steps of a blow, as the trace records them. */
export const CUBE_STEPS: (keyof BlowRow)[] = ["printed", "base", "kin", "focus", "watch", "wheel", "weak", "fx", "setting", "extra", "atk", "floor", "cap", "ward", "block", "resist", "armour", "mound", "shield", "halved", "aura", "stagger", "final"];

/** What one action did, from the acting side's view. */
export interface CubeOut {
  /** The action, in the reduced position's terms (spots as there). */
  sig: string;
  dSelf: number; dFoe: number; dSelfShield: number; dFoeShield: number; spent: number;
  /** It landed a blow, and the blow's steps (CUBE_STEPS order) when the cube keeps them. */
  struck: number; steps?: number[];
  /** The duel ended: bit 1 the actor fell, bit 2 its foe did. */
  end: number;
  /** The position after it, from the next actor's view (null when the duel ended). */
  next: string | null;
  /** Whether the next actor is the foe (it nearly always is). */
  swap: boolean;
}
export interface CubeEntry { outs: CubeOut[] }

/** Card definitions by id, for the reduced positions (a Slúagh host is a composed definition no table holds). */
const DEFS = new Map<string, CardDef>();
const reg = (c: Card | null) => { if (c) DEFS.set(c.def.id, c.def); return c ? c.def.id : "-"; };

export const CUBE = {
  /** Filled entries, by reduced position. */
  map: new Map<string, CubeEntry>(),
  /** Keep each blow's steps (the offline cube does; the search doesn't need them). */
  steps: false,
  /** Lookups, and how many were filled (a miss). */
  hits: 0, misses: 0,
  /** The most entries kept before the table is cleared. */
  max: 50000,
};

/** The turn as the next few turns can tell it: weariness and the turn limit are all that read it. */
function canonTurn(t: number, S: State): number {
  const at = param(S.rules, "duel.wearyAfter"), lim = S.rules.maxTurns ?? 60;
  if (t + 8 < at && t + 8 < lim) return 2 + (t % 2);
  if (t >= at && t + 8 < 2 * at && t + 8 < lim) return at + ((t - at) % 2);
  return t;
}
/** The reduced position: side a (to act) becomes side 0, each side's fighting quadrant its first. */
export function reduce(S: State): State {
  const C = S.combat!;
  const a = actorOf(C);
  const act = [quadOf(C.hs[0]) % 2, quadOf(C.hs[1]) % 2];
  const side = (r: number) => (r === a ? 0 : 1);
  const M = (s: number) => { const r = ownerOfSpot(s); const qi = quadOf(s) % 2; return side(r) * 6 + (qi === act[r] ? 0 : 1) * 3 + (s % 3); };
  const MQ = (q: number) => quadOf(M(q * 3));
  const P = <T>(x: T[]): T[] => (a === 0 ? [x[0], x[1]] : [x[1], x[0]]);
  const W = cloneState(S);
  W.board = Array(12).fill(null); for (let s = 0; s < 12; s++) W.board[M(s)] = S.board[s];
  W.quadGeis = [null, null, null, null]; W.quadOath = [null, null, null, null];
  for (let q = 0; q < 4; q++) { W.quadGeis[MQ(q)] = S.quadGeis[q]; W.quadOath[MQ(q)] = S.quadOath[q]; }
  W.globalGeis = S.globalGeis.slice();
  // the broken mask: quadrant geasa, oaths and global geasa are kept by quadrant
  let br = C.broken & CROW;
  for (let q = 0; q < 4; q++) {
    if (C.broken & (1 << q)) br |= 1 << MQ(q);
    if (C.broken & (OATH << q)) br |= OATH << MQ(q);
    for (let i = 0; i < 4; i++) if (C.broken & (1 << (9 + 4 * i + q))) br |= 1 << (9 + 4 * i + MQ(q));
  }
  const players = P(W.players) as [typeof W.players[0], typeof W.players[1]];
  W.players = players;
  for (const Q of W.players) {
    const n = Math.min(3, Q.reserve.length + Q.discard.length);
    const filler = (Q.reserve[0] ?? Q.discard[0]) as Card | undefined;
    Q.reserve = filler ? Array.from({ length: n }, (_, i) => ({ ...filler, uid: 900000 + i })) : [];
    Q.discard = []; Q.hand = []; Q.deck = []; Q.lost = []; Q.musterQ = [];
    Q.omens = Q.omens.filter((o) => o.faceUp).map((o) => ({ card: o.card, faceUp: true, target: o.target === undefined ? undefined : M(o.target) }));
  }
  W.attendants = [];
  W.hiddenSpots = [];
  const D: CombatState = { ...C };
  const perDuel = (x: unknown[][]) => x.map((r) => P(r)) as never;
  D.hs = [0, 6]; D.first = (C.turn % 2) as Side; D.turn = canonTurn(C.turn, S);
  D.valour = P(C.valour); D.shield = P(C.shield); D.nextStrike = P(C.nextStrike); D.cathbad = P(C.cathbad); D.kingsDue = P(C.kingsDue);
  D.struck = P(C.struck); D.guestUsed = [true, true]; D.guests = [[], []]; D.focus = P(C.focus); D.focusTodo = [];
  D.felled = perDuel(C.felled); D.endValour = perDuel(C.endValour); D.startV = perDuel(C.startV); D.endChamp = perDuel(C.endChamp);
  D.cap = P(C.cap); D.init = P(C.init); D.hit = P(C.hit); D.champ = P(C.champ); D.champs = [[], []];
  D.hostAdj = [null, null, null, null]; for (let q = 0; q < 4; q++) D.hostAdj[MQ(q)] = C.hostAdj[q];
  D.sacrificed = P(C.sacrificed); D.summoned = P(C.summoned);
  const two = (x: number[] | undefined) => P(x ?? [0, 0]);
  D.rested = two(C.rested); D.mound = two(C.mound); D.bleed = two(C.bleed); D.stagger = two(C.stagger); D.cried = two(C.cried); D.ebbed = two(C.ebbed);
  D.dodged = [0, 0]; D.restRun = [0, 0]; D.armour = two(C.armour); D.block = two(C.block);
  // each card's clock, relative to its own side's actions
  D.acts = [20, 20]; D.uses = Array(12).fill(0); D.lastUse = Array(12).fill(-99); D.restsSince = Array(12).fill(0);
  for (let s = 0; s < 12; s++) {
    const m = M(s);
    D.uses[m] = Math.min(2, C.uses[s]);
    if (C.uses[s]) D.lastUse[m] = 20 - Math.min(6, C.acts[ownerOfSpot(s)] - C.lastUse[s]);
    D.restsSince[m] = Math.min(3, C.restsSince[s]);
  }
  D.supportsUsed = Math.min(1, C.supportsUsed); D.used = 0; D.broken = br;
  D.pending = null; D.drawn = null; D.drew = true; // no draws in the cube: they are the search's own
  W.combat = D;
  W.stats = emptyStats();
  return W;
}
/** The reduced position's key: everything in it the rules read, as text. */
export function keyOf(W: State): string {
  const C = W.combat!;
  const ids = (cs: (Card | null)[]) => cs.map(reg).join(",");
  const omens = W.players.map((Q) => Q.omens.map((o) => reg(o.card) + "@" + (o.target ?? "")).join(",")).join("/");
  const adj = C.hostAdj.map((x) => (x ? x.remove.join("+") + ">" + x.add.map((m) => m.id).join("+") : "")).join(",");
  const two = (x: unknown[] | undefined) => (x ? x.map((v) => (v === true ? 1 : v === false ? 0 : v ?? "")).join(":") : "");
  return [
    W.rules.setting ?? "", ids(W.board), ids(W.quadGeis), ids(W.quadOath), ids(W.globalGeis), omens, adj, C.duel, C.turn, C.broken,
    two(C.valour), two(C.startV[C.duel]), two(C.cap), two(C.shield), two(C.nextStrike), two(C.cathbad), two(C.kingsDue), two(C.struck), two(C.hit),
    two(C.focus), two(C.champ.map((c) => (c ? reg(c) : ""))), two(C.sacrificed), two(C.summoned), two(C.rested), two(C.mound), two(C.bleed),
    two(C.stagger), two(C.cried), two(C.ebbed), two(C.armour), two(C.block), two(C.init), C.supportsUsed,
    C.felled.map((f) => two(f)).join(";"), C.uses.join(""), C.lastUse.map((x) => (x < 0 ? "-" : 20 - x)).join(""), C.restsSince.join(""),
    W.players.map((Q) => Q.reserve.length).join(":"),
  ].join("|");
}
/** An option's signature (what makes it this action, not that one). */
export const sigOf = (o: Option): string => {
  if (o.t === "duel") return `${o.act}:${o.spot}:${o.mode}:${o.as ?? ""}:${o.cry ? 1 : 0}`;
  if (o.t === "sacrifice" || o.t === "summon") return `${o.t}:${o.id}`;
  return "";
};
/** The options the cube plays: the board's own (no guests, draws, cards from hand or champions called). */
export const cubeable = (o: Option) => (o.t === "duel" && o.guest < 0) || o.t === "sacrifice" || o.t === "summon";

/** Play option i of the reduced position W, settling a blow the foe may block by the block that serves it best. */
function playOut(W: State, i: number): CubeOut {
  const d = nextDecision(W)!;
  const o = d.options[i];
  const X = cloneState(W);
  X.stats = emptyStats();
  const C0 = X.combat!, duel0 = C0.duel;
  const v0 = [C0.valour[0], C0.valour[1]], s0 = [C0.shield[0], C0.shield[1]], r0 = X.players[0].reserve.length;
  TRACE.on = CUBE.steps;
  X.stats!.blows = [];
  try {
    applyDecision(X, d, i, false);
    // a reaction: the defender blocks with whatever leaves it best off (or takes the blow)
    let d2 = nextDecision(X);
    if (d2 && d2.kind === "block") {
      let best: State | null = null, bv = Infinity;
      for (let j = 0; j < d2.options.length; j++) {
        const Y = cloneState(X); Y.stats = emptyStats(); Y.stats.blows = [];
        applyDecision(Y, d2, j, false);
        const Cy = Y.combat!;
        const same = Cy.duel === duel0 && Cy.stage === "turns";
        const v = same ? Cy.valour[0] - Cy.valour[1] : Cy.endValour[duel0][0] - Cy.endValour[duel0][1];
        if (v < bv) { bv = v; best = Y; }
      }
      if (best) { const blows = X.stats!.blows; Object.assign(X, best); X.stats!.blows = [...(blows ?? []), ...(best.stats!.blows ?? [])]; }
      d2 = nextDecision(X);
    }
  } finally { TRACE.on = false; }
  const C1 = X.combat!;
  const same = C1 && C1.duel === duel0 && C1.stage === "turns";
  const v1 = same ? [C1.valour[0], C1.valour[1]] : [C1.endValour[duel0][0], C1.endValour[duel0][1]];
  const sh1 = same ? [C1.shield[0], C1.shield[1]] : [s0[0], s0[1]];
  const B = X.stats!.blows?.find((x) => x.side === 0);
  const end = same ? 0 : (C1.felled[duel0][0] ? 1 : 0) | (C1.felled[duel0][1] ? 2 : 0) | (C1.felled[duel0][0] || C1.felled[duel0][1] ? 0 : 4);
  let next: string | null = null, swap = true;
  if (same) {
    const d3 = nextDecision(X);
    if (d3 && d3.kind === "duel") { swap = actorOf(C1) !== 0; const R = reduce(X); next = keyOf(R); POS.set(next, R); }
  }
  return {
    sig: sigOf(o), dSelf: v1[0] - v0[0], dFoe: v1[1] - v0[1], dSelfShield: sh1[0] - s0[0], dFoeShield: sh1[1] - s0[1],
    spent: r0 - X.players[0].reserve.length, struck: B ? 1 : 0, steps: CUBE.steps && B ? CUBE_STEPS.map((k) => B[k] as number) : undefined, end, next, swap,
  };
}
/** The reduced positions themselves, by key, while they are needed to fill entries (the chained cube reads them). */
const POS = new Map<string, State>();
/** The entry for a reduced position: every board action open there, played. */
export function entry(W: State, key = keyOf(W)): CubeEntry {
  const e = CUBE.map.get(key);
  if (e) { CUBE.hits++; return e; }
  CUBE.misses++;
  const d = nextDecision(W);
  const outs: CubeOut[] = [];
  if (d && d.kind === "duel" && d.player === 0) d.options.forEach((o, i) => { if (cubeable(o)) outs.push(playOut(W, i)); });
  const E = { outs };
  if (CUBE.map.size >= CUBE.max) { CUBE.map.clear(); POS.clear(); }
  CUBE.map.set(key, E);
  return E;
}
/** The entry for a real position (side to act at a duel decision), and how its options map onto the entry's. */
export function lookup(S: State): { key: string; entry: CubeEntry; sig: (o: Option) => string } | null {
  const C = S.combat;
  if (!C || S.phase !== "combat" || C.stage !== "turns" || C.pending || C.drawn) return null;
  const W = reduce(S);
  const key = keyOf(W);
  POS.set(key, W);
  const a = actorOf(C);
  const act = [quadOf(C.hs[0]) % 2, quadOf(C.hs[1]) % 2];
  const M = (s: number) => { const r = ownerOfSpot(s); const qi = quadOf(s) % 2; return (r === a ? 0 : 1) * 6 + (qi === act[r] ? 0 : 1) * 3 + (s % 3); };
  const sig = (o: Option) => (o.t === "duel" ? sigOf({ ...o, spot: o.spot < 0 ? o.spot : M(o.spot) }) : sigOf(o));
  return { key, entry: entry(W, key), sig };
}
/** Fill the entry for a key whose reduced position the cube has seen (a position some entry leads to). */
export function entryByKey(key: string): CubeEntry | null {
  const e = CUBE.map.get(key);
  if (e) { CUBE.hits++; return e; }
  const W = POS.get(key);
  return W ? entry(W, key) : null;
}

// ---------------------------------------------------------------- values and lines
/** What an action is worth to the side taking it, in Valour: the Valour swing, Shield at its measured worth, a card
 *  spent at the worth of the card, and a duel ended at the worth of the duel. */
export const CUBE_VALUE = { shield: (calcWeights as { weights: Record<string, number> }).weights.shield ?? 0.19, card: 0.5, fell: 20 };
export const outValue = (x: CubeOut): number =>
  x.dSelf - x.dFoe + CUBE_VALUE.shield * (x.dSelfShield - x.dFoeShield) - CUBE_VALUE.card * x.spent + (x.end & 2 ? CUBE_VALUE.fell : 0) - (x.end & 1 ? CUBE_VALUE.fell : 0);

/** The best line of `depth` actions from a reduced position (each side in turn taking the action best for it, by the
 *  cube): its value to the side to act. Depth 1 is the best single action; 2 the best against the best reply; 3 the
 *  best follow-up too. Positions whose entries aren't filled are filled on the way. */
const LINES = new Map<string, number>();
export function lineValue(key: string, depth: number): number {
  if (depth <= 0) return 0;
  const lk = depth + "#" + key;
  const v0 = LINES.get(lk);
  if (v0 !== undefined) return v0;
  const E = entryByKey(key);
  let best = -Infinity;
  for (const x of E?.outs ?? []) {
    let v = outValue(x);
    if (x.next && depth > 1) v += x.swap ? -lineValue(x.next, depth - 1) : lineValue(x.next, depth - 1);
    if (v > best) best = v;
  }
  if (best === -Infinity) best = 0;
  if (LINES.size > 400000) LINES.clear();
  LINES.set(lk, best);
  return best;
}
/** Keep the reduced position an entry led to, so lines can be followed from it (filled positions are kept by key). */
export function remember(W: State) { POS.set(keyOf(W), W); }
/** The reduced position kept for a key (null once the cube was cleared). */
export const positionOf = (key: string): State | null => POS.get(key) ?? null;
/** Clear the cube (between experiments; the table is a cache and refills itself). */
export function clearCube() { CUBE.map.clear(); POS.clear(); LINES.clear(); CUBE.hits = 0; CUBE.misses = 0; }
void heroSpotsOf;
/** Who fights for each side of a reduced position (side 0 to act). */
export const fightersOf = (W: State): [string, string] => [fighter(W, W.combat!, 0).id, fighter(W, W.combat!, 1).id];
