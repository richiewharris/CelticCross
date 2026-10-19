// Fidchell: the board and status on the left, the ledger (opponent, pieces, rules, moves) on the right.
import { hintText, statusText } from "./engine/game";
import { Board } from "./components/Board";
import { Controls } from "./components/Controls";
import { MoveLog } from "./components/MoveLog";
import { RulesPanel } from "./components/RulesPanel";
import { Tally } from "./components/Tally";
import { useFidchell } from "./useFidchell";

export function FidchellGame() {
  const f = useFidchell();
  const { g } = f;
  const status = statusText(g, f.thinking);
  return (
    <div className="wrap">
      <header>
        <h1>Fidchell</h1>
        <p className="tag">The "wood-wisdom" of the early Irish: gold against white on a board of 25 holes. Trap an enemy piece between two of yours to take it.</p>
      </header>

      <div className="game">
        <section className="stage" aria-label="Fidchell board">
          <div className={`status${status.tone ? ` ${status.tone}` : ""}`} role="status" aria-live="polite">{status.text}</div>
          <Board s={g.state} round={g.round} active={f.humanTurn} sel={f.sel} danger={f.danger} arrow={f.arrow}
            cursor={f.cursor} onCursor={f.setCursor} onCell={f.clickCell} onEscape={f.deselect} />
          <p className="hint-line">{hintText(f.over, f.humanTurn, f.sel !== null, f.hints)}</p>
        </section>

        <aside>
          <Controls mode={g.mode} side={g.side} lvl={g.lvl} setMode={f.setMode} setSide={f.setSide} setLvl={f.setLvl}
            newGame={f.newGame} canUndo={f.canUndo} undo={f.undo} hints={f.hints} toggleHints={f.toggleHints} />
          <div className="panel">
            <p className="label">Pieces</p>
            <Tally pieces={g.state.pieces} quiet={g.state.quiet} over={f.over} />
          </div>
          <RulesPanel />
          <div className="panel">
            <p className="label">Moves</p>
            <MoveLog history={g.history} />
          </div>
        </aside>
      </div>
    </div>
  );
}
