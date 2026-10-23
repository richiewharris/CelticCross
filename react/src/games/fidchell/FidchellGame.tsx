// Fidchell: the board and status on the left, the ledger (opponent, pieces, rules, moves) on the right.
import { useEffect, useRef, useState } from "react";
import { OnlinePanel } from "../../online/OnlinePanel";
import { leaveOnline } from "../../online/route";
import { hintText, statusText } from "./engine/game";
import { Board } from "./components/Board";
import { Controls, type View } from "./components/Controls";
import { MoveLog } from "./components/MoveLog";
import { RulesPanel } from "./components/RulesPanel";
import { Tally } from "./components/Tally";
import { useFidchell } from "./useFidchell";
import { useFidchellOnline } from "./useFidchellOnline";
import { fidchellOnline } from "./online";

export function FidchellGame() {
  const o = useFidchellOnline();
  const id = o.session.id;
  // "Online" chosen in the controls; an invite link in the address opens it too.
  const [wantOnline, setWantOnline] = useState(false);
  const online = wantOnline || id !== null;
  // Leaving an online game goes back to the game on this screen.
  const lastId = useRef(id);
  useEffect(() => { if (lastId.current && !id) setWantOnline(false); lastId.current = id; }, [id]);

  const f = useFidchell(online);
  const { g } = f;
  const setView = (v: View) => {
    if (v === "online") { setWantOnline(true); return; }
    setWantOnline(false);
    if (id) leaveOnline("fidchell");
    if (v !== g.mode) f.setMode(v);
  };

  const local = statusText(g, f.thinking);
  const status = !online ? local : id ? o.status : { text: "Play a friend online: make an invite link and send it.", tone: "" as const };
  const s = online ? o.s : g.state;
  const over = online ? s.winner !== null || o.session.doc?.status === "done" : f.over;
  const seated = !!o.session.mySeat && o.session.doc?.status === "active";
  return (
    <div className="wrap">
      <header>
        <h1>Fidchell</h1>
        <p className="tag">The "wood-wisdom" of the early Irish: gold against white on a board of 25 holes. Trap an enemy piece between two of yours to take it.</p>
      </header>

      <div className="game">
        <section className="stage" aria-label="Fidchell board">
          <div className={`status${status.tone ? ` ${status.tone}` : ""}`} role="status" aria-live="polite">{status.text}</div>
          {online
            ? <Board key={`online-${id ?? ""}`} s={s} active={o.active} sel={o.sel} danger={o.danger}
                cursor={o.cursor} onCursor={o.setCursor} onCell={o.clickCell} onEscape={o.deselect} />
            : <Board key="local" s={g.state} round={g.round} active={f.humanTurn} sel={f.sel} danger={f.danger} arrow={f.arrow}
                cursor={f.cursor} onCursor={f.setCursor} onCell={f.clickCell} onEscape={f.deselect} />}
          <p className="hint-line">{online ? o.hint : hintText(f.over, f.humanTurn, f.sel !== null, f.hints)}</p>
        </section>

        <aside>
          <Controls view={online ? "online" : g.mode} side={g.side} lvl={g.lvl} setView={setView} setSide={f.setSide} setLvl={f.setLvl}
            newGame={f.newGame} canUndo={f.canUndo} undo={f.undo} hints={f.hints} toggleHints={f.toggleHints}>
            <OnlinePanel session={o.session} adapter={fidchellOnline} options={fidchellOnline.defaultOptions} title="Fidchell" />
            {seated ? <div className="row"><button className="btn hint" type="button" aria-pressed={o.hints} onClick={o.toggleHints}>{o.hints ? "Hints on" : "Hints"}</button></div> : null}
          </Controls>
          <div className="panel">
            <p className="label">Pieces</p>
            <Tally pieces={s.pieces} quiet={s.quiet} over={over} />
          </div>
          <RulesPanel />
          <div className="panel">
            <p className="label">Moves</p>
            <MoveLog history={online ? o.history : g.history} />
          </div>
        </aside>
      </div>
    </div>
  );
}
