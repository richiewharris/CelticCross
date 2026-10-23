import type { ReactNode } from "react";
import { Segmented } from "../../../kit/Segmented";
import type { Turn } from "../engine/core";
import type { PlaySettings } from "../usePlayGame";

export type Opponent = PlaySettings["mode"] | "online";

export function PlayPanel(props: {
  settings: PlaySettings; change: (p: Partial<PlaySettings>) => void; newGame: () => void; canUndo: boolean; undo: () => void;
  /** The opponent shown as chosen; "online" shows `online` in place of the game controls. */
  opponent: Opponent; pick: (o: Opponent) => void; online?: ReactNode;
}) {
  const st = props.settings;
  return (
    <div className="panel">
      <p className="label">Opponent</p>
      <Segmented label="Opponent" value={props.opponent} onChange={props.pick}
        options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend, same screen" }, { value: "online", label: "Online" }] as { value: Opponent; label: string }[]} />
      {props.opponent === "online" ? props.online : (
        <>
          {st.mode === "cpu" ? (
            <div className="panel">
              <Segmented label="Your side" value={st.side} onChange={side => props.change({ side })}
                options={[{ value: 0 as Turn, label: "Play white" }, { value: 8 as Turn, label: "Play black" }]} />
              <Segmented label="Computer strength" value={st.lvl} onChange={lvl => props.change({ lvl })}
                options={[{ value: 1, label: "Casual" }, { value: 2, label: "Steady" }, { value: 3, label: "Strong" }] as { value: PlaySettings["lvl"]; label: string }[]} />
            </div>
          ) : null}
          <div className="row">
            <button className="btn primary" type="button" onClick={props.newGame}>New game</button>
            <button className="btn" type="button" disabled={!props.canUndo} onClick={props.undo}>Undo</button>
          </div>
        </>
      )}
    </div>
  );
}
