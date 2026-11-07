// The lock in a race: the dial, the cube or the classic cross, each driven by its own hook through a
// race link. Opening a lock moves on to the race's next one after a short beat; the race's options
// decide which resets there are.
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { GameScope } from "../../../kit/GameScope";
import { geom } from "../engine/dial";
import { looseEnds } from "../engine/knot";
import { touched } from "../engine/attempt";
import { Dial } from "../components/Dial";
import { TurnsPanel } from "../components/Ledger";
import { useLock } from "../useLock";
import { useCube, shadeOf } from "../cube/useCube";
import { CubeView, Triskele } from "../cube/CubeView";
import { CUBE_TIERS, FACES, cubeGeom, cubeTransform, looseEnds as cubeEnds } from "../cube/engine";
import { useCross } from "../useCross";
import { CrossBoard, TileSvg } from "../components/CrossBoard";
import { crossDeal, crossKnot, cubeDeal, cubeKnot, dialDeal, dialKnot, type RaceOptions } from "./engine";
import { RACE_MSG, type RaceLink } from "./link";
import "../cube/cube.css";

export interface PuzzleCtl {
  /** A lock opened: false if the clock had run out. */
  solved(): boolean;
  failed(): void;
  setPuzzle(i: number): void;
}
export interface PuzzleProps { o: RaceOptions; seed: number; ctl: PuzzleCtl; cheatAllowed: boolean; aside?: React.ReactNode }

const beatMs = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 650);

/** Lock i of the race and its j-th deal, for one kind of lock; moves on when a lock opens. */
function useRaceSequence<K, D>(p: PuzzleProps, knotOf: (i: number) => K, dealOf: (k: K, i: number, j: number) => D, load: () => ((k: K, d: D, msg: string) => void) | undefined): RaceLink<K, D> {
  const i = useRef(0), j = useRef(0);
  const first = useMemo(() => { const k = knotOf(0); return { knot: k, deal: dealOf(k, 0, 0) }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const knot = useRef(first.knot);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return {
    tier: p.o.tier, first, freeResets: p.o.resets === "free",
    nextDeal: () => dealOf(knot.current, i.current, ++j.current),
    opened: () => {
      if (!p.ctl.solved()) return;
      const n = ++i.current; j.current = 0;
      const k = knotOf(n), d = dealOf(k, n, 0);
      knot.current = k;
      timer.current = setTimeout(() => { timer.current = null; p.ctl.setPuzzle(n); load()?.(k, d, RACE_MSG.next(n + 1)); }, beatMs());
    },
    failed: () => p.ctl.failed(),
  };
}

/** Try the lock; with free resets also Start over, and Retry / Scramble after a failed try. */
function RaceControls(p: { open: boolean; failed: boolean; free: boolean; canStartOver: boolean; tryLabel: React.ReactNode; tryClass?: string; onTry(): void; onRetry(): void; onScramble(): void; onStartOver(): void }) {
  const retryRef = useRef<HTMLButtonElement>(null), tryRef = useRef<HTMLButtonElement>(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const a = document.activeElement;
    if (a && a !== document.body) return;
    (p.failed && p.free ? retryRef : tryRef).current?.focus({ preventScroll: true });
  }, [p.failed, p.free]);
  if (p.failed && p.free) {
    return (
      <>
        <button ref={retryRef} className="btn primary" type="button" onClick={p.onRetry}>Retry this lock</button>
        <button className="btn" type="button" onClick={p.onScramble}>Scramble</button>
      </>
    );
  }
  return (
    <>
      <button ref={tryRef} className={`btn primary${p.tryClass ? ` ${p.tryClass}` : ""}`} type="button" disabled={p.open || p.failed} onClick={p.onTry}>{p.tryLabel}</button>
      {p.free && <button className="btn minor" type="button" disabled={!p.canStartOver || p.open} onClick={p.onStartOver}
        title="Put the stones back as this lock was dealt, with all its turns">Start over</button>}
    </>
  );
}

/** Dev-only aid for browser tests: window.__lockRace.solve() puts the lock in play right. */
function useTestHook(solve: () => void) {
  const ref = useRef(solve); ref.current = solve;
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __lockRace?: { solve(): void } };
    w.__lockRace = { solve: () => ref.current() };
    return () => { delete w.__lockRace; };
  }, []);
}

