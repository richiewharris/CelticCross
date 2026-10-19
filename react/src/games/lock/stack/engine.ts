// Celtic Cross Lock, stacked discs: the rules. A lock is a stack of dials, one on top of another.
// You work only the top disc; when its knot is whole and you press the center it opens and lifts
// away, and the disc beneath comes up. One purse of turns pays for the whole stack and never refills.
// Pure: no React, no DOM, no timers. Randomness comes in as rng().
import { TIERS, WC, makeKnot, minTurns, rnd, rotCCW, rotCW, scramble, solved, type Rng, type TierId } from "../engine/knot";

export interface StackSpec { layers: TierId[]; desc: string }

/** The discs of each tier, top to bottom. Each disc is a full dial of that tier's size. */
export const STACKS: Record<TierId, StackSpec> = {
  1: { layers: [1, 1], desc: "Two iron discs. 24 stones in all." },
  2: { layers: [1, 2], desc: "An iron disc over a bronze one. 28 stones in all." },
  3: { layers: [2, 2, 3], desc: "Three discs: bronze, bronze, then silver with crossings." },
  4: { layers: [2, 3, 4], desc: "Three discs, each bigger than the last: bronze, silver, gold." },
  5: { layers: [2, 3, 4, 5], desc: "Four discs, down to an ogham disc of 30 stones at the bottom." },
};

export interface Layer { tier: TierId; sol: number[]; cur: number[]; phi: number }

export interface Stack {
  tier: TierId;
  layers: Layer[];
  /** The disc being worked: 0 is the top. Discs above it have been opened and lifted away. */
  at: number;
  /** Turns given at the start, and turns still in the purse. */
  purse: number; left: number;
  /** The bottom disc has opened, so the box is open. */
  open: boolean;
  /** Presses on a broken knot during this stack. */
  broken: number;
}

/** Starting spin: a sector centred in the window (as the dial's deal()). */
function startPhi(t: TierId, rng: Rng) { const da = 360 / TIERS[t].sectors; return WC - (rnd(TIERS[t].sectors, rng) + .5) * da; }

export function dealLayer(t: TierId, rng: Rng = Math.random): Layer {
  const sol = makeKnot(TIERS[t], rng);
  return { tier: t, sol, cur: scramble(sol, TIERS[t], rng), phi: startPhi(t, rng) };
}

/** Quarter turns still needed to put a disc back as it was dealt. */
export const layerNeed = (l: Layer) => minTurns(l.cur, l.sol);
/** Quarter turns still needed for this disc and every disc beneath it. */
export const needFrom = (st: Stack, from = st.at) => st.layers.slice(from).reduce((n, l) => n + layerNeed(l), 0);

/**
 * Turns to spare on top of what every disc needs: more for higher skill, fewer on harder tiers,
 * and a little more for each disc (one slip per disc should be survivable). Never fewer than one per disc.
 */
export function stackSpare(skill: number, tier: TierId, layers: number, rng: Rng = Math.random): number {
  return Math.max(layers, Math.round(2 + layers + skill / 14 - tier * 0.6 + rng()));
}

export function dealStack(tier: TierId, skill: number, rng: Rng = Math.random): Stack {
  const layers = STACKS[tier].layers.map(t => dealLayer(t, rng));
  const need = layers.reduce((n, l) => n + layerNeed(l), 0);
  const purse = need + stackSpare(skill, tier, layers.length, rng);
  return { tier, layers, at: 0, purse, left: purse, open: false, broken: 0 };
}

export const current = (st: Stack) => st.layers[st.at];
export const isLast = (st: Stack) => st.at === st.layers.length - 1;
export const layerSolved = (l: Layer) => { const T = TIERS[l.tier]; return solved(l.cur, T.rings, T.sectors); };

/** Give stone k of the top disc a quarter turn. Unchanged if it can't turn (crossing, empty purse, box open). */
export function turnStone(st: Stack, k: number, ccw: boolean): Stack {
  const L = current(st);
  if (st.open || st.left <= 0 || L.cur[k] === undefined || L.cur[k] === 15) return st;
  const cur = L.cur.slice(); cur[k] = ccw ? rotCCW(cur[k]) : rotCW(cur[k]);
  const layers = st.layers.slice(); layers[st.at] = { ...L, cur };
  return { ...st, layers, left: st.left - 1 };
}

export type PressKind = "next" | "box" | "broken";

/**
 * Press the center. A whole knot opens the disc: the next one comes up, or the box opens if it was
 * the bottom one. A broken knot scrambles that disc again; the purse does not refill.
 */
export function press(st: Stack, rng: Rng = Math.random): { kind: PressKind; st: Stack } {
  if (st.open) return { kind: "box", st };
  const L = current(st);
  if (layerSolved(L)) {
    if (isLast(st)) return { kind: "box", st: { ...st, open: true } };
    return { kind: "next", st: { ...st, at: st.at + 1 } };
  }
  const layers = st.layers.slice();
  layers[st.at] = { ...L, cur: scramble(L.sol, TIERS[L.tier], rng), phi: startPhi(L.tier, rng) };
  return { kind: "broken", st: { ...st, layers, broken: st.broken + 1 } };
}

/** Out of turns with the top disc's knot still broken: the attempt is over and the stack resets. */
export const stranded = (st: Stack) => !st.open && st.left <= 0 && !layerSolved(current(st));

/** A fresh stack and a fresh purse after running dry (or on New stack). */
export const resetStack = (st: Stack, skill: number, rng: Rng = Math.random) => dealStack(st.tier, skill, rng);

/* ---------- Skill ---------- */

/** Skill gained for opening the box: grows with the tier, the number of discs and the turns left. */
export function stackSkillGain(skill: number, tier: TierId, layers: number, left: number, cheated: boolean): number {
  return cheated ? 0 : Math.min(100 - skill, Math.max(1, Math.round(tier * 1.5 + layers * 1.5 + left * .5 - skill / 30)));
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
export const METAL: Record<TierId, string> = { 1: "Iron", 2: "Bronze", 3: "Silver", 4: "Gold", 5: "Ogham" };
