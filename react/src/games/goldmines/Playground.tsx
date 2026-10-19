// Every component on one page, with fixed data, so they can be built and checked in isolation.
import { useEffect, useRef, useState } from "react";
import "./goldmines.css";
import { GameScope } from "../../kit/GameScope";
import { drawFrame, makeSurface, newFx } from "./draw";
import { aim, drive, idleHands } from "./engine/control";
import { SPOTS, newDay, type Day, type DayResult, type PanResult } from "./engine/day";
import { dip, refreshExposure, scoop, stonesUp, type Pan } from "./engine/pan";
import { seeded } from "./engine/rng";
import { RiverMap } from "./components/RiverMap";
import { HowTo, SpotList, Today } from "./components/Ledger";
import { Controls, Gauge, Keys } from "./components/PanControls";
import { DayEnd, PanSummary } from "./components/PanCard";

/** A pan from a fixed seed, worked for a while: `shakeS` seconds of shaking, then `washS` of washing. */
function workedPan(seed: number, shakeS: number, washS: number): Pan {
  const rng = seeded(seed), pan = scoop(2.4, 4, rng), h = { ...idleHands(), holdShake: true };
  for (let t = 0; t < shakeS; t += 1 / 60) { if (pan.W < 0.5) dip(pan, rng); drive(pan, aim(h, t * 1000, false), 1 / 60, rng); }
  if (washS > 0) for (const p of stonesUp(pan)) p.alive = false;
  for (let t = 0; t < washS; t += 1 / 60) { if (pan.W < 0.15) { dip(pan, rng); pan.tilt = 0; } drive(pan, { ox: 0, tilt: 0.55 }, 1 / 60, rng); }
  Object.assign(pan, { ox: 0, tilt: 0, E: 0, flow: 0, W: 0.7 });
  refreshExposure(pan);
  return pan;
}

/** A still frame of the pan drawn by the game's own drawing code. */
function PanSnapshot({ pan, coach }: { pan: Pan | null; coach: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const paint = () => { const s = makeSurface(cv); if (s) drawFrame(s, pan, coach, true, { ...newFx(), displayMg: 240 }, 1.2); };
    paint();
    const ro = new ResizeObserver(paint); ro.observe(cv);
    return () => ro.disconnect();
  }, [pan, coach]);
  return <canvas ref={ref} style={{ width: "100%", aspectRatio: "1", display: "block", borderRadius: 16 }} aria-label="Sample pan" />;
}

const SAMPLE_DAY: Day = (() => {
  const d = newDay(seeded(3));
  d.pansLeft = 5; d.mg = 61.4;
  d.spots[0] = { ...d.spots[0], pans: 2, lastMg: 38.2 };
  d.spots[3] = { ...d.spots[3], pans: 1, lastMg: 0 };
  return d;
})();
const SUMMARY: PanResult = { total: 412.5, keptFlakes: 9, lostFlakes: 2, lostMg: 6.1, buriedN: 1, buriedMg: 3.3, nugget: true, advice: "Gold went over the lip. Shake longer before washing, and keep the tilt out of the red.", collected: [] };
const EMPTY: PanResult = { total: 0, keptFlakes: 0, lostFlakes: 0, lostMg: 0, buriedN: 0, buriedMg: 0, nugget: false, advice: "This scoop had no gold in it. Try a spot where the water slows.", collected: [] };
const DUSK: DayResult = { mg: 1234, flakes: 41, lost: 3, best: 1234, isBest: true };

export default function Playground() {
  const [step, setStep] = useState(1);
  const [coach, setCoach] = useState(true);
  const [inPan, setInPan] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [pans] = useState(() => ({ fresh: workedPan(5, 0, 0), shaken: workedPan(5, 6, 0), washed: workedPan(5, 6, 45) }));

  return (
    <GameScope id="goldmines"><div className="pg-game">
      <section>
        <h2>The pan <code>drawFrame()</code></h2>
        <div className="boards">
          <figure style={{ margin: 0 }}><PanSnapshot pan={pans.fresh} coach={coach} /><figcaption className="note">Fresh scoop (seed 5).</figcaption></figure>
          <figure style={{ margin: 0 }}><PanSnapshot pan={pans.shaken} coach={coach} /><figcaption className="note">After six seconds of shaking: stones up, gold down.</figcaption></figure>
          <figure style={{ margin: 0 }}><PanSnapshot pan={pans.washed} coach={coach} /><figcaption className="note">Washed down to the black sand; bare gold twinkles.</figcaption></figure>
          <figure style={{ margin: 0 }}><PanSnapshot pan={null} coach={false} /><figcaption className="note">Empty pan between scoops.</figcaption></figure>
        </div>
        <div className="controls" style={{ justifyContent: "start" }}>
          <button className="btn coach" type="button" aria-pressed={coach} onClick={() => setCoach(c => !c)}>{coach ? "Coach on" : "Coach"}</button>
        </div>
      </section>

      <section>
        <h2>Gauges and controls <code>&lt;Gauge&gt;</code> <code>&lt;Controls&gt;</code></h2>
        <div className="stage" style={{ justifyItems: "start" }}>
          <div className="gauges">
            <Gauge id="waterBar" label="Water" width="64%" />
            <Gauge id="tiltBar" label="Tilt" width="48%" />
            <Gauge id="settleBar" label="Gold settled" width="80%" />
          </div>
          <Controls inPan={inPan} coach={coach} hold={() => inPan} onDip={() => {}} onStones={() => {}} onFinish={() => {}} onCoach={() => setCoach(c => !c)} />
          <label className="small"><input type="checkbox" checked={inPan} onChange={e => setInPan(e.target.checked)} /> A pan is in hand (buttons enabled)</label>
          <Keys />
        </div>
      </section>

      <section>
        <h2>The river <code>&lt;RiverMap&gt;</code> <code>&lt;SpotList&gt;</code></h2>
        <div style={{ maxWidth: 320 }} className="panel">
          <RiverMap spots={SAMPLE_DAY.spots} onPick={setPicked} />
          <SpotList spots={SAMPLE_DAY.spots} enabled onPick={setPicked} />
          <p className="small">{picked ? `Picked ${SPOTS.find(s => s.id === picked)?.name}` : "Tap a spot."}</p>
        </div>
      </section>

      <section>
        <h2>The ledger <code>&lt;Today&gt;</code> <code>&lt;HowTo&gt;</code></h2>
        <div style={{ maxWidth: 320 }} className="panel">
          <Today pansLeft={SAMPLE_DAY.pansLeft} haul="61 mg" best={1234} />
          <HowTo step={step} />
          <div className="controls" style={{ justifyContent: "start" }}>
            <button className="btn" type="button" onClick={() => setStep(s => (s + 1) % 5)}>Next step</button>
          </div>
        </div>
      </section>

      <section>
        <h2>Cards <code>&lt;PanSummary&gt;</code> <code>&lt;DayEnd&gt;</code></h2>
        <div className="boards">
          <div className="canvas-wrap" style={{ aspectRatio: "auto", minHeight: 420 }}><div className="card"><PanSummary r={SUMMARY} pansLeft={4} onNext={() => {}} /></div></div>
          <div className="canvas-wrap" style={{ aspectRatio: "auto", minHeight: 420 }}><div className="card"><PanSummary r={EMPTY} pansLeft={0} onNext={() => {}} /></div></div>
          <div className="canvas-wrap" style={{ aspectRatio: "auto", minHeight: 420 }}><div className="card"><DayEnd r={DUSK} onNewDay={() => {}} /></div></div>
        </div>
      </section>
    </div></GameScope>
  );
}
