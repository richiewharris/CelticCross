// Post-game review: grade every placement and move.
// Moves are judged by one deep search per position and graded by where they led; the loser's
// last move where a defence still held is marked as the turning point.
import { MATE, analyse, placeScore, type Analysis } from "./ai";
import { SUMMIT, from, gen, key, sideOf, to, type Move, type Piece, type Side, type State } from "./rules";
import { zoneOk } from "./setup";
import { moveNote, rulesOf, type Game } from "./game";

export type Grade = "best" | "exc" | "good" | "miss" | "blun";
export const GRADES: Grade[] = ["best", "exc", "good", "miss", "blun"];
export const GRADE_NAME: Record<Grade, string> = { best: "Best", exc: "Excellent", good: "Good", miss: "Miss", blun: "Blunder" };

interface EntryBase { s: State; by: Side; note: string; after: State; q?: Grade; loss: number }
export interface PlaceEntry extends EntryBase { kind: "place"; to: number; piece: Piece; placed: number; best?: { to: number } | null }
export interface MoveEntry extends EntryBase {
  kind: "move"; m: Move; only?: boolean; ev?: Analysis; decisive?: boolean;
  best?: { from: number; to: number; note: string } | null;
}
export type Entry = PlaceEntry | MoveEntry;

const clampV = (v: number) => (v >= MATE / 2 ? 2000 : v <= -MATE / 2 ? -2000 : Math.max(-2000, Math.min(2000, v)));

export function classify(loss: number, bestV: number, playedV: number, only?: boolean): Grade {
  if (only) return "best";
  if (playedV <= -MATE / 2 && bestV > -MATE / 2) return "blun";
  if (bestV >= MATE / 2 && playedV < MATE / 2) return loss > 700 ? "blun" : "miss";
  if (loss <= 8) return "best";
  if (loss <= 40) return "exc";
  if (loss <= 110) return "good";
  if (loss <= 300) return "miss";
  return "blun";
}

export function buildEntries(g: Game): Entry[] {
  const H = g.history, out: Entry[] = [];
  for (let k = 0; k < H.length; k++) {
    const h = H[k], next = k + 1 < H.length ? H[k + 1] : { s: g.s, last: g.last };
    const last = next.last;
    if (!last) continue;
    if (h.phase === "place") out.push({ kind: "place", s: h.s, to: last.to, piece: next.s.b[last.to], by: h.by, placed: h.placed, note: h.note, after: next.s, loss: 0 });
    else out.push({ kind: "move", s: h.s, m: (last.from ?? 0) * 64 + last.to, by: h.by, note: h.note, after: next.s, loss: 0 });
  }
  return out;
}

/** Setup is judged by a placement heuristic with wide bands, since many holes are near-equal. */
export function assessPlacement(e: PlaceEntry, g: Game) {
  const owner = sideOf(e.piece), spite = e.by !== owner, rules = rulesOf(g);
  const topOnly = g.swap && e.placed === 1;
  const cells: number[] = [];
  for (let i = 0; i < 49; i++) if (!e.s.b[i] && (topOnly ? SUMMIT[i] : zoneOk(owner, i))) cells.push(i);
  let bestI = e.to, bestV = -Infinity, playedV = 0;
  for (const i of cells) {
    let v = placeScore(e.s, owner, e.piece, i, rules);
    if (spite) v = -v;
    if (v > bestV) { bestV = v; bestI = i; }
    if (i === e.to) playedV = v;
  }
  const loss = Math.max(0, bestV - playedV);
  e.loss = loss;
  e.q = cells.length <= 1 || loss <= 25 ? "best" : loss <= 70 ? "exc" : loss <= 160 ? "good" : loss <= 350 ? "miss" : "blun";
  e.best = e.q === "best" || bestI === e.to ? null : { to: bestI };
}

/** Deep-search one move entry's starting position. */
export function analyseMove(e: MoveEntry, g: Game, seen: Map<string, number>, ms = 900) {
  const k0 = key(e.s);
  seen.set(k0, (seen.get(k0) || 0) + 1);
  e.only = gen(e.s, rulesOf(g)).length === 1;
  e.ev = analyse(e.s, 8, ms, seen, rulesOf(g));
}

const bestOf = (e: MoveEntry) => e.ev && e.ev.m != null && e.ev.m !== e.m
  ? { from: from(e.ev.m), to: to(e.ev.m), note: moveNote(e.s, e.ev.m) } : null;

/** Grade every move from the deep values, then mark the loser's turning point. */
export function finishReview(list: Entry[], g: Game) {
  const moves = list.filter((e): e is MoveEntry => e.kind === "move");
  moves.forEach((e, i) => {
    const next = moves[i + 1];
    const playedV = next ? -(next.ev?.v ?? 0) : g.winner === e.by ? MATE : g.winner === -1 ? 0 : -MATE;
    const bv = e.ev?.v ?? 0, loss = Math.max(0, clampV(bv) - clampV(playedV));
    e.loss = loss;
    e.q = classify(loss, bv, playedV, e.only);
    e.best = e.q === "best" ? null : bestOf(e);
  });
  if (g.winner === 0 || g.winner === 1) {
    const loser = (g.winner ^ 1) as Side;
    const mine = moves.filter(e => e.by === loser);
    for (let i = mine.length - 1; i >= 0; i--) {
      const e = mine[i];
      if ((e.ev?.v ?? 0) > -MATE / 2) {
        if (e.q !== "blun" && e.q !== "miss" && !e.only) {
          e.q = "blun"; e.loss = Math.max(e.loss, 600); e.decisive = true; e.best = bestOf(e);
        }
        break;
      }
    }
  }
}

export interface SideSummary {
  side: Side; counts: Record<Grade, number>; acc: number; perf: number; rank: string;
  place: number | null; moves: number | null; nPlace: number; nMoves: number; n: number;
}

export function summarize(list: Entry[]): SideSummary[] {
  const rank = (r: number) => (r < 900 ? "Novice" : r < 1400 ? "Warrior" : r < 1900 ? "Champion" : "High King");
  const accOf = (arr: Entry[]) => arr.length ? arr.reduce((t, e) => t + 100 * Math.exp(-e.loss / 300), 0) / arr.length : null;
  return ([0, 1] as Side[]).map(side => {
    const mine = list.filter(e => e.q && e.by === side);
    const pl = mine.filter(e => e.kind === "place"), mv = mine.filter(e => e.kind === "move");
    const counts = Object.fromEntries(GRADES.map(q => [q, mv.filter(e => e.q === q).length])) as Record<Grade, number>;
    // Setup counts for a quarter of the rating, play for three quarters.
    const sp = accOf(pl), sm = accOf(mv);
    const acc = sp == null ? (sm ?? 0) : sm == null ? sp : 0.25 * sp + 0.75 * sm;
    const perf = Math.round((400 + 18 * acc) / 10) * 10;
    return {
      side, counts, acc: Math.round(acc), perf, rank: rank(perf),
      place: sp == null ? null : Math.round(sp), moves: sm == null ? null : Math.round(sm),
      nPlace: pl.length, nMoves: mv.length, n: mine.length,
    };
  });
}

/** Run a whole review synchronously (tests and the simulator; the UI uses the worker). */
export function reviewGame(g: Game, msPerMove = 300): Entry[] {
  const list = buildEntries(g), seen = new Map<string, number>();
  for (const e of list) {
    if (e.kind === "place") assessPlacement(e, g);
    else analyseMove(e, g, seen, msPerMove);
  }
  finishReview(list, g);
  return list;
}
