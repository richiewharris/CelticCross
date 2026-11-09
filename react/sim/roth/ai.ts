// AI players: Novice (random), Casual (rules of thumb), Skilled (static eval + exact duels),
// Expert (Skilled + determinized Monte Carlo lookahead in drafting and the playing turn).

import type { CardDef, HeroDef, SupportDef } from "./cards";
import {
  applyDecision, cloneCombat, cloneState, draftSpot, heroAt, isHeroSpot, nextDecision, playOut, quadOf, sameOption,
  type Card, type Decision, type Option, type Policy, type Side, type State,
} from "./engine";
import { Rng } from "./rng";
import { evalBoardCombat, quickSupportValue, solveChoice, stripGuests } from "./solver";

// ---------------------------------------------------------------- Novice
export class NovicePolicy implements Policy {
  name = "Novice";
  choose(_v: State, d: Decision, rng: Rng): number {
    return rng.int(d.options.length);
  }
}

// ---------------------------------------------------------------- shared helpers
const cardOf = (V: State, p: Side, uid: number): Card | undefined => V.players[p].hand.find((c) => c.uid === uid);
const ownOmen = (V: State, p: Side, uid: number) => V.players[p].omens.find((o) => o.card.uid === uid)?.card;
const enemyHeroSpotOfQuad = (q: number) => (q < 2 ? (q + 2) * 3 : (q - 2) * 3);
function knownHero(V: State, spot: number): HeroDef | null {
  const c = V.board[spot];
  return c && c.def.type === "hero" ? c.def : null;
}
function argmax(xs: number[]): number {
  let b = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[b]) b = i;
  return b;
}
/** Base "biggest-looking" number of a support for a hero (Casual's eye). */
function looks(s: SupportDef, h: HeroDef | null): number {
  if (h && ((s.alignment === "Ulaid" && h.alignment === "Connachta") || (s.alignment === "Connachta" && h.alignment === "Ulaid"))) return -5;
  let v = s.id === "gae_bolga" ? (h?.id === "cu" ? 3 : 1) : s.effects.reduce((a, e) => a + e.n, 0);
  if (s.cathbad) v = 0.5;
  if (h) {
    if (s.alignment !== "Unaligned" && (s.alignment === h.alignment || s.alignment === "Deorad" || h.alignment === "Deorad")) v += 1;
    if (h.focus === s.element || h.focus === s.kind) v += 1;
  }
  return v;
}

const CASUAL_OMEN_ORDER = ["o_boyhood", "o_lugh", "o_ford", "o_emain", "o_crow", "o_truce", "o_mist", "o_debility"];
const CASUAL_HERO_ORDER = ["cu", "medb", "ferdiad", "conall", "fergus", "morrigan", "conchobar", "emer"];

