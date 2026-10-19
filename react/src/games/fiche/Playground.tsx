// Every component on one page, with fixed data, so they can be built and checked in isolation.
import { useState } from "react";
import "./fiche.css";
import { GameScope } from "../../kit/GameScope";
import { ALL, DICE, DIST, bit, type Die } from "./engine/dice";
import { DEFAULT_SETTINGS, applyRoll, diceOdds, newMatch, type Game, type Settings } from "./engine/game";
import { DieArt } from "./components/DieArt";
import { Dial, DialFace } from "./components/Dial";
import { Hand } from "./components/Hand";
import { GamePanel, MatchPanel, RollLog, RulesPanel } from "./components/Ledger";
import { ResultCard } from "./components/ResultCard";
import { Spiral } from "./components/Spiral";
import { ROLL_MS, Tray, type Flight } from "./components/Tray";

/** A fixed round: You and the Rival trade a few rolls up to 14. */
function sampleGame(): Game {
  let g = newMatch(DEFAULT_SETTINGS, () => 0.1);
  g = applyRoll(g, 1, 4, 0.3);
  g = applyRoll(g, 0, 3, 0.7); // three: again
  g = applyRoll(g, 2, 2, 0.2);
  g = applyRoll(g, 2, 5, 0.6);
  return g;
}
const SAMPLE = sampleGame();

/** Round results: drawn on 12, and a match won on 20. */
function results(): Record<string, Game> {
  let g = newMatch(DEFAULT_SETTINGS, () => 0.1);
  const draw = applyRoll(applyRoll(g, 2, 8), 0, 4);
  g = { ...g, R: { ...g.R, total: 14 } };
  const won = applyRoll(g, 1, 6);
  const match = { ...won, M: { ...won.M, wins: { 1: 2, 2: 1 } as Game["M"]["wins"], over: 1 as const } };
  const pvpLose = applyRoll(newMatch({ ...DEFAULT_SETTINGS, mode: "pvp" }, () => 0.9), 0, 3);
  const nine = applyRoll({ ...pvpLose, R: { ...pvpLose.R, total: 5 } }, 1, 4);
  return { draw, match, nine };
}

export default function Playground() {
  const [total, setTotal] = useState(7);
  const [game, setGame] = useState(SAMPLE);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [coach, setCoach] = useState(true);
  const [card, setCard] = useState<string | null>(null);
  const RESULTS = results();

  const throwDie = (d: Die) => {
    if (flight) return;
    const v = DIST[d][(Math.random() * DIST[d].length) | 0][0], fl = { p: game.R.turn, d, v, seed: Math.random(), t0: performance.now(), dur: ROLL_MS };
    setFlight(fl);
    setTimeout(() => { setFlight(null); setGame(g => (g.R.total + v > 20 ? SAMPLE : applyRoll({ ...g, R: { ...g.R, hands: { 1: ALL, 2: ALL } } }, d, v, fl.seed))); }, ROLL_MS);
  };

  return (
    <GameScope id="fiche"><div className="pg-game">
      <section>
        <h2>Dice <code>&lt;DieArt&gt;</code></h2>
        {([0, 1, 2] as Die[]).map(d => (
          <div key={d} className="row" aria-label={DICE[d].name}>
            {DIST[d].map(([v]) => (
              <figure key={v} style={{ margin: 0, textAlign: "center" }}>
                <svg viewBox="-72 -52 144 108" width="96" aria-hidden="true"><DieArt d={d} value={v} seed={0.5} /></svg>
                <figcaption className="small">{DICE[d].name} {v}</figcaption>
              </figure>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2>Dial <code>&lt;Dial&gt;</code></h2>
        <Dial total={total} />
        <div className="row">
          {[0, 7, 9, 12, 20, 23].map(t => <button key={t} className="btn" type="button" onClick={() => setTotal(t)}>{t}</button>)}
        </div>
        <svg className="wide" viewBox="0 0 640 118" aria-label="Dial between 6 and 7"><DialFace pos={6.5} /></svg>
      </section>

      <section>
        <h2>Hands <code>&lt;Hand&gt;</code></h2>
        <div className="row" style={{ alignItems: "start", gridTemplateColumns: "repeat(3, 150px)", display: "grid" }}>
          <Hand side="you" name="You" note="Your roll. Pick a die." hand={bit(0) | bit(2)} forced={-1} active
            odds={diceOdds({ ...SAMPLE.R, turn: 1, hands: { 1: bit(0) | bit(2), 2: bit(1) } })} onRoll={() => {}} />
          <Hand side="you" name="Player 1" note="Roll the wire cube again" hand={0} forced={1} active
            odds={diceOdds({ ...SAMPLE.R, turn: 1, hands: { 1: 0, 2: ALL }, forced: 1 })} onRoll={() => {}} />
          <Hand side="rival" name="Rival" note="Thinking…" hand={bit(1)} forced={-1} active={false} onRoll={() => {}} />
        </div>
      </section>

      <section>
        <h2>Tray <code>&lt;Tray&gt;</code></h2>
        <div style={{ maxWidth: 420 }}>
          <Tray rolls={game.R.rolls} flight={flight} pvp={false} first={null} />
        </div>
        <div className="row">
          {([0, 1, 2] as Die[]).map(d => <button key={d} className="btn" type="button" onClick={() => throwDie(d)}>Throw the {DICE[d].name.toLowerCase()}</button>)}
          <button className="btn" type="button" onClick={() => setGame(SAMPLE)}>Reset</button>
        </div>
        <div style={{ maxWidth: 420 }}>
          <Tray rolls={[]} flight={null} pvp first={{ p: 2, lines: ["Player 2", "rolls first"] }} />
        </div>
      </section>

      <section>
        <h2>Scoring spiral <code>&lt;Spiral&gt;</code> (hidden in the game)</h2>
        <Spiral total={total} />
      </section>

      <section>
        <h2>Ledger <code>&lt;MatchPanel&gt;</code> <code>&lt;GamePanel&gt;</code> <code>&lt;RollLog&gt;</code> <code>&lt;RulesPanel&gt;</code></h2>
        <aside style={{ maxWidth: 310 }}>
          <MatchPanel M={{ ...SAMPLE.M, wins: { 1: 1, 2: 0 }, draws: 1, round: 3 }} />
          <GamePanel settings={settings} change={p => setSettings(s => ({ ...s, ...p }))} newMatch={() => {}} coach={coach} toggleCoach={() => setCoach(c => !c)} />
          <RollLog log={SAMPLE.M.log} pvp={false} />
          <RollLog log={[]} pvp />
          <RulesPanel />
        </aside>
      </section>

      <section>
        <h2>Results <code>&lt;ResultCard&gt;</code></h2>
        <div className="row">
          <button className="btn" type="button" onClick={() => setCard("draw")}>Round drawn on 12</button>
          <button className="btn" type="button" onClick={() => setCard("match")}>Match won</button>
          <button className="btn" type="button" onClick={() => setCard("nine")}>Friend mode, nine</button>
        </div>
        {card ? <ResultCard g={RESULTS[card]} onNext={() => setCard(null)} onAgain={() => setCard(null)} /> : null}
      </section>
    </div></GameScope>
  );
}
