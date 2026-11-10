// Exact duel solver (minimax over the tiny duel trees) and combat evaluation used by the AIs.

import { beats, isElement, unwillingPair, type HeroDef, type SupportDef } from "./cards";
import {
  combatApply, combatDecision, combatResult, cloneCombat, kin, newCombat, toDeath,
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
function evalBoardCombatRaw(S0: State, me: Side): number {
  // DECISION: a board headed for duels to the death is judged by how its two-turn duels would go: a quick, exact
  // stand-in for the strength of each pairing (the long duels are random and far too deep to solve)
  const S = toDeath(S0) ? { ...S0, rules: { ...S0.rules, duels: "ford" as const } } : S0;
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
