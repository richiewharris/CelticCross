// Every component on one page, with fixed data, so they can be built and checked in isolation.
import { useState } from "react";
import "./cnoc.css";
import { GameScope } from "../../kit/GameScope";
import { Dialog } from "../../kit/Dialog";
import { Segmented } from "../../kit/Segmented";
import { Board, type Mark } from "./components/Board";
import { HoldStones } from "./components/HoldStones";
import { MoveLog } from "./components/MoveLog";
import { ReviewSummary } from "./components/ReviewPanel";
import { Tray } from "./components/Tray";
import { CnocPiece } from "./glyphs";
import { newGame, playMove, type Game } from "./engine/game";
import { PUZZLES, mainLine, puzzleStart } from "./engine/puzzles";
import { CH, LO, NAMES, PH, RI, SP, emptyBoard, from, gen, sideOf, to, type Piece } from "./engine/rules";
import type { Entry, Grade } from "./engine/review";
import { PLACEMENTS } from "./engine/setup";

const PZ = PUZZLES[0];
const START = puzzleStart(PZ);
const LINE = mainLine(PZ);

/** A finished line from the first puzzle, for the move log. */
function solvedGame() {
  let g: Game = { ...newGame(), s: START, phase: "play", placed: PLACEMENTS };
  for (const m of LINE) g = playMove(g, m);
  return g;
}

/** A made-up review list, enough to drive the summary. */
function sampleReview(): Entry[] {
  const mk = (by: 0 | 1, q: Grade, loss: number, kind: "place" | "move"): Entry =>
    kind === "place"
      ? { kind, by, q, loss, s: START, after: START, note: "", to: 0, piece: SP, placed: 0 }
      : { kind, by, q, loss, s: START, after: START, note: "", m: 0 };
  return [
    mk(0, "best", 0, "place"), mk(1, "exc", 40, "place"), mk(0, "good", 90, "place"),
    mk(0, "best", 0, "move"), mk(1, "best", 0, "move"), mk(0, "exc", 25, "move"), mk(1, "miss", 220, "move"),
    mk(0, "good", 80, "move"), mk(1, "blun", 650, "move"), mk(0, "best", 0, "move"),
  ];
}

