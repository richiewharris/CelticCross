// Monsiv rules and the puzzle engine: a line-by-line port of the original page's puzzleCore(),
// fast enough to prove forced wins. The game, the computer player and the puzzle trainer all use it.
// Puzzle generation is deterministic: puzzleFor(L, i) gives the same puzzle as the original page.

/** Square contents: 0 empty; type in the low bits (Throne 1, Angel 2, Cross 3); black adds 8. */
export const T = 1, A = 2, C = 3, BL = 8;
export type Turn = 0 | 8;
export type Kind = typeof T | typeof A | typeof C;

/** A position: board, side to move, and each side's last swap (a*25+b, or -1), white first. */
export interface State { b: number[]; turn: Turn; ls: [number, number] }
/** A move: [0, from, to] steps (and captures); [1, a, b] swaps two own pieces, a < b. */
export type Move = [0 | 1, number, number];
/** Earlier positions this game (only board and side to move matter for the no-repeat rule). */
export type Path = { b: number[]; turn: number }[];

const DIRS: Record<Kind, [number, number][]> = {
  1: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
  2: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  3: [[-1, 0], [1, 0], [0, -1], [0, 1]],
};
const STEP: Record<Kind, number[][]> = { 1: [], 2: [], 3: [] };
export const ADJ: number[][] = [];
for (let i = 0; i < 25; i++) {
  const r = (i / 5) | 0, c = i % 5;
  for (const t of [1, 2, 3] as Kind[]) {
    STEP[t][i] = DIRS[t].filter(([dr, dc]) => r + dr >= 0 && r + dr < 5 && c + dc >= 0 && c + dc < 5).map(([dr, dc]) => (r + dr) * 5 + c + dc);
  }
  ADJ[i] = STEP[1][i];
}
export const col = (p: number) => p & BL;
export const kind = (p: number) => (p & 7) as Kind;
/** The row a side wins by reaching: row 0 (rank 5) for white, row 4 (rank 1) for black. */
export const farRow = (turn: number) => (turn === 0 ? 0 : 4);
export const other = (turn: Turn): Turn => (turn ^ BL) as Turn;

/** Could a piece of colour `by` step onto sq? */
export function attacked(b: number[], sq: number, by: number): boolean {
  for (const j of ADJ[sq]) {
    const p = b[j];
    if (!p || col(p) !== by) continue;
    const t = p & 7;
    if (t === T) return true;
    const diag = ((j / 5) | 0) !== ((sq / 5) | 0) && j % 5 !== sq % 5;
    if ((t === A) === diag) return true;
  }
  return false;
}
function seen(path: Path, b: number[], turn: number): boolean {
  for (let k = 0; k < path.length; k++) {
    const p = path[k];
    if (p.turn === turn) {
      let ok = true;
      for (let i = 0; i < 25; i++) if (p.b[i] !== b[i]) { ok = false; break; }
      if (ok) return true;
    }
  }
  return false;
}

/** Does m win on the spot: take the Throne or reach the far row? */
export function winsNow(s: State, m: Move): boolean {
  if (m[0] !== 0) return false;
  const q = s.b[m[2]];
  return (!!q && (q & 7) === T) || ((m[2] / 5) | 0) === farRow(s.turn);
}
/** Throne safety and no repeats (a move that wins on the spot is always allowed). */
function legal(s: State, m: Move, path: Path): boolean {
  if (winsNow(s, m)) return true;
  const b = s.b.slice(), me = s.turn, opp = me ^ BL;
  let to = -1;
  if (m[0] === 0) { if ((b[m[1]] & 7) === T) to = m[2]; b[m[2]] = b[m[1]]; b[m[1]] = 0; }
  else { const ta = (b[m[1]] & 7) === T, tb = (b[m[2]] & 7) === T; if (ta) to = m[2]; if (tb) to = m[1]; const t = b[m[1]]; b[m[1]] = b[m[2]]; b[m[2]] = t; }
  if (to >= 0 && attacked(b, to, opp)) return false;
  return !seen(path, b, opp);
}
/** Legal moves for the side to move, in the original's order. */
export function gen(s: State, path: Path, firstOnly = false): Move[] {
  const out: Move[] = [], b = s.b, me = s.turn;
  for (let i = 0; i < 25; i++) {
    const p = b[i];
    if (!p || col(p) !== me) continue;
    for (const j of STEP[kind(p)][i]) {
      const q = b[j];
      if (q && col(q) === me) continue;
      const m: Move = [0, i, j];
      if (legal(s, m, path)) { out.push(m); if (firstOnly) return out; }
    }
    for (const j of ADJ[i]) {
      const q = b[j];
      if (j > i && q && col(q) === me && (q & 7) !== (p & 7) && s.ls[me ? 1 : 0] !== i * 25 + j) {
        const m: Move = [1, i, j];
        if (legal(s, m, path)) { out.push(m); if (firstOnly) return out; }
      }
    }
  }
  return out;
}
export function apply(s: State, m: Move): State {
  const b = s.b.slice(), ls: [number, number] = [s.ls[0], s.ls[1]];
  if (m[0] === 0) { b[m[2]] = b[m[1]]; b[m[1]] = 0; ls[s.turn ? 1 : 0] = -1; }
  else { const t = b[m[1]]; b[m[1]] = b[m[2]]; b[m[2]] = t; ls[s.turn ? 1 : 0] = m[1] * 25 + m[2]; }
  return { b, turn: other(s.turn), ls };
}
/** Does m win on the spot, including leaving the opponent with no move? */
export function immediate(s: State, m: Move, path: Path): boolean {
  if (winsNow(s, m)) return true;
  const t = apply(s, m);
  path.push(t);
  const none = gen(t, path, true).length === 0;
  path.pop();
  return none;
}

