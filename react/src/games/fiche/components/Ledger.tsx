// The ledger beside the table: the match score, the options, the rules and the roll log.
import { useEffect, useRef } from "react";
import { Segmented } from "../../../kit/Segmented";
import { nameOf, need, type LogLine, type Match, type Settings } from "../engine/game";

export function MatchPanel({ M }: { M: Match }) {
  const row = (p: 1 | 2, cls: "you" | "rival") => [
    <span key={`n${p}`} className={`nm ${cls}`}>{nameOf(M, p)}</span>,
    <span key={`p${p}`} className={`pips row-${cls}`}>{Array.from({ length: need(M) }, (_, k) => <span key={k} className={`pip${k < M.wins[p] ? " on" : ""}`} />)}</span>,
    <span key={`s${p}`} className="small">{M.wins[p]}</span>,
  ];
  return (
    <div className="panel">
      <p className="label">Match</p>
      <div className="match">{row(1, "you")}{row(2, "rival")}</div>
      <p className="small">{`Round ${M.round} · best of ${M.best} · first to ${need(M)}${M.draws ? ` · ${M.draws} drawn` : ""}`}</p>
    </div>
  );
}

export function GamePanel(props: { settings: Settings; change: (p: Partial<Settings>) => void; newMatch: () => void; coach: boolean; toggleCoach: () => void }) {
  const st = props.settings;
  return (
    <div className="panel">
      <p className="label">Game</p>
      <Segmented label="Opponent" value={st.mode} onChange={mode => props.change({ mode })}
        options={[{ value: "cpu", label: "Computer" }, { value: "pvp", label: "Friend, same screen" }] as { value: Settings["mode"]; label: string }[]} />
      {st.mode === "cpu" ? (
        <div id="cpuOpts" className="panel">
          <Segmented label="Computer strength" value={st.lvl} onChange={lvl => props.change({ lvl })}
            options={[{ value: 1, label: "Casual" }, { value: 2, label: "Steady" }, { value: 3, label: "Shrewd" }] as { value: Settings["lvl"]; label: string }[]} />
        </div>
      ) : null}
      <Segmented label="Match length" value={st.best} onChange={best => props.change({ best })}
        options={[{ value: 3, label: "Best of 3" }, { value: 5, label: "Best of 5" }] as { value: Settings["best"]; label: string }[]} />
      <div className="row">
        <button className="btn" type="button" onClick={props.newMatch}>New match</button>
        <button className="btn coach" type="button" aria-pressed={props.coach} onClick={props.toggleCoach}>{props.coach ? "Coach on" : "Coach"}</button>
      </div>
    </div>
  );
}

export function RulesPanel() {
  return (
    <div className="panel">
      <p className="label">How to play</p>
      <ul className="rules">
        <li><span className="n plain">↻</span><span>Take turns. Pick one of your dice and roll it; its number goes onto the shared total. Each die is used once a round.</span></li>
        <li><span className="n again">3</span><span>Roll a three on any die and you roll again, with another die if you have one, or the same one if it was your last.</span></li>
        <li><span className="n again">7</span><span>Land the total on 7 and you roll again.</span></li>
        <li><span className="n lose">9</span><span>Land on 9 and your opponent takes the round.</span></li>
        <li><span className="n draw">12</span><span>Land on 12 and the round is drawn.</span></li>
        <li><span className="n win">20</span><span>Land on 20 and you take the round. Go over 20 and you lose it.</span></li>
        <li><span className="n plain">⚐</span><span>If all six dice are used up short of 20, the round is drawn. Whoever rolled last starts the next round.</span></li>
      </ul>
      <p className="note">The caltrop shows the number of notches cut into the leg standing up. The wire cube's number is how many wires run across its top. The twin cubes add the wires on their two tops, 2 to 8, and show 1 only when the bar lands standing on end.</p>
    </div>
  );
}

export function RollLog({ log, pvp }: { log: LogLine[]; pvp: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log]);
  return (
    <div className="panel">
      <p className="label">Rolls</p>
      <ol className="log" ref={ref}>
        {log.length ? log.map((l, i) => (l.e || !l.p
          ? <li key={i}><span className="e">{l.text}</span></li>
          : <li key={i}><span className={l.p === 1 ? "y" : "r"}>{pvp ? `P${l.p}` : l.p === 1 ? "You" : "Rival"}</span><span>{l.text}</span></li>
        )) : <li className="empty">No rolls yet.</li>}
      </ol>
    </div>
  );
}
