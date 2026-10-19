// The narrow ledger beside the pan: spot list, the day's pans and haul, and the steps of panning.
import { PANS_PER_DAY, SPOTS, fmt, type SpotState } from "../engine/day";

export function SpotList({ spots, enabled, onPick }: { spots: SpotState[]; enabled: boolean; onPick: (id: string) => void }) {
  return (
    <ul className="spots" id="spots">
      {SPOTS.map(s => {
        const st = spots.find(x => x.id === s.id);
        const yd = st && st.pans ? `${st.pans} pan${st.pans > 1 ? "s" : ""} · ${st.lastMg != null && st.lastMg > 0 ? fmt(st.lastMg) : "none"}` : "";
        return (
          <li key={s.id}>
            <button type="button" data-id={s.id} disabled={!enabled} onClick={() => onPick(s.id)}>
              <span className="k">{s.id}</span><span className="nm">{s.name}</span><span className="yd">{yd}</span><span className="tip">{s.tip}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Today({ pansLeft, haul, best }: { pansLeft: number; haul: string; best: number }) {
  return (
    <div className="panel">
      <p className="label">Today</p>
      <div className="day">
        <span className="small">Pans left</span>
        <span className="pips" id="pips">
          {Array.from({ length: PANS_PER_DAY }, (_, k) => <span key={k} className={`pip${k < pansLeft ? " on" : ""}`} />)}
        </span>
        <span className="small">In the vial</span><span className="haul" id="haul">{haul}</span>
      </div>
      <p className="small" id="best">{best ? `Best day: ${fmt(best)}` : ""}</p>
    </div>
  );
}

const STEPS: [string, string][] = [
  ["Scoop", " from a spot on the river. Gold drops where the water slows down."],
  ["Shake", " the pan side to side under water. Gold is heavy and sinks; stones and gravel rise."],
  ["Pick out the stones", " once they come to the top."],
  ["Wash.", " Tilt the pan so water carries the top layer over the lip. Dip for more water. Tilt too steep and the gold goes too."],
  ["Collect", " the gold you can see. Anything still buried under sand when you finish is lost."],
];

export function HowTo({ step }: { step: number }) {
  return (
    <div className="panel">
      <p className="label">How to pan</p>
      <ol className="steps" id="steps">
        {STEPS.map(([b, rest], i) => <li key={i} className={i === step ? "now" : undefined}><b>{b}</b>{rest}</li>)}
      </ol>
      <p className="note">In September 1795, gold was found on the slopes of Croghan Kinsella in County Wicklow. For one month, crowds panned the Goldmines River, finding a nugget of about 22 ounces, before soldiers took over the site.</p>
    </div>
  );
}
