import type { Side } from "../engine/rules";
import { Segmented } from "../../../kit/Segmented";
import { puzzlesFor, type PzState } from "../usePuzzles";

export function PuzzlePanel(props: {
  side: Side; setSide: (s: Side) => void; solved: Record<string, number>; pz: PzState | null;
  start: (id: string) => void; hint: () => void; showSolution: () => void; retry: () => void; next: () => void;
}) {
  const list = puzzlesFor(props.side), done = list.filter(p => props.solved[p.id] === 1).length;
  const ph = props.pz?.phase ?? null;
  return (
    <div className="panel">
      <Segmented label="Which side's puzzles" value={props.side} onChange={props.setSide}
        options={[{ value: 0 as Side, label: "Host puzzles" }, { value: 1 as Side, label: "Sí puzzles" }]} />
      <p className="label">{list.length ? `${done} of ${list.length} solved. Each needs 2 to 5 moves; the computer defends.` : "No puzzles here yet."}</p>
      <div className="plist">
        {[2, 3, 4, 5].map(n => {
          const grp = list.filter(p => p.n === n);
          if (!grp.length) return null;
          return (
            <div className="grp" key={n}>
              <span>{n} moves</span>
              <div className="chips">
                {grp.map((p, k) => {
                  const ok = props.solved[p.id] === 1;
                  return (
                    <button key={p.id} type="button" className={`${ok ? "done" : ""}${props.pz?.p.id === p.id ? " cur" : ""}`}
                      aria-label={`Puzzle ${p.label}${ok ? ", solved" : ""}`} onClick={() => props.start(p.id)}>{k + 1}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="pzmsg" aria-live="polite">{props.pz?.msg ?? "Pick a puzzle."}</p>
      <div className="row">
        {ph === "solve" || ph === "wait" ? <button className="btn" type="button" disabled={ph !== "solve" || props.pz?.hint} onClick={props.hint}>Hint</button> : null}
        {ph !== "show" ? <button className="btn" type="button" onClick={props.showSolution}>{ph === "shown" ? "Replay solution" : "Show solution"}</button> : null}
        {ph === "solved" || ph === "failed" || ph === "shown" ? <button className="btn" type="button" onClick={props.retry}>Try again</button> : null}
        <button className="btn primary" type="button" onClick={props.next}>Next puzzle</button>
      </div>
    </div>
  );
}
