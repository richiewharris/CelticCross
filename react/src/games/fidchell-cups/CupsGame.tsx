// Fidchell of Cups: the board with the dice beneath it, and the ledger beside.
import { Board } from "./components/Board";
import { Dice } from "./components/Dice";
import { GamePanel } from "./components/GamePanel";
import { Ledger } from "./components/Ledger";
import { RollLog } from "./components/RollLog";
import { RulesPanel } from "./components/RulesPanel";
import { useCupsGame } from "./useCupsGame";

export function CupsGame() {
  const p = useCupsGame();
  const s = p.g.state;
  return (
    <div className="wrap">
      <header>
        <h1>Fidchell of Cups</h1>
        <p className="tag">Fidchell played by the rules of Tablero. Mead against wine on the 7×7 board: two dice move your cups, trap a rival cup between two of yours and drink it, and they refill it from their own jug. Drain their jug to win.</p>
      </header>

      <div className="game">
        <section className="stage" aria-label="Fidchell of Cups board">
          <div className={`status${p.status.tone ? " " + p.status.tone : ""}`} id="status" role="status" aria-live="polite">{p.status.text}</div>
          <Board pieces={s.pieces} nonce={p.g.nonce} overlay={p.overlay} locked={p.locked}
            onCell={p.clickCell} onKeyDown={p.onKeyDown} onFocusChange={p.setFocused} />
          <div className="dicebar">
            <Dice d={p.dice} used={p.diceUsed} queen={p.diceQueen} tumble={p.tumble} />
            <button className="btn primary big" type="button" id="rollBtn" disabled={!p.canRoll} onClick={p.roll}>{p.rollLabel}</button>
            <button className="btn queen big" type="button" id="toastBtn" hidden={!p.showToast} onClick={p.toastQueen}>To the Queen!</button>
          </div>
          <p className={`roll-note${p.noteKind ? " " + p.noteKind : ""}`} id="rollNote" aria-live="polite">{p.note}</p>
        </section>

        <aside>
          <Ledger s={s} />
          <GamePanel settings={p.settings} change={p.change} newGame={p.newGame} hints={p.hints} toggleHints={p.toggleHints} />
          <RulesPanel />
          <RollLog log={p.g.log} />
        </aside>
      </div>
    </div>
  );
}
