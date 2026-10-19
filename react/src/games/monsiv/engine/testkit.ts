// Helpers for tests. The original page had two separate copies of the rules: the game's
// (object pieces, a set of seen positions) and the puzzle engine's (which core.ts ports).
// This file ports the game's copy, so tests can check one against the other and verify
// puzzles with a solver that shares no code with the one being tested.
import type { Move, State, Turn } from "./core";

const CODE: Record<string, number> = { ".": 0, T: 1, A: 2, C: 3, t: 9, a: 10, c: 11 };
/** rows: 5 strings of 5 characters, rank 5 first. White T A C, black t a c, "." empty. */
export function pos(rows: string[], turn: Turn = 0, ls: [number, number] = [-1, -1]): State {
  const b = rows.join("").split("").map(ch => CODE[ch]);
  if (b.length !== 25 || b.some(x => x === undefined)) throw new Error("need 25 squares");
  return { b, turn, ls };
}
export const at = (sq: string) => (5 - Number(sq[1])) * 5 + (sq.charCodeAt(0) - 97);

/* ---------- The original game's rules, object style ---------- */
type P = { c: "w" | "b"; t: "T" | "A" | "C" } | null;
interface RS { b: P[]; turn: "w" | "b"; lastSwap: { w: string | null; b: string | null } }
type RM = { k: "m"; from: number; to: number; cap: string | null; t: string } | { k: "s"; a: number; b: number; key: string };

const DIRS: Record<string, [number, number][]> = {
  T: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
  A: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  C: [[-1, 0], [1, 0], [0, -1], [0, 1]],
};
const other = (c: "w" | "b") => (c === "w" ? "b" : "w");
const posKey = (b: P[], turn: string) => b.map(p => (p ? p.c + p.t : ".")).join("") + turn;

function toRS(s: State): RS {
  const ls = (v: number) => (v < 0 ? null : `${Math.floor(v / 25)}-${v % 25}`);
  return { b: s.b.map(v => (v ? { c: v & 8 ? "b" : "w", t: "?TAC"[v & 7] as "T" | "A" | "C" } : null)), turn: s.turn ? "b" : "w", lastSwap: { w: ls(s.ls[0]), b: ls(s.ls[1]) } };
}
function attacked(b: P[], sq: number, by: string) {
  const r = (sq / 5) | 0, c = sq % 5;
  for (let i = 0; i < 25; i++) {
    const p = b[i];
    if (!p || p.c !== by) continue;
    for (const [dr, dc] of DIRS[p.t]) if (((i / 5) | 0) + dr === r && (i % 5) + dc === c) return true;
  }
  return false;
}
function throneMoveOk(s: RS, m: RM) {
  const me = s.turn, b = s.b.slice();
  let to: number;
  if (m.k === "m") {
    if (m.t !== "T") return true;
    if (m.cap === "T" || ((m.to / 5) | 0) === (me === "w" ? 0 : 4)) return true;
    b[m.to] = b[m.from]; b[m.from] = null; to = m.to;
  } else {
    const ta = s.b[m.a]!.t === "T", tb = s.b[m.b]!.t === "T";
    if (!ta && !tb) return true;
    const t = b[m.a]; b[m.a] = b[m.b]; b[m.b] = t; to = ta ? m.b : m.a;
  }
  return !attacked(b, to, other(me));
}
function repeats(s: RS, m: RM, seen: Set<string>) {
  const me = s.turn, b = s.b.slice();
  if (m.k === "m") {
    if (m.cap === "T" || ((m.to / 5) | 0) === (me === "w" ? 0 : 4)) return false;
    b[m.to] = b[m.from]; b[m.from] = null;
  } else { const t = b[m.a]; b[m.a] = b[m.b]; b[m.b] = t; }
  return seen.has(posKey(b, other(me)));
}
function genMoves(s: RS, seen: Set<string>): RM[] {
  const ms: RM[] = [];
  for (let i = 0; i < 25; i++) {
    const p = s.b[i];
    if (!p || p.c !== s.turn) continue;
    const r = (i / 5) | 0, c = i % 5;
    for (const [dr, dc] of DIRS[p.t]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr > 4 || cc < 0 || cc > 4) continue;
      const j = rr * 5 + cc, q = s.b[j];
      if (!q || q.c !== p.c) ms.push({ k: "m", from: i, to: j, cap: q ? q.t : null, t: p.t });
    }
    for (const [dr, dc] of DIRS.T) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr > 4 || cc < 0 || cc > 4) continue;
      const j = rr * 5 + cc, q = s.b[j];
      if (j > i && q && q.c === p.c && q.t !== p.t) {
        const key = i + "-" + j;
        if (s.lastSwap[s.turn] !== key) ms.push({ k: "s", a: i, b: j, key });
      }
    }
  }
  return ms.filter(m => throneMoveOk(s, m) && !repeats(s, m, seen));
}
function applyRef(s: RS, m: RM, seen: Set<string>): { s: RS; winner: boolean } {
  const me = s.turn;
  const n: RS = { b: s.b.slice(), turn: other(me), lastSwap: { ...s.lastSwap } };
  let winner = false;
  if (m.k === "m") {
    const captured = n.b[m.to];
    n.b[m.to] = n.b[m.from]; n.b[m.from] = null;
    n.lastSwap[me] = null;
    if (captured && captured.t === "T") winner = true;
    else if (((m.to / 5) | 0) === (me === "w" ? 0 : 4)) winner = true;
  } else {
    const t = n.b[m.a]; n.b[m.a] = n.b[m.b]; n.b[m.b] = t;
    n.lastSwap[me] = m.key;
  }
  if (!winner && genMoves(n, seen).length === 0) winner = true;
  return { s: n, winner };
}
const toMove = (m: RM): Move => (m.k === "m" ? [0, m.from, m.to] : [1, m.a, m.b]);
const fromMove = (s: RS, m: Move): RM => (m[0] === 0
  ? { k: "m", from: m[1], to: m[2], cap: s.b[m[2]]?.t ?? null, t: s.b[m[1]]!.t }
  : { k: "s", a: m[1], b: m[2], key: `${m[1]}-${m[2]}` });

/** A position under the reference rules, with every position seen so far. */
export interface Ref { s: RS; seen: Set<string> }
export const refStart = (s: State, history: State[] = []): Ref => {
  const seen = new Set(history.map(h => posKey(toRS(h).b, toRS(h).turn)));
  const r = toRS(s);
  seen.add(posKey(r.b, r.turn));
  return { s: r, seen };
};
export const refMoves = (r: Ref): Move[] => genMoves(r.s, r.seen).map(toMove);
/** Play a move under the reference rules; `won` if it ends the game for the mover. */
export function refPlay(r: Ref, m: Move): { r: Ref; won: boolean } {
  const res = applyRef(r.s, fromMove(r.s, m), r.seen);
  const seen = new Set(r.seen);
  seen.add(posKey(res.s.b, res.s.turn));
  return { r: { s: res.s, seen }, won: res.winner };
}

/** Brute force: can the side to move force a win within n of its own moves? */
export function refWin(r: Ref, n: number): boolean {
  return refMoves(r).some(m => refForces(r, m, n));
}
/** Does m force a win within n moves (m included), whatever the reply? */
export function refForces(r: Ref, m: Move, n: number): boolean {
  const a = refPlay(r, m);
  if (a.won) return true;
  if (n <= 1) return false;
  return refMoves(a.r).every(rep => {
    const b = refPlay(a.r, rep);
    return !b.won && refWin(b.r, n - 1);
  });
}
