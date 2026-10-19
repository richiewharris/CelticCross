// The endless puzzle trainer: seeded puzzles by level, a rating, hints and solution playback.
// It follows the original page's state machine closely: one mutable puzzle record, re-rendered
// after each change, with a single timer for the defender's replies and the solution playback.
import { useEffect, useReducer, useRef } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { bestReply, forces, gen, other, puzzleState, sameMove, type Move, type Puzzle, type Turn } from "./engine/core";
import { fromState, legalMoves, pathOf, playMove, squaresOf, who, type Game } from "./engine/game";
import { SPEED_MS, freshStats, nextIndex, pickLevel, recordResult, type PuzzleStats } from "./engine/rating";
import type { Flash } from "./components/Board";
import { moveTo } from "./usePlayGame";
import { fetchPuzzle } from "./aiClient";

export type PzPhase = "load" | "solve" | "wait" | "solved" | "failed" | "show" | "shown";
export interface PzState {
  L: number; i: number; p: Puzzle | null; phase: PzPhase;
  retry: boolean; hint: boolean; moved: boolean; rated: boolean;
  status: string; tip: string; flash: Flash | null; hintSq: number | null; delta: number | null;
  left: number; k: number; paused: boolean; ok: boolean;
  g: Game; side: Turn; sel: number | null; anim: number;
}

const emptyGame = (): Game => fromState({ b: Array(25).fill(0), turn: 0, ls: [-1, -1] });

