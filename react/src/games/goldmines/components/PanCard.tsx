// The card laid over the pan at the end of a pan and at the end of the day.
import { useEffect, useRef, type ReactNode } from "react";
import { fmt, type DayResult, type PanResult } from "../engine/day";

export function PanSummary({ r, pansLeft, onNext }: { r: PanResult; pansLeft: number; onNext: () => void }) {
  return (
    <>
      <h2>{r.total > 0 ? "Colour in the pan" : "Not a speck"}</h2>
      <div className="big">{fmt(r.total)}</div>
      <dl>
        <dt>Flakes kept</dt><dd>{r.keptFlakes}</dd>
        <dt>Washed out over the lip</dt><dd>{r.lostFlakes}{r.lostFlakes ? ` (${fmt(r.lostMg)})` : ""}</dd>
        <dt>Left buried in the sand</dt><dd>{r.buriedN}{r.buriedN ? ` (${fmt(r.buriedMg)})` : ""}</dd>
      </dl>
      {r.nugget ? <p>A nugget! Wicklow's biggest weighed about 22 ounces.</p> : null}
      <p>{r.advice}</p>
      <button className="btn primary" type="button" id="nextBtn" onClick={onNext}>{pansLeft > 0 ? "Choose the next spot" : "End the day"}</button>
    </>
  );
}

export function DayEnd({ r, onNewDay }: { r: DayResult; onNewDay: () => void }) {
  return (
    <>
      <h2>Dusk on the river</h2>
      <div className="big">{fmt(r.mg)}</div>
      <dl>
        <dt>Flakes in the vial</dt><dd>{r.flakes}</dd>
        <dt>Flakes washed away</dt><dd>{r.lost}</dd>
        <dt>Best day</dt><dd>{fmt(r.best)}</dd>
      </dl>
      {r.isBest ? <p>Your best day yet.</p> : null}
      <p>Overnight the river moves its gravel, so tomorrow's best spots may be different.</p>
      <button className="btn primary" type="button" id="dayBtn" onClick={onNewDay}>Start a new day</button>
    </>
  );
}

/** The overlay itself: hidden when empty, and its button takes focus when it appears. */
export function Card({ children, focusKey }: { children: ReactNode; focusKey: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (children) ref.current?.querySelector("button")?.focus(); }, [focusKey]);
  return <div className="card" id="card" ref={ref} hidden={!children}>{children}</div>;
}
