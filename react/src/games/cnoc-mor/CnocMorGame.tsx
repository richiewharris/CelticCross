// Cnoc Mór: the whole page, composed from the hill, the reserves, the panels and usePlayGame.
import { DROP, NN, from, sideName, to, zoneOk, type Side, type State } from "./engine/rules";
import { moveMarks, selHint } from "./hints";
import { PLACEMENTS, placer, trayKinds } from "./engine/game";
import { Board, type Mark } from "./components/Board";
import { MoveLog } from "./components/MoveLog";
import { PlayPanel } from "./components/PlayPanel";
import { Reserves } from "./components/Reserves";
import { ResultDialog } from "./components/ResultDialog";
import { ReviewPanel } from "./components/ReviewPanel";
import { RulesPanel } from "./components/RulesPanel";
import { Tray } from "./components/Tray";
import { usePlayGame } from "./usePlayGame";
import { why } from "./text";

export function CnocMorGame() {
  const play = usePlayGame();
  const { g, settings, review } = play;

  // ---- What the hill shows ----
  let s: State, last = g.last, best = null, marks = new Map<number, Mark>();
  let status = "", statusTone = "", hint = "";
  if (review) {
    const e = review.v > 0 ? review.list[review.v - 1] : null;
    s = e ? e.after : review.list[0]?.s ?? g.s;
    last = e ? (e.kind === "place" ? { to: e.to } : { from: from(e.m), to: to(e.m) }) : null;
    best = e?.best ?? null;
    status = e ? `Review · ${review.v} of ${review.list.length}` : "Review · the empty hill";
    hint = e?.best ? "Dashed green rings: the better choice." : "";
  } else {
    s = g.s;
    if (g.winner !== null) {
      status = `${g.winner === -1 ? "A draw." : `The ${sideName(g.winner)} win.`} ${why(g.why)}`;
      if (settings.mode === "cpu" && g.winner !== -1) statusTone = g.winner === settings.side ? "win" : "lose";
    } else if (play.thinking) status = g.phase === "place" ? "The computer sets a piece…" : "The computer is thinking…";
    else if (g.phase === "place") status = `${sideName(placer(g))}: set a piece (${g.placed + 1} of ${PLACEMENTS})`;
    else status = settings.mode === "cpu" ? `Your move, ${sideName(settings.side)}` : `${sideName(s.turn)} to move`;

    if (g.phase === "place") {
      hint = placer(g) === 0 ? "Host pieces go on the outer ring." : "Sí pieces go on the upper slope or the summit.";
      if (play.humanTurn) for (let i = 0; i < NN; i++) if (!s.b[i] && zoneOk(placer(g), i)) marks.set(i, "place");
    } else {
      if (play.humanTurn) marks = moveMarks(s, play.sel);
      hint = play.sel !== null ? selHint(s, play.sel) : g.winner !== null ? "" : "Tap a piece to see where it can go, or a reserve to bring it in.";
    }
  }

  // ---- Setup tray ----
  let tray = null;
  if (!review && g.phase === "place") {
    const side = placer(g), tr = g.trays[side], kinds = trayKinds(side);
    tray = (
      <Tray label={play.humanTurn ? `${sideName(side)}: choose a piece, then a marked hole` : `${sideName(side)} pieces still to set`}
        kinds={kinds} counts={tr} picked={play.pick ?? (tr[kinds[0]] ? kinds[0] : kinds[1])}
        enabled={k => !!tr[k] && play.humanTurn} onPick={play.setPick} />
    );
  }

  const whoLabel = (side: Side) => (settings.mode === "cpu" ? (side === settings.side ? " (you)" : " (computer)") : "");
  const ending = g.winner === null ? "" : g.winner === -1 ? "A draw." : `The ${sideName(g.winner)} win: ${why(g.why)}`;
  const resultTone = g.winner === -1 || settings.mode !== "cpu" ? "draw" : g.winner === settings.side ? "win" : "lose";
  const resultTitle = g.winner === -1 ? "A draw" : settings.mode === "cpu" ? (g.winner === settings.side ? "You win" : "You lose") : `The ${sideName(g.winner as Side)} win`;
  const dropSide = !review && play.sel === DROP ? s.turn : null;

  return (
    <div className="wrap">
      <header>
        <h1>Cnoc Mór <span className="say">(k’nuk mor)</span></h1>
        <p className="tag">The big hill: many climb, few defend, one cairn.</p>
      </header>
      <div className="game">
        <section className="stage" aria-label="The hill">
          <div className={`status ${statusTone}`} role="status" aria-live="polite">{status}</div>
          <Board b={s.b} marks={marks} selected={review ? null : play.sel} last={last} best={best}
            locked={!!review || !play.humanTurn} animate={!review && play.animate} onCell={play.clickCell} />
          <Reserves rh={s.rh} rs={s.rs} canDrop={side => !review && play.canDrop(side)} pressed={dropSide} onPick={play.pickReserve} />
          {tray}
          <p className="hint">{hint}</p>
        </section>
        <aside>
          {review ? (
            <ReviewPanel review={review} ending={ending} whoLabel={whoLabel} go={play.goReview} togglePlay={play.togglePlay} close={play.stopReview} />
          ) : (
            <>
              <PlayPanel settings={settings} change={play.changeSettings} newGame={play.newGame} canUndo={play.canUndo} undo={play.takeBack}
                canReview={g.winner !== null} review={play.startReview} />
              <div className="panel">
                <p className="label">Moves</p>
                <MoveLog history={g.history} settingUp={g.phase === "place"} />
              </div>
            </>
          )}
          <RulesPanel />
        </aside>
      </div>
      {play.resultOpen && g.winner !== null ? (
        <ResultDialog tone={resultTone} title={resultTitle} text={why(g.why)} review={play.startReview} newGame={play.newGame} close={play.closeResult} />
      ) : null}
    </div>
  );
}