function CheatButton({ on, toggle }: { on: boolean; toggle(): void }) {
  return <button className="btn cheat" type="button" aria-pressed={on} onClick={toggle}>{on ? "Cheat on" : "Cheat"}</button>;
}

export function DialRace(p: PuzzleProps) {
  const loadRef = useRef<ReturnType<typeof useLock>["loadLock"]>();
  const link = useRaceSequence(p, i => dialKnot(p.o.tier, p.seed, i), (k, i, j) => dialDeal(p.o.tier, k, p.seed, i, j), () => loadRef.current);
  const L = useLock(link);
  loadRef.current = L.loadLock;
  useTestHook(L.solveNow);
  const { s, cheat } = L;
  const g = geom(s.tier);
  const ends = looseEnds(s.cur, g.R, g.C).length;
  return (
    <div className="game race-game">
      <section className="box race-box" aria-label="Puzzle box">
        <div className={`status ${s.msgKind}`} role="status" aria-live="polite">{s.msg}</div>
        <Dial tier={s.tier} cur={s.cur} sol={s.sol} phi={L.drawnPhi} anim={L.anim} open={s.open} svgOpen={L.svgOpen} cheat={cheat} locked={s.failed}
          domRef={L.dom} {...L.handlers} />
        <div className="controls">
          <button className="btn icon" type="button" aria-label="Spin anticlockwise" onClick={() => L.spinBy(-1)}>⟲</button>
          <button className="btn icon" type="button" aria-label="Spin clockwise" onClick={() => L.spinBy(1)}>⟳</button>
          <RaceControls open={s.open} failed={s.failed} free={p.o.resets === "free"} canStartOver={touched(s)} tryLabel="Try the lock"
            onTry={L.tryOpen} onRetry={L.retry} onScramble={L.scramble} onStartOver={L.startOver} />
          {p.cheatAllowed && <CheatButton on={cheat} toggle={L.toggleCheat} />}
        </div>
        <p className="hintbox" aria-live="polite">{cheat && !s.open ? (ends ? `${ends} loose end${ends === 1 ? "" : "s"} left.` : "No loose ends. Press the center.") : ""}</p>
      </section>
      <aside>
      <TurnsPanel label="Turns left" left={s.turnsLeft} budget={s.budget} meterOver={30}
        line={s.turnsLeft === 0 ? `0 of ${s.budget} left. Press the center${p.o.resets === "free" ? ", or start over" : ""}.` : `${s.turnsLeft} of ${s.budget} turns left`} />
      {p.aside}
      </aside>
    </div>
  );
}