let nodes = 0;
/** Can the side to move force a win within n of its own moves? */
export function win(s: State, n: number, path: Path): boolean {
  nodes++;
  const ms = gen(s, path);
  for (const m of ms) if (immediate(s, m, path)) return true;
  if (n <= 1) return false;
  for (const m of ms) if (forces(s, m, n, path)) return true;
  return false;
}
/** After my move m, does every reply still lose within n-1 more of my moves? */
export function forces(s: State, m: Move, n: number, path: Path): boolean {
  if (immediate(s, m, path)) return true;
  if (n <= 1) return false;
  const t = apply(s, m);
  path.push(t);
  const rs = gen(t, path);
  let ok = true;
  for (const r of rs) if (winsNow(t, r)) { ok = false; break; }
  if (ok) for (const r of rs) {
    const u = apply(t, r);
    path.push(u);
    const w = win(u, n - 1, path);
    path.pop();
    if (!w) { ok = false; break; }
  }
  path.pop();
  return ok;
}
/** Fewest of my moves needed to win after m (0 if m wins now), up to max; Infinity if none. */
export function depthAfter(s: State, m: Move, max: number, path: Path): number {
  for (let n = 1; n <= max; n++) if (forces(s, m, n, path)) return n === 1 && immediate(s, m, path) ? 0 : n - 1;
  return Infinity;
}
/** Defender's best reply: the one that holds out longest (ties: captures first, then first found). */
export function bestReply(t: State, max: number, path: Path): { m: Move | null; d: number } {
  const rs = gen(t, path);
  let best: Move | null = null, bestD = -1, bestCap = false;
  for (const r of rs) {
    if (winsNow(t, r)) return { m: r, d: Infinity };
    const u = apply(t, r);
    path.push(u);
    let d = Infinity;
    for (let n = 1; n <= max; n++) if (win(u, n, path)) { d = n; break; }
    path.pop();
    const cap = r[0] === 0 && t.b[r[2]] !== 0;
    if (d > bestD || (d === bestD && cap && !bestCap)) { best = r; bestD = d; bestCap = cap; }
  }
  return { m: best, d: bestD };
}
/** Main line: key move, best defence, ... until the win. */
export function mainLine(s: State, n: number, path0: Path): Move[] | null {
  const line: Move[] = [];
  const path = path0.slice();
  let cur = s;
  for (let k = n; k >= 1; k--) {
    const ms = gen(cur, path);
    let pick: Move | null = null;
    for (const m of ms) if (immediate(cur, m, path)) { pick = m; break; }
    if (!pick) for (const m of ms) if (forces(cur, m, k, path)) { pick = m; break; }
    if (!pick) return null;
    line.push(pick);
    const t = apply(cur, pick);
    if (immediate(cur, pick, path)) return line;
    path.push(t);
    const r = bestReply(t, k - 1, path).m;
    if (!r) return line;
    line.push(r);
    cur = apply(t, r);
    path.push(cur);
  }
  return line;
}
export const nodeCount = () => nodes;

/* ---------- Generator ---------- */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) { h ^= x >>> 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return h >>> 0;
}

function randomPosition(R: () => number, n: number): State {
  const b: number[] = Array(25).fill(0);
  const turn: Turn = R() < 0.5 ? 0 : BL;
  const place = (p: number, ok: (i: number) => boolean) => {
    for (let tries = 0; tries < 60; tries++) { const i = (R() * 25) | 0; if (!b[i] && ok(i)) { b[i] = p; return true; } }
    return false;
  };
  for (const side of [0, BL]) {
    const homeOk = (i: number) => ((i / 5) | 0) !== farRow(side); // not already on its winning row
    const all = [A, A, C, C];
    const k = 1 + ((R() * (n >= 3 ? 4 : 4)) | 0);
    for (let x = 0; x < 4; x++) { const y = x + ((R() * (4 - x)) | 0); [all[x], all[y]] = [all[y], all[x]]; }
    place(T | side, homeOk);
    for (let x = 0; x < k; x++) place(all[x] | side, homeOk);
  }
  return { b, turn, ls: [-1, -1] };
}

