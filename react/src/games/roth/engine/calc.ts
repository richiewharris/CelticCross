// The duel calculator: the game's arithmetic as formulas, level by level, each checked against the measured cube.
//
//   Level 1, the blow (and every other option): exact, by the rules. Each option open to a side is played on a copy
//            of the position and the change read off: wounds dealt, Valour healed, Shield gained, Valour paid.
//   Level 2, the turn: what a side can do each turn from here: its best blow (net of what it pays), and its best
//            sustain (what a heal or a rest gives back).
//   Level 3, the duel: a race. Each side's effective Valour (Valour, plus the Shield that will soak non-Spirit blows)
//            over the other's best blow less its own sustain is the number of turns it lasts; whoever needs fewer of
//            its own turns, allowing for who acts next, fells the other. The margin, over its spread, is a win chance.
//
// Nothing here is fitted to outcomes. The one constant, SPREAD (how many turns of margin make a duel a near
// certainty), is measured: the spread of real duels around the race's prediction.
import { actorOf, applyDecision, cloneState, drawable, fighter, nextDecision, toDeath, type Side, type State } from "./engine";
import { reuseOf, type SupportDef } from "./cards";

/** What one option does, by the rules: played on a copy of the position. */
export interface OptionEffect { dealt: number; healed: number; shield: number; paid: number; rest: boolean; draw?: boolean }

/** A copy of S in which side p is to act on its duel turn (nothing pending), or null if p can't act now. */
function asActor(S: State, p: Side): State | null {
  if (!S.combat || S.phase !== "combat" || S.combat.stage !== "turns") return null;
  const W = cloneState(S);
  const C = W.combat!;
  C.pending = null; C.drawn = null; C.drew = false;
  if (actorOf(C) !== p) C.turn += 1;
  return W;
}

/** Level 1: every duel option open to side p from this position, and what each does. */
export function optionEffects(S: State, p: Side): OptionEffect[] {
  const W = asActor(S, p);
  if (!W) return [];
  const d = nextDecision(W);
  if (!d || d.kind !== "duel" || d.player !== p) return [];
  const o = (1 - p) as Side;
  const out: OptionEffect[] = [];
  d.options.forEach((x, i) => {
    if (x.t === "draw") { const e = drawEffect(W, d, i, p); if (e) out.push(e); return; }
    if (x.t !== "duel" || x.guest >= 0) return;
    const X = cloneState(W);
    const C0 = X.combat!;
    const v0 = [C0.valour[0], C0.valour[1]], s0 = C0.shield[p], duel0 = C0.duel;
    applyDecision(X, d, i, false);
    // if the option ended the duel, the duel's end Valour says what it did (a felled side ends at 0)
    const same = C0.duel === duel0 && C0.stage === "turns";
    const vo = same ? C0.valour[o] : C0.endValour[duel0][o];
    const vp = same ? C0.valour[p] : C0.endValour[duel0][p];
    const dealt = Math.max(0, v0[o] - Math.max(0, vo));
    const dv = vp - v0[p];
    out.push({ dealt, healed: Math.max(0, dv), paid: Math.max(0, -dv), shield: same ? Math.max(0, C0.shield[p] - s0) : 0, rest: x.act === "rest" });
  });
  return out;
}

/** A draw, valued over the cards that could come off the top of the Reserve (each weighted by its chance): the best
 *  that card's own options do (play it at once, or keep it for later, valued as playing it). */