export function CubeRace(p: PuzzleProps) {
  const loadRef = useRef<ReturnType<typeof useCube>["loadLock"]>();
  const link = useRaceSequence(p, i => cubeKnot(p.o.tier, p.seed, i), (k, i, j) => cubeDeal(p.o.tier, k, p.seed, i, j), () => loadRef.current);
  const L = useCube(link);
  loadRef.current = L.loadLock;
  useTestHook(L.solveNow);
  const { s, cheat, view } = L;
  const T = CUBE_TIERS[s.tier], g = cubeGeom(T.N);
  const ends = cubeEnds(g, s.cur);
  const reveal = FACES.map((_, f) => !T.obscured || f === view.front || cheat || s.open);
  const live = FACES.map((_, f) => !s.open && !s.failed && reveal[f] && view.vis.includes(f));
  return (
    <div className="game race-game">
      <section className="box cube-box race-box" aria-label="Puzzle cube" onKeyDown={L.onKeyDown}>
        <div className={`status ${s.msgKind}`} role="status" aria-live="polite">{s.msg}</div>
        <CubeView g={g} cur={s.cur} sol={s.sol} ends={ends} reveal={reveal} live={live} cheat={cheat} open={s.open} home={L.home}
          transform={cubeTransform(L.q.current)} shade={shadeOf(L.q.current)} domRef={L.dom} {...L.handlers} />
        <div className="cube-turns" role="group" aria-label="Turn the cube">
          <button className="btn icon" type="button" aria-label="Turn the cube left" title="Turn left (←)" onClick={() => L.turnBy("left")}>←</button>
          <button className="btn icon" type="button" aria-label="Turn the cube up" title="Turn up (↑)" onClick={() => L.turnBy("up")}>↑</button>
          <button className="btn icon" type="button" aria-label="Turn the cube down" title="Turn down (↓)" onClick={() => L.turnBy("down")}>↓</button>
          <button className="btn icon" type="button" aria-label="Turn the cube right" title="Turn right (→)" onClick={() => L.turnBy("right")}>→</button>
          <button className="btn icon" type="button" aria-label="Roll the cube anticlockwise" title="Roll anticlockwise (Q)" onClick={() => L.turnBy("unroll")}>⟲</button>
          <button className="btn icon" type="button" aria-label="Roll the cube clockwise" title="Roll clockwise (E)" onClick={() => L.turnBy("roll")}>⟳</button>
        </div>
        <div className="controls">
          <RaceControls open={s.open} failed={s.failed} free={p.o.resets === "free"} canStartOver={touched(s)} tryLabel={<><Triskele />Try the lock</>} tryClass="boss"
            onTry={L.tryOpen} onRetry={L.retry} onScramble={L.scramble} onStartOver={L.startOver} />
          {p.cheatAllowed && <CheatButton on={cheat} toggle={L.toggleCheat} />}
        </div>
        <p className="hintbox" aria-live="polite">{cheat && !s.open ? (ends.length ? `${ends.length} loose end${ends.length === 1 ? "" : "s"} left.` : "No loose ends. Press the triskele.") : ""}</p>
      </section>
      <aside>
      <TurnsPanel label="Turns left" left={s.turnsLeft} budget={s.budget} meterOver={30}
        line={s.turnsLeft === 0 ? `0 of ${s.budget} left. Press the triskele${p.o.resets === "free" ? ", or start over" : ""}.` : `${s.turnsLeft} of ${s.budget} turns left`} />
      {p.aside}
      </aside>
    </div>
  );
}

export function CrossRace(p: PuzzleProps) {
  const loadRef = useRef<ReturnType<typeof useCross>["loadLock"]>();
  const link = useRaceSequence(p, i => crossKnot(p.o.tier, p.seed, i), (k, i, j) => crossDeal(p.o.tier, k, p.seed, i, j), () => loadRef.current);
  const X = useCross(link);
  loadRef.current = X.loadLock;
  useTestHook(X.solveNow);
  const { S, cheat } = X;
  return (
    <GameScope id="lock-v1">
      <div className="game race-game">
      <section className="box race-box" aria-label="Puzzle box">
        <div className={`status ${S.msgKind}`} role="status" aria-live="polite">{S.msg}</div>
        <CrossBoard tiles={S.tiles} arr={S.arr} open={S.open} look={X.look} flash={X.flash} flashed={X.flashed} boardRef={X.boardEl} {...X.handlers} />
        <div className="actions">
          <RaceControls open={S.open} failed={S.failed} free={p.o.resets === "free"} canStartOver={X.canStartOver} tryLabel="Try the lock"
            onTry={X.tryLock} onRetry={X.retry} onScramble={X.scramble} onStartOver={X.startOver} />
          {p.cheatAllowed && <CheatButton on={cheat} toggle={X.toggleCheat} />}
        </div>
        <p className="hintbox" aria-live="polite">{X.hintText}</p>
      </section>
      <aside>
      <TurnsPanel label="Moves left" left={S.movesLeft} budget={S.budget}
        line={S.movesLeft === 0 ? `0 of ${S.budget} left. Try the lock${p.o.resets === "free" ? ", or start over" : ""}.` : `${S.movesLeft} of ${S.budget} moves left`} />
      {p.aside}
      </aside>
      </div>
      {X.ghost ? createPortal(<div className="ghost" ref={X.ghostEl}><TileSvg t={X.ghost.t} bad={X.ghost.bad} /></div>, document.body) : null}
    </GameScope>
  );
}

export function RacePuzzle(p: PuzzleProps) {
  return p.o.kind === "cube" ? <CubeRace {...p} /> : p.o.kind === "cross" ? <CrossRace {...p} /> : <DialRace {...p} />;
}
