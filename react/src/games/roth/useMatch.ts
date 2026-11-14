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
import { applyDecision, cloneState, fighter, newMatch, nextDecision, upgradeState, NARRATE, type Decision, type Side, type State } from "./engine/engine";
import { summarize } from "./components/Choices";
import { cancelComputer, computerChoice } from "./aiClient";
import { logLine, reckonedLine } from "./text";
import { recordGameEnd, recordGameStart } from "../../online/analytics";
import { recordMatch } from "../../online/telemetry";

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
interface Back { S: State; log: string[]; moves?: number[] }
/** A move as the table shows it afterwards: who, what, what changed, and the support it used. */
export interface MoveEvent { mine: boolean; text: string; fx: string | null; spot?: number; n: number }
interface Saved {
  v: 1; setup: Setup; S: State; me: Side; theirs: Faction; log: string[]; seed: number; back?: Back[]; recorded?: boolean; last?: MoveEvent[];
  /** A duel has just ended: play waits here until the player has seen how it went. */
  pause?: DuelEnd;
  /** For the match record (online/telemetry.ts): every choice made, both decks by seat, when it began, moves taken back. */
  moves?: number[]; decks?: [string[], string[]]; t0?: number; undos?: number;
}
/** The match as a record: enough to replay it by the rules (the seed, both decks, every choice) and how it ended. */
function sendRecord(m: Saved, outcome: "won" | "lost" | "drawn" | "abandoned") {
  if (!m.moves?.length || !m.decks) return;
  const st = m.setup, r = m.S.result;
  void recordMatch({ game: "roth", outcome, match: {
    setup: { mine: st.mine.startsWith("custom:") ? "custom" : st.mine, theirs: m.theirs, theirsDeck: st.theirsDeck ?? "built", level: st.level, seat: m.me === 0 ? "first" : "second" },
    me: m.me, seed: m.seed, decks: { first: m.decks[0], second: m.decks[1] }, moves: m.moves, undos: m.undos ?? 0,
    ms: m.t0 ? Date.now() - m.t0 : null, phase: m.S.phase, duel: m.S.combat?.duel ?? null,
    result: r ? { winner: r.winner, felled: [r.felled[0], r.felled[1]] } : null,
  } });
}
const BACK_MAX = 10;

/** A heading for the log when the match moves into a new part. */
function sectionOf(S: State): string {
  if (S.phase === "muster") return "The Muster";
  if (S.phase === "draft") return "Marshalling";
  if (S.phase === "reckon") return "The Reckoning";
  if (S.phase === "play" || S.phase === "late") return S.reversed ? "The round run backwards" : "The Winnow";
  if (S.phase === "combat" && S.combat) return S.combat.duel === 2 ? "The final duel" : `Duel ${S.combat.duel + 1}`;
  return "The result";
}