function drawEffect(W: State, d: ReturnType<typeof nextDecision>, i: number, p: Side): OptionEffect | null {
  const P = W.players[p];
  const pile = P.reserve.length ? P.reserve : P.discard;
  if (!pile.length || !d) return null;
  const by = new Map<string, { uid: number; n: number }>();
  for (const c of pile) { const x = by.get(c.def.id); if (x) x.n++; else by.set(c.def.id, { uid: c.uid, n: 1 }); }
  const sum: OptionEffect = { dealt: 0, healed: 0, shield: 0, paid: 0, rest: false, draw: true };
  for (const { uid, n } of by.values()) {
    const w = n / pile.length;
    const X = cloneState(W);
    const Q = X.players[p];
    if (!Q.reserve.length) { Q.reserve = Q.discard; Q.discard = []; }
    const k = Q.reserve.findIndex((c) => c.uid === uid);
    Q.reserve.unshift(...Q.reserve.splice(k, 1));
    applyDecision(X, d, i, false);
    const d2 = nextDecision(X);
    let best: OptionEffect = { dealt: 0, healed: 0, shield: 0, paid: 0, rest: false };
    if (d2 && d2.kind === "drawn") {
      d2.options.forEach((y, j) => {
        if (y.t !== "drawn" || y.how !== "play") return;
        const Y = cloneState(X);
        const C0 = Y.combat!, o = (1 - p) as Side, duel0 = C0.duel, v0 = [C0.valour[0], C0.valour[1]], s0 = C0.shield[p];
        applyDecision(Y, d2, j, false);
        const same = C0.duel === duel0 && C0.stage === "turns";
        const vo = same ? C0.valour[o] : C0.endValour[duel0][o], vp = same ? C0.valour[p] : C0.endValour[duel0][p];
        const e = { dealt: Math.max(0, v0[o] - Math.max(0, vo)), healed: Math.max(0, vp - v0[p]), paid: Math.max(0, v0[p] - vp), shield: same ? Math.max(0, C0.shield[p] - s0) : 0, rest: false };
        if (e.dealt - e.paid + 0.5 * (e.healed + e.shield) > best.dealt - best.paid + 0.5 * (best.healed + best.shield)) best = e;
      });
    }
    sum.dealt += w * best.dealt; sum.healed += w * best.healed; sum.shield += w * best.shield; sum.paid += w * best.paid;
  }
  return sum;
}

/** Level 2: what side p can do each turn from here.
 *  blow      its best blow this turn (net of what it pays), from what is ready now or a draw
 *  sustained what it can keep taking off each turn after that: the best of a draw, and each card beside its fighter
 *            at its full value spread over its cycle (a Weapon or a Spirit blow every other turn, a Feat every other
 *            turn with a rest between, an Ally for a card, a Word for 1 Valour), net of that cost
 *  sustain   the most it gets back in a turn (a heal, or a rest's Shield) */
export interface TurnRate { blow: number; sustained: number; sustain: number; options: number }
export function turnRate(S: State, p: Side): TurnRate {
  const ef = optionEffects(S, p);
  let blow = 0, sustain = 0, draw = 0;
  for (const e of ef) {
    blow = Math.max(blow, e.dealt - e.paid);
    sustain = Math.max(sustain, e.healed + e.shield);
    if (e.draw) draw = e.dealt - e.paid;
  }
  let sustained = draw;
  const W = asActor(S, p);
  if (W) {
    const C = W.combat!;
    for (const sp of [C.hs[p] + 1, C.hs[p] + 2]) {
      const c = W.board[sp];
      if (!c || c.def.type !== "support" || c.def.use || !c.def.effects.some((x) => x.type === "strike")) continue;
      const r = reuseOf(c.def as SupportDef);
      // its first-use value: on a copy where it is fresh
      const X = cloneState(W);
      const u = X.combat!.uses.slice(); u[sp] = 0; X.combat!.uses = u;
      const best = optionEffects(X, p).reduce((m, e) => Math.max(m, e.dealt), 0);
      const cycle = 1 + (r.turns ?? 0) + (r.rest ?? 0);
      sustained = Math.max(sustained, (best - (r.valour ?? 0) - 1.5 * (r.draw ?? 0)) / cycle);
    }
  }
  return { blow, sustained, sustain, options: ef.length };
}

