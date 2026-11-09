import { ALL_DEFS, CONNACHT, ULSTER } from "../cards";
import {
  applyDecision, newCombat, newMatch, nextDecision, ownerOfSpot,
  type Card, type Option, type Rules, type Side, type State,
} from "../engine";

let uid = 10000;
export const card = (id: string, owner: Side): Card => {
  const def = ALL_DEFS[id];
  if (!def) throw new Error(`no card ${id}`);
  return { uid: uid++, def, owner };
};

export interface Spec {
  /** 12 card ids for spots 1–12; "id@0" / "id@1" overrides the owner (e.g. a supplanted card). */
  board: (string | null)[];
  geasa?: (string | null)[]; // per quadrant 1–4 (laid by the enemy)
  oaths?: (string | null)[]; // per quadrant 1–4 (sworn by the owner)
  omens?: [string[], string[]]; // face-up omens per player
  hands?: [string[], string[]];
  rules?: Partial<Rules>;
}

/** A match jumped straight to combat with the given board. */
export function combatState(spec: Spec): State {
  const S = newMatch([ULSTER, CONNACHT], spec.rules ?? {}, 1);
  for (const P of S.players) { P.deck = []; P.hand = []; P.reserve = []; P.omens = []; }
  S.board = spec.board.map((x, i) => {
    if (!x) return null;
    const [id, o] = x.split("@");
    return card(id, o !== undefined ? (Number(o) as Side) : ownerOfSpot(i));
  });
  S.quadGeis = (spec.geasa ?? [null, null, null, null]).map((g, q) => (g ? card(g, q < 2 ? 1 : 0) : null));
  S.quadOath = (spec.oaths ?? [null, null, null, null]).map((g, q) => (g ? card(g, q < 2 ? 0 : 1) : null));
  if (spec.omens) spec.omens.forEach((ids, p) => { S.players[p].omens = ids.map((id) => ({ card: card(id, p as Side), faceUp: true })); });
  if (spec.hands) spec.hands.forEach((ids, p) => { S.players[p].hand = ids.map((id) => card(id, p as Side)); });
  S.phase = "combat";
  S.combat = newCombat(S);
  return S;
}

/** Standard filler board: spot list with heroes at 1,4,7,10. */
export function board(d1: [string, string, string], d1e: [string, string, string], d2: [string, string, string] = ["emer", "salmon", "salmon"], d2e: [string, string, string] = ["morrigan", "salmon", "salmon"]): (string | null)[] {
  return [...d1, ...d2, ...d1e, ...d2e];
}

export type Pat = Partial<Extract<Option, { t: "duel" }>> | Partial<Option>;
/** Apply the first pending option matching the pattern (spot given 1-based as `at`). */
export function act(S: State, pat: Pat & { at?: number }): void {
  const d = nextDecision(S);
  if (!d) throw new Error("no decision pending");
  const want: Record<string, unknown> = { ...pat };
  if (pat.at !== undefined) { want.spot = pat.at - 1; delete want.at; }
  const i = d.options.findIndex((o) => Object.entries(want).every(([k, v]) => (o as Record<string, unknown>)[k] === v));
  if (i < 0) throw new Error(`no option matching ${JSON.stringify(want)} in ${JSON.stringify(d.options)}`);
  applyDecision(S, d, i);
}
export const use = (S: State, at: number, mode: "normal" | "break" | "ignore" = "normal", guest = -1) => act(S, { t: "duel", act: "use", at, mode, guest });
export const rest = (S: State, mode: "normal" | "break" | "ignore" = "normal") => act(S, { t: "duel", act: "rest", mode, guest: -1 });
export const V = (S: State) => S.combat!.valour.slice();
export const actor = (S: State) => nextDecision(S)?.player;
export const options = (S: State) => nextDecision(S)!.options;
