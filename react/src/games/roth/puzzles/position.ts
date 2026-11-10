// Puzzle positions: a match state stored compactly (card ids for card objects), and the exact value of each
// choice under the puzzle's assumption that, after your choice, everyone holds through the rest of the Playing
// turn and both duels are then played perfectly by both sides (no guests or champions).
import { ALL_DEFS, FIRST_PRINTING, UNKNOWN, type CardDef } from "../engine/cards";
import {
  applyDecision, cloneCombat, cloneState, combatApply, combatDecision, newCombat, nextDecision, upgradeState,
  type CombatState, type Decision, type Side, type State,
} from "../engine/engine";
import { finalUtil, stripGuests } from "../engine/solver";

/** Puzzle positions use the cards as first printed (see FIRST_PRINTING). */
const defOf = (id: string): CardDef => (id === "unknown" ? UNKNOWN : FIRST_PRINTING[id] ?? ALL_DEFS[id]);

export function packState(S: State): string {
  return JSON.stringify({ ...S, stats: null }, (k, v) => {
    if (k === "def" && v && typeof v === "object") return (v as CardDef).id;
    if (k === "deckList" && Array.isArray(v)) return (v as CardDef[]).map((d) => d.id);
    return v;
  });
}
export function unpackState(json: string): State {
  const S = JSON.parse(json, (k, v) => {
    if (k === "def" && typeof v === "string") return defOf(v);
    if (k === "deckList" && Array.isArray(v)) return (v as string[]).map(defOf);
    return v;
  }) as State;
  return upgradeState(S); // positions saved before attendants and host actions existed
}

/** Full minimax over both duels (alpha-beta), from `me`'s side. Guests and champions are left out. */
export function solveFull(S: State, C: CombatState, me: Side, a: number, b: number): number {
  if (C.stage === "done") return finalUtil(C, me);
  const d = combatDecision(S, C)!;
  const idx = d.options.map((_, i) => i).filter((i) => {
    const o = d.options[i];
    return !(o.t === "duel" && o.guest >= 0) && o.t !== "champion";
  });
  const max = d.player === me;
  let best = max ? -Infinity : Infinity;
  for (const i of idx) {
    const C2 = cloneCombat(C);
    combatApply(S, C2, d.options[i], null);
    const v = solveFull(S, C2, me, a, b);
    if (max) { if (v > best) best = v; if (best > a) a = best; } else { if (v < best) best = v; if (best < b) b = best; }
    if (a >= b) break;
  }
  return best;
}

/** Value of the combat as it stands (or as the board would start it), for `me`. */
export function combatValue(S: State, me: Side): number {
  const T = cloneState(S);
  const C = T.combat ? cloneCombat(T.combat) : newCombat(T);
  stripGuests(C, null);
  return solveFull(T, C, me, -Infinity, Infinity);
}

/** Play the rest of the round with everyone holding (and turning nothing), up to the duels. */
function holdToCombat(S: State): State {
  for (let guard = 0; guard < 100; guard++) {
    const d = nextDecision(S);
    if (!d || S.phase === "combat" || S.phase === "end") return S;
    const hold = d.options.findIndex((o) => o.t === "hold" || o.t === "lateDone");
    if (hold < 0) return S; // a draft decision: the board must already be full for the puzzle's question
    applyDecision(S, d, hold, false);
  }
  return S;
}

/** The value of every option of the pending decision, for the player who must choose. */
export function optionValues(S0: State): { d: Decision; values: number[] } {
  const S = cloneState(S0);
  const d = nextDecision(S)!;
  const me = d.player;
  const values = d.options.map((o, i) => {
    const T = cloneState(S);
    if (d.kind === "duel" || d.kind === "focus") {
      if (o.t === "champion" || (o.t === "duel" && o.guest >= 0)) return NaN;
      const C = cloneCombat(T.combat!);
      stripGuests(C, null);
      combatApply(T, C, o, null);
      return solveFull(T, C, me, -Infinity, Infinity);
    }
    if (d.kind === "place") {
      // Drafting puzzles: the other spots are already settled; play the placement onto the board and judge it.
      const c = T.players[me].hand.find((x) => x.uid === (o as { uid: number }).uid)!;
      T.board[d.spot!] = c;
      T.players[me].hand = T.players[me].hand.filter((x) => x !== c);
      T.phase = "play"; T.step = 7; T.sub = 0;
      for (const P of T.players) { P.lost.push(...P.omens.filter((x) => !x.faceUp).map((x) => x.card)); P.omens = P.omens.filter((x) => x.faceUp); }
      return combatValue(T, me);
    }
    applyDecision(T, d, i, false);
    holdToCombat(T);
    return combatValue(T, me);
  });
  return { d, values };
}