/** Level 3: the race, from side me's view. */
export interface Race { tMe: number; tFoe: number; margin: number; win: number; rateMe: TurnRate; rateFoe: TurnRate }
/** How many own turns of margin make a duel a near certainty (measured: see sim/roth/cube/calccheck.py). */
export const CALC = { spread: 2 };
export function duelRace(S: State, me: Side): Race | null {
  const C = S.combat;
  if (!C || !toDeath(S) || C.stage !== "turns") return null;
  const o = (1 - me) as Side;
  const rm = turnRate(S, me), ro = turnRate(S, o);
  // effective Valour: Valour, plus the Shield that soaks blows (not a Slúagh's Spirit, which passes it)
  const eff = (p: Side, foe: Side) => C.valour[p] + (fighter(S, C, foe).alignment === "Sluagh" ? 0 : C.shield[p]);
  // turns a side lasts: the foe's best blow first, then what it can keep taking off each turn (sustain is measured
  // beside it, and the check says whether it belongs in the race); 15 turns stands for "not by blows alone"
  const lasts = (p: Side, foe: Side, f: TurnRate) => {
    const E = Math.max(0, eff(p, foe));
    if (f.blow >= E) return 1;
    return f.sustained <= 0.05 ? 15 : Math.min(15, 1 + (E - f.blow) / f.sustained);
  };
  const tMe = lasts(o, me, rm);   // own turns I need to fell the foe
  const tFoe = lasts(me, o, ro);  // its turns it needs to fell me
  // whoever acts next gets its turns in first: a tie goes to it
  const next = actorOf(C) === me ? 0.5 : -0.5;
  const margin = tFoe - tMe + next;
  return { tMe, tFoe, margin, win: 1 / (1 + Math.exp(-margin / CALC.spread * 2)), rateMe: rm, rateFoe: ro };
}

/** Level 3, as it turned out: the duel is additive. A side's edge, in Valour points, is its Valour lead plus what each
 *  of these is worth in Valour (measured: sim/roth/cube/calcfit.py writes engine/calcWeights.json):
 *    shield     its Shield lead
 *    blow       its best blow now, less the foe's
 *    sustained  what it can keep taking off each turn, less the foe's
 *    sustain    what it can get back in a turn, less the foe's
 *    move       +1 if it acts next, -1 if the foe does */
export const CALC_TERMS = ["valour", "shield", "blow", "sustained", "sustain", "move"] as const;
export type CalcTerm = (typeof CALC_TERMS)[number];
export function calcTerms(S: State, me: Side): Record<CalcTerm, number> | null {
  const C = S.combat;
  if (!C || !toDeath(S) || C.stage !== "turns") return null;
  const o = (1 - me) as Side;
  const rm = turnRate(S, me), ro = turnRate(S, o);
  return {
    valour: C.valour[me] - C.valour[o],
    shield: C.shield[me] - C.shield[o],
    blow: rm.blow - ro.blow,
    sustained: rm.sustained - ro.sustained,
    sustain: rm.sustain - ro.sustain,
    // having the move: the side to act next gets its blow in first
    move: actorOf(C) === me ? 1 : -1,
  };
}
/** A side's edge in Valour points under these Valour-equivalents (valour itself is 1). */
export function calcEdge(S: State, me: Side, w: Record<CalcTerm, number>): number | null {
  const t = calcTerms(S, me);
  if (!t) return null;
  let e = 0;
  for (const k of CALC_TERMS) e += (k === "valour" ? 1 : w[k]) * t[k];
  return e;
}

// ---------------------------------------------------------------- Level 4: the duel played out on the tables
// The rules cubes found the duel nearly additive: an action's outcome from a position is its outcome from the static
// position (the primary cube) changed by what the previous actions left behind (the secondary cube): a card waiting
// to come back, a rest's Shield soaking the next blow, Valour paid; and only 3% of what two actions leave behind
// together isn't the sum of each (the tertiary cube), almost all of it a blow that fells or is capped by what Valour
// is left. So the duel can be played out on numbers alone: each side's actions measured once by the rules, from
// this position (level 1), then a run of turns kept in arithmetic: Valour, Shield (soaked and spent), each card's
// clock (own turns to wait, rests needed, the price of using it again), cards left to draw, and the fell.

