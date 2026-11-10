// A real match against the computer: setup, the human's choices, the computer's turns (in a worker),
// the move log and saving across reloads.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { DECKS, FACTIONS, type Faction } from "./engine/cards";
import { BUILD_NOISE, buildDeck } from "./engine/builder";
import { computerDeck } from "./engine/computerDecks";
import { Rng } from "./engine/rng";
import { loadSavedDecks, resolveDeck } from "./decks";
import { FACTION_TITLE } from "./text";
import { applyDecision, cloneState, newMatch, nextDecision, upgradeState, type Decision, type Side, type State } from "./engine/engine";
import { cancelComputer, computerChoice } from "./aiClient";
import { logLine } from "./text";

export type Level = "novice" | "casual" | "skilled" | "expert";
/** mine: a faction (its starter deck) or "custom:<id>" (a saved deck). theirsDeck: the computer builds its own, or plays the starter. */
export interface Setup { mine: string; theirs: Faction | "random"; theirsDeck?: "built" | "starter"; level: Level; seat: "first" | "second" | "random"; pace?: Pace }
export type Pace = "quick" | "normal" | "slow";
/** The least time a computer move takes on screen, so you can follow it. */
const PACE_MS: Record<Pace, number> = { quick: 120, normal: 450, slow: 1100 };

/** Your results against the computer, by level, kept in this browser. */
export interface MatchRecord { [level: string]: { w: number; l: number; d: number } }
export const RECORD_KEY = "roth-react-record";
export const DEFAULT_SETUP: Setup = { mine: "ulster", theirs: "random", theirsDeck: "built", level: "casual", seat: "random" };

/** The state before each of your recent moves, so you can take one back (and the computer's replies with it). */
interface Back { S: State; log: string[] }
interface Saved { v: 1; setup: Setup; S: State; me: Side; theirs: Faction; log: string[]; seed: number; back?: Back[]; recorded?: boolean }
const BACK_MAX = 10;

/** A heading for the log when the match moves into a new part. */
function sectionOf(S: State): string {
  if (S.phase === "muster") return "The Muster";
  if (S.phase === "draft") return "Drafting";
  if (S.phase === "play" || S.phase === "late") return S.reversed ? "The round run backwards" : "The Playing turn";
  if (S.phase === "combat" && S.combat) return S.combat.duel === 2 ? "The final duel" : `Duel ${S.combat.duel + 1}`;
  return "The result";
}

/** Run automatic steps; return the state and the decision now pending (null when the match is over). */
function settle(S: State): { S: State; d: Decision | null } {
  const T = cloneState(upgradeState(S));
  const d = nextDecision(T);
  return { S: T, d };
}