export type Note = "swap" | "quiet" | "sacrifice";
export type How = "throne" | "row" | "blocked";

function rate(s: State, n: number, key: Move, line: Move[], rootMoves: Move[], path: Path) {
  let r = [0, 520, 1000, 1450][n];
  const notes: Note[] = [];
  r += (rootMoves.length - 10) * 10;
  const cap = key[0] === 0 && s.b[key[2]] !== 0;
  if (key[0] === 1) { r += 190; notes.push("swap"); }
  else if (!cap) { r += 90; notes.push("quiet"); }
  else r -= 60;
  const after = apply(s, key);
  const moved = key[0] === 0 ? key[2] : -1;
  if (moved >= 0 && !winsNow(s, key) && attacked(after.b, moved, s.turn ^ BL)) { r += 120; notes.push("sacrifice"); }
  // Tempting captures that don't win.
  let decoys = 0;
  for (const m of rootMoves) if (m !== key && m[0] === 0 && s.b[m[2]] !== 0) decoys++;
  r += Math.min(decoys, 4) * 30;
  // How many replies the defender has to the key move.
  if (n > 1) { const rs = gen(after, path.concat([after])); r += Math.min(rs.length, 20) * 4; }
  // How the line ends.
  let end = s, last: Move = line[0];
  for (let k = 0; k < line.length; k++) { last = line[k]; if (k < line.length - 1) end = apply(end, line[k]); }
  let how: How = "row";
  if (last[0] === 0 && end.b[last[2]] && (end.b[last[2]] & 7) === T) how = "throne";
  else if (last[0] === 0 && ((last[2] / 5) | 0) === farRow(end.turn)) how = "row";
  else how = "blocked";
  if (how === "blocked") r += 140;
  return { rating: Math.round(Math.max(300, Math.min(2400, r)) / 10) * 10, notes, how };
}

export interface Puzzle {
  b: number[]; turn: Turn; n: number; key: Move; line: Move[];
  rating: number; notes: Note[]; how: How;
  L: number; i: number; tries: number;
}

/** Try to build a puzzle with a forced win in exactly n moves and one key move. */
export function tryPuzzle(seed: number, n: number): Omit<Puzzle, "L" | "i" | "tries"> | null {
  const R = rng(seed);
  const s = randomPosition(R, n);
  const path: Path = [s];
  const opp = s.turn ^ BL;
  const myT = s.b.findIndex(p => p === (T | s.turn)), oT = s.b.findIndex(p => p === (T | opp));
  if (myT < 0 || oT < 0) return null;
  if (attacked(s.b, myT, opp) && n > 1) return null;
  if (n > 1 && attacked(s.b, oT, s.turn)) return null;
  const ms = gen(s, path);
  if (ms.length < 3) return null;
  // Opponent must have had a move to get here, and no win in fewer moves.
  if (n > 1 && win(s, n - 1, path)) return null;
  let key: Move | null = null;
  for (const m of ms) {
    if (forces(s, m, n, path)) { if (key) return null; key = m; }
  }
  if (!key) return null;
  if (n === 1 && ms.filter(m => immediate(s, m, path)).length !== 1) return null;
  const line = mainLine(s, n, path);
  if (!line || line.length !== 2 * n - 1) return null;
  const rt = rate(s, n, key, line, ms, path);
  return { b: s.b, turn: s.turn, n, key, line, ...rt };
}

export const LEVELS_N = 12;
export const LEVEL_LO = (L: number) => 300 + (L - 1) * 150;
/** How many moves a level's puzzles need, in the order the generator tries them. */
export const levelMoves = (L: number) => {
  const mid = LEVEL_LO(L) + 75;
  return mid < 800 ? [1, 2] : mid < 1250 ? [2, 1, 3] : mid < 1600 ? [3, 2] : [3];
};

/** Puzzle number i of level L (levels 1..12). Deterministic: same L and i, same puzzle. */
export function puzzleFor(L: number, i: number): Puzzle | null {
  const lo = LEVEL_LO(L), hi = lo + 150;
  const ns = levelMoves(L);
  let best: Puzzle | null = null, bestGap = Infinity;
  for (let a = 0; a < 40000; a++) {
    const n = ns[a % ns.length];
    const p = tryPuzzle(hash(L, i, a, 7919), n);
    if (!p) continue;
    const gap = p.rating < lo ? lo - p.rating : p.rating >= hi ? p.rating - hi + 1 : 0;
    if (gap === 0) return { ...p, L, i, tries: a + 1 };
    if (gap < bestGap) { best = { ...p, L, i, tries: a + 1 }; bestGap = gap; }
    if (a > 3000 && best && bestGap < 120) return best;
  }
  return best;
}

/** The start position of a puzzle. */
export const puzzleState = (p: { b: number[]; turn: Turn }): State => ({ b: p.b.slice(), turn: p.turn, ls: [-1, -1] });
export const sameMove = (x: Move, y: Move) => x[0] === y[0] && x[1] === y[1] && x[2] === y[2];