export function usePuzzles(active: boolean) {
  const [stored, setStored] = useStoredState<PuzzleStats>("monsiv-react-puzzles", freshStats);
  const PS = useRef<PuzzleStats>({ ...freshStats(), ...stored });
  const PZ = useRef<PzState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const activeRef = useRef(active);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const render = () => bump();
  const savePS = () => setStored({ ...PS.current });
  const later = (ms: number, f: () => void) => { clearTimeout(timer.current); timer.current = setTimeout(f, ms); };

  function solveText(pz: PzState) {
    const n = pz.left, them = who(other(pz.side));
    pz.status = `${who(pz.side)} to move · win in ${n}`;
    pz.tip = n === 1 ? "Find the move that wins right now." : `Find a move that forces a win within ${n} moves, whatever ${them} does.`;
  }

  function startPuzzle(L: number, i: number, retry = false) {
    clearTimeout(timer.current);
    const mine: PzState = {
      L, i, p: null, phase: "load", retry, hint: false, moved: false, rated: false,
      status: "Carving a puzzle…", tip: "Each puzzle is checked so exactly one first move wins.",
      flash: null, hintSq: null, delta: null, left: 0, k: 0, paused: false, ok: true,
      g: emptyGame(), side: 0, sel: null, anim: -1,
    };
    PZ.current = mine;
    if (!retry) { PS.current = { ...PS.current, cur: { L, i } }; savePS(); }
    render();
    fetchPuzzle(L, i).then(p => {
      if (PZ.current !== mine || !activeRef.current) return;
      if (!p) { mine.status = "Couldn't build that puzzle"; mine.tip = "Try the next one."; mine.phase = "failed"; mine.rated = true; render(); return; }
      mine.p = p; mine.left = p.n; mine.phase = "solve";
      mine.g = fromState(puzzleState(p)); mine.side = p.turn;
      solveText(mine); render();
      // Carve the next one in the background.
      const nl = pickLevel(PS.current);
      fetchPuzzle(nl, nl === L ? Math.max(i + 1, nextIndex(PS.current, nl)) : nextIndex(PS.current, nl));
    });
  }

  function pushMove(pz: PzState, m: Move) {
    pz.g = playMove(pz.g, m);
    pz.sel = null;
  }

  // Elo-style: the puzzle is the opponent. Score 1 for a solve, ½ with a hint, 0 for a miss.
  function conclude(pz: PzState, score: number) {
    if (pz.rated || pz.retry || !pz.p) return;
    pz.rated = true;
    const r = recordResult(PS.current, pz.L, pz.i, pz.p.rating, score);
    PS.current = r.ps;
    pz.delta = r.delta;
    savePS();
  }

  function puzzleMove(m: Move) {
    const pz = PZ.current;
    if (!pz || pz.phase !== "solve") return;
    pz.moved = true; pz.hintSq = null;
    const ok = forces(pz.g.s, m, pz.left, pathOf(pz.g));
    pushMove(pz, m);
    pz.anim = pz.g.history.length;
    pz.flash = { sqs: squaresOf(m), kind: ok ? "good" : "bad" };
    if (pz.g.winner === pz.side) return solved(pz);
    const them = who(other(pz.side));
    pz.phase = "wait"; pz.ok = ok;
    if (ok) pz.left--;
    pz.status = ok ? `Good. ${them} replies…` : `${them} has an answer…`;
    render();
    later(700, () => reply(pz));
  }

  /** The defender's answer, after a move: the reply that holds out longest. */
  function reply(pz: PzState) {
    if (PZ.current !== pz || pz.phase !== "wait") return;
    const ok = pz.ok, them = who(other(pz.side));
    const r = bestReply(pz.g.s, Math.max(1, pz.left - (ok ? 0 : 1)), pathOf(pz.g)).m;
    const um = r && legalMoves(pz.g).find(x => sameMove(x, r));
    if (um) { pushMove(pz, um); pz.anim = pz.g.history.length; pz.flash = ok ? null : { sqs: squaresOf(um), kind: "bad" }; }
    if (!ok || !um || pz.g.winner !== null) {
      const note = um ? pz.g.history[pz.g.history.length - 1].note : "";
      return failed(pz, pz.g.winner === other(pz.side) ? `${them} wins with ${note}.` : um ? `After ${note}, there's no forced win left.` : "");
    }
    pz.phase = "solve"; pz.flash = null; solveText(pz);
    pz.status = `Good. ${pz.status}`;
    render();
  }

  function solved(pz: PzState) {
    pz.phase = "solved"; conclude(pz, pz.hint ? 0.5 : 1);
    pz.status = "Solved!";
    pz.tip = pz.retry ? "Solved again. Practice runs don't change your rating." : pz.hint ? "Solved with a hint, which counts as half." : "Nicely found.";
    render();
  }
  function failed(pz: PzState, why: string) {
    pz.phase = "failed"; conclude(pz, 0);
    pz.status = "Not this time";
    pz.tip = `${why} Show the solution to see the idea, or try again (for practice).`.trim();
    render();
  }

  function hint() {
    const pz = PZ.current;
    if (!pz || pz.phase !== "solve") return;
    const s = pz.g.s, path = pathOf(pz.g);
    const good = gen(s, path).find(m => forces(s, m, pz.left, path));
    if (!good) return;
    pz.hint = true; pz.hintSq = good[1]; pz.sel = null;
    pz.tip = "Hint: move this piece (or swap it). A solve with a hint counts as half.";
    render();
  }

  // Solution playback: reset to the start and play the main line at the chosen speed.
  function showSolution() {
    const pz = PZ.current;
    if (!pz || !pz.p) return;
    clearTimeout(timer.current);
    if (pz.phase === "solve" || pz.phase === "wait") conclude(pz, 0);
    pz.g = fromState(puzzleState(pz.p)); pz.sel = null; pz.anim = -1;
    pz.phase = "show"; pz.k = 0; pz.paused = false; pz.flash = null; pz.hintSq = null;
    pz.status = "Solution"; pz.tip = "Watch the winning line. Your moves are the odd ones.";
    render();
    later(500, () => stepSolution());
  }
  function stepSolution(manual = false) {
    const pz = PZ.current;
    if (!pz || !pz.p || pz.phase !== "show") return;
    clearTimeout(timer.current);
    const line = pz.p.line, cm = line[pz.k];
    const m = cm && legalMoves(pz.g).find(x => sameMove(x, cm));
    if (!m) { pz.phase = "shown"; render(); return; }
    pushMove(pz, m);
    pz.k++;
    const mine = pz.k % 2 === 1;
    pz.flash = { sqs: squaresOf(m), kind: mine ? "good" : "last" };
    pz.status = `Solution · move ${pz.k} of ${line.length}`;
    if (pz.k >= line.length) {
      pz.phase = "shown";
      const how = pz.p.how === "throne" ? "takes the Throne" : pz.p.how === "row" ? "reaches the far row" : `leaves ${who(other(pz.side))} with no move`;
      pz.status = `Solution: ${who(pz.side)} ${how}`;
      pz.tip = "Try again to play it yourself, or go on to the next puzzle.";
    }
    render();
    if (pz.phase === "show" && !pz.paused && !manual) later(SPEED_MS[PS.current.speed] || 950, () => stepSolution());
  }
  function togglePause() {
    const pz = PZ.current;
    if (!pz || pz.phase !== "show") return;
    pz.paused = !pz.paused;
    if (!pz.paused) stepSolution(); else { clearTimeout(timer.current); render(); }
  }

  function nextPuzzle() {
    const pz = PZ.current;
    if (pz && pz.p && (pz.phase === "solve" || pz.phase === "wait") && (pz.moved || pz.hint)) conclude(pz, 0);
    if (pz && pz.p && !pz.retry) PS.current = { ...PS.current, next: { ...PS.current.next, [pz.L]: Math.max(nextIndex(PS.current, pz.L), pz.i + 1) } };
    savePS();
    const L = pickLevel(PS.current);
    startPuzzle(L, nextIndex(PS.current, L));
  }

  function setPick(v: string) {
    PS.current = { ...PS.current, pick: v }; savePS();
    const pz = PZ.current;
    if (pz && pz.phase === "solve" && !pz.moved && !pz.hint && pickLevel(PS.current) !== pz.L) {
      const L = pickLevel(PS.current);
      startPuzzle(L, nextIndex(PS.current, L));
    } else render();
  }
  function setSpeed(v: PuzzleStats["speed"]) { PS.current = { ...PS.current, speed: v }; savePS(); }

  function click(i: number) {
    const pz = PZ.current;
    if (!pz || pz.phase !== "solve" || pz.g.winner !== null) return;
    const s = pz.g.s;
    if (pz.sel !== null) {
      const m = moveTo(legalMoves(pz.g), pz.sel, i);
      if (m) return puzzleMove(m);
      if (i === pz.sel) { pz.sel = null; return render(); }
    }
    const p = s.b[i];
    pz.sel = p && (p & 8) === s.turn ? i : null;
    render();
  }

  // Opening and leaving the tab. Leaving pauses the puzzle: a solution being shown stops where it
  // is, and a pending reply is made when the tab is opened again.
  useEffect(() => {
    activeRef.current = active;
    if (!active) return;
    const pz = PZ.current, c = PS.current.cur;
    if (pz && pz.phase === "load") startPuzzle(pz.L, pz.i, pz.retry);
    else if (pz) { if (pz.phase === "wait") later(700, () => reply(pz)); render(); }
    else if (c && nextIndex(PS.current, c.L) <= c.i) startPuzzle(c.L, c.i);
    else { const L = pickLevel(PS.current); startPuzzle(L, nextIndex(PS.current, L)); }
    return () => {
      activeRef.current = false;
      clearTimeout(timer.current);
      const cur = PZ.current;
      if (cur && cur.phase === "show") cur.phase = "shown";
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    pz: PZ.current, ps: PS.current, click, hint, showSolution, togglePause,
    step: () => stepSolution(true), next: nextPuzzle,
    retry: () => { const pz = PZ.current; if (pz) startPuzzle(pz.L, pz.i, true); },
    setPick, setSpeed,
  };
}