/** One of a side's actions, as the rollout keeps it. */
export interface RollAct {
  kind: "card" | "rest" | "draw" | "once";
  /** A card's spot (its clock is read from there). */
  spot?: number;
  /** A host's sacrifice or summon: one of each a duel, whichever monster. */
  group?: string;
  /** Wounds against no Shield; whether Shield soaks them (a Spirit blow or a piercing one passes it). */
  dealt: number; soaked: boolean;
  /** What it gives the side itself, and what it costs it (Valour, Reserve cards). */
  healed: number; shield: number; paid: number; cards: number;
  /** Its clock: own turns to wait after a use, rests needed, the price of using it again (Valour, cards). */
  wait: number; rests: number; reValour: number; reCards: number;
  /** Where it stands now: used before, own actions since, rests since. */
  used: boolean; since: number; restsSince: number;
}
export interface Repertoire { acts: RollAct[]; valour: number; shield: number; cards: number }

/** Play option i of W (side p to act) on a copy: what it did. */
function effectOf(W: State, d: NonNullable<ReturnType<typeof nextDecision>>, i: number, p: Side): OptionEffect {
  const X = cloneState(W);
  const C0 = X.combat!;
  const o = (1 - p) as Side;
  const v0 = [C0.valour[0], C0.valour[1]], s0 = C0.shield[p], duel0 = C0.duel, r0 = X.players[p].reserve.length + X.players[p].discard.length;
  applyDecision(X, d, i, false);
  const same = C0.duel === duel0 && C0.stage === "turns";
  const vo = same ? C0.valour[o] : C0.endValour[duel0][o];
  const vp = same ? C0.valour[p] : C0.endValour[duel0][p];
  const dv = vp - v0[p];
  const e: OptionEffect & { cards?: number } = { dealt: Math.max(0, v0[o] - Math.max(0, vo)), healed: Math.max(0, dv), paid: Math.max(0, -dv), shield: same ? Math.max(0, C0.shield[p] - s0) : 0, rest: false };
  e.cards = Math.max(0, r0 - (X.players[p].reserve.length + X.players[p].discard.length));
  return e;
}

/** Level 1 for the rollout: side p's actions from this position, each measured by the rules once. */
export function repertoire(S: State, p: Side): Repertoire | null {
  const W = asActor(S, p);
  if (!W) return null;
  const C = W.combat!;
  const o = (1 - p) as Side;
  const acts: RollAct[] = [];
  const blank = { healed: 0, shield: 0, paid: 0, cards: 0, wait: 0, rests: 0, reValour: 0, reCards: 0, used: false, since: 99, restsSince: 99 };
  // each card beside the fighter, as it is when fresh (its clock kept apart), against no Shield and against Shield 3
  for (const sp of [C.hs[p] + 1, C.hs[p] + 2]) {
    const c = W.board[sp];
    if (!c || c.def.type !== "support" || c.def.use) continue;
    const r = reuseOf(c.def as SupportDef);
    const fresh = (shield: number) => {
      const X = cloneState(W);
      const Cx = X.combat!;
      const u = Cx.uses.slice(); u[sp] = 0; Cx.uses = u;
      const sh = Cx.shield.slice(); sh[o] = shield; Cx.shield = sh;
      const d = nextDecision(X);
      if (!d || d.kind !== "duel") return null;
      let i = d.options.findIndex((x) => x.t === "duel" && x.act === "use" && x.spot === sp && x.guest < 0 && !x.cry && x.mode === "normal");
      if (i < 0) i = d.options.findIndex((x) => x.t === "duel" && x.act === "use" && x.spot === sp && x.guest < 0 && !x.cry);
      return i < 0 ? null : (effectOf(X, d, i, p) as OptionEffect & { cards: number });
    };
    const e0 = fresh(0);
    if (!e0) continue;
    const e3 = e0.dealt > 0 ? fresh(3) : e0;
    acts.push({
      kind: "card", spot: sp, dealt: e0.dealt, soaked: !!e3 && e3.dealt < e0.dealt, healed: e0.healed, shield: e0.shield, paid: e0.paid, cards: e0.cards,
      wait: r.turns ?? 0, rests: r.rest ?? 0, reValour: r.valour ?? 0, reCards: r.draw ?? 0,
      used: C.uses[sp] > 0, since: C.acts[p] - C.lastUse[sp], restsSince: C.restsSince[sp],
    });
  }
  // a rest, a draw, and a host's sacrifice and summon (once each), as they are now
  const d = nextDecision(W);
  if (d && d.kind === "duel") d.options.forEach((x, i) => {
    if (x.t === "duel" && x.act === "rest" && x.mode === "normal") {
      const e = effectOf(W, d, i, p);
      acts.push({ ...blank, kind: "rest", dealt: 0, soaked: false, healed: e.healed, shield: e.shield, paid: e.paid });
    } else if (x.t === "draw") {
      const e = drawEffect(W, d, i, p);
      if (e) acts.push({ ...blank, kind: "draw", dealt: e.dealt, soaked: true, healed: e.healed, shield: e.shield, paid: e.paid, cards: 1 });
    } else if (x.t === "sacrifice" || x.t === "summon") {
      const e = effectOf(W, d, i, p) as OptionEffect & { cards: number };
      acts.push({ ...blank, kind: "once", group: x.t, dealt: e.dealt, soaked: true, healed: e.healed, shield: e.shield, paid: e.paid, cards: e.cards });
    }
  });
  return { acts, valour: C.valour[p], shield: C.shield[p], cards: drawable(W, p) };
}

