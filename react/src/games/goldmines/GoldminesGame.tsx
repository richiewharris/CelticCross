import { useRef } from "react";
import { useGoldmines } from "./useGoldmines";
import { RiverMap } from "./components/RiverMap";
import { HowTo, SpotList, Today } from "./components/Ledger";
import { Controls, Gauge, Keys } from "./components/PanControls";
import { Card, DayEnd, PanSummary } from "./components/PanCard";

export function GoldminesGame() {
  const water = useRef<HTMLElement>(null), tilt = useRef<HTMLElement>(null), settle = useRef<HTMLElement>(null);
  const g = useGoldmines({ water, tilt, settle });
  const inPan = g.phase === "pan";
  const canPick = g.phase === "choose" && g.day.pansLeft > 0;
  const pick = (id: string) => { if (canPick) g.startPan(id); };

  return (
    <div className="wrap">
      <header>
        <h1>Goldmines River</h1>
        <p className="tag">Pan a Wicklow stream for gold. Shake the pan so the heavy gold sinks, toss out the stones, then tilt and wash the light gravel over the lip without letting the gold go with it.</p>
      </header>

      <div className="game">
        <section className="stage" aria-label="Gold pan">
          <div className={`status${g.status.kind ? " " + g.status.kind : ""}`} id="status" role="status" aria-live="polite">{g.status.text}</div>
          <div className="canvas-wrap">
            <canvas id="pan" ref={g.canvasRef} tabIndex={0} className={g.dragging ? "dragging" : undefined}
              aria-label="Gold pan. Drag side to side to shake, drag down to tilt and wash, tap stones and gold. Keys: left and right arrows shake, down arrow tilts, space dips."
              {...g.canvasHandlers} />
            <Card focusKey={g.card}>
              {g.card?.kind === "summary" ? <PanSummary r={g.card.r} pansLeft={g.card.pansLeft} onNext={g.next} />
                : g.card?.kind === "dayEnd" ? <DayEnd r={g.card.r} onNewDay={g.newDay} /> : null}
            </Card>
          </div>
          <div className="gauges">
            <Gauge id="waterBar" label="Water" ref={water} />
            <Gauge id="tiltBar" label="Tilt" ref={tilt} />
            <Gauge id="settleBar" gaugeId="settleGauge" label="Gold settled" hidden={!g.meta.coach} ref={settle} />
          </div>
          <Controls inPan={inPan} coach={g.meta.coach} hold={g.hold}
            onDip={g.dip} onStones={g.pickStones} onFinish={g.finish} onCoach={g.toggleCoach} />
          <Keys />
        </section>

        <aside>
          <div className="panel">
            <p className="label">The river</p>
            <RiverMap spots={g.day.spots} onPick={pick} />
            <SpotList spots={g.day.spots} enabled={canPick} onPick={pick} />
          </div>
          <Today pansLeft={g.day.pansLeft} haul={g.haul} best={g.meta.best} />
          <HowTo step={g.status.step} />
        </aside>
      </div>
    </div>
  );
}
