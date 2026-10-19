// Gauges and buttons under the pan.
import { forwardRef, useEffect, useState } from "react";

type HoldKey = "holdShake" | "holdWash";

/** A button that acts while held down (pointer, or Space/Enter from the keyboard). */
function HoldButton({ id, title, label, disabled, k, hold }: {
  id: string; title: string; label: string; disabled: boolean; k: HoldKey; hold: (k: HoldKey, on: boolean) => boolean;
}) {
  const [held, setHeld] = useState(false);
  const off = () => { hold(k, false); setHeld(false); };
  useEffect(() => { if (disabled && held) off(); }); // a button that is disabled mid-hold lets go
  return (
    <button className={`btn${held ? " held" : ""}`} type="button" id={id} title={title} disabled={disabled}
      onPointerDown={e => {
        e.preventDefault();
        if (!hold(k, true)) return;
        setHeld(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }}
      onPointerUp={off} onPointerCancel={off} onPointerLeave={off}
      onKeyDown={e => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); if (hold(k, true)) setHeld(true); }
      }}
      onKeyUp={e => { if (e.key === " " || e.key === "Enter") off(); }}
    >{label}</button>
  );
}

export function Controls(props: {
  inPan: boolean; coach: boolean; hold: (k: HoldKey, on: boolean) => boolean;
  onDip: () => void; onStones: () => void; onFinish: () => void; onCoach: () => void;
}) {
  const off = !props.inPan;
  return (
    <div className="controls">
      <HoldButton id="shakeBtn" title="Hold to shake" label="Shake" disabled={off} k="holdShake" hold={props.hold} />
      <HoldButton id="washBtn" title="Hold to tilt and wash" label="Wash" disabled={off} k="holdWash" hold={props.hold} />
      <button className="btn" type="button" id="dipBtn" disabled={off} onClick={props.onDip}>Dip</button>
      <button className="btn" type="button" id="stonesBtn" disabled={off} onClick={props.onStones}>Stones</button>
      <button className="btn primary" type="button" id="finishBtn" disabled={off} onClick={props.onFinish}>Finish pan</button>
      <button className="btn coach" type="button" id="coachBtn" aria-pressed={props.coach} onClick={props.onCoach}>{props.coach ? "Coach on" : "Coach"}</button>
    </div>
  );
}

/** One gauge bar; the bar's fill (<i>) is sized directly by the animation loop through the ref. */
export const Gauge = forwardRef<HTMLElement, { id: string; label: string; gaugeId?: string; hidden?: boolean; width?: string }>(
  function Gauge({ id, label, gaugeId, hidden, width }, ref) {
    return (
      <div className="gauge" id={gaugeId} hidden={hidden}>
        <p className="label">{label}</p>
        <div className="bar" id={id}><i ref={ref} style={width ? { width } : undefined} /></div>
      </div>
    );
  },
);

export function Keys() {
  return (
    <p className="keys">Drag the pan side to side to shake and down to tilt, or hold Shake and Wash. Dip refills the water, Stones tosses out stones that have come up. Keys: <kbd>←</kbd> <kbd>→</kbd> shake, hold <kbd>↓</kbd> to wash (<kbd>Shift</kbd> for steeper), <kbd>Space</kbd> dip, <kbd>S</kbd> stones, <kbd>Enter</kbd> finish.</p>
  );
}
