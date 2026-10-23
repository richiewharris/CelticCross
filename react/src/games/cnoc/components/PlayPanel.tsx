import { Segmented } from "../../../kit/Segmented";
import type { Side } from "../engine/rules";
import type { CnocOptions } from "../online";
import type { PlaySettings } from "../usePlayGame";

export type Opponent = PlaySettings["mode"] | "online";

export function PlayPanel(props: {
  settings: PlaySettings; change: (p: Partial<PlaySettings>) => void;
  opponent: Opponent; setOpponent: (o: Opponent) => void;
  /** Online: the rules a new invite will carry (null while in an online game, which has its own). */
  online?: { options: CnocOptions; change: (p: Partial<CnocOptions>) => void } | null;
  newGame: () => void; canUndo: boolean; undo: () => void; canReview: boolean; review: () => void;
}) {
  const st = props.settings, isOnline = props.opponent === "online", on = props.online;
  // Online, the rule choices set up the invite instead of restarting the game on the board.
  const rules = isOnline ? on?.options ?? null : { holdN: st.holdN, swap: st.swap, combine: !!st.combine };
  const setRule = (p: Partial<CnocOptions>) => (isOnline ? on?.change(p) : props.change(p));
  const d = rules?.swap ? 2 : 0;
  return (
    <div className="panel">
      <p className="label">Opponent</p>
      <Segmented label="Opponent" value={props.opponent} onChange={props.setOpponent}
        options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend" }, { value: "online", label: "Online" }] as { value: Opponent; label: string }[]} />
      {props.opponent === "cpu" ? (
        <div className="panel">
          <Segmented label="Your side" value={st.side} onChange={side => props.change({ side })}
            options={[{ value: 0 as Side, label: "Play the Host" }, { value: 1 as Side, label: "Play the Sí" }]} />
          <Segmented label="Computer strength" value={st.lvl} onChange={lvl => props.change({ lvl })}
            options={[{ value: 1, label: "Novice" }, { value: 2, label: "Warrior" }, { value: 3, label: "Champion" }, { value: 4, label: "High King" }] as { value: PlaySettings["lvl"]; label: string }[]} />
        </div>
      ) : null}
      {rules ? (
        <>
          <Segmented label="Hold length" title="How many Sí turns the summit must be held" value={rules.holdN} onChange={holdN => setRule({ holdN })}
            options={[{ value: 7, label: `Hold ${7 - d} turns` }, { value: 8, label: `Hold ${8 - d} (easier Host)` }] as { value: PlaySettings["holdN"]; label: string }[]} />
          <Segmented label="Setup" title="Who sets each side's pieces at the start" value={rules.swap ? "swap" : "own"} onChange={v => setRule({ swap: v === "swap" })}
            options={[{ value: "own", label: "Set your own pieces" }, { value: "swap", label: "Set your rival's" }]} />
          <Segmented label="Pieces" title="Combining: the Host may field a Phalanx in place of 3 Spearmen; two Sí Riders on the summit may merge into a Chariot" value={rules.combine ? "combine" : "standard"} onChange={v => setRule({ combine: v === "combine" })}
            options={[{ value: "standard", label: "Standard pieces" }, { value: "combine", label: "Combining" }]} />
        </>
      ) : null}
      {isOnline ? (props.canReview ? (
        <div className="row"><button className="btn" type="button" onClick={props.review}>Review the game</button></div>
      ) : null) : (
        <div className="row">
          <button className="btn primary" type="button" onClick={props.newGame}>New game</button>
          <button className="btn" type="button" disabled={!props.canUndo} onClick={props.undo}>Undo</button>
          {props.canReview ? <button className="btn" type="button" onClick={props.review}>Review the game</button> : null}
        </div>
      )}
    </div>
  );
}
