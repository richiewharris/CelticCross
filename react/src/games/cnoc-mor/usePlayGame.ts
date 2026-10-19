// Everything about a game against the computer or a friend: state, the computer's turns,
// reserves, undo, persistence and the post-game review.
import { useCallback, useEffect, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { createRpc } from "../../kit/rpc";
import { LEVELS, cpuPick, cpuPlace, type Level } from "./engine/ai";
import { actor, canPlace, newGame, pieceToSet, placePiece, placer, playMove, seenMap, undo, type Game } from "./engine/game";
import { buildEntries, type Entry } from "./engine/review";
import { DROP, NN, from, gen, sideOf, to, type Move, type Piece, type Side } from "./engine/rules";
import { aiRpc, makeAiWorker } from "./aiClient";
import type { ReviewState } from "./components/ReviewPanel";

export interface PlaySettings { mode: "cpu" | "pvp"; side: Side; lvl: Level }
export const DEFAULT_SETTINGS: PlaySettings = { mode: "cpu", side: 0, lvl: 2 };

const validGame = (g: Game | null | undefined): g is Game =>
  !!g && !!g.s && Array.isArray(g.s.b) && g.s.b.length === NN && Array.isArray(g.history) && !!g.trays;

export function usePlayGame() {
  const [settings, setSettings] = useStoredState<PlaySettings>("cnoc-mor-react-settings", DEFAULT_SETTINGS);
  const [stored, setG] = useStoredState<Game>("cnoc-mor-react-game", newGame);
  const g = validGame(stored) ? stored : newGame();
  /** A selected piece's hole, DROP for the reserve, or null. */
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState<Piece | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [animate, setAnimate] = useState(false);
  const reviewWorker = useRef<Worker | null>(null);

  useEffect(() => { if (!validGame(stored)) setG(newGame()); }, [stored, setG]);

  const isHuman = (side: Side) => settings.mode === "pvp" || side === settings.side;
  const over = g.winner !== null;
  const cpuTurn = settings.mode === "cpu" && !over && !review && !isHuman(actor(g));
  const humanTurn = !over && !review && isHuman(actor(g));

  /** Every change of the game made by a move or a placement pops the piece that landed. */
  const advance = useCallback((next: Game) => { setAnimate(true); setSel(null); setPick(null); setG(next); }, [setG]);

  // The computer's turn. Answers that arrive after the game has moved on are dropped.
  useEffect(() => {
    if (!cpuTurn) return;
    let live = true;
    const timer = setTimeout(async () => {
      if (g.phase === "place") {
        const side = placer(g), piece = cpuPick(g.trays[side], side);
        const i = cpuPlace(g.s, side, piece, settings.lvl);
        if (live) advance(placePiece(g, i, piece));
      } else {
        const m = await aiRpc().call<Move | null>("move", { s: g.s, opts: LEVELS[settings.lvl], seen: [...seenMap(g)] });
        if (live && m != null) advance(playMove(g, m));
      }
    }, g.phase === "place" ? 260 : 360);
    return () => { live = false; clearTimeout(timer); };
  }, [cpuTurn, g, settings.lvl, advance]);

  // Show the result a moment after a game ends (not when a finished game is reloaded).
  const prevWinner = useRef(g.winner);
  useEffect(() => {
    const was = prevWinner.current;
    prevWinner.current = g.winner;
    if (was !== null || g.winner === null) return;
    const t = setTimeout(() => setResultOpen(true), 700);
    return () => clearTimeout(t);
  }, [g.winner]);

  const stopReview = useCallback(() => {
    reviewWorker.current?.terminate();
    reviewWorker.current = null;
    setReview(null);
  }, []);
  useEffect(() => () => reviewWorker.current?.terminate(), []);

  const restart = useCallback(() => {
    stopReview(); setResultOpen(false); setSel(null); setPick(null); setAnimate(false);
    prevWinner.current = null;
    setG(newGame());
  }, [setG, stopReview]);

  const changeSettings = (patch: Partial<PlaySettings>) => {
    setSettings({ ...settings, ...patch });
    if (Object.keys(patch).some(k => k !== "lvl")) restart();
  };

  const clickCell = (i: number) => {
    if (!humanTurn) return;
    if (g.phase === "place") {
      if (!canPlace(g, i)) return;
      advance(placePiece(g, i, pieceToSet(g, pick)));
      return;
    }
    if (sel !== null) {
      const m = gen(g.s).find(x => from(x) === sel && to(x) === i);
      if (m !== undefined) { advance(playMove(g, m)); return; }
      if (i === sel) { setSel(null); return; }
    }
    const p = g.s.b[i];
    setSel(p && sideOf(p) === g.s.turn ? i : null);
  };

  const canDrop = (side: Side) =>
    humanTurn && g.phase === "play" && g.s.turn === side && (side === 0 ? g.s.rh : g.s.rs) > 0;
  const pickReserve = (side: Side) => {
    if (!canDrop(side)) return;
    setSel(sel === DROP ? null : DROP);
  };

  const canUndo = g.history.length > 0 && (settings.mode === "pvp" || g.history.some(h => h.by === settings.side));
  const takeBack = () => {
    if (!canUndo) return;
    stopReview(); setResultOpen(false); setSel(null); setPick(null); setAnimate(false);
    prevWinner.current = null;
    setG(undo(g, settings.mode === "cpu" ? settings.side : undefined));
  };

  const startReview = () => {
    if (!over || review) return;
    setResultOpen(false); setSel(null);
    const list = buildEntries(g);
    setReview({ list, done: 0, v: list.length, playing: false });
    const w = makeAiWorker();
    reviewWorker.current = w;
    createRpc(w)
      .call<Entry[]>("review", { game: g }, p => {
        const { k, entry } = p as { k: number; entry: Entry };
        if (reviewWorker.current === w) setReview(r => (r ? { ...r, done: k, list: r.list.map((e, j) => (j === k - 1 ? entry : e)) } : r));
      })
      .then(res => { if (reviewWorker.current === w) setReview(r => (r ? { ...r, list: res, done: res.length } : r)); });
  };

  const goReview = (v: number) => setReview(r => (r ? { ...r, v: Math.max(0, Math.min(r.list.length, v)) } : r));
  // Play steps at once, then every 0.9 s (from the start again when at the end).
  const togglePlay = () => setReview(r => {
    if (!r) return r;
    if (r.playing) return { ...r, playing: false };
    const v = r.v >= r.list.length ? 0 : r.v;
    return v >= r.list.length ? r : { ...r, playing: true, v: v + 1 };
  });

  useEffect(() => {
    if (!review?.playing) return;
    const t = setTimeout(() => setReview(r => {
      if (!r) return r;
      return r.v >= r.list.length ? { ...r, playing: false } : { ...r, v: r.v + 1 };
    }), 900);
    return () => clearTimeout(t);
  }, [review?.playing, review?.v]);

  // Arrow keys step through the review.
  useEffect(() => {
    if (!review) return;
    const onKey = (e: KeyboardEvent) => {
      if (resultOpen || /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === "ArrowLeft") { goReview(review.v - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { goReview(review.v + 1); e.preventDefault(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return {
    g, settings, changeSettings, sel, pick, setPick, clickCell, canDrop, pickReserve, animate,
    humanTurn, thinking: cpuTurn,
    newGame: restart, canUndo, takeBack,
    resultOpen, closeResult: () => setResultOpen(false),
    review, startReview, stopReview, goReview, togglePlay,
  };
}