// ---------------------------------------------------------------- Casual
export class CasualPolicy implements Policy {
  name = "Casual";
  choose(V: State, d: Decision, _rng: Rng): number {
    const me = d.player;
    const o = d.options;
    switch (d.kind) {
      case "musterOmen": {
        const rank = (uid: number) => {
          const c = ownOmen(V, me, uid) ?? (V.pendingOmen?.uid === uid ? V.pendingOmen : undefined);
          return c ? CASUAL_OMEN_ORDER.indexOf(c.def.id) : 0;
        };
        return argmax(o.map((x) => rank((x as { uid: number }).uid)));
      }
      case "musterReturn": {
        const val = (c: Card) => (c.def.type === "geis" ? 0 : c.def.type === "support" ? 1 + looks(c.def, null) : 10 + (c.def.type === "hero" ? c.def.init : 0));
        return argmax(o.map((x) => -val(cardOf(V, me, (x as { uid: number }).uid)!)));
      }
      case "place": {
        const spot = d.spot!;
        if (isHeroSpot(spot)) return argmax(o.map((x) => -CASUAL_HERO_ORDER.indexOf(cardOf(V, me, (x as { uid: number }).uid)!.def.id)));
        const h = knownHero(V, quadOf(spot) * 3);
        return argmax(o.map((x) => looks(cardOf(V, me, (x as { uid: number }).uid)!.def as SupportDef, h)));
      }
      case "action": {
        const spot = d.spot!;
        const omenIdx = () => {
          let best = -1, br = 99;
          o.forEach((x, i) => {
            if (x.t !== "omen") return;
            const r = CASUAL_OMEN_ORDER.indexOf(ownOmen(V, me, x.uid)!.def.id);
            if (r < br) { br = r; best = i; }
          });
          return best;
        };
        const hold = o.findIndex((x) => x.t === "hold");
        if (isHeroSpot(spot)) {
          const b = o.findIndex((x) => x.t === "bind");
          if (b >= 0) return b;
        } else {
          const enemy = V.board[spot]?.def;
          const sups = o.map((x, i) => [x, i] as const).filter(([x]) => x.t === "supplant");
          if (enemy && enemy.type === "support" && sups.length) {
            const base = (s: SupportDef) => looks(s, null);
            let wi = -1, wv = 99;
            for (const [x, i] of sups) {
              const v = base(cardOf(V, me, (x as { uid: number }).uid)!.def as SupportDef);
              if (v < wv) { wv = v; wi = i; }
            }
            if (wv < base(enemy)) return wi;
          }
        }
        const om = omenIdx();
        return om >= 0 ? om : hold;
      }
      case "late":
        return 0;
      case "focus":
        return 0;
      case "duel": {
        const C = V.combat!;
        const h = heroAt(V, C.hs[me]);
        let best = -1, bv = -Infinity;
        o.forEach((x, i) => {
          if (x.t !== "duel" || x.guest >= 0) return;
          let v: number;
          if (x.act === "rest") v = h.id === "emer" ? -1 : -3;
          else v = looks(V.board[x.spot]!.def as SupportDef, h);
          if (x.mode === "break") v -= C.valour[me] <= 2 ? 99 : 1.5;
          if (x.act === "rest" && x.mode === "break") v -= 5;
          if (v > bv) { bv = v; best = i; }
        });
        if (C.valour[me] < V.rules.maxValour) {
          const b = o[best] as Extract<Option, { t: "duel" }>;
          const g = o.findIndex((x) => x.t === "duel" && x.guest >= 0 && x.act === b.act && x.spot === b.spot && x.mode === b.mode);
          if (g >= 0) return g;
        }
        return best;
      }
    }
  }
}

// ---------------------------------------------------------------- Skilled
const PH_HERO: HeroDef = { type: "hero", id: "placeholder", name: "Unknown hero", alignment: "None", init: 3, focus: null, weakness: null, quality: "", tag: null };
const PH_SUP: SupportDef = { type: "support", id: "ph_sup", name: "Unknown support", element: null, kind: null, alignment: "Unaligned", effects: [{ type: "strike", n: 2 }], text: "" };

function heroRating(h: HeroDef, hand: Card[]): number {
  const vals = hand.filter((c) => c.def.type === "support").map((c) => quickSupportValue(c.def as SupportDef, h, null)).sort((a, b) => b - a);
  return 0.5 * h.init + (vals[0] ?? 0) + (vals[1] ?? 0);
}

