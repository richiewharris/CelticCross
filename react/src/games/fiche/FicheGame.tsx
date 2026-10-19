// Fiche: the whole page. The dial runs across the top of the table, the rolling tray sits between
// the two hands, and the ledger beside holds the match, options, rules and the roll log.
import { DICE } from "./engine/dice";
import { isHuman, live, nameOf, verb } from "./engine/game";
import { Dial } from "./components/Dial";
import { Hand } from "./components/Hand";
import { GamePanel, MatchPanel, RollLog, RulesPanel } from "./components/Ledger";
import { ResultCard } from "./components/ResultCard";
import { Spiral } from "./components/Spiral";
import { Tray } from "./components/Tray";
import { useFiche } from "./useFiche";

export function FicheGame() {
  const f = useFiche();
  const { g, view } = f;
  const { M, R } = view;
  const pvp = M.mode === "pvp";
  const mine = live(g) && isHuman(M, R.turn) && !f.busy;
  const again = (who: string) => (R.forced >= 0 ? `Roll the ${DICE[R.forced].name.toLowerCase()} again` : who);
  const youNote = R.turn === 1 && mine ? again("Your roll. Pick a die.") : "";
  const rivalNote = R.turn === 2 && !R.over ? (pvp ? (mine ? again("Player 2 to roll. Pick a die.") : "") : f.busy ? "Thinking…" : "") : "";
  const status = R.msg || (R.over ? "" : `Total ${R.total}. ${nameOf(M, R.turn)} to roll.`);
  const oddsFor = (p: 1 | 2) => (R.turn === p ? f.odds : [null, null, null]);

  return (
    <div className="wrap">
      <header>
        <h1>Fiche</h1>
        <p className="tag">A race to twenty with three odd dice: a bone caltrop, a wire-wrapped cube, and two cubes on a rod. Take turns rolling into one shared total. Land on twenty to take the round, but mind the sevens, nines and twelves on the way.</p>
      </header>

      <div className="game">
        <section className="table" aria-label="The table">
          <div className={`status${R.kind ? " " + R.kind : ""}`} role="status" aria-live="polite">{status}</div>
          {/* The spiral board is kept but hidden, as in the original; the dial shows the total. */}
          <Spiral total={R.total} hidden />
          <Dial total={g.R.total} />
          <div className="playfield">
            <Hand side="you" name={pvp ? "Player 1" : "You"} note={youNote} hand={R.hands[1]} forced={R.forced}
              active={mine && R.turn === 1} odds={oddsFor(1)} onRoll={f.roll} />
            <Tray rolls={R.rolls} flight={f.flight} pvp={pvp}
              first={!R.rolls.length && !M.over ? { p: R.turn, lines: [nameOf(M, R.turn), `${verb(M, R.turn, "roll", "rolls")} first`] } : null} />
            <Hand side="rival" name={pvp ? "Player 2" : "Rival"} note={rivalNote} hand={R.hands[2]} forced={R.forced}
              active={mine && R.turn === 2} odds={pvp ? oddsFor(2) : undefined} onRoll={f.roll} />
          </div>
        </section>

        <aside>
          <MatchPanel M={M} />
          <GamePanel settings={f.settings} change={f.change} newMatch={f.newMatch} coach={f.coach} toggleCoach={f.toggleCoach} />
          <RulesPanel />
          <RollLog log={M.log} pvp={pvp} />
        </aside>
      </div>
      {f.cardOpen ? <ResultCard g={g} onNext={f.nextRound} onAgain={f.newMatch} /> : null}
    </div>
  );
}
