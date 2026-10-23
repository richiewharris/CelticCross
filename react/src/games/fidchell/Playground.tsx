// Every component on one page, with fixed data, so they can be built and checked in isolation.
import { useState } from "react";
import "./fidchell.css";
import { GameScope } from "../../kit/GameScope";
import { Board, Peg } from "./components/Board";
import { Controls, type View } from "./components/Controls";
import { MoveLog } from "./components/MoveLog";
import { RulesPanel } from "./components/RulesPanel";
import { Tally } from "./components/Tally";
import type { LevelId } from "./engine/ai";
import { doMove, newGame, type Game } from "./engine/game";
import { GOLD, WHITE, fromRows, fromSq, genMoves, initial, play, threatened, type Move, type Side } from "./engine/rules";

const mv = (a: string, b: string): Move => [fromSq(a), fromSq(b)];

/** A short opening with one capture, for the log and the tally. */
function sampleGame(): Game {
  let g = newGame("pvp", GOLD, 2);
  for (const [a, b] of [["b1", "b3"], ["c5", "c3"], ["d1", "d3"], ["a5", "a3"], ["b3", "b4"], ["e5", "e2"], ["a1", "a2"], ["d5", "d4"]] as const) g = doMove(g, mv(a, b));
  return g;
}
const SAMPLE = sampleGame();

// Gold c1-c3 takes three; after it, the dashed red rings mark the captured pegs.
const TRIPLE = fromRows(["..g..", "..w..", "gw.wg", ".....", "w.g.w"]);
const AFTER_TRIPLE = play(TRIPLE, mv("c1", "c3"));
// White to move with c3 in danger; the arrow is a suggested move.
const DANGER = fromRows(["w...w", ".....", ".gw..", ".....", "g..g."], WHITE);

export default function Playground() {
  const [live, setLive] = useState(initial);
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState(fromSq("c1"));
  const [mode, setMode] = useState<View>("cpu");
  const [side, setSide] = useState<Side>(GOLD);
  const [lvl, setLvl] = useState<LevelId>(2);
  const [hints, setHints] = useState(false);

  const click = (i: number) => {
    setCursor(i);
    if (live.winner !== null) return;
    if (sel !== null) {
      const m = genMoves(live.b, live.turn).find(x => x[0] === sel && x[1] === i);
      if (m) { setLive(play(live, m)); setSel(null); return; }
      if (i === sel) { setSel(null); return; }
    }
    setSel(live.b[i] === live.turn ? i : null);
  };

  const ids = { gold: "pg-fid-gold", white: "pg-fid-white" };
  return (
    <GameScope id="fidchell"><div className="pg-game">
      <section>
        <h2>Pegs <code>&lt;Peg&gt;</code></h2>
        <svg viewBox="0 0 200 80" width="200" height="80" aria-hidden="true">
          <defs>
            <radialGradient id={ids.gold} cx="36%" cy="32%" r="72%"><stop offset="0" stopColor="#e3c891" /><stop offset=".45" stopColor="#a7844c" /><stop offset="1" stopColor="#4c381c" /></radialGradient>
            <radialGradient id={ids.white} cx="36%" cy="32%" r="72%"><stop offset="0" stopColor="#fffbf2" /><stop offset=".5" stopColor="#ddd3ba" /><stop offset="1" stopColor="#857c66" /></radialGradient>
          </defs>
          <g transform="translate(-52 -52)">
            <Peg p={{ id: 0, side: GOLD, pos: 0, alive: true }} ids={ids} />
            <Peg p={{ id: 1, side: WHITE, pos: 1, alive: true }} ids={ids} />
          </g>
        </svg>
      </section>

      <section>
        <h2>Board <code>&lt;Board&gt;</code></h2>
        <div className="boards">
          <figure>
            <Board s={live} active={live.winner === null} sel={sel} cursor={cursor} onCursor={setCursor} onCell={click} onEscape={() => setSel(null)} />
            <figcaption>Live, both sides by hand: tap a {live.turn === GOLD ? "gold" : "white"} peg to see its moves. <button className="btn" type="button" onClick={() => { setLive(initial()); setSel(null); }}>Reset</button></figcaption>
          </figure>
          <figure>
            <Board s={TRIPLE} active sel={fromSq("c1")} />
            <figcaption>Selected peg: dots for moves, a red ring where a move captures (here, three at once).</figcaption>
          </figure>
          <figure>
            <Board s={AFTER_TRIPLE} active={false} />
            <figcaption>After the triple capture: last move ringed, taken pegs faded with dashed rings.</figcaption>
          </figure>
          <figure>
            <Board s={DANGER} active danger={threatened(DANGER.b, WHITE)} arrow={mv("c3", "c2")} cursor={fromSq("c3")} showCursor />
            <figcaption>Hints on: a piece in danger, a suggested move, and the keyboard cursor.</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>Controls <code>&lt;Controls&gt;</code></h2>
        <aside style={{ maxWidth: 300 }}>
          <Controls view={mode} side={side} lvl={lvl} setView={setMode} setSide={setSide} setLvl={setLvl}
            newGame={() => {}} canUndo undo={() => {}} hints={hints} toggleHints={() => setHints(h => !h)}>
            <p className="hint-line">(The online panel shows here.)</p>
          </Controls>
        </aside>
      </section>

      <section>
        <h2>Pieces <code>&lt;Tally&gt;</code></h2>
        <div className="panel" style={{ maxWidth: 300 }}><Tally pieces={AFTER_TRIPLE.pieces} quiet={AFTER_TRIPLE.quiet} over={false} /></div>
      </section>

      <section>
        <h2>Move log <code>&lt;MoveLog&gt;</code></h2>
        <div className="panel" style={{ maxWidth: 300 }}><MoveLog history={SAMPLE.history} /></div>
        <div className="panel" style={{ maxWidth: 300 }}><MoveLog history={[]} /></div>
      </section>

      <section>
        <h2>Rules <code>&lt;RulesPanel&gt;</code></h2>
        <aside style={{ maxWidth: 300 }}><RulesPanel /></aside>
      </section>
    </div></GameScope>
  );
}
