// Cnoc Mór rules: a 9x9 hill in four tiers, with reserves. Pure functions only, so the game,
// the tests, the review and the simulator all share exactly the same rules.

export const EMPTY = 0, SP = 1, LO = 2, RI = 3, CH = 4;
export type Piece = 0 | 1 | 2 | 3 | 4;
export type Side = 0 | 1; // 0 = Host, 1 = Sí
/** A move is encoded as from * 128 + to; from = DROP brings a piece in from reserve. */
export type Move = number;
export type WinReason = "crown" | "wipe" | "lord" | "nomove" | "repeat" | "long";

export interface State {
  b: Piece[];  // 81 holes, row by row from the top
  turn: Side;
  rh: number;  // Host spearmen still in reserve
  rs: number;  // Sí Riders still in reserve
  ply: number; // moves played since the setup
}
export interface Applied extends State {
  /** 0: play on, 1: Host win, 2: Sí win. */
  res: 0 | 1 | 2;
  why: WinReason | null;
}

export const N = 9;
export const NN = 81;
export const CENTRE = 40;
export const DROP = 127;
export const PLY_LIMIT = 300;
export const RES_H = 3, RES_S = 1;

export const TIER: number[] = [];
export const SUMMIT: boolean[] = [];
for (let i = 0; i < NN; i++) {
  const r = (i / N) | 0, c = i % N, ring = Math.min(r, c, N - 1 - r, N - 1 - c);
  const cross = (r === 4 && Math.abs(c - 4) <= 1) || (c === 4 && Math.abs(r - 4) <= 1);
  TIER[i] = ring === 0 ? 1 : ring === 1 ? 2 : cross ? 4 : 3;
  SUMMIT[i] = TIER[i] === 4;
}

export const sideOf = (p: Piece): Side => (p >= 3 ? 1 : 0);
export const from = (m: Move) => m >> 7;
export const to = (m: Move) => m & 127;
export const mv = (f: number, t: number): Move => f * 128 + t;
export const isDrop = (m: Move) => from(m) === DROP;
export const sqName = (i: number) => "abcdefghi"[i % N] + (N - ((i / N) | 0));
export const NAMES: Record<number, string> = { 1: "Spearman", 2: "Lord", 3: "Rider", 4: "Chariot" };
export const PLURAL: Record<number, string> = { 1: "spearmen", 3: "riders" };
export const LETTER: Record<number, string> = { 1: "S", 2: "L", 3: "R", 4: "C" };
export const sideName = (s: Side) => (s === 0 ? "Host" : "Sí");

const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
export const ALL8 = ORTH.concat(DIAG);

/** Slide or step from a hole. A move that climbs a tier ends there. */
function slide(b: Piece[], f: number, dirs: number[][], maxd: number, me: Side, out: Move[], kind: Piece) {
  const r0 = (f / N) | 0, c0 = f % N;
  for (const [dr, dc] of dirs) {
    let r = r0, c = c0, prev = TIER[f];
    for (let k = 1; k <= maxd; k++) {
      r += dr; c += dc;
      if (r < 0 || r >= N || c < 0 || c >= N) break;
      const j = r * N + c, q = b[j];
      if (q && sideOf(q) === me) break;
      if (kind === SP && dr && dc && TIER[j] > prev) break;   // spearmen climb only straight
      if (kind === LO && j === CENTRE && q) break;            // the Lord can't take a piece standing on the cairn
      if (kind === RI && q === LO && TIER[j] === 1) break;    // the Lord is safe from Riders on the outer ring
      out.push(f * 128 + j);
      if (q || TIER[j] > prev) break;
      prev = TIER[j];
    }
  }
}

export const presence = (b: Piece[], side: Side) => {
  for (let i = 0; i < NN; i++) if (SUMMIT[i] && b[i] && sideOf(b[i]) === side) return true;
  return false;
};

/** All legal moves for the side to move (a return to the summit may repeat a plain move, as in the original). */
export function gen(s: State): Move[] {
  const out: Move[] = [], b = s.b, me = s.turn;
  for (let i = 0; i < NN; i++) {
    const p = b[i];
    if (!p || sideOf(p) !== me) continue;
    if (p === SP) slide(b, i, ALL8, 1, me, out, SP);
    else if (p === LO) slide(b, i, ALL8, 1, me, out, LO);
    else if (p === RI) slide(b, i, DIAG, N, me, out, RI);
    else slide(b, i, ORTH, N, me, out, CH);
  }
  if (me === 1 && !presence(b, 0)) {
    // A Sí piece may return to any empty summit hole while no Host piece stands on the summit.
    for (let j = 0; j < NN; j++) if (SUMMIT[j] && !b[j]) for (let i = 0; i < NN; i++) if (b[i] >= RI && !SUMMIT[i]) out.push(i * 128 + j);
  }
  if (me === 0 && s.rh > 0) for (let j = 0; j < NN; j++) if (!b[j] && TIER[j] === 1) out.push(DROP * 128 + j);
  if (me === 1 && s.rs > 0) for (let j = 0; j < NN; j++) if (!b[j] && TIER[j] >= 3) out.push(DROP * 128 + j);
  return out;
}

/** Apply a move and report an immediate win, if any. */
export function apply(s: State, m: Move): Applied {
  const f = from(m), t = to(m), b = s.b.slice(), me = s.turn, q = b[t];
  let rh = s.rh, rs = s.rs, p: Piece;
  if (f === DROP) { p = me === 0 ? SP : RI; if (me === 0) rh--; else rs--; }
  else { p = b[f]; b[f] = EMPTY; }
  b[t] = p;
  let res: Applied["res"] = 0, why: WinReason | null = null;
  if (q === LO) { res = 2; why = "lord"; }
  else if (p === LO && t === CENTRE) { res = 1; why = "crown"; }
  else if (me === 0 && q && rs === 0 && !b.some(x => x >= 3)) { res = 1; why = "wipe"; }
  return { b, turn: (me ^ 1) as Side, rh, rs, ply: (s.ply || 0) + 1, res, why };
}

/** Position key for repetition: the board, the side to move and both reserves (not the ply). */
export const key = (s: State) => s.b.join("") + s.turn + "/" + s.rh + s.rs;
export const count = (b: Piece[], side: Side): number => b.reduce<number>((n, p) => n + (p && sideOf(p) === side ? 1 : 0), 0);
/** Pieces on the board plus the reserve. */
export const total = (s: State, side: Side) => count(s.b, side) + (side === 0 ? s.rh : s.rs);

/** Does move m win at once for the mover (including leaving the other side with no move)? */
export function immediateWin(s: State, m: Move): boolean {
  const t = apply(s, m);
  if (t.res) return t.res - 1 === s.turn;
  return gen(t).length === 0;
}

export const emptyBoard = (): Piece[] => Array<Piece>(NN).fill(EMPTY);
export const emptyState = (): State => ({ b: emptyBoard(), turn: 0, rh: RES_H, rs: RES_S, ply: 0 });
/** Setup zones: Host on the outer ring, Sí on the upper slope or the summit. */
export const zoneOk = (side: Side, i: number) => (side === 0 ? TIER[i] === 1 : TIER[i] >= 3);
