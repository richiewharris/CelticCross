import { Segmented } from "../../../kit/Segmented";
import type { Side } from "../engine/rules";
import type { PlaySettings } from "../usePlayGame";

export function PlayPanel(props: {
  settings: PlaySettings; change: (p: Partial<PlaySettings>) => void;
  newGame: () => void; canUndo: boolean; undo: () => void; canReview: boolean; review: () => void;
}) {
  const st = props.settings, d = st.swap ? 2 : 0;
  return (
    <div className="panel">
      <p className="label">Opponent</p>
      <Segmented label="Opponent" value={st.mode} onChange={mode => props.change({ mode })}
        options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend" }]} />
      {st.mode === "cpu" ? (
        <div className="panel">
          <Segmented label="Your side" value={st.side} onChange={side => props.change({ side })}
            options={[{ value: 0 as Side, label: "Play the Host" }, { value: 1 as Side, label: "Play the Sí" }]} />
          <Segmented label="Computer strength" value={st.lvl} onChange={lvl => props.change({ lvl })}
            options={[{ value: 1, label: "Novice" }, { value: 2, label: "Warrior" }, { value: 3, label: "Champion" }, { value: 4, label: "High King" }] as { value: PlaySettings["lvl"]; label: string }[]} />
        </div>
      ) : null}
      <Segmented label="Hold length" title="How many Sí turns the summit must be held" value={st.holdN} onChange={holdN => props.change({ holdN })}
        options={[{ value: 7, label: `Hold ${7 - d} turns` }, { value: 8, label: `Hold ${8 - d} (easier Host)` }] as { value: PlaySettings["holdN"]; label: string }[]} />
      <Segmented label="Setup" title="Who sets each side's pieces at the start" value={st.swap ? "swap" : "own"} onChange={v => props.change({ swap: v === "swap" })}
        options={[{ value: "own", label: "Set your own pieces" }, { value: "swap", label: "Set your rival's" }]} />
      <div className="row">
        <button className="btn primary" type="button" onClick={props.newGame}>New game</button>
        <button className="btn" type="button" disabled={!props.canUndo} onClick={props.undo}>Undo</button>
        {props.canReview ? <button className="btn" type="button" onClick={props.review}>Review the game</button> : null}
      </div>
    </div>
  );
}
