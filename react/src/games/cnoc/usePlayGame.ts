// Everything about a game against the computer or a friend: state, the computer's turns,
// undo, persistence and the post-game review.
import { useCallback, useEffect, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { createRpc } from "../../kit/rpc";
import { LEVELS } from "./engine/ai";
import {
  actor, currentSlot, defaultPiece, newGame, phalanxOffer, placePiece, playMove, rulesOf, seenMap, undo, type Game,
} from "./engine/game";
import { cpuSetupChoice } from "./engine/cpu";
import { buildEntries, type Entry } from "./engine/review";
import { from, gen, sideOf, type Move, type Piece, type Side } from "./engine/rules";
import { slotZone } from "./engine/setup";
import { aiRpc, makeAiWorker } from "./aiClient";
import { recordGameEnd, recordGameStart, type GameEventInfo } from "../../online/analytics";

export interface PlaySettings {
  mode: "cpu" | "pvp"; side: Side; lvl: 1 | 2 | 3 | 4; holdN: 7 | 8; swap: boolean;
  /** The combining variant (absent in settings saved before it existed). */
  combine?: boolean;
}
export const DEFAULT_SETTINGS: PlaySettings = { mode: "cpu", side: 0, lvl: 2, holdN: 7, swap: false, combine: false };

export interface ReviewState { list: Entry[]; done: number; v: number; playing: boolean; ready: boolean }

const fresh = (st: PlaySettings) => newGame({ swap: st.swap, holdN: st.holdN, combine: !!st.combine });

/** paused: an online game is on the board, so the local game waits (no computer turns). */
export function usePlayGame(active: boolean, paused = false) {
  const [settings, setSettings] = useStoredState<PlaySettings>("cnoc-react-settings", DEFAULT_SETTINGS);
  const [g, setG] = useStoredState<Game>("cnoc-react-game", () => fresh(settings));
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState<Piece | null>(null);
  // Rival's setup in the combining variant: the Host's Phalanx choice, sent with the Lord.
  const [phx, setPhx] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const reviewWorker = useRef<Worker | null>(null);

  const isHuman = (side: Side) => settings.mode === "pvp" || side === settings.side;
  const over = g.winner !== null;
  const cpuTurn = active && !paused && settings.mode === "cpu" && !over && !review && !isHuman(actor(g));
  const humanTurn = !over && !review && isHuman(actor(g));

  // The computer's turn. Answers that arrive after the game has moved on are dropped.
  useEffect(() => {
    if (!cpuTurn) return;
    let live = true;
    const rules = rulesOf(g), rpc = aiRpc();
    const timer = setTimeout(async () => {
      if (g.phase === "place") {
        const slot = currentSlot(g), { piece, takePhalanx } = cpuSetupChoice(g, settings.lvl);
        const i = await rpc.call<number>("place", { s: g.s, placed: g.placed, swap: g.swap, piece, lvl: settings.lvl, rules, slot });
        if (live) setG(cur => (cur === g ? placePiece(g, i, piece, takePhalanx) : cur));
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
    if (prevWinner.current === null && g.winner !== null) {
      setResultOpen(true);
      recordGameEnd("cnoc", { ...eventInfo(), result: resultFor(g.winner) });
    }
    prevWinner.current = g.winner;
  }, [g.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Statistics: a game starts with its first placement.
  const prevLen = useRef(g.history.length);
  useEffect(() => {
    if (prevLen.current === 0 && g.history.length === 1) recordGameStart("cnoc", eventInfo());
    prevLen.current = g.history.length;
  }, [g.history.length]); // eslint-disable-line react-hooks/exhaustive-deps
  function eventInfo(): GameEventInfo {
    return {
      mode: settings.mode === "cpu" ? "computer" : "friend",
      ...(g.combine ? { variant: "combining" } : {}),
      ...(settings.mode === "cpu" ? { level: settings.lvl } : {}),
    };
  }
  function resultFor(w: Side | -1): string {
    if (w === -1) return "draw";
    if (settings.mode === "cpu") return w === settings.side ? "win" : "loss";
    return w === 0 ? "host" : "si";
  }

  const stopReview = useCallback(() => {
    reviewWorker.current?.terminate();
    reviewWorker.current = null;
    setReview(null);
  }, []);
  useEffect(() => () => reviewWorker.current?.terminate(), []);

  const restart = useCallback((st: PlaySettings) => {
    stopReview(); setResultOpen(false); setSel(null); setPick(null); setPhx(false);
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
      setG(placePiece(g, i, defaultPiece(g, pick), phx && phalanxOffer(g)));
      setPhx(false);
      return;
    }
    if (sel !== null) {
      const m = legalFrom(g, sel).find(x => (x & 63) === i);
      if (m !== undefined) { setSel(null); setG(playMove(g, m)); return; }
      if (i === sel) { setSel(null); return; }
    }
    const p = g.s.b[i];
    setSel(p && sideOf(p) === g.s.turn ? i : null);
  };

  const canUndo = g.history.length > 0 && (settings.mode === "pvp" || g.history.some(h => h.by === settings.side));
  const takeBack = () => {
    if (!canUndo) return;
    stopReview(); setResultOpen(false); setSel(null); setPhx(false);
    prevWinner.current = null;
    setG(undo(g, settings.mode === "cpu" ? settings.side : undefined));
  };

  /** Review a finished game: this one, or another (an online game) passed in. */
  const startReview = (src: Game = g) => {
    if (src.winner === null && src === g) return;
    if (review) return;
    setResultOpen(false);
    const list = buildEntries(src);
    setReview({ list, done: 0, v: list.length, playing: false, ready: false });
    const w = makeAiWorker();
    reviewWorker.current = w;
    createRpc(w)
      .call<Entry[]>("review", { game: src, ms: 900 }, p => setReview(r => (r ? { ...r, done: p as number } : r)))
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
    g, settings, changeSettings, sel, pick, setPick, phx, setPhx, clickCell,
    humanTurn, thinking: cpuTurn, isHuman,
    newGame: () => restart(settings), canUndo, takeBack,
    resultOpen, closeResult: () => setResultOpen(false),
    review, startReview, stopReview, goReview, togglePlay,
  };
}

export const legalFrom = (g: Game, sq: number) => gen(g.s, rulesOf(g)).filter(m => from(m) === sq);