/** The rollout's result from side me's view: who fell (1 the foe, -1 me, 0 neither within the horizon), the Valour
 *  margin at the end (a felled side counted at 0), and the own turns it took. */
export interface Roll { win: number; margin: number; turns: number }
export const ROLL = { horizon: 12, cardWorth: 0.5, shieldWorth: 0.19 };
export function rollout(S: State, me: Side, reps?: [Repertoire | null, Repertoire | null]): Roll | null {
  const C = S.combat;
  if (!C || !toDeath(S) || C.stage !== "turns") return null;
  const R = reps ?? [repertoire(S, 0), repertoire(S, 1)];
  if (!R[0] || !R[1]) return null;
  const st = R.map((r) => ({
    v: r!.valour, sh: r!.shield, cards: r!.cards, acts: 0,
    clock: r!.acts.map((a) => ({ used: a.used, since: a.since, rs: a.restsSince, done: false })),
  }));
  let side = actorOf(C) as Side;
  let fell = -1, plies = 0;
  for (; plies < 2 * ROLL.horizon && fell < 0; plies++) {
    const A = st[side], F = st[1 - side], acts = R[side]!.acts;
    let best = -1, bs = -Infinity;
    acts.forEach((a, k) => {
      const ck = A.clock[k];
      if (a.kind === "once" && ck.done) return;
      if (a.kind === "draw" && A.cards < 1) return;
      if (a.kind === "card" && ck.used && (ck.since <= a.wait || ck.rs < a.rests || A.v <= a.reValour || A.cards < a.reCards)) return;
      const dealt = a.soaked ? Math.max(0, a.dealt - F.sh) : a.dealt;
      const paid = a.paid + (a.kind === "card" && ck.used ? a.reValour : 0), cards = a.cards + (a.kind === "card" && ck.used ? a.reCards : 0);
      if (paid >= A.v) return;
      let s = dealt - paid - ROLL.cardWorth * cards + a.healed + ROLL.shieldWorth * a.shield;
      if (dealt >= F.v) s += 1000;
      // a rest also brings back the cards that wait on it
      if (a.kind === "rest") s += 0.25 * acts.filter((b, j) => b.kind === "card" && A.clock[j].used && A.clock[j].rs < b.rests).length;
      if (s > bs) { bs = s; best = k; }
    });
    if (best >= 0) {
      const a = acts[best], ck = A.clock[best];
      const dealt = a.soaked ? Math.max(0, a.dealt - F.sh) : a.dealt;
      if (a.soaked) F.sh = Math.max(0, F.sh - a.dealt);
      F.v -= dealt;
      A.v += a.healed - a.paid - (a.kind === "card" && ck.used ? a.reValour : 0);
      A.sh += a.shield;
      A.cards -= a.cards + (a.kind === "card" && ck.used ? a.reCards : 0);
      if (a.kind === "card") { ck.used = true; ck.since = 0; ck.rs = 0; }
      if (a.kind === "once") acts.forEach((b, j) => { if (b.group === a.group) A.clock[j].done = true; });
      if (a.kind === "rest") for (const c of A.clock) c.rs++;
    }
    A.acts++;
    for (const c of A.clock) c.since++;
    if (F.v <= 0) fell = 1 - side;
    else if (A.v <= 0) fell = side;
    side = (1 - side) as Side;
  }
  const o = 1 - me;
  return { win: fell < 0 ? 0 : fell === o ? 1 : -1, margin: Math.max(0, st[me].v) - Math.max(0, st[o].v), turns: Math.ceil(plies / 2) };
}