/** Fill empty/unknown board spots: own spots greedily from hand, enemy spots with placeholders (or overrides). */
export function completeBoard(V: State, me: Side, override: Map<number, HeroDef> = new Map()): State {
  let need = false;
  for (const c of V.board) if (!c || c.def.type === "unknown") need = true;
  if (!need) return V;
  const W = cloneState(V);
  const hand = W.players[me].hand.slice();
  for (let step = 1; step <= 6; step++) for (const p of [0, 1] as Side[]) {
    const spot = draftSpot(step, p);
    const c = W.board[spot];
    if (c && c.def.type !== "unknown") continue;
    let def: CardDef;
    if (p === me) {
      if (isHeroSpot(spot)) {
        const hs = hand.filter((x) => x.def.type === "hero");
        if (hs.length) {
          const pick = hs[argmax(hs.map((x) => heroRating(x.def as HeroDef, hand)))];
          hand.splice(hand.indexOf(pick), 1);
          def = pick.def;
        } else def = PH_HERO;
      } else {
        const h = W.board[quadOf(spot) * 3]!.def as HeroDef;
        const e = knownHero(W, enemyHeroSpotOfQuad(quadOf(spot)));
        const ss = hand.filter((x) => x.def.type === "support");
        if (ss.length) {
          const pick = ss[argmax(ss.map((x) => quickSupportValue(x.def as SupportDef, h, e && e.id !== "placeholder" ? e : null)))];
          hand.splice(hand.indexOf(pick), 1);
          def = pick.def;
        } else def = PH_SUP;
      }
    } else def = isHeroSpot(spot) ? override.get(spot) ?? PH_HERO : PH_SUP;
    W.board[spot] = { uid: -1, def, owner: p };
  }
  return W;
}

/** Heroes of the opponent's deck list not yet seen in play. */
export function unseenEnemyHeroes(V: State, me: Side): HeroDef[] {
  const o = (1 - me) as Side;
  const seen = new Set<string>();
  for (const c of V.board) if (c && c.owner === o && c.def.type === "hero") seen.add(c.def.id);
  for (const P of V.players) for (const c of P.discard) if (c.owner === o) seen.add(c.def.id);
  const out: HeroDef[] = [];
  for (const d of V.players[o].deckList) if (d.type === "hero" && !seen.has(d.id)) out.push(d);
  return out;
}

function omenStatic(id: string, V: State, me: Side): number {
  const mine = V.players[me].deckList, theirs = V.players[1 - me].deckList;
  const n = (deck: CardDef[], f: (d: CardDef) => boolean) => deck.filter(f).length;
  const ulaid = (d: CardDef) => d.type === "hero" && (d.alignment === "Ulaid" || d.alignment === "Deorad") && d.id !== "cu";
  const heals = (d: CardDef) => d.type === "support" && d.effects.some((e) => e.type === "heal");
  const big = (d: CardDef) => d.type === "support" && (d.id === "gae_bolga" || d.id === "warp" || d.effects.some((e) => e.type === "strike" && e.n >= 2));
  switch (id) {
    case "o_boyhood": return 1.5;
    case "o_lugh": return 1.5;
    case "o_emain": return 0.3 * n(theirs, (d) => d.type === "geis");
    case "o_ford": return 0.7 * n(mine, (d) => d.type === "support" && d.element === "Water");
    case "o_crow": return 0.5 * (n(theirs, heals) - n(mine, heals));
    case "o_truce": return 0.3 * (n(theirs, big) - n(mine, big));
    case "o_mist": return me === 1 ? 1 : -0.5;
    case "o_debility": return 0.8 * (n(theirs, ulaid) - n(mine, ulaid));
  }
  return 0;
}

export class SkilledPolicy implements Policy {
  name = "Skilled";
  /** fast: first-duel decisions use the first-duel heuristic leaf instead of searching through the second duel. */
  constructor(public fast = false) {}

  choose(V: State, d: Decision, rng: Rng): number {
    if (d.options.length === 1) return 0;
    switch (d.kind) {
      case "musterOmen": {
        const me = d.player;
        const vals = d.options.map((x) => {
          const uid = (x as { uid: number }).uid;
          const c = ownOmen(V, me, uid) ?? V.pendingOmen!;
          return -omenStatic(c.def.id, V, me);
        });
        return argmax(vals);
      }
      case "musterReturn": {
        const me = d.player;
        const heroes = V.players[me].deckList.filter((x): x is HeroDef => x.type === "hero");
        const val = (c: Card) => c.def.type === "geis" ? 1.2 : c.def.type === "hero" ? 2 + 0.5 * c.def.init
          : c.def.type === "support" ? Math.max(...heroes.map((h) => quickSupportValue(c.def as SupportDef, h, null))) : 0;
        return argmax(d.options.map((x) => -val(cardOf(V, me, (x as { uid: number }).uid)!)));
      }
      case "place":
      case "action":
      case "late":
        return argmax(this.scoreOptions(V, d));
      case "focus":
      case "duel": {
        const C2 = cloneCombat(V.combat!);
        stripGuests(C2, d.player);
        return solveChoice(V, C2, d.player, !this.fast).best;
      }
    }
    return rng.int(d.options.length);
  }

