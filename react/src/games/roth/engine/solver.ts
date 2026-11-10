// Exact duel solver (minimax over the tiny duel trees) and combat evaluation used by the AIs.

import { beats, isElement, reuseOf, unwillingPair, type CardDef, type FighterDef, type HeroDef, type SupportDef } from "./cards";
import {
  activeOath, baseEffects, combatApply, combatDecision, combatResult, cloneCombat, effSupport, fighter, forbidMask, heroFx, kin, newCombat, primaryBonus, startDuel, toDeath, unwilling,
  type CombatState, type Option, type Side, type State,
} from "./engine";

/** Final utility of a finished combat from `me`'s side: result dominates, then felled, then valour. */
export function finalUtil(C: CombatState, me: Side): number {
  const r = combatResult(C);
  const o = 1 - me;
  const res = r.winner === -1 ? 0 : r.winner === me ? 1 : -1;
  return 100 * res + 10 * (r.felled[o] - r.felled[me]) + (r.valour[me] - r.valour[o]);
}
/** Heuristic value at the end of the first duel (when not searching into the second). */
export function firstDuelLeaf(C: CombatState, me: Side): number {
  const o = 1 - me;
  const f = C.felled[0];
  return 30 * ((f[o] ? 1 : 0) - (f[me] ? 1 : 0)) + (C.endValour[0][me] - C.endValour[0][o]);
}

/** Solver options are the engine's options, with guest variants reduced to one guest and only when hurt. */
function solverOptions(_S: State, C: CombatState, opts: Option[], actor: Side): number[] {
  const out: number[] = [];
  let guestUid = -2;
  const hurt = C.valour[actor] < C.cap[actor];
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    if (o.t === "duel" && o.guest >= 0) {
      if (!hurt) continue;
      if (guestUid === -2) guestUid = o.guest;
      if (o.guest !== guestUid) continue;
    }
    out.push(i);
  }
  return out;
}

export let solverNodes = 0;