/** The table calculator's terms: the additive ones of level 3 (Valour, Shield, the blow, what can be kept up, the
 *  sustain, the move) and the rollout's verdict (who fell, and the Valour margin it ended at). Measured together, the
 *  rollout carries what the level-3 terms miss (held out: log-loss 0.412 against 0.432, accuracy 81.2% against 79.9%). */
export const CALC2_TERMS = ["valour", "shield", "blow", "sustained", "sustain", "move", "rollWin", "rollMargin"] as const;
export type Calc2Term = (typeof CALC2_TERMS)[number];
export function calc2Terms(S: State, me: Side): Record<Calc2Term, number> | null {
  const t = calcTerms(S, me);
  if (!t) return null;
  const r = rollout(S, me);
  if (!r) return null;
  return { ...t, rollWin: r.win, rollMargin: r.margin };
}
export function calc2Edge(S: State, me: Side, w: Record<Calc2Term, number>): number | null {
  const t = calc2Terms(S, me);
  if (!t) return null;
  let e = 0;
  for (const k of CALC2_TERMS) e += (k === "valour" ? 1 : w[k] ?? 0) * t[k];
  return e;
}

// ---------------------------------------------------------------- the fast calculator: the tables, looked up
// What a side's actions do changes far more slowly than the position: within a search the board, the geasa and the
// duel's standing counters stay put while Valour, Shield and the clocks move every ply. So each side's repertoire is
// measured by the rules once per standing position (the key below leaves out Valour, Shield, the clocks and the turn)
// and kept; every other position is arithmetic on it: the clocks read live, the level-3 terms taken from the
// repertoire instead of played, and the rollout run on it.

/** The standing position, for side p: everything that changes what p's actions do, but not Valour, Shield or clocks. */
function standingKey(S: State, p: Side): string {
  const C = S.combat!;
  const id = (c: { def: { id: string } } | null | undefined) => (c ? c.def.id : "-");
  const j = (x: unknown) => (Array.isArray(x) ? x.map((v) => (v && typeof v === "object" ? id(v as never) : String(v ?? ""))).join(":") : String(x ?? ""));
  const Q = S.players[p];
  return [
    p, S.rules.setting ?? "", S.board.map(id).join(","), S.quadGeis.map(id).join(","), S.quadOath.map(id).join(","), S.globalGeis.map(id).join(","),
    S.players.map((P) => P.omens.filter((o) => o.faceUp).map((o) => id(o.card) + "@" + (o.target ?? "")).join(",")).join("/"),
    C.hostAdj.map((x) => (x ? x.remove.join("+") + ">" + x.add.map((m) => m.id).join("+") : "")).join(","),
    C.duel, j(C.hs), C.broken, j(C.cap), j(C.focus), j(C.stagger), j(C.armour), j(C.mound), j(C.bleed), j(C.cried), j(C.ebbed), j(C.block),
    j(C.nextStrike), j(C.cathbad), j(C.kingsDue), j(C.champ), j(C.sacrificed), j(C.summoned), j(C.rested), j(C.init),
    // the draw is kept as first measured (its expectation over the pile then): what is left in the Reserve changes with
    // every draw a search samples, and keying on it would measure again at nearly every one
    Math.min(Q.reserve.length + Q.discard.length, 3),
  ].join("|");
}
export const FAST = { map: new Map<string, RollAct[]>(), hits: 0, misses: 0, max: 200000 };
export function clearFast() { FAST.map.clear(); FAST.hits = 0; FAST.misses = 0; }