export default function Playground() {
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [dialog, setDialog] = useState(false);
  const [pick, setPick] = useState<Piece | null>(SP);
  const [hold, setHold] = useState(3);
  const [sel, setSel] = useState<number | null>(null);


  const marks = new Map<number, Mark>();
  if (sel !== null) for (const m of gen(START)) if (from(m) === sel) marks.set(to(m), START.b[to(m)] ? "cap" : "go");

  const mergeBoard = emptyBoard();
  mergeBoard[24] = RI; mergeBoard[25] = RI; mergeBoard[44] = PH; mergeBoard[48] = LO;
  const mergeMarks = new Map<number, Mark>([[25, "merge"], [16, "go"], [18, "go"], [30, "go"], [32, "go"]]);
  const setupBoard = emptyBoard();
  setupBoard[0] = LO; setupBoard[3] = SP; setupBoard[24] = CH;
  const placeMarks = new Map<number, Mark>();
  for (let i = 0; i < 49; i++) if (!setupBoard[i] && (i < 7 || i > 41 || i % 7 === 0 || i % 7 === 6)) placeMarks.set(i, "place");

  return (
    <GameScope id="cnoc"><div className="pg-game">
      <section>
        <h2>Pieces <code>&lt;CnocPiece&gt;</code></h2>
        <div className="specimens">
          {([LO, SP, PH, CH, RI] as Piece[]).map(p => <figure key={p}><CnocPiece p={p} /><figcaption>{NAMES[p]}</figcaption></figure>)}
          <figure><CnocPiece p={LO} pop /><figcaption>pop (just moved)</figcaption></figure>
        </div>
      </section>

      <section>
        <h2>Board <code>&lt;Board&gt;</code></h2>
        <div className="boards">
          <figure>
            <Board b={START.b} marks={marks} selected={sel} onCell={i => setSel(START.b[i] && sideOf(START.b[i]) === START.turn && i !== sel ? i : null)} />
            <figcaption>Puzzle {PZ.label}, live: tap a {PZ.side === 0 ? "Host" : "Sí"} piece to see its moves.</figcaption>
          </figure>
          <figure>
            <Board b={mergeBoard} marks={mergeMarks} selected={24} />
            <figcaption>Combining pieces: the Rider on d4 may merge with the one on e4 (double ring), beside a Host Phalanx.</figcaption>
          </figure>
          <figure>
            <Board b={setupBoard} marks={placeMarks} last={{ to: 3 }} />
            <figcaption>Setup: free holes on the outer ring are marked.</figcaption>
          </figure>
          <figure>
            <Board b={START.b} best={{ from: from(LINE[0]), to: to(LINE[0]) }} hint={from(LINE[0])} locked />
            <figcaption>Review marks: the better move in dashed rings, plus a puzzle hint.</figcaption>
          </figure>
          <figure>
            <Board b={START.b} flash={{ sqs: [from(LINE[0]), to(LINE[0])], kind: "good" }} locked />
            <figcaption>Puzzle flash for a good move.</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>The hold <code>&lt;HoldStones&gt;</code></h2>
        <HoldStones hold={hold} of={7} />
        <div className="row">
          <button className="btn" type="button" onClick={() => setHold(h => Math.max(0, h - 1))}>Fewer</button>
          <button className="btn" type="button" onClick={() => setHold(h => Math.min(7, h + 1))}>More</button>
        </div>
      </section>

      <section>
        <h2>Setup tray <code>&lt;Tray&gt;</code></h2>
        <Tray label="Host: choose a Host piece, then a marked hole" kinds={[SP, LO]} counts={{ [SP]: 5, [LO]: 1 }} picked={pick} enabled={() => true} onPick={setPick} />
        <Tray label="Combining pieces: the Phalanx in the Host's tray" kinds={[SP, LO, PH]} counts={{ [SP]: 5, [LO]: 1, [PH]: 1 }} picked={pick} enabled={() => true} onPick={setPick} />
        <Tray label="Sí pieces still to set" kinds={[RI, CH]} counts={{ [RI]: 2, [CH]: 0 }} picked={RI} enabled={() => false} onPick={() => {}} />
      </section>

      <section>
        <h2>Controls <code>&lt;Segmented&gt;</code> and <code>&lt;Dialog&gt;</code></h2>
        <Segmented label="Sample" value={seg} onChange={setSeg}
          options={[{ value: "a", label: "First" }, { value: "b", label: "Second" }, { value: "c", label: "Third" }] as { value: "a" | "b" | "c"; label: string }[]} />
        <div className="row">
          <button className="btn primary" type="button" onClick={() => setDialog(true)}>Open a dialog</button>
          <button className="btn" type="button" disabled>Disabled</button>
        </div>
        {dialog ? (
          <Dialog tone="win" label="Sample dialog">
            <h2>You win</h2>
            <p>The Lord stands on the summit.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn primary" type="button" onClick={() => setDialog(false)}>Close</button>
            </div>
          </Dialog>
        ) : null}
      </section>

      <section>
        <h2>Move log <code>&lt;MoveLog&gt;</code></h2>
        <div className="panel" style={{ maxWidth: 360 }}><MoveLog history={solvedGame().history} settingUp={false} /></div>
      </section>

      <section>
        <h2>Review summary <code>&lt;ReviewSummary&gt;</code></h2>
        <div style={{ maxWidth: 420 }}><ReviewSummary list={sampleReview()} whoLabel={s => (s === 0 ? " (you)" : " (computer)")} /></div>
      </section>
    </div></GameScope>
  );
}
