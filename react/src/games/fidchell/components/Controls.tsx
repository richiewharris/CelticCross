import { Segmented } from "../../../kit/Segmented";
import { LEVEL_NAMES, type LevelId } from "../engine/ai";
import type { Mode } from "../engine/game";
import type { Side } from "../engine/rules";

export interface ControlsProps {
  mode: Mode; side: Side; lvl: LevelId;
  setMode: (m: Mode) => void; setSide: (s: Side) => void; setLvl: (l: LevelId) => void;
  newGame: () => void; canUndo: boolean; undo: () => void;
  hints: boolean; toggleHints: () => void;
}

/** Opponent, side and level, plus New game, Undo and the Hints toggle. */
export function Controls(p: ControlsProps) {
  return (
    <div className="panel">
      <p className="label">Opponent</p>
      <Segmented label="Opponent" value={p.mode} onChange={p.setMode}
        options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend, same screen" }] as { value: Mode; label: string }[]} />
      <div id="cpuOpts" className="panel" hidden={p.mode !== "cpu"}>
        <Segmented label="Your side" value={p.side} onChange={p.setSide}
          options={[{ value: 1, label: "Play gold" }, { value: 2, label: "Play white" }] as { value: Side; label: string }[]} />
        <Segmented label="Computer strength" value={p.lvl} onChange={p.setLvl}
          options={([1, 2, 3] as LevelId[]).map(v => ({ value: v, label: LEVEL_NAMES[v] }))} />
      </div>
      <div className="row">
        <button className="btn primary" type="button" onClick={p.newGame}>New game</button>
        <button className="btn" type="button" onClick={p.undo} disabled={!p.canUndo}>Undo</button>
        <button className="btn hint" type="button" aria-pressed={p.hints} onClick={p.toggleHints}>{p.hints ? "Hints on" : "Hints"}</button>
      </div>
    </div>
  );
}