/** Side p's repertoire: the measured actions of its standing position, with the clocks, Valour and Shield read live. */
export function fastRepertoire(S: State, p: Side): Repertoire | null {
  const C = S.combat;
  if (!C || S.phase !== "combat" || C.stage !== "turns") return null;
  const k = standingKey(S, p);
  let acts = FAST.map.get(k);
  if (acts) FAST.hits++;
  else {
    FAST.misses++;
    const r = repertoire(S, p);
    if (!r) return null;
    acts = r.acts;
    if (FAST.map.size >= FAST.max) FAST.map.clear();
    FAST.map.set(k, acts);
  }
  return {
    acts: acts.map((a) => (a.kind === "card" && a.spot !== undefined
      ? { ...a, used: C.uses[a.spot] > 0, since: C.acts[p] - C.lastUse[a.spot], restsSince: C.restsSince[a.spot] }
      : a)),
    valour: C.valour[p], shield: C.shield[p], cards: drawable(S, p),
  };
}
/** Is act a ready for side A now (the rollout's own test)? */
const ready = (a: RollAct, v: number, cards: number) =>
  !(a.kind === "draw" && cards < 1) && !(a.kind === "card" && a.used && (a.since <= a.wait || a.restsSince < a.rests || v <= a.reValour || cards < a.reCards));
/** Level 2 from a repertoire: the best blow now against the foe's Shield, what can be kept up, the best sustain. */
function fastRate(R: Repertoire, foeShield: number): { blow: number; sustained: number; sustain: number } {
  let blow = 0, sustain = 0, sustained = 0;
  for (const a of R.acts) {
    const again = a.kind === "card" && a.used;
    if (ready(a, R.valour, R.cards) && !(a.kind === "once" && a.used)) {
      const dealt = a.soaked ? Math.max(0, a.dealt - foeShield) : a.dealt;
      blow = Math.max(blow, dealt - a.paid - (again ? a.reValour : 0));
      sustain = Math.max(sustain, a.healed + a.shield);
    }
    if (a.kind === "draw") sustained = Math.max(sustained, a.dealt - a.paid);
    if (a.kind === "card" && a.dealt > 0) sustained = Math.max(sustained, (a.dealt - a.reValour - 1.5 * a.reCards) / (1 + a.wait + a.rests));
  }
  return { blow, sustained, sustain };
}
/** The fast calculator's parts, from side me's view: each side's rates (level 2) and the rollout, from the kept repertoires. */
export function calc3Parts(S: State, me: Side): { rm: ReturnType<typeof fastRate>; ro: ReturnType<typeof fastRate>; roll: Roll } | null {
  const C = S.combat;
  if (!C || !toDeath(S) || C.stage !== "turns") return null;
  const o = (1 - me) as Side;
  const R: [Repertoire | null, Repertoire | null] = [fastRepertoire(S, 0), fastRepertoire(S, 1)];
  if (!R[0] || !R[1]) return null;
  return { rm: fastRate(R[me]!, C.shield[o]), ro: fastRate(R[o]!, C.shield[me]), roll: rollout(S, me, R)! };
}
/** The fast calculator's terms: those of the table calculator, from the kept repertoires. */
export function calc3Terms(S: State, me: Side): Record<Calc2Term, number> | null {
  const P = calc3Parts(S, me);
  if (!P) return null;
  const C = S.combat!, o = 1 - me;
  return {
    valour: C.valour[me] - C.valour[o], shield: C.shield[me] - C.shield[o],
    blow: P.rm.blow - P.ro.blow, sustained: P.rm.sustained - P.ro.sustained, sustain: P.rm.sustain - P.ro.sustain,
    move: actorOf(C) === me ? 1 : -1, rollWin: P.roll.win, rollMargin: P.roll.margin,
  };
}
export function calc3Edge(S: State, me: Side, w: Record<Calc2Term, number>): number | null {
  const t = calc3Terms(S, me);
  if (!t) return null;
  let e = 0;
  for (const k of CALC2_TERMS) e += (k === "valour" ? 1 : w[k] ?? 0) * t[k];
  return e;
}
