// Everything about a game in progress: the stored game, the dice spin, the computer's turns,
// the pass pause, and the player's taps and keys.
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { bestPlan, bestToastTarget, threatened, treasonVictim } from "./engine/ai";
import {
  DEFAULT_SETTINGS, START_CURSOR, endWait, isGame, isHuman, land, newGame, over, playStep, playToast, settle,
  startTreasonPick, statusLine, treasonByComputer, treasonPicked, type Game, type Settings,
} from "./engine/game";
import { N, NAME, capturesFor, d6, inB, legalNow, other, at } from "./engine/rules";
import type { Overlay } from "./components/Board";
import { planStep } from "./aiClient";

const reduceMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useCupsGame() {
  const [stored, setG] = useStoredState<Game>("fidchell-cups-react-game", () => newGame(DEFAULT_SETTINGS));
  const fallback = useMemo(() => newGame(DEFAULT_SETTINGS), []);
  const g = isGame(stored) ? stored : fallback;
  useEffect(() => { if (!isGame(stored)) setG(fallback); }, [stored, fallback, setG]);

  const [spin, setSpin] = useState<[number, number] | null>(null);
  const [tumble, setTumble] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [cursor, setCursor] = useState(START_CURSOR);
  const [focused, setFocused] = useState(false);
  const [hints, setHints] = useState(false);
  const reduce = useMemo(reduceMotion, []);
  const later = (ms: number) => (reduce ? Math.min(ms, 200) : ms);

  const s = g.state, isOver = over(g);
  const rolling = spin !== null;
  const humanTurn = !isOver && !rolling && g.wait === null && isHuman(g, s.turn);
  const cpuTurn = !isOver && !rolling && g.wait === null && !isHuman(g, s.turn);

  const startRoll = () => { setTumble(t => t + 1); setSpin([d6(), d6()]); };

  // The dice tumble for a moment, then land.
  useEffect(() => {
    if (!rolling) return;
    let ticks = 0;
    const id = setInterval(() => {
      if (++ticks > 6) {
        clearInterval(id);
        const d: [number, number] = [d6(), d6()];
        setSpin(null); setSel(null);
        setG(cur => land(cur, d));
      } else setSpin([d6(), d6()]);
    }, reduce ? 10 : 85);
    return () => clearInterval(id);
  }, [rolling, reduce, setG]);

  // A pass or a dead roll stays on show, then the dice go across.
  useEffect(() => {
    if (!g.wait || isOver) return;
    const t = setTimeout(() => setG(cur => (cur === g ? endWait(g) : cur)), later(1500));
    return () => clearTimeout(t);
  }, [g, isOver]);

  // The computer's turn: roll, toast the Queen, or move one cup at a time.
  useEffect(() => {
    if (!cpuTurn) return;
    const st = g.state;
    let live = true;
    let t: ReturnType<typeof setTimeout>;
    if (st.dice === null) t = setTimeout(startRoll, later(900));
    else if (st.queenPending) t = setTimeout(() => setG(cur => (cur === g ? playToast(g, bestToastTarget(st)) : cur)), later(1100));
    else t = setTimeout(async () => {
      const step = legalNow(st).length ? await planStep(st, g.lvl) : null;
      if (live) setG(cur => (cur !== g ? cur : step ? playStep(g, ...step) : settle(g)));
    }, later(650));
    return () => { live = false; clearTimeout(t); };
  }, [cpuTurn, g]);

  const restart = (st: Settings) => {
    setSpin(null); setSel(null); setPicking(false); setCursor(START_CURSOR);
    setG(newGame(st));
  };
  const settings: Settings = { mode: g.mode, side: g.side, lvl: g.lvl, turns: g.turns };
  const change = (patch: Partial<Settings>) => {
    if ("mode" in patch || "side" in patch) restart({ ...settings, ...patch });
    else setG({ ...g, ...patch });
  };

  const roll = () => {
    if (isOver || rolling || g.wait || !isHuman(g, s.turn) || g.treasonPick) return;
    if (s.dice && !s.queenPending) return;
    if (s.queenPending) {
      // Rolling on without toasting the Queen is treason.
      if (g.mode === "cpu") {
        const g2 = treasonByComputer(g, treasonVictim(s));
        setG(g2);
        if (over(g2)) return;
      } else { setG(startTreasonPick(g)); return; }
    }
    startRoll();
  };

  const clickCell = (i: number) => {
    if (g.treasonPick) { setG(treasonPicked(g, i)); return; }
    if (!humanTurn) return;
    setCursor(i);
    if (picking) {
      if (s.b[i] === other(s.turn)) { setPicking(false); setG(playToast(g, i)); }
      return;
    }
    if (!s.dice || s.queenPending) return;
    const legal = legalNow(s);
    if (sel !== null) {
      const m = legal.find(x => x[1] === sel && x[2] === i);
      if (m) { setSel(null); setG(playStep(g, ...m)); return; }
      if (i === sel) { setSel(null); return; }
    }
    setSel(legal.some(x => x[1] === i) ? i : null);
  };

  const toastQueen = () => { if (humanTurn && s.queenPending) setPicking(true); };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const r = (cursor / N) | 0, c = cursor % N;
    const mv = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (mv) { e.preventDefault(); const nr = r + mv[0], nc = c + mv[1]; if (inB(nr, nc)) setCursor(at(nr, nc)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (s.dice === null) roll(); else clickCell(cursor); }
    else if (e.key === "Escape" && sel !== null) setSel(null);
  };

  // ---- What the board shows ----
  const myMove = humanTurn && !!s.dice && !s.queenPending && !picking;
  const hintPlan = useMemo(() => (hints && myMove ? bestPlan(s, 2) : null), [hints, myMove, s]);
  const overlay: Overlay = {};
  if (myMove) {
    const legal = legalNow(s);
    if (sel === null) overlay.from = [...new Set(legal.map(x => x[1]))];
    else {
      overlay.sel = sel;
      overlay.targets = legal.filter(x => x[1] === sel).map(([k, f, t]) => {
        const b = s.b.slice(); b[t] = s.turn; b[f] = 0;
        return { at: t, die: s.dice![k], cap: capturesFor(b, t, s.turn).length > 0 };
      });
    }
    if (hintPlan) overlay.arrow = { from: hintPlan.steps[0][1], to: hintPlan.steps[0][2] };
  }
  if ((picking && humanTurn) || g.treasonPick) {
    const victims = g.treasonPick ? s.turn : other(s.turn);
    overlay.pick = { squares: s.b.flatMap((v, i) => (v === victims ? [i] : [])), treason: g.treasonPick };
  }
  if (hints && humanTurn && !picking) overlay.threats = [...threatened(s.b, s.turn)];
  if (focused) overlay.cursor = cursor;
  const locked = !(myMove || picking || g.treasonPick);

  // ---- Dice, buttons and the note under them ----
  const canRoll = humanTurn && (s.dice === null || (s.queenPending && !picking)) && !g.treasonPick;
  const rollLabel = s.queenPending && humanTurn ? "Roll on (treason)" : "Roll";
  const showToast = humanTurn && s.queenPending && !picking;
  const note = picking
    ? `Tap a ${NAME[other(s.turn)].toLowerCase()} cup to drink to the Queen.`
    : g.note || (humanTurn && s.dice === null ? "Roll the dice to start your turn." : "");

  return {
    g, settings, change, newGame: () => restart(settings), status: statusLine(g),
    hints, toggleHints: () => setHints(h => !h),
    overlay, locked, clickCell, onKeyDown, setFocused,
    dice: spin ?? s.dice, diceUsed: spin ? undefined : s.used, diceQueen: !spin && s.queenPending, tumble,
    canRoll, rollLabel, roll, showToast, toastQueen, note, noteKind: g.noteKind,
  };
}