function rec(S: State, C: CombatState, me: Side, exact: boolean, startDuel: number, alpha: number, beta: number): number {
  solverNodes++;
  if (C.stage === "done") return finalUtil(C, me);
  if (!exact && C.duel !== startDuel) return firstDuelLeaf(C, me);
  const d = combatDecision(S, C)!;
  const idx = solverOptions(S, C, d.options, d.player);
  if (d.player === me) {
    let best = -Infinity;
    for (const i of idx) {
      const C2 = cloneCombat(C);
      combatApply(S, C2, d.options[i], null);
      const v = rec(S, C2, me, exact, startDuel, alpha, beta);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const i of idx) {
    const C2 = cloneCombat(C);
    combatApply(S, C2, d.options[i], null);
    const v = rec(S, C2, me, exact, startDuel, alpha, beta);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best option index for the pending combat decision. exact=true searches through both duels. */
export function solveChoice(S: State, C: CombatState, me: Side, exact: boolean): { best: number; value: number } {
  const d = combatDecision(S, C)!;
  const idx = solverOptions(S, C, d.options, d.player);
  let best = idx[0], bestV = -Infinity;
  for (const i of idx) {
    const C2 = cloneCombat(C);
    combatApply(S, C2, d.options[i], null);
    const v = rec(S, C2, me, exact, C.duel, -Infinity, Infinity);
    if (v > bestV) { bestV = v; best = i; }
  }
  return { best, value: bestV };
}

/** Strip guests that the solving side cannot see (or that are unknown placeholders). */
export function stripGuests(C: CombatState, keep: Side | null) {
  C.guests = [0, 1].map((p) => (keep === p ? C.guests[p].filter((g) => g.def.type === "hero") : []));
  C.champs = [0, 1].map((p) => (keep === p ? C.champs[p].filter((g) => g.def.type === "champion") : []));
}

/**
 * Value of the combat that the current (complete) board would produce, from `me`'s side,
 * assuming optimal play by both: first duel played along its minimax line (first-duel heuristic leaf),
 * second duel solved exactly. Guests are ignored. Unturned omens count for nothing.
 */
const evalCache = new Map<string, number>();
const rulesKey = new WeakMap<object, string>();
export let evalCacheHits = 0;
export function boardKey(S: State, me: Side): string {
  let rk = rulesKey.get(S.rules);
  if (rk === undefined) { rk = JSON.stringify(S.rules); rulesKey.set(S.rules, rk); }
  let k = rk + me + (S.rules.initTie === "random" ? S.tieCoin.join("") : "");
  for (const c of S.board) k += "|" + (c ? c.def.id + c.owner : "-");
  for (const c of S.quadGeis) k += "|" + (c ? c.def.id : "-");
  for (const c of S.quadOath) k += "|" + (c ? c.def.id : "-");
  k += "|g" + S.globalGeis.map((c) => c.def.id).join(",");
  k += "|a" + (S.attendants ?? []).map((c) => c.def.id + c.owner).join(",");
  for (const P of S.players) { k += "#"; for (const o of P.omens) if (o.faceUp) k += o.card.def.id + (o.target ?? "") + ","; }
  return k;
}
export function evalBoardCombat(S: State, me: Side): number {
  const key = boardKey(S, me);
  const hit = evalCache.get(key);
  if (hit !== undefined) { evalCacheHits++; return hit; }
  const v = evalBoardCombatRaw(S, me);
  if (evalCache.size > 400000) evalCache.clear();
  evalCache.set(key, v);
  return v;
}
function evalBoardCombatRaw(S: State, me: Side): number {
  if (toDeath(S)) return evalBoardDeath(S, me);
  const C = newCombat(S);
  stripGuests(C, null);
  const leaf = C.duel === 0 && C.stage !== "done" ? recPV(S, C, me, -Infinity, Infinity).leaf : C;
  if (leaf.stage === "done") return finalUtil(leaf, me);
  return solveValue(S, leaf, me);
}
/** First-duel minimax returning the leaf reached on the principal variation. */
function recPV(S: State, C: CombatState, me: Side, alpha: number, beta: number): { v: number; leaf: CombatState } {
  solverNodes++;
  if (C.stage === "done" || C.duel !== 0) return { v: C.stage === "done" ? finalUtil(C, me) : firstDuelLeaf(C, me), leaf: C };
  const d = combatDecision(S, C)!;
  const idx = solverOptions(S, C, d.options, d.player);
  const max = d.player === me;
  let best: { v: number; leaf: CombatState } | null = null;
  for (const i of idx) {
    const C2 = cloneCombat(C);
    combatApply(S, C2, d.options[i], null);
    const r = recPV(S, C2, me, alpha, beta);
    if (!best || (max ? r.v > best.v : r.v < best.v)) best = r;
    if (max) { if (best.v > alpha) alpha = best.v; } else if (best.v < beta) beta = best.v;
    if (alpha >= beta) break;
  }
  return best!;
}
function solveValue(S: State, C: CombatState, me: Side): number {
  return rec(S, cloneCombat(C), me, true, C.duel, -Infinity, Infinity);
}

// ---------------------------------------------------------------- quick static estimates

/** Rough value of a support for hero h against e (e may be null = unknown). */
export function quickSupportValue(s: SupportDef, h: HeroDef, e: HeroDef | null): number {
  if (unwillingPair(h.alignment, s.alignment)) return -1;
  let v = 0;
  const effs = s.effects.map((x) => ({ ...x }));
  if (s.forHero) effs[0].n = h.id === s.forHero.id ? s.forHero.n : effs[0].n;
  if (s.vsHero && e?.id === s.vsHero.id) effs[0].n = s.vsHero.n;
  if (s.firstBonus) effs[0].n += 0.5 * s.firstBonus;
  if (s.vsBig) effs[0].n += e ? (e.valour >= 5 ? s.vsBig : 0) : 0.5 * s.vsBig;
  for (let i = 0; i < effs.length; i++) {
    let n = effs[i].n;
    if (i === 0) {
      n += kin(s.alignment, h.alignment) ? h.ab.kinBonus ?? 1 : 0;
      if (h.ab.focusAny || (h.focus && (h.focus === s.element || h.focus === s.kind))) n += 1;
      if (effs[i].type === "strike" && e && s.element) {
        if (e.weakness === s.element) n += 1;
        if (isElement(e.focus) && beats(s.element, e.focus)) n += 1;
      }
    }
    v += effs[i].type === "strike" ? n * (s.pierce ? 1.15 : 1) : effs[i].type === "heal" ? 0.85 * n : 0.8 * n;
  }
  if (s.invoke && e && e.tag === s.invoke) v += 2;
  if (s.selfLoss) v -= s.selfLoss;
  if (s.drain) v += 0.5 * s.drain;
  if (s.nextStrike) v += 0.8 * s.nextStrike;
  if (s.cathbad) v += 0.6;
  return v;
}

// ---------------------------------------------------------------- duels to the death: a race, estimated
/**
 * A board headed for duels to the death can't be solved: the duels are long and every draw is a chance. So each
 * pairing is judged as a race. Each side's worth per turn is what its two supports give (each as often as its reuse
 * price allows, with every bonus it would get on this board) and, in the turns left over, what a draw off the Reserve
 * is worth on average; the side that needs fewer turns to fell the other is likely to win. Then the two duels (and a
 * final one at one each) are combined into a chance of winning the match.
 */
export function evalBoardDeath(S: State, me: Side): number {
  const C0 = newCombat(S);
  stripGuests(C0, null);
  const p: number[] = [];
  for (const d of [0, 1]) {
    let C = C0;
    if (d === 1) { C = cloneCombat(C0); C.felled = [[false, false], [false, false], [false, false]]; startDuel(S, C, 1, null); stripGuests(C, null); }
    p.push(duelChance(S, C, me));
  }
  const P = p[0] * p[1] + 0.5 * (p[0] * (1 - p[1]) + (1 - p[0]) * p[1]);
  return 100 * (2 * P - 1);
}
/** The worth of support s to side a's fighter in combat C, as one action. */
function supWorth(S: State, C: CombatState, a: Side, s0: SupportDef): number {
  const h = fighter(S, C, a), e = fighter(S, C, 1 - a);
  if (unwilling(h.alignment, s0.alignment)) return 0;
  const s = effSupport(S, a, s0);
  const effs = baseEffects(s, h, e, false);
  let v = 0;
  effs.forEach((x, i) => {
    let n = x.n + (i === 0 ? primaryBonus(S, C, a, s, x.type === "strike") : 0);
    if (x.type === "strike") {
      n += (h.ab.strikeAll ?? 0) + (activeOath(S, C, a)?.boon.strike ?? 0);
      for (const fx of heroFx(S, C, a)) n += fx.strikeMod ?? 0;
      if (e.ab.capTaken !== undefined) n = Math.min(n, e.ab.capTaken);
      v += Math.max(0, n) * (s.pierce || s.element === "Spirit" ? 1.1 : 1);
    } else v += 0.8 * Math.max(0, n);
  });
  if (s.nextStrike) v += 0.8 * s.nextStrike;
  if (s.drain) v += 0.5 * s.drain;
  if (s.foeLoss) v += s.foeLoss;
  if (s.selfLoss) v -= s.selfLoss;
  if (forbidMask(S, C, a, s0)) v -= 2;
  return v;
}
/** How often (per turn) and at what cost a support can be used over a long duel. */
function reuseRate(s: SupportDef): { rate: number; cost: number } {
  const r = reuseOf(s);
  let rate = 1, cost = 0;
  if (r.turns) rate = Math.min(rate, 1 / (r.turns + 1));
  if (r.rest) rate = Math.min(rate, 1 / (r.rest + 1.5));
  if (r.valour) cost += r.valour;
  if (r.draw) cost += 0.3 * r.draw;
  return { rate, cost };
}
const drawCache = new Map<string, number>();
/** What a draw off side a's Reserve is worth, on average, to its fighter now. */
function drawWorth(S: State, C: CombatState, a: Side): number {
  const h = fighter(S, C, a) as HeroDef, e = fighter(S, C, 1 - a) as HeroDef;
  const key = a + h.id + e.id + S.players[a].deckList.length + S.players[a].deckList[0]?.id;
  const hit = drawCache.get(key);
  if (hit !== undefined) return hit;
  const list: CardDef[] = S.players[a].deckList;
  let tot = 0;
  for (const c of list) tot += c.type === "support" ? quickSupportValue(c, h, e) : c.type === "omen" || c.type === "geis" || c.type === "oath" ? 1.2 : 0.3;
  const v = list.length ? tot / list.length : 1;
  if (drawCache.size > 20000) drawCache.clear();
  drawCache.set(key, v);
  return v;
}
/** Side me's chance of winning the duel in C, as a race. */
function duelChance(S: State, C: CombatState, me: Side): number {
  const per = (a: Side) => {
    const h: FighterDef = fighter(S, C, a);
    const D = drawWorth(S, C, a);
    const opts: { v: number; rate: number }[] = [];
    for (const sp of [C.hs[a] + 1, C.hs[a] + 2]) {
      const c = S.board[sp];
      if (!c || c.def.type !== "support") continue;
      const w = supWorth(S, C, a, c.def);
      const r = reuseRate(c.def);
      opts.push({ v: w - r.cost, rate: r.rate });
    }
    opts.sort((x, y) => y.v - x.v);
    let left = 1, v = 0;
    for (const o of opts) if (o.v > D) { const f = Math.min(left, o.rate); v += f * o.v; left -= f; }
    v += left * D;
    v += 0.4 * (h.ab.drain ?? 0) + 0.25 * (h.ab.restHeal ?? 0) + 0.25 * (h.ab.restShield ?? 0);
    return Math.max(0.5, v);
  };
  const o = (1 - me) as Side;
  const tough = (a: Side) => { const h = fighter(S, C, a); return Math.max(0.5, C.valour[a] + C.shield[a] + Math.min(3, h.ab.firstHitSoak ?? 0)); };
  let tMe = tough(o) / per(me), tO = tough(me) / per(o);
  if (C.first === me) tMe -= 0.5; else tO -= 0.5;
  return 1 / (1 + Math.exp(-0.9 * (tO - tMe)));
}