/** Run automatic steps; return the state and the decision now pending (null when the match is over). */
/** How a duel ended, as the player sees it. */
export interface DuelEnd { title: string; lines: string[]; next: string | null }
/** If the duel running before this move has ended after it: say how, and what comes next. */
export function duelEnd(before: State, after: State, me: Side): DuelEnd | null {
  const B = before.combat, A = after.combat;
  if (before.phase !== "combat" || !B || !A || B.stage === "done") return null;
  const k = B.duel;
  // the duel is over once the next one has begun, or the fighting is done
  if (!(A.duel > k || A.stage === "done") || A.felled[k] === undefined) return null;
  const nameOf = (p: Side) => fighter(before, B, p).name;
  const ord: Side[] = [(1 - me) as Side, me];
  const lines = ord.map((p) => {
    const whose = p === me ? "yours" : "the computer's";
    return A.felled[k][p] ? `${nameOf(p)} (${whose}) falls.` : `${nameOf(p)} (${whose}) stands, with Valour ${A.endValour[k][p]}.`;
  });
  const title = `${k === 2 ? "The final duel" : `Duel ${k + 1}`} is over`;
  let next: string | null = null;
  if (after.phase === "combat" && A.duel > k && A.stage !== "done") {
    const f = (p: Side) => fighter(after, A, p).name;
    next = `${A.duel === 2 ? "The final duel" : `Duel ${A.duel + 1}`}: ${f(me)} (yours) against ${f((1 - me) as Side)} (the computer's). ${A.first === me ? "You act" : "The computer acts"} first (Initiative ${A.init[me]} against ${A.init[1 - me]}).`;
  }
  return { title, lines, next };
}

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
    if (saved && !saved.recorded) sendRecord(saved, "abandoned");
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
    recordGameStart("roth", { mode: "computer", level: st.level });
    setSaved({ v: 1, setup: st, S, me, theirs, back: [], moves: [], decks: [decks[0].map((c) => c.id), decks[1].map((c) => c.id)], t0: Date.now(), undos: 0, log: [`§ ${sectionOf(S)}`, `New match: you play ${mine.label} as the ${me === 0 ? "first" : "second"} player against ${built ? (theirs === "ulster" ? "an" : "a") : "the"} ${FACTION_TITLE[theirs]} ${built ? "deck the computer built" : "starter deck"} (${st.level}).`], seed });
  }, [setup, setSetup, setSaved, saved]);

  const [record, setRecord] = useStoredState<MatchRecord>(RECORD_KEY, {});
  const play = useCallback((i: number) => {
    if (!saved || !d) return;
    const T = cloneState(saved.S);
    const line = logLine(T, d, d.options[i], saved.me);
    const before = sectionOf(T);
    const o = d.options[i];
    const lines: string[] = [];
    NARRATE.lines = lines;
    try { applyDecision(T, d, i); } finally { NARRATE.lines = null; }
    // name whose Valour or Shield it was ("Valour 5 → 7" alone doesn't say)
    const who = T.combat ? fighter(T, T.combat, d.player).name : null;
    const fx = summarize(lines)?.replace(/(^|· )(Valour|Shield) /g, (_m, a: string, k: string) => `${a}${who ? `${who}${k === "Shield" ? "'s Shield" : ""} ` : `${k} `}`) ?? null;
    const ev: MoveEvent = { mine: d.player === saved.me, text: line, fx, spot: o.t === "duel" && o.act === "use" ? o.spot : undefined, n: saved.log.length };
    const { S, d: next } = settle(T);
    const after = sectionOf(S);
    // the result, in words, when the match ends
    const res = !next && S.result ? S.result : null;
    const resultLine = res ? `${res.winner === -1 ? "A draw" : res.winner === saved.me ? "You win" : "The computer wins"}: heroes felled, you ${res.felled[1 - saved.me]}, the computer ${res.felled[saved.me]}.` : null;
    // the Reckoning's two secret changes, shown together once both are made
    const reck: DuelEnd | null = saved.S.phase === "reckon" && S.phase !== "reckon" && S.reckoned
      ? { title: "The Reckoning", lines: [reckonedLine(S, saved.me, saved.me), reckonedLine(S, (1 - saved.me) as Side, saved.me)], next: "The Winnow begins." } : null;
    const end = duelEnd(saved.S, S, saved.me) ?? reck;
    const endLines = end ? [`${end.title}. ${end.lines.join(" ")}`, ...(end.next ? [end.next] : [])] : [];
    const log = [...saved.log, line, ...endLines, ...(after !== before ? [`§ ${after}`] : []), ...(resultLine ? [resultLine] : [])].slice(-240);
    // stop between duels (not after the last: the result says it), so the player sees how the duel ended
    const pause = end && next ? end : undefined;
    // your own moves can be taken back; the Muster's are quick enough to keep out of the way
    const back = d.player === saved.me && d.kind !== "muster" ? [...(saved.back ?? []), { S: saved.S, log: saved.log, moves: saved.moves }].slice(-BACK_MAX) : saved.back;
    const moves = saved.moves ? [...saved.moves, i] : undefined;
    let recorded = saved.recorded;
    if (!next && S.result && !recorded) {
      recorded = true;
      const r = S.result, lv = saved.setup.level, cur = record[lv] ?? { w: 0, l: 0, d: 0 };
      setRecord({ ...record, [lv]: { w: cur.w + (r.winner === saved.me ? 1 : 0), l: cur.l + (r.winner === 1 - saved.me ? 1 : 0), d: cur.d + (r.winner === -1 ? 1 : 0) } });
      const outcome = r.winner === -1 ? "drawn" : r.winner === saved.me ? "won" : "lost";
      recordGameEnd("roth", { mode: "computer", level: lv, result: outcome === "won" ? "win" : outcome === "lost" ? "loss" : "draw" });
      sendRecord({ ...saved, S, moves }, outcome);
    }
    const last = T.phase === "combat" || S.phase === "combat" ? [...(saved.last ?? []), ev].slice(-4) : [];
    setSaved({ ...saved, S, log, back, recorded, last, moves, pause });
  }, [saved, d, setSaved, record, setRecord]);

  /** Take back your last move, and the computer's replies since. */
  const undo = useCallback(() => {
    if (!saved?.back?.length || saved.recorded) return;
    cancelComputer();
    busy.current++;
    const back = saved.back.slice(0, -1), b = saved.back[saved.back.length - 1];
    setSaved({ ...saved, S: b.S, log: [...b.log, "You took back a move."], back, last: [], pause: undefined, moves: b.moves, undos: (saved.undos ?? 0) + 1 });
  }, [saved, setSaved]);

  // The computer's turn
  useEffect(() => {
    if (!saved || !d || d.player === saved.me || saved.pause) { setThinking(false); return; }
    const ticket = ++busy.current;
    setThinking(true);
    const seed = (saved.seed + saved.log.length * 7919) % 2147483647;
    const t0 = performance.now();
    void computerChoice(saved.S, d, saved.setup.level, seed).then((i) => {
      const wait = Math.max(0, (d.kind === "muster" ? 60 : PACE_MS[saved.setup.pace ?? "normal"]) - (performance.now() - t0)); // the computer's Muster goes quickly
      setTimeout(() => { if (ticket === busy.current) play(i); }, wait);
    });
  }, [saved, d, play]);

  /** Go on past a duel's end. */
  const goOn = useCallback(() => { if (saved?.pause) setSaved({ ...saved, pause: undefined }); }, [saved, setSaved]);

  const quit = useCallback(() => { if (saved && !saved.recorded) sendRecord(saved, "abandoned"); cancelComputer(); busy.current++; setSaved(null); }, [saved, setSaved]);

  return {
    setup, setSetup, start, quit, play, thinking, undo, canUndo: !!saved?.back?.length && !saved.recorded, record,
    S: saved?.S ?? null, me: saved?.me ?? (0 as Side), d, log: saved?.log ?? [], theirs: saved?.theirs ?? null, last: saved?.last ?? [],
    myTurn: !!saved && !!d && d.player === saved.me && !saved.pause,
    pause: saved?.pause ?? null, goOn,
    over: !!saved && !d && !!saved.S.result,
  };
}
export type MatchApi = ReturnType<typeof useMatch>;
