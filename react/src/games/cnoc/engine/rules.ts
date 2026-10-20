// Cnoc rules: a 7x7 board in three tiers. Pure functions only, so the game, the tests
// and the simulator all share exactly the same rules.

export const EMPTY = 0, SP = 1, LO = 2, RI = 3, CH = 4;
/** The Phalanx: a Host piece found only in the combining variant. */
export const PH = 5;
export type Piece = 0 | 1 | 2 | 3 | 4 | 5;
export type Side = 0 | 1; // 0 = Host, 1 = Sí
/** A move is encoded as from * 64 + to. */
export type Move = number;
export type WinReason = "crown" | "wipe" | "lord" | "hold" | "nomove" | "repeat";

export interface State {
  b: Piece[];   // 49 holes, row by row from the top
  turn: Side;
  hold: number; // Sí turns in a row holding the summit
}
export interface Applied extends State {
  /** 0: play on, 1: Host win, 2: Sí win. */
  res: 0 | 1 | 2;
  why: WinReason | null;
}
export interface Rules {
  /** Sí turns the summit must be held to win. */
  holdN: number;
  /** The combining variant: the Host's Phalanx and the Sí merging two Riders into a Chariot. */
  combine?: boolean;
}

export const N = 7;
export const NN = 49;
export const TIER: number[] = [];
export const SUMMIT: boolean[] = [];
for (let i = 0; i < NN; i++) {
  const r = (i / N) | 0, c = i % N, ring = Math.min(r, c, N - 1 - r, N - 1 - c);
  const cross = (r === 3 && c >= 2 && c <= 4) || (c === 3 && r >= 2 && r <= 4);
  TIER[i] = ring === 0 ? 1 : cross ? 3 : 2;
  SUMMIT[i] = TIER[i] === 3;
}

const SIDE: Side[] = [0, 0, 0, 1, 1, 0];
/** Riders and the Chariot are Sí; Spearmen, the Lord and the Phalanx are Host. */
export const sideOf = (p: Piece): Side => SIDE[p];
const isSi = (p: Piece) => p === RI || p === CH;
export const from = (m: Move) => m >> 6;
export const to = (m: Move) => m & 63;
export const mv = (f: number, t: number): Move => f * 64 + t;
export const sqName = (i: number) => "abcdefg"[i % N] + (N - ((i / N) | 0));
export const NAMES: Record<number, string> = { 1: "Spearman", 2: "Lord", 3: "Rider", 4: "Chariot", 5: "Phalanx" };
export const LETTER: Record<number, string> = { 1: "S", 2: "L", 3: "R", 4: "C", 5: "P" };
export const sideName = (s: Side) => (s === 0 ? "Host" : "Sí");

const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
export const ALL8 = ORTH.concat(DIAG);

/** Step or slide along each direction; a move that climbs a tier ends there. */
function slide(b: Piece[], f: number, dirs: number[][], maxd: number, me: Side, out: Move[]) {
  const r0 = (f / N) | 0, c0 = f % N;
  for (const [dr, dc] of dirs) {
    let r = r0, c = c0, prev = TIER[f];
    for (let k = 1; k <= maxd; k++) {
      r += dr; c += dc;
      if (r < 0 || r >= N || c < 0 || c >= N) break;
      const j = r * N + c, q = b[j];
      if (q && sideOf(q) === me) break;
      out.push(mv(f, j));
      if (q || TIER[j] > prev) break;
      prev = TIER[j];
    }
  }
}

export const presence = (b: Piece[], side: Side) => {
  for (let i = 0; i < NN; i++) if (SUMMIT[i] && b[i] && sideOf(b[i]) === side) return true;
  return false;
};

/** May the Rider on f merge with a neighbouring Rider? (Combining variant, summit only, no Chariot left.) */
function merges(b: Piece[], f: number, out: Move[]) {
  if (!SUMMIT[f] || b.includes(CH)) return;
  const r0 = (f / N) | 0, c0 = f % N;
  for (const [dr, dc] of ALL8) {
    const r = r0 + dr, c = c0 + dc;
    if (r < 0 || r >= N || c < 0 || c >= N) continue;
    const j = r * N + c;
    if (SUMMIT[j] && b[j] === RI) out.push(mv(f, j));
  }
}

/** Is m a merge: a Rider moving onto its own Rider? */
export const isMerge = (b: Piece[], m: Move) => b[from(m)] === RI && b[to(m)] === RI;

/** All legal moves for the side to move. Pass the rules to allow the combining variant's merges. */
export function gen(s: State, rules?: Pick<Rules, "combine">): Move[] {
  const out: Move[] = [], b = s.b, me = s.turn;
  for (let i = 0; i < NN; i++) {
    const p = b[i];
    if (!p || sideOf(p) !== me) continue;
    if (p === SP) slide(b, i, ORTH, 1, me, out);
    else if (p === RI) { slide(b, i, DIAG, 1, me, out); if (rules?.combine) merges(b, i, out); }
    else if (p === CH) slide(b, i, ORTH, N, me, out);
    else if (p === PH) slide(b, i, ALL8, 1, me, out);
    else {
      // The Lord: one or two holes in a straight line, and only onto a summit no Sí piece holds.
      const tmp: Move[] = [];
      slide(b, i, ALL8, 2, me, tmp);
      for (const m of tmp) {
        const t = to(m);
        if (SUMMIT[t]) {
          let siTop = false;
          for (let j = 0; j < NN; j++) if (j !== t && SUMMIT[j] && isSi(b[j])) { siTop = true; break; }
          if (siTop) continue;
        }
        out.push(m);
      }
    }
  }
  return out;
}

/** Apply a move and report an immediate win, if any. */
export function apply(s: State, m: Move, rules: Rules): Applied {
  const f = from(m), t = to(m), b = s.b.slice(), p = b[f], q = b[t], me = s.turn;
  b[t] = p === RI && q === RI ? CH : p; b[f] = EMPTY; // two Riders merge into a Chariot
  let res: Applied["res"] = 0, why: WinReason | null = null, hold = s.hold;
  if (q === LO) { res = 2; why = "lord"; }
  else if (p === LO && SUMMIT[t]) { res = 1; why = "crown"; }
  else if (me === 0 && q && !b.some(isSi)) { res = 1; why = "wipe"; }
  if (me === 0) { if (presence(b, 0)) hold = 0; }
  else {
    if (presence(b, 1) && !presence(b, 0)) hold++; else hold = 0;
    if (!res && hold >= rules.holdN) { res = 2; why = "hold"; }
  }
  return { b, turn: (me ^ 1) as Side, hold: Math.min(hold, 15), res, why };
}

export const key = (s: State) => s.b.join("") + s.turn + "/" + s.hold;
/** Pieces a side has, as the repetition rule counts them: a Phalanx counts as the 3 Spearmen it replaced. */
export const count = (b: Piece[], side: Side): number => b.reduce<number>((n, p) => n + (p && sideOf(p) === side ? (p === PH ? 3 : 1) : 0), 0);

/** Does move m win at once for the mover (including leaving the other side with no move)? */
export function immediateWin(s: State, m: Move, rules: Rules): boolean {
  const t = apply(s, m, rules);
  if (t.res) return t.res - 1 === s.turn;
  return gen(t, rules).length === 0;
}

export const emptyBoard = (): Piece[] => Array<Piece>(NN).fill(EMPTY);
