// Every component on one page, with fixed data, so they can be built and checked in isolation.
import { useState } from "react";
import "./cnoc-mor.css";
import { GameScope } from "../../kit/GameScope";
import { Dialog } from "../../kit/Dialog";
import { Segmented } from "../../kit/Segmented";
import { Board, type Mark } from "./components/Board";
import { MoveLog } from "./components/MoveLog";
import { Reserves } from "./components/Reserves";
import { ReviewSummary } from "./components/ReviewPanel";
import { RulesPanel } from "./components/RulesPanel";
import { Tray } from "./components/Tray";
import { MorPiece } from "./glyphs";
import { moveMarks, selHint } from "./hints";
import { PLACEMENTS, newGame, playMove, type Game } from "./engine/game";
import type { Entry, Grade } from "./engine/review";
import { CH, DROP, LO, NAMES, NN, RI, SP, emptyBoard, sideOf, zoneOk, type Piece, type Side, type State } from "./engine/rules";

const sq = (name: string) => (9 - Number(name[1])) * 9 + (name.charCodeAt(0) - 97);
function position(pieces: Record<string, Piece>, turn: Side, rh: number, rs: number): State {
  const b = emptyBoard();
  for (const [k, p] of Object.entries(pieces)) b[sq(k)] = p;
  return { b, turn, rh, rs, ply: 0 };
}
/** A mid-game hill: the Host climbing from the south-west, the Sí holding the summit. */
const MID = position({
  a1: LO, b1: SP, c2: SP, d3: SP, a4: SP, i1: SP,
  e5: CH, d5: RI, c6: RI, g4: RI, f7: RI,
}, 0, 2, 1);

/** A few moves from the mid-game position, for the move log. */
function shortGame(): Game {
  let g: Game = { ...newGame(), s: MID, phase: "play", placed: PLACEMENTS };
  for (const m of [sq("c2") * 128 + sq("c3"), sq("d5") * 128 + sq("b3"), DROP * 128 + sq("e1"), sq("g4") * 128 + sq("h3"), sq("a1") * 128 + sq("b2")]) g = playMove(g, m);
  return g;
}

/** A made-up review list, enough to drive the summary. */
function sampleReview(): Entry[] {
  const mk = (by: Side, q: Grade, loss: number, kind: "place" | "move"): Entry =>
    kind === "place"
      ? { kind, by, q, loss, s: MID, after: MID, note: "", to: 0, piece: SP, placed: 0 }
      : { kind, by, q, loss, s: MID, after: MID, note: "", m: 0 };
  return [
    mk(0, "best", 0, "place"), mk(1, "exc", 40, "place"), mk(0, "good", 90, "place"), mk(1, "best", 0, "place"),
    mk(0, "best", 0, "move"), mk(1, "best", 0, "move"), mk(0, "exc", 25, "move"), mk(1, "miss", 220, "move"),
    mk(0, "good", 80, "move"), mk(1, "blun", 650, "move"), mk(0, "best", 0, "move"),
  ];
}

export default function Playground() {
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [dialog, setDialog] = useState(false);
  const [pick, setPick] = useState<Piece | null>(SP);
  const [sel, setSel] = useState<number | null>(null);
  const [turn, setTurn] = useState<Side>(0);

  const live: State = { ...MID, turn };
  const marks = moveMarks(live, sel);
  const click = (i: number) => {
    if (sel !== null && marks.has(i)) { setSel(null); return; }
    setSel(live.b[i] && sideOf(live.b[i]) === turn && i !== sel ? i : null);
  };

  const setupBoard = emptyBoard();
  setupBoard[sq("a1")] = LO; setupBoard[sq("d1")] = SP; setupBoard[sq("e5")] = CH; setupBoard[sq("c3")] = RI;
  const placeMarks = new Map<number, Mark>();
  for (let i = 0; i < NN; i++) if (!setupBoard[i] && zoneOk(0, i)) placeMarks.set(i, "place");

  return (
    <GameScope id="cnoc-mor"><div className="pg-game">
      <section>
        <h2>Pieces <code>&lt;MorPiece&gt;</code></h2>
        <div className="specimens">
          {([LO, SP, CH, RI] as Piece[]).map(p => <figure key={p}><MorPiece p={p} /><figcaption>{NAMES[p]}</figcaption></figure>)}
          <figure><MorPiece p={LO} pop /><figcaption>pop (just moved)</figcaption></figure>
        </div>
      </section>

      <section>
        <h2>Hill and reserves <code>&lt;Board&gt;</code> <code>&lt;Reserves&gt;</code></h2>
        <div className="boards" style={{ alignItems: "start" }}>
          <figure>
            <Board b={live.b} marks={marks} selected={sel} onCell={click} />
            <Reserves rh={live.rh} rs={live.rs} canDrop={side => side === turn} pressed={sel === DROP ? turn : null}
              onPick={() => setSel(sel === DROP ? null : DROP)} />
            <p className="hint">{sel !== null ? selHint(live, sel) : "Tap a piece or your reserve to see its moves."}</p>
            <div className="row">
              <button className="btn" type="button" onClick={() => { setTurn(t => (t ^ 1) as Side); setSel(null); }}>Switch to the {turn === 0 ? "Sí" : "Host"}</button>
            </div>
            <figcaption>Live: {turn === 0 ? "Host" : "Sí"} to move.</figcaption>
          </figure>
          <figure>
            <Board b={setupBoard} marks={placeMarks} last={{ to: sq("d1") }} locked />
            <figcaption>Setup: free holes on the outer ring are marked.</figcaption>
          </figure>
          <figure>
            <Board b={MID.b} last={{ from: sq("c2"), to: sq("c3") }} best={{ from: sq("d3"), to: sq("d4") }} locked />
            <figcaption>Review marks: the move played, and the better move in dashed rings.</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>Setup tray <code>&lt;Tray&gt;</code></h2>
        <Tray label="Host: choose a piece, then a marked hole" kinds={[SP, LO]} counts={{ [SP]: 3, [LO]: 1 }} picked={pick} enabled={() => true} onPick={setPick} />
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
            <p>The Lord reached the cairn at the centre.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn primary" type="button" onClick={() => setDialog(false)}>Close</button>
            </div>
          </Dialog>
        ) : null}
      </section>

      <section>
        <h2>Move log <code>&lt;MoveLog&gt;</code></h2>
        <div className="panel" style={{ maxWidth: 360 }}><MoveLog history={shortGame().history} settingUp={false} /></div>
      </section>

      <section>
        <h2>Review summary <code>&lt;ReviewSummary&gt;</code></h2>
        <div style={{ maxWidth: 420 }}><ReviewSummary list={sampleReview()} whoLabel={s => (s === 0 ? " (you)" : " (computer)")} /></div>
      </section>

      <section>
        <h2>Rules <code>&lt;RulesPanel&gt;</code></h2>
        <div style={{ maxWidth: 360 }}><RulesPanel /></div>
      </section>
    </div></GameScope>
  );
}
