// The puzzle trainer: pick a position, find the win while the computer defends.
import { useCallback, useEffect, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { newGame, playMove, type Game } from "./engine/game";
import { PUZZLES, puzzleStart, stepPuzzle, type Puzzle, type PuzzleNode } from "./engine/puzzles";
import { from, sideName, to, type Move, type Side } from "./engine/rules";
import { PLACEMENTS } from "./engine/setup";
import { aiRpc } from "./aiClient";
import { why } from "./text";

export type PzPhase = "solve" | "wait" | "solved" | "failed" | "show" | "shown";
export interface Flash { sqs: number[]; kind: "good" | "bad" }
export interface PzState {
  p: Puzzle; g: Game; node: PuzzleNode; phase: PzPhase; hint: boolean;
  flash: Flash | null; hintSq: number | null; left: number; status: string; msg: string;
}
interface Progress { solved: Record<string, number>; side: Side; cur: string | null }

const puzzleGame = (p: Puzzle): Game => ({ ...newGame({ holdN: 7 }), s: puzzleStart(p), phase: "play", placed: PLACEMENTS });
const flashOf = (m: Move, kind: Flash["kind"]): Flash => ({ sqs: [from(m), to(m)], kind });
export const puzzlesFor = (side: Side) => PUZZLES.filter(p => p.side === side);

function solveText(p: Puzzle, left: number) {
  const goal = p.side === 0 ? "crown the Lord, take every Sí piece, or leave the Sí with no move" : "take the Lord, finish the hold, or leave the Host with no move";
  return {
    status: `${sideName(p.side)} to move · win in ${left}`,
    msg: left === p.n
      ? `Puzzle ${p.label}. Win within ${p.n} moves, whatever the other side does: ${goal}.${p.hold ? ` The Sí have held the summit for ${p.hold} turn${p.hold > 1 ? "s" : ""}.` : ""}`
      : `Good. ${left === 1 ? "Now finish it." : `${left} moves to go.`}`,
  };
}

export function usePuzzles(active: boolean) {
  const [progress, setProgress] = useStoredState<Progress>("cnoc-puzzles", { solved: {}, side: 0, cur: null });
  const [pz, setPzState] = useState<PzState | null>(null);
  const ref = useRef<PzState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const setPz = (v: PzState | null) => { ref.current = v; setPzState(v); };
  const later = (ms: number, f: () => void) => { clearTimeout(timer.current); timer.current = setTimeout(f, ms); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const start = useCallback((id: string) => {
    const p = PUZZLES.find(x => x.id === id);
    if (!p) return;
    clearTimeout(timer.current);
    setPz({ p, g: puzzleGame(p), node: p.t, phase: "solve", hint: false, flash: null, hintSq: null, left: p.n, ...solveText(p, p.n) });
    setProgress(pr => ({ ...pr, cur: id, side: p.side }));
  }, [setProgress]);

  const next = useCallback((side: Side = ref.current?.p.side ?? progress.side) => {
    const list = puzzlesFor(side);
    if (!list.length) return;
    const i = ref.current && ref.current.p.side === side ? list.findIndex(x => x.id === ref.current!.p.id) : -1;
    const after = list.slice(i + 1).concat(list.slice(0, i + 1));
    start((after.find(x => !progress.solved[x.id]) ?? after[0]).id);
  }, [progress, start]);

  // Open the last puzzle the first time the tab is shown.
  useEffect(() => {
    if (!active || ref.current) return;
    if (progress.cur && PUZZLES.some(x => x.id === progress.cur)) start(progress.cur); else next(progress.side);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (m: Move) => {
    const cur = ref.current;
    if (!cur || cur.phase !== "solve") return;
    const me = cur.p.side, step = stepPuzzle(cur.node, cur.g.s, m), g1 = playMove(cur.g, m);
    if (g1.winner === me) {
      const full = !cur.hint;
      setProgress(pr => ({ ...pr, solved: { ...pr.solved, [cur.p.id]: full ? 1 : Math.max(pr.solved[cur.p.id] ?? 0, 0.5) } }));
      setPz({ ...cur, g: g1, flash: flashOf(m, "good"), hintSq: null, phase: "solved", status: "Solved!",
        msg: `${why(g1.why)} ${full ? "Well found." : "Solved with a hint: try it again cold to earn the full mark."}` });
      return;
    }
    const waiting: PzState = { ...cur, g: g1, flash: flashOf(m, step.ok ? "good" : "bad"), hintSq: null, phase: "wait",
      status: step.ok ? `Good. The ${sideName((me ^ 1) as Side)} answer…` : `The ${sideName((me ^ 1) as Side)} have an answer…` };
    setPz(waiting);
    later(750, async () => {
      if (ref.current !== waiting) return;
      if (!step.ok || step.reply === undefined || !step.next) {
        let g2 = g1, flash = waiting.flash;
        if (g1.winner === null) {
          const r = await aiRpc().call<Move | null>("move", { s: g1.s, opts: { depth: 3, ms: 400, noise: 0 }, seen: [], rules: { holdN: 7 } });
          if (ref.current !== waiting) return;
          if (r != null) { g2 = playMove(g1, r); flash = flashOf(r, "bad"); }
        }
        setPz({ ...waiting, g: g2, flash, phase: "failed", status: "Not this time", msg: "That lets them escape. Try again, or show the solution." });
        return;
      }
      const left = cur.left - 1, t = solveText(cur.p, left);
      setPz({ ...waiting, g: playMove(g1, step.reply), node: step.next, left, flash: null, phase: "solve", status: `Good. ${t.status}`, msg: t.msg });
    });
  };

  const hint = () => {
    const cur = ref.current;
    if (!cur || cur.phase !== "solve") return;
    setPz({ ...cur, hint: true, hintSq: "w" in cur.node ? cur.node.w[0] : cur.node.a[0][0], msg: "Hint: move this piece." });
  };

  const showSolution = () => {
    const cur = ref.current;
    if (!cur) return;
    const shown: PzState = { ...cur, g: puzzleGame(cur.p), node: cur.p.t, phase: "show", flash: null, hintSq: null, status: "Solution", msg: "Watch the winning line. Your moves are lit green." };
    setPz(shown);
    const step = (mine: boolean) => {
      const st = ref.current;
      if (!st || st.phase !== "show" || st.p !== cur.p) return;
      const node = st.node;
      if (mine) {
        const m = "w" in node ? node.w[0] * 64 + node.w[1] : node.a[0][0] * 64 + node.a[0][1];
        const g1 = playMove(st.g, m);
        if ("w" in node || g1.winner !== null) {
          setPz({ ...st, g: g1, flash: flashOf(m, "good"), phase: "shown", status: `Solution: ${why(g1.why)}`, msg: "Try it yourself, or go on to the next puzzle." });
          return;
        }
        setPz({ ...st, g: g1, flash: flashOf(m, "good") });
      } else if (!("w" in node)) {
        const a = node.a[0];
        setPz({ ...st, g: playMove(st.g, a[2] * 64 + a[3]), node: a[4], flash: null });
      }
      later(1000, () => step(!mine));
    };
    later(600, () => step(true));
  };

  const setSide = (side: Side) => {
    setProgress(pr => ({ ...pr, side }));
    const list = puzzlesFor(side);
    const pick = list.find(x => !progress.solved[x.id]) ?? list[0];
    if (pick) start(pick.id);
  };

  return { pz, progress, start, next: () => next(), move, hint, showSolution, retry: () => pz && start(pz.p.id), setSide };
}
