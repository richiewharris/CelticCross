// Everything about a game against the computer or a friend: state, the computer's turns,
// undo, persistence and the post-game review.
import { useCallback, useEffect, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { createRpc } from "../../kit/rpc";
import { LEVELS } from "./engine/ai";
import {
  actor, currentSlot, newGame, placePiece, playMove, rulesOf, seenMap, trayChoices, undo, type Game,
} from "./engine/game";
import { buildEntries, type Entry } from "./engine/review";
import { CH, LO, RI, SP, from, gen, type Move, type Piece, type Side } from "./engine/rules";
import { slotZone } from "./engine/setup";
import { aiRpc, makeAiWorker } from "./aiClient";

export interface PlaySettings { mode: "cpu" | "pvp"; side: Side; lvl: 1 | 2 | 3 | 4; holdN: 7 | 8; swap: boolean }
export const DEFAULT_SETTINGS: PlaySettings = { mode: "cpu", side: 0, lvl: 2, holdN: 7, swap: false };

export interface ReviewState { list: Entry[]; done: number; v: number; playing: boolean; ready: boolean }

const fresh = (st: PlaySettings) => newGame({ swap: st.swap, holdN: st.holdN });

export function usePlayGame(active: boolean) {
  const [settings, setSettings] = useStoredState<PlaySettings>("cnoc-react-settings", DEFAULT_SETTINGS);
  const [g, setG] = useStoredState<Game>("cnoc-react-game", () => fresh(settings));
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState<Piece | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const reviewWorker = useRef<Worker | null>(null);

  const isHuman = (side: Side) => settings.mode === "pvp" || side === settings.side;
  const over = g.winner !== null;
  const cpuTurn = active && settings.mode === "cpu" && !over && !review && !isHuman(actor(g));
  const humanTurn = !over && !review && isHuman(actor(g));

  // The computer's turn. Answers that arrive after the game has moved on are dropped.
  useEffect(() => {
    if (!cpuTurn) return;
    let live = true;
    const rules = rulesOf(g), rpc = aiRpc();
    const timer = setTimeout(async () => {
      if (g.phase === "place") {
        const slot = currentSlot(g), tr = g.trays[slot.o], choices = trayChoices(g);
        const special = slot.o === 0 ? LO : CH, plain = slot.o === 0 ? SP : RI;
        const left = (tr[special] ?? 0) + (tr[plain] ?? 0);
        const piece = slot.k ?? (choices.includes(special) && (Math.random() < 1 / left || !choices.includes(plain)) ? special : plain);
        const i = await rpc.call<number>("place", { s: g.s, placed: g.placed, swap: g.swap, piece, lvl: settings.lvl, rules });
        if (live) setG(cur => (cur === g ? placePiece(g, i, piece) : cur));
      } else {
        const m = await rpc.call<Move | null>("move", { s: g.s, opts: LEVELS[settings.lvl], seen: [...seenMap(g)], rules });
        if (live && m != null) setG(cur => (cur === g ? playMove(g, m) : cur));
      }
    }, g.phase === "place" ? 280 : 380);
    return () => { live = false; clearTimeout(timer); };
  }, [cpuTurn, g, settings.lvl, setG]);

  // Open the result dialog when a game ends (not when a finished game is reloaded).
  const prevWinner = useRef(g.winner);
  useEffect(() => {
    if (prevWinner.current === null && g.winner !== null) setResultOpen(true);
    prevWinner.current = g.winner;
  }, [g.winner]);

  const stopReview = useCallback(() => {
    reviewWorker.current?.terminate();
    reviewWorker.current = null;
    setReview(null);
  }, []);
  useEffect(() => () => reviewWorker.current?.terminate(), []);

  const restart = useCallback((st: PlaySettings) => {
    stopReview(); setResultOpen(false); setSel(null); setPick(null);
    prevWinner.current = null;
    setG(fresh(st));
  }, [setG, stopReview]);

  const changeSettings = (patch: Partial<PlaySettings>) => {
    const st = { ...settings, ...patch };
    setSettings(st);
    if (Object.keys(patch).some(k => k !== "lvl")) restart(st);
  };

  const clickCell = (i: number) => {
    if (!humanTurn) return;
    if (g.phase === "place") {
      const slot = currentSlot(g);
      if (g.s.b[i] || !slotZone(slot, i)) return;
      const tr = g.trays[slot.o];
      const piece = slot.k ?? (pick && tr[pick] ? pick : slot.o === 0 ? (tr[SP] ? SP : LO) : (tr[RI] ? RI : CH));
      setG(placePiece(g, i, piece));
      return;
    }
    if (sel !== null) {
      const m = legalFrom(g, sel).find(x => (x & 63) === i);
      if (m !== undefined) { setSel(null); setG(playMove(g, m)); return; }
      if (i === sel) { setSel(null); return; }
    }
    const p = g.s.b[i];
    setSel(p && (p >= 3 ? 1 : 0) === g.s.turn ? i : null);
  };

  const canUndo = g.history.length > 0 && (settings.mode === "pvp" || g.history.some(h => h.by === settings.side));
  const takeBack = () => {
    if (!canUndo) return;
    stopReview(); setResultOpen(false); setSel(null);
    prevWinner.current = null;
    setG(undo(g, settings.mode === "cpu" ? settings.side : undefined));
  };

  const startReview = () => {
    if (!over || review) return;
    setResultOpen(false);
    const list = buildEntries(g);
    setReview({ list, done: 0, v: list.length, playing: false, ready: false });
    const w = makeAiWorker();
    reviewWorker.current = w;
    createRpc(w)
      .call<Entry[]>("review", { game: g, ms: 900 }, p => setReview(r => (r ? { ...r, done: p as number } : r)))
      .then(res => { if (reviewWorker.current === w) setReview(r => (r ? { ...r, list: res, done: res.length, ready: true } : r)); });
  };

  const goReview = (v: number) => setReview(r => (r ? { ...r, v: Math.max(0, Math.min(r.list.length, v)) } : r));
  const togglePlay = () => setReview(r => (r ? { ...r, playing: !r.playing, v: !r.playing && r.v >= r.list.length ? 0 : r.v } : r));

  // Playback of the review.
  useEffect(() => {
    if (!review?.playing) return;
    const t = setTimeout(() => setReview(r => {
      if (!r) return r;
      return r.v >= r.list.length ? { ...r, playing: false } : { ...r, v: r.v + 1 };
    }), review.v === 0 ? 500 : 900);
    return () => clearTimeout(t);
  }, [review?.playing, review?.v]);

  // Arrow keys step through the review.
  useEffect(() => {
    if (!review || !active) return;
    const onKey = (e: KeyboardEvent) => {
      if (resultOpen || /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === "ArrowLeft") { goReview(review.v - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { goReview(review.v + 1); e.preventDefault(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return {
    g, settings, changeSettings, sel, pick, setPick, clickCell,
    humanTurn, thinking: cpuTurn, isHuman,
    newGame: () => restart(settings), canUndo, takeBack,
    resultOpen, closeResult: () => setResultOpen(false),
    review, startReview, stopReview, goReview, togglePlay,
  };
}

export const legalFrom = (g: Game, sq: number) => gen(g.s).filter(m => from(m) === sq);
