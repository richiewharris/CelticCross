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
import { actorOf, applyDecision, cloneState, fighter, nextDecision, toDeath, type Side, type State } from "./engine";

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

/** Level 2: what side p can do each turn from here. */
export interface TurnRate { blow: number; sustain: number; options: number }
export function turnRate(S: State, p: Side): TurnRate {
  const ef = optionEffects(S, p);
  let blow = 0, sustain = 0;
  for (const e of ef) {
    blow = Math.max(blow, e.dealt - e.paid);
    sustain = Math.max(sustain, e.healed + e.shield);
  }
  return { blow, sustain, options: ef.length };
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
  // turns a side lasts: its effective Valour over the foe's best blow each turn (sustain is measured beside it, and
  // the check says whether it belongs in the race). A foe that can't wound it at all needs "for ever": cap at 30.
  const lasts = (p: Side, foe: Side, foeRate: TurnRate) => (foeRate.blow <= 0 ? 30 : Math.min(30, Math.ceil(Math.max(0, eff(p, foe)) / foeRate.blow)));
  const tMe = lasts(o, me, rm);   // own turns I need to fell the foe
  const tFoe = lasts(me, o, ro);  // its turns it needs to fell me
  // whoever acts next gets its turns in first: a tie goes to it
  const next = actorOf(C) === me ? 0.5 : -0.5;
  const margin = tFoe - tMe + next;
  return { tMe, tFoe, margin, win: 1 / (1 + Math.exp(-margin / CALC.spread * 2)), rateMe: rm, rateFoe: ro };
}
