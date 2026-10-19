// The match: state, the roll animation, the computer's turns, the result card and saving.
import { useCallback, useEffect, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { aiChoice } from "./engine/ai";
import { sample, type Die, type Rng } from "./engine/dice";
import {
  DEFAULT_SETTINGS, diceOdds, isHuman, land, legalDie, live, newMatch, nextRound, takeDie, type Game, type Settings,
} from "./engine/game";
import { ROLL_MS, type Flight } from "./components/Tray";
import { useReducedMotion } from "./useReducedMotion";

const rng: Rng = Math.random;

export function useFiche() {
  const reduce = useReducedMotion();
  const [settings, setSettings] = useStoredState<Settings>("fiche-react-settings", DEFAULT_SETTINGS);
  const [coach, setCoach] = useStoredState<boolean>("fiche-react-coach", false);
  // A finished match is not worth resuming: start afresh, as the original does.
  const [g, setG] = useStoredState<Game>("fiche-react-match", () => newMatch(settings, rng));
  const [flight, setFlight] = useState<Flight | null>(null);
  const [thinking, setThinking] = useState(false);
  // The result card waits for the last die and the dial to settle.
  const [cardOpen, setCardOpen] = useState(() => !!g.R.over && !g.M.over);
  const flightRef = useRef<Flight | null>(null);
  const later = (ms: number) => (reduce ? Math.min(ms, 150) : ms);

  useEffect(() => { if (g.M.over && !cardOpen && !flight) setG(newMatch(settings, rng)); }, []);

  const busy = !!flight || thinking;
  const cpuTurn = live(g) && !isHuman(g.M, g.R.turn);

  /** Pick die d for the player to move, and send it rolling. */
  const roll = useCallback((d: Die) => {
    if (flightRef.current) return;
    const real = legalDie(g, d);
    if (real === null) return;
    const fl: Flight = { p: g.R.turn, d: real, v: sample(real, rng), seed: rng(), t0: performance.now(), dur: reduce ? 1 : ROLL_MS };
    flightRef.current = fl;
    setFlight(fl);
  }, [g, reduce]);

  // The die lands when its flight ends.
  useEffect(() => {
    if (!flight) return;
    const t = setTimeout(() => {
      flightRef.current = null;
      setFlight(null);
      setG(cur => land(takeDie(cur, flight.d), flight.d, flight.v, flight.seed));
    }, flight.dur);
    return () => clearTimeout(t);
  }, [flight, setG]);

  // The computer's turn: a pause, then a roll.
  useEffect(() => {
    if (!cpuTurn || flight) return;
    setThinking(true);
    const t = setTimeout(() => { setThinking(false); roll(aiChoice(g.R, g.M.lvl, rng)); }, later(g.R.kind === "again" ? 900 : 700));
    return () => { clearTimeout(t); setThinking(false); };
  }, [cpuTurn, flight, g]);

  // A round has just ended: show the result after a moment.
  const roundOver = !!g.R.over;
  useEffect(() => {
    if (!roundOver || cardOpen) return;
    const t = setTimeout(() => setCardOpen(true), later(900));
    return () => clearTimeout(t);
  }, [roundOver]);

  const restart = (st: Settings) => {
    flightRef.current = null;
    setFlight(null); setThinking(false); setCardOpen(false);
    setG(newMatch(st, rng));
  };

  const change = (patch: Partial<Settings>) => {
    const st = { ...settings, ...patch };
    setSettings(st);
    if (patch.mode !== undefined || patch.best !== undefined) restart(st);
    else if (patch.lvl !== undefined) setG(cur => ({ ...cur, M: { ...cur.M, lvl: st.lvl } }));
  };

  const view = flight ? takeDie(g, flight.d) : g;
  const humanTurn = live(g) && isHuman(g.M, g.R.turn) && !busy;

  return {
    g, view, flight, busy, settings, change, coach,
    toggleCoach: () => setCoach(c => !c),
    humanTurn, roll,
    odds: humanTurn && coach ? diceOdds(g.R) : [null, null, null],
    cardOpen,
    nextRound: () => { setCardOpen(false); setG(cur => nextRound(cur)); },
    newMatch: () => restart(settings),
  };
}