export function useMatch() {
  const [setup, setSetup] = useStoredState<Setup>("roth-react-setup", DEFAULT_SETUP);
  const [saved, setSaved] = useStoredState<Saved | null>("roth-react-match", null);
  const [thinking, setThinking] = useState(false);
  const busy = useRef(0);

  // The pending decision of the saved state (the state is already settled, so this only reads it).
  const d = useMemo(() => (saved ? settle(saved.S).d : null), [saved]);

  const start = useCallback((st: Setup = setup) => {
    cancelComputer();
    busy.current++;
    const seed = Math.floor(Math.random() * 1e9);
    const theirs = st.theirs === "random" ? FACTIONS[Math.floor(Math.random() * FACTIONS.length)] : st.theirs;
    const me: Side = st.seat === "first" ? 0 : st.seat === "second" ? 1 : (Math.random() < 0.5 ? 0 : 1);
    const mine = resolveDeck(st.mine, loadSavedDecks()) ?? resolveDeck("ulster", [])!;
    const built = (st.theirsDeck ?? "built") === "built";
    const theirDeck = !built ? DECKS[theirs]
      : st.level === "skilled" || st.level === "expert" ? computerDeck(theirs, new Rng(seed ^ 0x5bd1e995))
      : buildDeck({ factions: [theirs], noise: BUILD_NOISE[st.level] }, new Rng(seed ^ 0x5bd1e995));
    const decks = me === 0 ? [mine.deck, theirDeck] : [theirDeck, mine.deck];
    const S0 = newMatch([decks[0], decks[1]], {}, seed, false);
    const { S } = settle(S0);
    setSetup(st);
    setSaved({ v: 1, setup: st, S, me, theirs, back: [], log: [`§ ${sectionOf(S)}`, `New match: you play ${mine.label} as the ${me === 0 ? "first" : "second"} player against ${built ? (theirs === "ulster" ? "an" : "a") : "the"} ${FACTION_TITLE[theirs]} ${built ? "deck the computer built" : "starter deck"} (${st.level}).`], seed });
  }, [setup, setSetup, setSaved]);

  const [record, setRecord] = useStoredState<MatchRecord>(RECORD_KEY, {});
  const play = useCallback((i: number) => {
    if (!saved || !d) return;
    const T = cloneState(saved.S);
    const line = logLine(T, d, d.options[i], saved.me);
    const before = sectionOf(T);
    applyDecision(T, d, i);
    const { S, d: next } = settle(T);
    const after = sectionOf(S);
    const log = [...saved.log, line, ...(after !== before ? [`§ ${after}`] : [])].slice(-240);
    // your own moves can be taken back; the Muster's are quick enough to keep out of the way
    const back = d.player === saved.me && d.kind !== "muster" ? [...(saved.back ?? []), { S: saved.S, log: saved.log }].slice(-BACK_MAX) : saved.back;
    let recorded = saved.recorded;
    if (!next && S.result && !recorded) {
      recorded = true;
      const r = S.result, lv = saved.setup.level, cur = record[lv] ?? { w: 0, l: 0, d: 0 };
      setRecord({ ...record, [lv]: { w: cur.w + (r.winner === saved.me ? 1 : 0), l: cur.l + (r.winner === 1 - saved.me ? 1 : 0), d: cur.d + (r.winner === -1 ? 1 : 0) } });
    }
    setSaved({ ...saved, S, log, back, recorded });
  }, [saved, d, setSaved, record, setRecord]);

  /** Take back your last move, and the computer's replies since. */
  const undo = useCallback(() => {
    if (!saved?.back?.length || saved.recorded) return;
    cancelComputer();
    busy.current++;
    const back = saved.back.slice(0, -1), b = saved.back[saved.back.length - 1];
    setSaved({ ...saved, S: b.S, log: [...b.log, "You took back a move."], back });
  }, [saved, setSaved]);

  // The computer's turn
  useEffect(() => {
    if (!saved || !d || d.player === saved.me) { setThinking(false); return; }
    const ticket = ++busy.current;
    setThinking(true);
    const seed = (saved.seed + saved.log.length * 7919) % 2147483647;
    const t0 = performance.now();
    void computerChoice(saved.S, d, saved.setup.level, seed).then((i) => {
      const wait = Math.max(0, (d.kind === "muster" ? 60 : PACE_MS[saved.setup.pace ?? "normal"]) - (performance.now() - t0)); // the computer's Muster goes quickly
      setTimeout(() => { if (ticket === busy.current) play(i); }, wait);
    });
  }, [saved, d, play]);

  const quit = useCallback(() => { cancelComputer(); busy.current++; setSaved(null); }, [setSaved]);

  return {
    setup, setSetup, start, quit, play, thinking, undo, canUndo: !!saved?.back?.length && !saved.recorded, record,
    S: saved?.S ?? null, me: saved?.me ?? (0 as Side), d, log: saved?.log ?? [], theirs: saved?.theirs ?? null,
    myTurn: !!saved && !!d && d.player === saved.me,
    over: !!saved && !d && !!saved.S.result,
  };
}
export type MatchApi = ReturnType<typeof useMatch>;
