// Every Monsiv component on one page, with fixed data, so they can be built and checked in isolation.
import { useMemo, useState } from "react";
import "./monsiv.css";
import { loadFonts } from "../../kit/fonts";
import { GameScope } from "../../kit/GameScope";
import { Segmented } from "../../kit/Segmented";
import { puzzleFor, puzzleState } from "./engine/core";
import { fromState, legalMoves, newGame, playMove, type Game } from "./engine/game";
import { freshStats, type PuzzleStats } from "./engine/rating";
import { Board } from "./components/Board";
import { MoveLog } from "./components/MoveLog";
import { MonsivPiece } from "./components/Piece";
import { PuzzlePanel } from "./components/PuzzlePanel";
import { RulesPanel } from "./components/RulesPanel";
import { targetsOf } from "./MonsivGame";
import { moveTo } from "./usePlayGame";
import type { PzPhase, PzState } from "./usePuzzles";

loadFonts("https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap");

/** Pieces are drawn for the board, so show them on a light square. */
const TILE = { display: "grid", padding: 8, background: "var(--sq-light)" } as const;

const STATS: PuzzleStats = { ...freshStats(), rating: 742, played: 9, solved: 6, streak: 2, best: 768, recent: ["w", "w", "l", "h", "w", "l", "w", "w", "l"] };

export default function Playground() {
  const [g, setG] = useState<Game>(newGame);
  const [sel, setSel] = useState<number | null>(null);
  const [phase, setPhase] = useState<PzPhase>("solve");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<PuzzleStats["speed"]>("2");
  const { p10, p3, solvedLine } = useMemo(() => {
    const p10 = puzzleFor(10, 1)!, p3 = puzzleFor(3, 1)!;
    let line = fromState(puzzleState(p10));
    for (const m of p10.line) line = playMove(line, m);
    return { p10, p3, solvedLine: line };
  }, []);

  const click = (i: number) => {
    if (g.winner !== null) return;
    if (sel !== null) {
      const m = moveTo(legalMoves(g), sel, i);
      if (m) { setG(playMove(g, m)); setSel(null); return; }
    }
    setSel(g.s.b[i] && (g.s.b[i] & 8) === g.s.turn && i !== sel ? i : null);
  };

  const pz: PzState = {
    L: 10, i: 1, p: p10, phase, retry: false, hint: false, moved: phase !== "solve", rated: false,
    status: "", tip: phase === "solved" ? "Nicely found." : phase === "failed" ? "After C d4×d3, there's no forced win left. Show the solution to see the idea, or try again (for practice)." : phase === "show" ? "Watch the winning line. Your moves are the odd ones." : "Find a move that forces a win within 3 moves, whatever Black does.",
    flash: null, hintSq: null, delta: phase === "solved" ? 18 : phase === "failed" ? -9 : null, left: 3, k: 0, paused, ok: true,
    g: fromState(puzzleState(p10)), side: 0, sel: null, anim: -1,
  };

  return (
    <GameScope id="monsiv"><div className="pg-game">
      <section>
        <h2>Pieces <code>&lt;MonsivPiece&gt;</code></h2>
        <div className="specimens">
          {[1, 2, 3, 9, 10, 11].map(c => <figure key={c}><span style={TILE}><MonsivPiece code={c} className="piece" /></span><figcaption>{c & 8 ? "Black" : "White"} {["", "Throne", "Angel", "Cross"][c & 7]}</figcaption></figure>)}
          <figure><span style={TILE}><MonsivPiece code={2} className="piece" pop /></span><figcaption>pop (just moved)</figcaption></figure>
        </div>
      </section>

      <section>
        <h2>Board <code>&lt;Board&gt;</code></h2>
        <div className="boards">
          <figure>
            <Board b={g.s.b} marks={targetsOf(g, sel)} selected={sel} last={g.last ? [g.last[1], g.last[2]] : []} onCell={click} locked={g.winner !== null} />
            <figcaption>Live, two players: tap a piece to see its steps, captures and swaps. <button className="btn" type="button" onClick={() => { setG(newGame()); setSel(null); }}>Reset</button></figcaption>
          </figure>
          <figure>
            <Board b={p3.b} flip hint={p3.key[1]} locked />
            <figcaption>Puzzle 3·1 from Black's side, with a hint on the piece to move.</figcaption>
          </figure>
          <figure>
            <Board b={solvedLine.s.b} flash={{ sqs: [p10.line[4][1], p10.line[4][2]], kind: "good" }} locked />
            <figcaption>Puzzle 10·1 solved: a good move flashes green.</figcaption>
          </figure>
          <figure>
            <Board b={p10.b} flash={{ sqs: [p10.line[0][1], p10.line[0][2]], kind: "bad" }} last={[]} locked />
            <figcaption>A wrong move flashes red.</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>Puzzle panel <code>&lt;PuzzlePanel&gt;</code></h2>
        <Segmented label="Phase" value={phase} onChange={setPhase}
          options={(["solve", "solved", "failed", "show", "shown"] as PzPhase[]).map(v => ({ value: v, label: v }))} />
        <div style={{ maxWidth: 320 }}>
          <PuzzlePanel ps={{ ...STATS, speed }} pz={pz} next={() => setPhase("solve")} hint={() => {}} showSolution={() => setPhase("show")}
            retry={() => setPhase("solve")} togglePause={() => setPaused(x => !x)} step={() => {}} setSpeed={setSpeed} setPick={() => {}} />
        </div>
      </section>

      <section>
        <h2>Move log <code>&lt;MoveLog&gt;</code></h2>
        <div className="panel" style={{ maxWidth: 320 }}><MoveLog notes={solvedLine.history.map(h => h.note)} empty="" /></div>
        <div className="panel" style={{ maxWidth: 320 }}><MoveLog notes={[]} empty="No moves yet. White goes first." /></div>
      </section>

      <section>
        <h2>Rules <code>&lt;RulesPanel&gt;</code></h2>
        <div style={{ maxWidth: 320 }}><RulesPanel /></div>
      </section>
    </div></GameScope>
  );
}
