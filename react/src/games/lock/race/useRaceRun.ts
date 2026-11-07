// One racer's run in play: the countdown, the clock, the count of opened locks and failed tries, and
// the +N / −N notes. The clock is this device's own (Date.now()), from the moment the countdown ends.
import { useCallback, useEffect, useRef, useState } from "react";
import { NEW_RUN, deadline, failRun, finishRun, runEnded, solveRun, timeLeftMs, type RaceOptions, type RaceRun } from "./engine";

export interface RaceSink {
  /** The count changed (a lock opened or a try failed). */
  progress(run: RaceRun): void;
  /** The clock ran out: the final count. */
  finish(run: RaceRun): void;
}

export interface Toast { id: number; text: string; kind: "plus" | "minus" }
export type RunPhase = "countdown" | "racing" | "over";

const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useRaceRun(o: RaceOptions, sink: RaceSink) {
  const [phase, setPhase] = useState<RunPhase>("countdown");
  const [count, setCount] = useState(3);
  const [run, setRun] = useState<RaceRun>(NEW_RUN);
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [puzzle, setPuzzle] = useState(0);
  const startAt = useRef<number | null>(null);
  const runRef = useRef(run);
  const sinkRef = useRef(sink); sinkRef.current = sink;
  const toastId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = (ms: number, f: () => void) => { const t = setTimeout(() => { timers.current.delete(t); f(); }, ms); timers.current.add(t); };
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);

  const commit = (r: RaceRun) => { runRef.current = r; setRun(r); };
  const toast = (text: string, kind: Toast["kind"]) => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-2), { id, text, kind }]);
    later(reduceMotion() ? 2200 : 1600, () => setToasts(t => t.filter(x => x.id !== id)));
  };

  const finish = useCallback(() => {
    const s = startAt.current;
    if (s === null || runRef.current.finished) return;
    const done = finishRun(o, runRef.current, s, Date.now());
    commit(done); setPhase("over");
    sinkRef.current.finish(done);
  }, [o]);

  // 3 · 2 · 1 · go
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) { startAt.current = Date.now(); setNow(startAt.current); setPhase("racing"); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  // The clock: redraw ten times a second; stop when it runs out.
  useEffect(() => {
    if (phase !== "racing") return;
    const t = setInterval(() => {
      const n = Date.now(); setNow(n);
      if (startAt.current !== null && runEnded(o, runRef.current, startAt.current, n)) finish();
    }, 100);
    return () => clearInterval(t);
  }, [phase, o, finish]);

  /** A lock opened. False if the clock had already run out (the race is over). */
  const solved = useCallback((): boolean => {
    const s = startAt.current;
    if (s === null) return false;
    const r = solveRun(o, runRef.current, s, Date.now());
    if (!r) { finish(); return false; }
    commit(r.run);
    if (r.gained) toast(`+${r.gained} s`, "plus");
    sinkRef.current.progress(r.run);
    return true;
  }, [o, finish]);

  /** A try failed: the penalty, which may end the run there and then. */
  const failed = useCallback(() => {
    const s = startAt.current;
    if (s === null) return;
    const r = failRun(o, runRef.current, s, Date.now());
    if (!r) { finish(); return; }
    commit(r.run);
    if (r.lost) toast(`−${r.lost} s`, "minus");
    sinkRef.current.progress(r.run);
    if (runEnded(o, r.run, s, Date.now())) finish();
  }, [o, finish]);

  const left = startAt.current === null ? o.minutes * 60000 : timeLeftMs(o, run, startAt.current, now);
  return {
    phase, count, run, left, toasts, puzzle, setPuzzle, solved, failed,
    deadline: startAt.current === null ? null : deadline(o, run, startAt.current),
  };
}
export type RaceRunCtl = ReturnType<typeof useRaceRun>;