  /** Static evaluation of each option (same order as d.options). */
  scoreOptions(V: State, d: Decision): number[] {
    const me = d.player;
    const cache = new Map<string, number>();
    if (d.kind === "place") {
      const spot = d.spot!;
      return d.options.map((x) => {
        const c = cardOf(V, me, (x as { uid: number }).uid)!;
        const k = c.def.id;
        if (cache.has(k)) return cache.get(k)!;
        const W = cloneState(V);
        W.players[me].hand = W.players[me].hand.filter((y) => y.uid !== c.uid);
        W.board[spot] = c;
        let v: number;
        const eh = enemyHeroSpotOfQuad(quadOf(spot));
        const ec = W.board[eh];
        if (isHeroSpot(spot) && (!ec || ec.def.type === "unknown")) {
          const cands = unseenEnemyHeroes(W, me);
          const vals = cands.map((e) => evalBoardCombat(completeBoard(W, me, new Map([[eh, e]])), me));
          v = vals.length ? 0.5 * Math.min(...vals) + 0.5 * (vals.reduce((a, b) => a + b, 0) / vals.length) : evalBoardCombat(completeBoard(W, me), me);
        } else v = evalBoardCombat(completeBoard(W, me), me);
        cache.set(k, v);
        return v;
      });
    }
    // action / late: apply on a copy of the view and evaluate the resulting board
    return d.options.map((x, i) => {
      const W = cloneState(V);
      applyDecision(W, d, i, false);
      let v = evalBoardCombat(completeBoard(W, me), me);
      if (x.t === "bind" || x.t === "supplant") v -= 0.05;
      if (x.t === "omen" || x.t === "late") v -= 0.01;
      return v;
    });
  }
}

// ---------------------------------------------------------------- Expert
/** Replace the opponent's unknown cards with a sample consistent with what has been seen. */
export function determinize(V: State, me: Side, rng: Rng): State {
  const D = cloneState(V);
  const o = (1 - me) as Side;
  const O = D.players[o];
  const pool = O.deckList.slice();
  const drop = (def: CardDef) => { const i = pool.findIndex((x) => x.id === def.id); if (i >= 0) pool.splice(i, 1); };
  for (const c of D.board) if (c && c.owner === o && c.def.type !== "unknown") drop(c.def);
  for (const c of D.quadGeis) if (c && c.owner === o) drop(c.def);
  for (const P of D.players) for (const c of P.discard) if (c.owner === o && c.def.type !== "unknown") drop(c.def);
  for (const s of O.omens) if (s.faceUp) drop(s.card.def);
  rng.shuffle(pool);
  const take = (f: (x: CardDef) => boolean): CardDef | undefined => {
    const i = pool.findIndex(f);
    if (i < 0) return undefined;
    return pool.splice(i, 1)[0];
  };
  const mk = (def: CardDef): Card => ({ uid: D.nextUid++, def, owner: o });
  for (let s = 0; s < 12; s++) {
    const c = D.board[s];
    if (c && c.def.type === "unknown") D.board[s] = mk(take((x) => x.type === "hero") ?? take((x) => x.type !== "omen")!);
  }
  O.omens = O.omens.map((s) => (s.faceUp ? s : { card: mk(take((x) => x.type === "omen") ?? take(() => true)!), faceUp: false }));
  const handN = O.hand.length;
  const hand: Card[] = [];
  if (D.phase === "draft") {
    let needH = 0, needS = 0;
    for (let step = D.step; step <= 6; step++) {
      const spot = draftSpot(step, o);
      if (D.board[spot]) continue;
      if (isHeroSpot(spot)) needH++; else needS++;
    }
    for (let i = 0; i < needH && hand.length < handN; i++) { const x = take((y) => y.type === "hero"); if (x) hand.push(mk(x)); }
    for (let i = 0; i < needS && hand.length < handN; i++) { const x = take((y) => y.type === "support"); if (x) hand.push(mk(x)); }
  }
  while (hand.length < handN) {
    const x = take((y) => y.type !== "omen") ?? take(() => true);
    if (!x) break;
    hand.push(mk(x));
  }
  O.hand = hand;
  O.reserve = pool.map(mk);
  O.deck = [];
  O.musterQ = [];
  O.lost = [];
  if (D.combat) { const g = D.combat.guests.slice(); g[o] = hand.filter((c) => c.def.type === "hero"); D.combat.guests = g; }
  D.hiddenSpots = D.hiddenSpots.filter((s) => D.board[s]?.owner !== o);
  return D;
}

