import { Segmented } from "../../../kit/Segmented";
import type { Level } from "../engine/ai";
import type { Mode, Settings, Turns } from "../engine/game";
import type { Side } from "../engine/rules";

/** Opponent, side, strength, turn length, New game and Hints. */
export function GamePanel(p: { settings: Settings; change: (patch: Partial<Settings>) => void; newGame: () => void; hints: boolean; toggleHints: () => void }) {
  const st = p.settings;
  return (
    <div className="panel">
      <p className="label">Game</p>
      <Segmented label="Opponent" value={st.mode} onChange={mode => p.change({ mode })}
        options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend, same screen" }] as { value: Mode; label: string }[]} />
      <div id="cpuOpts" className="panel" hidden={st.mode !== "cpu"}>
        <Segmented label="Your side" value={st.side} onChange={side => p.change({ side })}
          options={[{ value: 1, label: "Play mead" }, { value: 2, label: "Play wine" }] as { value: Side; label: string }[]} />
        <Segmented label="Computer strength" value={st.lvl} onChange={lvl => p.change({ lvl })}
          options={[{ value: 1, label: "Casual" }, { value: 2, label: "Steady" }, { value: 3, label: "Strong" }] as { value: Level; label: string }[]} />
      </div>
      <Segmented label="Turn length" title="How long a turn lasts" value={st.turns} onChange={turns => p.change({ turns })}
        options={[{ value: "tablero", label: "Roll till a pass" }, { value: "one", label: "One roll a turn" }] as { value: Turns; label: string }[]} />
      <div className="row">
        <button className="btn" type="button" onClick={p.newGame}>New game</button>
        <button className="btn hint" type="button" aria-pressed={p.hints} onClick={p.toggleHints}>{p.hints ? "Hints on" : "Hints"}</button>
      </div>
    </div>
  );
}
