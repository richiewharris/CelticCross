import { Segmented } from "../../../kit/Segmented";
import { LEVELS_N } from "../engine/core";
import { levelLabel, type PuzzleStats } from "../engine/rating";
import type { PzState } from "../usePuzzles";

const THEME: Record<string, string> = { swap: "Swap", quiet: "Quiet move", sacrifice: "Sacrifice", row: "Far row", throne: "Throne hunt", blocked: "No moves left" };

export function PuzzlePanel(props: {
  ps: PuzzleStats; pz: PzState | null;
  next: () => void; hint: () => void; showSolution: () => void; retry: () => void; togglePause: () => void; step: () => void;
  setSpeed: (v: PuzzleStats["speed"]) => void; setPick: (v: string) => void;
}) {
  const { ps, pz } = props;
  const p = pz?.p ?? null;
  const ph = pz ? pz.phase : "load";
  const done = !!pz && ["solved", "failed", "show", "shown"].includes(pz.phase);
  const delta = pz && pz.delta != null ? pz.delta : null;
  return (
    <div className="panel" id="puzPanel">
      <div className="rating"><b>{ps.rating}</b><span className={`delta${delta == null ? "" : delta >= 0 ? " up" : " down"}`}>{delta == null ? "" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}`}</span></div>
      <p className="stats">{ps.played ? `${ps.solved} of ${ps.played} solved · streak ${ps.streak} · best ${ps.best}` : "Your puzzle rating. It starts at 600 and moves with every puzzle."}</p>
      <div className="dots" aria-hidden="true">{ps.recent.map((r, k) => <i key={k} className={r} />)}</div>
      <div className="pzcard">
        <p className="pzmeta"><span>{pz ? `Puzzle ${pz.L}·${pz.i}${pz.retry ? " (practice)" : ""}` : "Puzzle"}</span><span>{p && pz ? (done ? `Rated ${p.rating}` : `Level ${pz.L} · win in ${p.n}`) : ""}</span></p>
        <p className="pzmsg" aria-live="polite">{pz ? pz.tip : ""}</p>
        <div className="chips">{p && done ? [...p.notes, p.how].map(t => <span key={t}>{THEME[t]}</span>) : null}</div>
      </div>
      <div className="row">
        <button className={`btn${ph !== "solve" && ph !== "wait" ? " primary" : ""}`} type="button" onClick={props.next}>{ph === "solve" && !(pz?.moved || pz?.hint) ? "Skip" : "Next puzzle"}</button>
        <button className="btn" type="button" hidden={ph !== "solve" && ph !== "wait"} disabled={ph !== "solve" || pz?.hint} onClick={props.hint}>Hint</button>
        <button className="btn" type="button" hidden={ph === "show"} disabled={!p} onClick={props.showSolution}>{ph === "shown" ? "Replay solution" : "Show solution"}</button>
        <button className="btn" type="button" hidden={!(ph === "failed" || ph === "solved" || ph === "shown")} onClick={props.retry}>Try again</button>
        <button className="btn" type="button" hidden={ph !== "show"} onClick={props.togglePause}>{pz?.paused ? "Play" : "Pause"}</button>
        <button className="btn" type="button" hidden={ph !== "show"} disabled={!pz?.paused} onClick={props.step}>Step ▸</button>
      </div>
      <p className="label">Solution speed</p>
      <Segmented label="Solution speed" value={ps.speed} onChange={props.setSpeed}
        options={[{ value: "1", label: "Slow" }, { value: "2", label: "Normal" }, { value: "3", label: "Fast" }] as { value: PuzzleStats["speed"]; label: string }[]} />
      <label className="label" htmlFor="pzPick">Difficulty</label>
      <select className="pick" id="pzPick" value={ps.pick} onChange={e => props.setPick(e.target.value)}>
        <option value="auto">Match my rating</option>
        {Array.from({ length: LEVELS_N }, (_, k) => <option key={k + 1} value={String(k + 1)}>{levelLabel(k + 1)}</option>)}
      </select>
    </div>
  );
}
