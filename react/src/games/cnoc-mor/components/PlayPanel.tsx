import { Segmented } from "../../../kit/Segmented";
import type { Level } from "../engine/ai";
import type { Side } from "../engine/rules";
import type { PlaySettings } from "../usePlayGame";

export function PlayPanel(props: {
  settings: PlaySettings; change: (p: Partial<PlaySettings>) => void;
  newGame: () => void; canUndo: boolean; undo: () => void; canReview: boolean; review: () => void;
}) {
  const st = props.settings;
  return (
    <div className="panel">
      <p className="label">Opponent</p>
      <Segmented label="Opponent" value={st.mode} onChange={mode => props.change({ mode })}
        options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend" }] as { value: PlaySettings["mode"]; label: string }[]} />
      {st.mode === "cpu" ? (
        <div className="panel">
          <Segmented label="Your side" value={st.side} onChange={side => props.change({ side })}
            options={[{ value: 0 as Side, label: "Play the Host" }, { value: 1 as Side, label: "Play the Sí" }]} />
          <Segmented label="Computer strength" value={st.lvl} onChange={lvl => props.change({ lvl })}
            options={[{ value: 1, label: "Novice" }, { value: 2, label: "Warrior" }, { value: 3, label: "Champion" }, { value: 4, label: "High King" }] as { value: Level; label: string }[]} />
        </div>
      ) : null}
      <div className="row">
        <button className="btn primary" type="button" onClick={props.newGame}>New game</button>
        <button className="btn" type="button" disabled={!props.canUndo} onClick={props.undo}>Undo</button>
        {props.canReview ? <button className="btn" type="button" onClick={props.review}>Review the game</button> : null}
      </div>
    </div>
  );
}
