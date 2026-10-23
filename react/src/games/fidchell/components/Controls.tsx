import type { ReactNode } from "react";
import { Segmented } from "../../../kit/Segmented";
import { LEVEL_NAMES, type LevelId } from "../engine/ai";
import type { Mode } from "../engine/game";
import type { Side } from "../engine/rules";

export type View = Mode | "online";

export interface ControlsProps {
  /** "online" shows `children` (the online panel) in place of the local game's controls. */
  view: View; side: Side; lvl: LevelId;
  setView: (v: View) => void; setSide: (s: Side) => void; setLvl: (l: LevelId) => void;
  newGame: () => void; canUndo: boolean; undo: () => void;
  hints: boolean; toggleHints: () => void;
  children?: ReactNode;
}

/** Opponent, side and level, plus New game, Undo and the Hints toggle. */
export function Controls(p: ControlsProps) {
  const seg = (
    <Segmented label="Opponent" value={p.view} onChange={p.setView}
      options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend, same screen" }, { value: "online", label: "Online" }] as { value: View; label: string }[]} />
  );
  if (p.view === "online") return <div className="panel"><p className="label">Opponent</p>{seg}{p.children}</div>;
  return (
    <div className="panel">
      <p className="label">Opponent</p>
      {seg}
      <div id="cpuOpts" className="panel" hidden={p.view !== "cpu"}>
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
