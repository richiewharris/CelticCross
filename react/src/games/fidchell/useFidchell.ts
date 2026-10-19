// The game against the computer or a friend: state, the computer's turn, undo, hints and saving.
import { useEffect, useMemo, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { HINT_LEVEL, LEVELS, type LevelId } from "./engine/ai";
import { START_CURSOR, canUndo, doMove, isOver, newGame, undo, validGame, type Game, type Mode } from "./engine/game";
import { genMoves, threatened, type Move, type Side } from "./engine/rules";
import { think } from "./aiClient";

const fresh = () => newGame("cpu", 1, 2);
const keyOf = (g: Game) => g.state.b.join("") + g.state.turn;

export function useFidchell() {
  const [stored, setG] = useStoredState<Game>("fidchell-react-game", fresh);
  const g = validGame(stored) ? stored : null;
  useEffect(() => { if (!g) setG(fresh()); }, [g, setG]);
  const game = g ?? fresh();

  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState(START_CURSOR);
  const [hints, setHints] = useState(false);
  const [sug, setSug] = useState<{ key: string; move: Move | null } | null>(null);

  const over = isOver(game);
  const thinking = !over && game.mode === "cpu" && game.state.turn !== game.side;
  const humanTurn = !over && !thinking;

  // The computer's turn: a short pause, then the search in the worker. Stale answers are dropped.
  useEffect(() => {
    if (!g || !thinking) return;
    let live = true;
    const timer = setTimeout(async () => {
      const m = await think(g.state, LEVELS[g.lvl]);
      if (live && m) setG(cur => (cur === g ? doMove(g, m) : cur));
    }, 420);
    return () => { live = false; clearTimeout(timer); };
  }, [g, thinking, setG]);

  // The hint arrow, worked out once per position.
  const key = keyOf(game);
  useEffect(() => {
    if (!g || !hints || !humanTurn || sug?.key === key) return;
    let live = true;
    think(g.state, HINT_LEVEL).then(move => { if (live) setSug({ key, move }); });
    return () => { live = false; };
  }, [g, hints, humanTurn, key, sug]);

  const danger = useMemo(() => (hints && humanTurn ? threatened(game.state.b, game.state.turn) : null), [hints, humanTurn, game.state]);

  const start = (mode: Mode, side: Side) => {
    setSel(null);
    setG(cur => newGame(mode, side, cur.lvl ?? 2, (cur.round ?? 0) + 1));
  };

  const clickCell = (i: number) => {
    if (!humanTurn) return;
    const s = game.state, me = s.turn;
    setCursor(i);
    if (sel !== null) {
      const legal = genMoves(s.b, me).find(m => m[0] === sel && m[1] === i);
      if (legal) { setSel(null); setG(doMove(game, legal)); return; }
      if (i === sel) { setSel(null); return; }
    }
    setSel(s.b[i] === me && genMoves(s.b, me).some(m => m[0] === i) ? i : null);
  };

  return {
    g: game, sel, cursor, setCursor, hints, thinking, humanTurn, over,
    danger, arrow: hints && humanTurn && sug?.key === key ? sug.move : null,
    clickCell, deselect: () => setSel(null),
    newGame: () => start(game.mode, game.side),
    setMode: (m: Mode) => start(m, game.side),
    setSide: (s: Side) => start(game.mode, s),
    setLvl: (lvl: LevelId) => setG(cur => ({ ...cur, lvl })),
    canUndo: canUndo(game),
    undo: () => { setSel(null); setG(undo(game)); },
    toggleHints: () => setHints(h => !h),
  };
}
