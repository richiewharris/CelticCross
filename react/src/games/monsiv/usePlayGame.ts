// A game against the computer or a friend: state, the computer's turns, undo and saving.
import { useEffect, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { LEVELS } from "./engine/ai";
import { col, sameMove, type Move, type Turn } from "./engine/core";
import { legalMoves, newGame, pathOf, playMove, undo, type Game } from "./engine/game";
import { aiRpc } from "./aiClient";

export interface PlaySettings { mode: "cpu" | "pvp"; side: Turn; lvl: 1 | 2 | 3 }
export const DEFAULT_SETTINGS: PlaySettings = { mode: "cpu", side: 0, lvl: 2 };

const validGame = (g: Game | null): g is Game => !!g && !!g.s && Array.isArray(g.s.b) && g.s.b.length === 25 && Array.isArray(g.history);

/** The move (step or swap) from `sel` to `i`, if the board allows it. */
export function moveTo(legal: Move[], sel: number, i: number): Move | undefined {
  return legal.find(m => m[0] === 0 && m[1] === sel && m[2] === i)
    ?? legal.find(m => m[0] === 1 && ((m[1] === sel && m[2] === i) || (m[2] === sel && m[1] === i)));
}

export function usePlayGame(active: boolean) {
  const [settings, setSettings] = useStoredState<PlaySettings>("monsiv-react-settings", DEFAULT_SETTINGS);
  const [stored, setG] = useStoredState<Game>("monsiv-react-game", newGame);
  const g = validGame(stored) ? stored : newGame();
  const [sel, setSel] = useState<number | null>(null);
  /** History length after the last forward move, so only fresh moves pop in. */
  const [anim, setAnim] = useState(-1);

  const over = g.winner !== null;
  const cpuTurn = active && settings.mode === "cpu" && !over && g.s.turn !== settings.side;
  const humanTurn = !over && (settings.mode === "pvp" || g.s.turn === settings.side) && !cpuTurn;

  const play = (from: Game, m: Move) => {
    const next = playMove(from, m);
    setSel(null); setAnim(next.history.length);
    return next;
  };

  // The computer's turn. Answers that arrive after the game has moved on are dropped.
  useEffect(() => {
    if (!cpuTurn) return;
    let live = true;
    const timer = setTimeout(async () => {
      const m = await aiRpc().call<Move | null>("move", { s: g.s, path: pathOf(g), opts: LEVELS[settings.lvl] });
      if (!live || !m || !legalMoves(g).some(x => sameMove(x, m))) return;
      setG(play(g, m));
    }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [cpuTurn, g, settings.lvl, setG]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = () => { setSel(null); setAnim(-1); setG(newGame()); };

  const changeSettings = (patch: Partial<PlaySettings>) => {
    setSettings({ ...settings, ...patch });
    if ("mode" in patch || "side" in patch) restart();
  };

  const clickCell = (i: number) => {
    if (!humanTurn) return;
    if (sel !== null) {
      const m = moveTo(legalMoves(g), sel, i);
      if (m) { setG(play(g, m)); return; }
      if (i === sel) { setSel(null); return; }
    }
    const p = g.s.b[i];
    setSel(p && col(p) === g.s.turn ? i : null);
  };

  const canUndo = g.history.length > 0 && !(settings.mode === "cpu" && !g.history.some(h => h.by === settings.side));
  const takeBack = () => {
    if (!g.history.length) return;
    setSel(null); setAnim(-1);
    setG(undo(g, settings.mode === "cpu" ? settings.side : undefined));
  };

  return { g, settings, changeSettings, sel, clickCell, humanTurn, thinking: cpuTurn, newGame: restart, canUndo, takeBack, anim };
}
