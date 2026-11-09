// A real match against the computer: setup, the human's choices, the computer's turns (in a worker),
// the move log and saving across reloads.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { DECKS, FACTIONS, type Faction } from "./engine/cards";
import { applyDecision, cloneState, newMatch, nextDecision, type Decision, type Side, type State } from "./engine/engine";
import { cancelComputer, computerChoice } from "./aiClient";
import { logLine } from "./text";

export type Level = "novice" | "casual" | "skilled" | "expert";
export interface Setup { mine: Faction; theirs: Faction | "random"; level: Level; seat: "first" | "second" | "random" }
export const DEFAULT_SETUP: Setup = { mine: "ulster", theirs: "random", level: "casual", seat: "random" };

interface Saved { v: 1; setup: Setup; S: State; me: Side; theirs: Faction; log: string[]; seed: number }

/** Run automatic steps; return the state and the decision now pending (null when the match is over). */
function settle(S: State): { S: State; d: Decision | null } {
  const T = cloneState(S);
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
    const decks = me === 0 ? [DECKS[st.mine], DECKS[theirs]] : [DECKS[theirs], DECKS[st.mine]];
    const S0 = newMatch([decks[0], decks[1]], {}, seed, false);
    const { S } = settle(S0);
    setSetup(st);
    setSaved({ v: 1, setup: st, S, me, theirs, log: [`New match: you play ${st.mine} as the ${me === 0 ? "first" : "second"} player against ${theirs} (${st.level}).`], seed });
  }, [setup, setSetup, setSaved]);

  const play = useCallback((i: number) => {
    if (!saved || !d) return;
    const T = cloneState(saved.S);
    const line = logLine(T, d, d.options[i], saved.me);
    applyDecision(T, d, i);
    const { S } = settle(T);
    setSaved({ ...saved, S, log: [...saved.log, line].slice(-200) });
  }, [saved, d, setSaved]);

  // The computer's turn
  useEffect(() => {
    if (!saved || !d || d.player === saved.me) { setThinking(false); return; }
    const ticket = ++busy.current;
    setThinking(true);
    const seed = (saved.seed + saved.log.length * 7919) % 2147483647;
    const t0 = performance.now();
    void computerChoice(saved.S, d, saved.setup.level, seed).then((i) => {
      const wait = Math.max(0, 450 - (performance.now() - t0));
      setTimeout(() => { if (ticket === busy.current) play(i); }, wait);
    });
  }, [saved, d, play]);

  const quit = useCallback(() => { cancelComputer(); busy.current++; setSaved(null); }, [setSaved]);

  return {
    setup, setSetup, start, quit, play, thinking,
    S: saved?.S ?? null, me: saved?.me ?? (0 as Side), d, log: saved?.log ?? [], theirs: saved?.theirs ?? null,
    myTurn: !!saved && !!d && d.player === saved.me,
    over: !!saved && !d && !!saved.S.result,
  };
}
export type MatchApi = ReturnType<typeof useMatch>;