export class ExpertPolicy implements Policy {
  name = "Expert";
  skilled = new SkilledPolicy(false);
  rollout = new SkilledPolicy(true);
  /** N determinized rollouts per candidate; at most K candidates (pre-ranked by Skilled's evaluation). */
  constructor(public N = 24, public K = 4) {}

  choose(V: State, d: Decision, rng: Rng): number {
    if (d.options.length === 1) return 0;
    if (d.kind !== "place" && d.kind !== "action" && d.kind !== "late") return this.skilled.choose(V, d, rng);
    const me = d.player;
    // dedupe identical cards
    const seen = new Map<string, number>();
    const cands: number[] = [];
    d.options.forEach((x, i) => {
      const uid = (x as { uid?: number }).uid;
      const c = uid !== undefined ? cardOf(V, me, uid) ?? ownOmen(V, me, uid) : undefined;
      const key = x.t + ":" + (c ? c.def.id : "");
      if (!seen.has(key)) { seen.set(key, i); cands.push(i); }
    });
    if (cands.length === 1) return cands[0];
    let pool = cands;
    if (cands.length > this.K) {
      const sc = this.skilled.scoreOptions(V, d);
      pool = cands.slice().sort((a, b) => sc[b] - sc[a]).slice(0, this.K);
    }
    const tot = pool.map(() => 0);
    for (let n = 0; n < this.N; n++) {
      const D = determinize(V, me, rng);
      const seed = rng.int(0x7fffffff);
      pool.forEach((ci, k) => {
        const S2 = cloneState(D);
        const d2 = nextDecision(S2)!;
        const j = d2.options.findIndex((y) => sameOption(y, d.options[ci]));
        if (j < 0) throw new Error("determinized decision mismatch");
        applyDecision(S2, d2, j, false);
        const r = playOut(S2, [this.rollout, this.rollout], [new Rng(seed), new Rng(seed ^ 0x5bd1e995)], false);
        tot[k] += r.winner === -1 ? 0.5 : r.winner === me ? 1 : 0;
        tot[k] += 0.001 * (r.valour[me] - r.valour[1 - me]);
      });
    }
    return pool[argmax(tot)];
  }
}

export function makePolicy(level: string, opts: { N?: number; K?: number } = {}): Policy {
  switch (level.toLowerCase()) {
    case "novice": return new NovicePolicy();
    case "casual": return new CasualPolicy();
    case "skilled": return new SkilledPolicy(false);
    case "expert": return new ExpertPolicy(opts.N ?? 24, opts.K ?? 4);
  }
  throw new Error(`unknown level ${level}`);
}
export const LEVELS = ["Novice", "Casual", "Skilled", "Expert"] as const;
