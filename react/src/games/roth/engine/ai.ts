// AI players: Novice (random), Casual (rules of thumb), Skilled (static eval + exact duels),
// Expert (Skilled + determinized Monte Carlo lookahead in drafting and the playing turn).

import { composeHost, reuseOf, unwillingPair, type MonsterDef, type CardDef, type FighterDef, type HeroDef, type OmenEffect, type SupportDef } from "./cards";
import {
  applyDecision, cloneCombat, cloneState, debilitated, supportReady, toDeath, draftSpot, fighter, forbidsSupport, isHeroSpot, kin, nextDecision, playOut, quadOf, sameOption,
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
function looks(s: SupportDef, h: FighterDef | null): number {
  if (h && unwillingPair(h.alignment, s.alignment)) return -5;
  let v = s.forHero && h?.id === s.forHero.id ? s.forHero.n : s.effects.reduce((a, e) => a + e.n, 0);
  if (s.cathbad) v = 0.5;
  if (h) {
    if (kin(s.alignment, h.alignment)) v += 1;
    if (h.ab.focusAny || h.focus === s.element || h.focus === s.kind) v += 1;
  }
  return v;
}

/** Casual's fixed liking for an omen: simple rule-of-thumb weights by effect. */
function casualOmen(fx: OmenEffect): number {
  if (fx.startValour || fx.strikeDuel) return 8;
  if (fx.strikeMod || fx.initMod) return 7;
  if (fx.shield) return 6;
  if (fx.firstHitSoak || fx.shieldStart) return 7;
  if (fx.element || fx.kind || fx.heal) return 6;
  if (fx.ignoreGeis) return 5;
  if (fx.mist) return 4;
  return 2; // board omens hurt both sides: Casual turns them last
}
/** Casual's eye for a hero: big numbers. */
const casualHero = (h: HeroDef) => h.valour + 0.5 * h.init + (h.rarity === "legendary" ? 2 : h.rarity === "rare" ? 1 : 0);

/** The Muster as the computer plays it: keep what it can (as the old automatic Muster did), put omens in empty
 *  spots, and when the spots are full keep the four best omens. */
function musterPick(V: State, d: Decision, omenValue: (c: Card) => number): number {
  const o = d.options as Extract<Option, { t: "muster" }>[];
  const keep = o.findIndex((x) => x.how === "keep");
  if (keep >= 0) return keep;
  const spot = o.findIndex((x) => x.how === "omen" && x.swap === undefined);
  if (spot >= 0) return spot;
  const me = d.player;
  let best = o.findIndex((x) => x.how === "aside"), worst = omenValue(V.players[me].musterQ[0]);
  o.forEach((x, i) => {
    if (x.swap === undefined) return;
    const v = omenValue(ownOmen(V, me, x.swap)!);
    if (v < worst) { worst = v; best = i; }
  });
  return Math.max(0, best);
}

// ---------------------------------------------------------------- Casual
export class CasualPolicy implements Policy {
  name = "Casual";
  choose(V: State, d: Decision, _rng: Rng): number {
    const me = d.player;
    const o = d.options;
    switch (d.kind) {
      case "muster": return musterPick(V, d, (c) => (c.def.type === "omen" ? casualOmen(c.def.fx) : 0));
      case "musterOmen": {
        const rank = (uid: number) => {
          const c = ownOmen(V, me, uid) ?? (V.pendingOmen?.uid === uid ? V.pendingOmen : undefined);
          return c && c.def.type === "omen" ? -casualOmen(c.def.fx) : 0;
        };
        return argmax(o.map((x) => rank((x as { uid: number }).uid)));
      }
      case "musterReturn": {
        const val = (c: Card) => (c.def.type === "geis" || c.def.type === "oath" || c.def.type === "attendant" || c.def.type === "champion" ? 0 : c.def.type === "support" ? 1 + looks(c.def, null) : 10 + (c.def.type === "hero" ? casualHero(c.def) : 0));
        return argmax(o.map((x) => -val(cardOf(V, me, (x as { uid: number }).uid)!)));
      }
      case "place": {
        const spot = d.spot!;
        if (isHeroSpot(spot)) return argmax(o.map((x) => {
          const d0 = cardOf(V, me, (x as { uid: number }).uid)!.def;
          if (d0.type !== "host") return casualHero(d0 as HeroDef);
          // Casual joins as many monsters as it can: big numbers
          return casualHero(composeHost(d0, ((x as { join?: number[] }).join ?? []).map((u) => cardOf(V, me, u)!.def as MonsterDef)));
        }));
        const h = knownHero(V, quadOf(spot) * 3);
        return argmax(o.map((x) => looks(cardOf(V, me, (x as { uid: number }).uid)!.def as SupportDef, h)));
      }
      case "action": {
        const spot = d.spot!;
        const omenIdx = () => {
          let best = -1, br = 99;
          o.forEach((x, i) => {
            if (x.t !== "omen") return;
            const d = ownOmen(V, me, x.uid)!.def;
            const r = d.type === "omen" ? -casualOmen(d.fx) : 0;
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
        // swear an oath on a hero none of whose own supports it forbids
        for (let i = 0; i < o.length; i++) {
          const x = o[i];
          if (x.t !== "swear") continue;
          const v = cardOf(V, me, x.uid)!.def;
          if (v.type !== "oath") continue;
          const sups = [x.spot + 1, x.spot + 2].map((s) => V.board[s]?.def).filter((d): d is SupportDef => d?.type === "support");
          if (!sups.some((s) => forbidsSupport(v.forbids, s))) return i;
        }
        // call an attendant that changes some support on the wheel for the better (by rule of thumb)
        for (let i = 0; i < o.length; i++) {
          const x = o[i];
          if (x.t !== "attend") continue;
          const a = cardOf(V, me, x.uid)!.def;
          if (a.type !== "attendant") continue;
          if (a.mode === "curse" || a.scope === "enemy") return i;
          const mine = V.board.filter((c): c is Card => !!c && c.owner === me && c.def.type === "support").map((c) => c.def as SupportDef);
          if (mine.some((s) => (a.mode === "enchant" || a.mode === "reforge" ? s.kind === a.kind : s.element === a.from))) return i;
        }
        const om = omenIdx();
        if (om >= 0) {
          // a targeted omen: help your first hero, or hinder the enemy's
          const x = o[om] as { t: "omen"; uid: number; target?: number };
          if (x.target !== undefined) {
            const d0 = ownOmen(V, me, x.uid)!.def;
            const good = d0.type === "omen" && ((d0.fx.strikeMod ?? 0) > 0 || (d0.fx.initMod ?? 0) > 0 || !!d0.fx.shieldStart || !!d0.fx.firstHitSoak);
            const want = good ? (me === 0 ? 0 : 6) : (me === 0 ? 6 : 0);
            const j = o.findIndex((y) => y.t === "omen" && y.uid === x.uid && y.target === want);
            if (j >= 0) return j;
          }
          return om;
        }
        return hold;
      }
      case "late":
        return 0;
      case "focus":
        return 0;
      case "drawn": {
        const C = V.combat!;
        const c = C.drawn!.def;
        const h = fighter(V, C, me);
        const keep = o.findIndex((x) => x.t === "drawn" && x.how === "keep");
        if (keep >= 0) return keep;
        const disc = o.findIndex((x) => x.t === "drawn" && x.how === "discard");
        let best = disc, bv = 1.5;
        o.forEach((x, i) => {
          if (x.t !== "drawn" || x.how !== "play") return;
          let v = c.type === "support" ? looks(c, h) : c.type === "omen" ? casualOmen(c.fx) / 2.5 : 2;
          if (x.mode === "break") v -= C.valour[me] <= 2 ? 99 : 2;
          if (x.target !== undefined && c.type === "omen") {
            const good = (c.fx.strikeMod ?? 0) > 0 || !!c.fx.shieldStart || !!c.fx.firstHitSoak || (c.fx.initMod ?? 0) > 0;
            if (good !== (x.target === C.hs[me])) v -= 5;
          }
          if (v > bv) { bv = v; best = i; }
        });
        return best;
      }
      case "duel": {
        const C = V.combat!;
        const h = fighter(V, C, me);
        if (toDeath(V)) return casualDeathTurn(V, d, me);
        // a host nearly beaten gives up a monster to win back its Valour
        const sac = o.findIndex((x) => x.t === "sacrifice");
        if (sac >= 0 && C.valour[me] <= 2) return sac;
        // call a champion when the hero is nearly beaten
        const ch = o.findIndex((x) => x.t === "champion");
        if (ch >= 0 && C.valour[me] <= 2) return ch;
        let best = -1, bv = -Infinity;
        o.forEach((x, i) => {
          if (x.t !== "duel" || x.guest >= 0) return;
          let v: number;
          if (x.act === "rest") v = h.ab.restHeal || h.ab.restShield ? -1 : -3;
          else v = looks(V.board[x.spot]!.def as SupportDef, h);
          if (x.mode === "break") v -= C.valour[me] <= 2 ? 99 : 1.5;
          if (x.act === "rest" && x.mode === "break") v -= 5;
          if (v > bv) { bv = v; best = i; }
        });
        if (C.valour[me] < C.cap[me]) {
          const b = o[best] as Extract<Option, { t: "duel" }>;
          const g = o.findIndex((x) => x.t === "duel" && x.guest >= 0 && x.act === b.act && x.spot === b.spot && x.mode === b.mode);
          if (g >= 0) return g;
        }
        return best;
      }
    }
  }
}

/** Casual in a duel to the death: the biggest-looking support that is ready, else a draw; heal-rests when hurt. */
function casualDeathTurn(V: State, d: Decision, me: Side): number {
  const C = V.combat!;
  const h = fighter(V, C, me);
  const o = d.options;
  const sac = o.findIndex((x) => x.t === "sacrifice");
  if (sac >= 0 && C.valour[me] <= 2) return sac;
  const ch = o.findIndex((x) => x.t === "champion");
  if (ch >= 0 && C.valour[me] <= 2) return ch;
  let best = 0, bv = -Infinity;
  o.forEach((x, i) => {
    let v = -Infinity;
    if (x.t === "draw") v = 2.2;
    else if (x.t === "duel" && x.guest < 0) {
      if (x.act === "rest") v = h.ab.restHeal || h.ab.restShield ? 0.5 : -1;
      else {
        const s = V.board[x.spot]!.def as SupportDef;
        v = unwillingPair(h.alignment, s.alignment) ? 2.3 : looks(s, h) - (C.uses[x.spot] ? (reuseOf(s).valour ?? 0) + 0.5 * (reuseOf(s).draw ?? 0) : 0);
      }
      if (x.mode === "break") v -= C.valour[me] <= 2 ? 99 : 2;
    } else if (x.t === "duelCard") {
      const c = V.players[me].omens.find((s) => s.card.uid === x.uid)?.card.def ?? V.players[me].hand.find((s) => s.uid === x.uid)?.def;
      v = c?.type === "omen" ? casualOmen(c.fx) / 3 : 1;
      if (c?.type === "omen" && x.target !== undefined) {
        const good = (c.fx.strikeMod ?? 0) > 0 || !!c.fx.shieldStart || !!c.fx.firstHitSoak || (c.fx.initMod ?? 0) > 0;
        if (good !== (x.target === C.hs[me])) v -= 5;
      }
    }
    if (v > bv) { bv = v; best = i; }
  });
  if (C.valour[me] < C.cap[me]) {
    const b = o[best];
    if (b.t === "duel") {
      const g = o.findIndex((x) => x.t === "duel" && x.guest >= 0 && x.act === b.act && x.spot === b.spot && x.mode === b.mode);
      if (g >= 0) return g;
    }
  }
  return best;
}

// ---------------------------------------------------------------- Skilled
const PH_HERO: HeroDef = { type: "hero", id: "placeholder", name: "Unknown hero", alignment: "None", rarity: "common", valour: 4, init: 3, focus: null, weakness: null, quality: "", tag: null, ab: {} };
const PH_SUP: SupportDef = { type: "support", id: "ph_sup", name: "Unknown support", element: null, kind: null, alignment: "Unaligned", rarity: "common", effects: [{ type: "strike", n: 2 }], text: "" };

function heroRating(h: HeroDef, hand: Card[]): number {
  const vals = hand.filter((c) => c.def.type === "support").map((c) => quickSupportValue(c.def as SupportDef, h, null)).sort((a, b) => b - a);
  return 0.5 * h.init + 0.8 * h.valour + (h.ab.strikeAll ?? 0) * 1.5 + (vals[0] ?? 0) + (vals[1] ?? 0);
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

function omenStatic(def: CardDef, V: State, me: Side): number {
  if (def.type !== "omen") return 0;
  const fx = def.fx;
  const mine = V.players[me].deckList, theirs = V.players[1 - me].deckList;
  const n = (deck: CardDef[], f: (d: CardDef) => boolean) => deck.filter(f).length;
  const heals = (d: CardDef) => d.type === "support" && d.effects.some((e) => e.type === "heal");
  const shields = (d: CardDef) => d.type === "support" && d.effects.some((e) => e.type === "shield");
  const big = (d: CardDef) => d.type === "support" && (d.effects.some((e) => e.type === "strike" && e.n >= 2) || !!d.forHero);
  const avgInit = (deck: CardDef[]) => { const h = deck.filter((d): d is HeroDef => d.type === "hero"); return h.reduce((a, x) => a + x.init, 0) / Math.max(1, h.length); };
  let v = 0;
  if (fx.startValour) v += 1.2;
  if (fx.strikeDuel) v += 1.2;
  if (fx.strikeMod || fx.initMod || fx.shieldStart) v += 1.0;
  if (fx.shield) v += 0.6 * n(mine, shields);
  if (fx.firstHitSoak) v += 1.5;
  if (fx.shieldStart) v += 1.5;
  if (fx.ignoreGeis) v += 0.3 * n(theirs, (d) => d.type === "geis");
  if (fx.element) v += 0.7 * n(mine, (d) => d.type === "support" && d.element === fx.element!.el);
  if (fx.kind) v += 0.7 * n(mine, (d) => d.type === "support" && d.kind === fx.kind!.kind);
  if (fx.heal) v += 0.6 * n(mine, heals);
  if (fx.noHeals || fx.healMod) v += 0.5 * (n(theirs, heals) - n(mine, heals));
  if (fx.shieldMod) v += 0.5 * (n(mine, shields) - n(theirs, shields));
  if (fx.truce) v += 0.3 * (n(theirs, big) - n(mine, big));
  if (fx.mist) v += 1;
  if (fx.darkness) v += 0.5 * (avgInit(theirs) - avgInit(mine));
  if (fx.debility) v += 0.8 * (n(theirs, (d) => d.type === "hero" && debilitated(d, fx.debility!)) - n(mine, (d) => d.type === "hero" && debilitated(d, fx.debility!)));
  return v;
}

export class SkilledPolicy implements Policy {
  name = "Skilled";
  /** fast: first-duel decisions use the first-duel heuristic leaf instead of searching through the second duel. */
  constructor(public fast = false) {}

  choose(V: State, d: Decision, rng: Rng): number {
    if (d.options.length === 1) return 0;
    switch (d.kind) {
      case "muster": return musterPick(V, d, (c) => omenStatic(c.def, V, d.player));
      case "musterOmen": {
        const me = d.player;
        const vals = d.options.map((x) => {
          const uid = (x as { uid: number }).uid;
          const c = ownOmen(V, me, uid) ?? V.pendingOmen!;
          return -omenStatic(c.def, V, me);
        });
        return argmax(vals);
      }
      case "musterReturn": {
        const me = d.player;
        const heroes = V.players[me].deckList.filter((x): x is HeroDef => x.type === "hero");
        const val = (c: Card) => c.def.type === "geis" || c.def.type === "oath" || c.def.type === "attendant" ? 1.2 : c.def.type === "champion" ? 1.5 + 0.3 * c.def.valour : c.def.type === "hero" ? 2 + 0.5 * c.def.init + 0.3 * c.def.valour
          : c.def.type === "support" ? Math.max(...heroes.map((h) => quickSupportValue(c.def as SupportDef, h, null))) : 0;
        return argmax(d.options.map((x) => -val(cardOf(V, me, (x as { uid: number }).uid)!)));
      }
      case "place":
      case "action":
      case "late":
        return argmax(this.scoreOptions(V, d));
      case "drawn":
      case "focus":
      case "duel": {
        if (toDeath(V)) return this.fast ? new CasualPolicy().choose(V, d, rng) : deathChoice(V, d, rng);
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
        const c0 = cardOf(V, me, (x as { uid: number }).uid)!;
        const join = (x as { join?: number[] }).join ?? [];
        const W = cloneState(V);
        let c = c0;
        if (c0.def.type === "host") {
          const members = join.map((u) => cardOf(V, me, u)!.def as MonsterDef);
          c = { uid: c0.uid, def: composeHost(c0.def, members), owner: c0.owner };
        }
        const k = c.def.id;
        if (cache.has(k)) return cache.get(k)!;
        W.players[me].hand = W.players[me].hand.filter((y) => y.uid !== c0.uid && !join.includes(y.uid));
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
      if (x.t === "bind" || x.t === "supplant" || x.t === "swear") v -= 0.05;
      if (x.t === "omen" || x.t === "late") v -= 0.01;
      return v;
    });
  }
}

// ---------------------------------------------------------------- duels to the death: a short look-ahead
/**
 * The duels are long and every draw is a chance, so nothing is solved exactly: Skilled looks one turn of its own and
 * one of the enemy's ahead (a draw is averaged over what the Reserve could give), and judges the board it reaches.
 */
function deathEval(S: State, me: Side): number {
  if (S.result) return S.result.winner === -1 ? 0 : S.result.winner === me ? 1000 : -1000;
  const C = S.combat;
  if (!C) return 0;
  const o = (1 - me) as Side;
  let felled = 0;
  for (const f of C.felled) felled += (f[o] ? 1 : 0) - (f[me] ? 1 : 0);
  if (C.stage === "done") return 60 * felled;
  const hm = fighter(S, C, me), ho = fighter(S, C, o);
  // how hard each side can hit with what is ready now
  const pot = (p: Side) => {
    const h = p === me ? hm : ho, e = p === me ? ho : hm;
    let best = 1.5; // a draw is worth about this much
    for (const hs of [C.hs[p]]) for (const sp of [hs + 1, hs + 2]) {
      const c = S.board[sp];
      if (!c || c.def.type !== "support") continue;
      if (C.uses[sp] && !supportReady(S, C, p, sp)) continue;
      best = Math.max(best, quickSupportValue(c.def, h as HeroDef, e as HeroDef));
    }
    return best + C.nextStrike[p] + (h.ab.strikeAll ?? 0);
  };
  const vm = C.valour[me] + 0.7 * C.shield[me], vo = C.valour[o] + 0.7 * C.shield[o];
  // turns each side needs to fell the other, roughly; fewer is better
  const tm = vo / Math.max(0.5, pot(me)), to = vm / Math.max(0.5, pot(o));
  return 60 * felled + 3 * (vm - vo) + 6 * Math.tanh((to - tm) / 2);
}
/** Each different card that could come off the top of p's Reserve, with its chance (the discards if it is empty). */
function topCards(S: State, p: Side): { uid: number; w: number }[] {
  const P = S.players[p];
  const pile = P.reserve.length ? P.reserve : P.discard;
  const by = new Map<string, { uid: number; n: number }>();
  for (const c of pile) { const k = c.def.id; const x = by.get(k); if (x) x.n++; else by.set(k, { uid: c.uid, n: 1 }); }
  return [...by.values()].map((x) => ({ uid: x.uid, w: x.n / pile.length }));
}
/** A copy of S with the card uid on top of p's Reserve (the discards shuffled back first, if it is empty). */
function withTop(S: State, p: Side, uid: number): State {
  const W = cloneState(S);
  const P = W.players[p];
  if (!P.reserve.length) { P.reserve = P.discard; P.discard = []; }
  const i = P.reserve.findIndex((c) => c.uid === uid);
  const [c] = P.reserve.splice(i, 1);
  P.reserve.unshift(c);
  return W;
}
const turnKey = (S: State) => (S.combat ? S.combat.duel * 1000 + S.combat.turn : -1) + (S.phase === "end" ? 1e6 : 0);
/** Expectiminimax over whole turns: budget = turns still to look into. */
function deathNode(S: State, me: Side, budget: number, stats: { n: number }): number {
  stats.n++;
  const d = S.phase === "combat" ? nextDecision(S) : null;
  if (!d || budget <= 0 || stats.n > 20000) return deathEval(S, me);
  return deathPick(S, d, me, budget, stats).v;
}
function deathPick(S: State, d: Decision, me: Side, budget: number, stats: { n: number }): { v: number; i: number } {
  const max = d.player === me;
  const k0 = turnKey(S);
  let best = { v: max ? -Infinity : Infinity, i: 0 };
  let guestSeen = false;
  d.options.forEach((x, i) => {
    if (x.t === "duel" && x.guest >= 0) {
      if (guestSeen || S.combat!.valour[d.player] >= S.combat!.cap[d.player]) return;
      guestSeen = true;
    }
    let v: number;
    if (x.t === "draw") {
      v = 0;
      for (const t of topCards(S, d.player)) {
        const W = withTop(S, d.player, t.uid);
        const d2 = nextDecision(W)!;
        applyDecision(W, d2, d2.options.findIndex((y) => y.t === "draw"), false);
        v += t.w * deathNode(W, me, budget, stats);
      }
    } else {
      const W = cloneState(S);
      applyDecision(W, d, i, false);
      v = deathNode(W, me, turnKey(W) !== k0 ? budget - 1 : budget, stats);
    }
    if (max ? v > best.v : v < best.v) best = { v, i };
  });
  return best;
}
function deathChoice(V: State, d: Decision, rng: Rng): number {
  if (d.options.length === 1) return 0;
  if (d.kind === "focus") return new CasualPolicy().choose(V, d, rng);
  // the enemy's hidden cards (its hand and Reserve) are filled in with a plausible sample
  const D = determinize(V, d.player, rng);
  if (DEATH.budget === 0) return new CasualPolicy().choose(V, d, rng);
  return deathPick(D, d, d.player, DEATH.budget, { n: 0 }).i;
}
/** Look-ahead depth in whole turns for long duels (a lever for experiments; 0 = Casual's eye). */
export const DEATH = { budget: 2 };

// ---------------------------------------------------------------- Expert
/** Replace the opponent's unknown cards with a sample consistent with what has been seen. */
export function determinize(V: State, me: Side, rng: Rng): State {
  const D = cloneState(V);
  const o = (1 - me) as Side;
  const O = D.players[o];
  const pool = O.deckList.slice();
  const drop = (def: CardDef) => { const i = pool.findIndex((x) => x.id === def.id); if (i >= 0) pool.splice(i, 1); };
  for (const c of D.board) if (c && c.owner === o && c.def.type !== "unknown") {
    if (c.def.type === "hero" && c.def.host) { drop(c.def.host.def); c.def.host.members.forEach(drop); } else drop(c.def);
  }
  for (const c of D.quadGeis) if (c && c.owner === o) drop(c.def);
  for (const c of D.quadOath) if (c && c.owner === o) drop(c.def);
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
    for (let i = 0; i < needH && hand.length < handN; i++) {
      const x = take((y) => y.type === "hero");
      if (x) { hand.push(mk(x)); continue; }
      // a host deck: a host and two monsters to join to it
      const hst = take((y) => y.type === "host");
      if (hst) { hand.push(mk(hst)); for (let k = 0; k < 2 && hand.length < handN; k++) { const m = take((y) => y.type === "monster"); if (m) hand.push(mk(m)); } }
    }
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
  if (D.combat) {
    const g = D.combat.guests.slice(); g[o] = hand.filter((c) => c.def.type === "hero"); D.combat.guests = g;
    const ch = D.combat.champs.slice(); ch[o] = hand.filter((c) => c.def.type === "champion"); D.combat.champs = ch;
  }
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
      const key = x.t + ":" + (c ? c.def.id : "") + (x.t === "swear" ? ":" + x.spot : "") + ((x.t === "omen" || x.t === "late") && x.target !== undefined ? ":" + x.target : "");
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
