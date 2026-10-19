// Monsiv: the whole page, composed from the board, the panels and two hooks
// (usePlayGame for real games, usePuzzles for the trainer).
import { Segmented } from "../../kit/Segmented";
import { useStoredState } from "../../kit/useStoredState";
import { legalMoves, who, winText, type Game } from "./engine/game";
import { Board, type Flash, type Mark } from "./components/Board";
import { MoveLog } from "./components/MoveLog";
import { PlayPanel } from "./components/PlayPanel";
import { PuzzlePanel } from "./components/PuzzlePanel";
import { RulesPanel } from "./components/RulesPanel";
import { usePlayGame } from "./usePlayGame";
import { usePuzzles } from "./usePuzzles";

type Tab = "play" | "puzzles";

const SEL_HINT = "Tap a dot to step, a red ring to capture, or a gold ⇄ to swap. Tap the piece again to cancel.";

/** Where the selected piece can step, capture or swap. */
export function targetsOf(g: Game, sel: number | null): Map<number, Mark> {
  const t = new Map<number, Mark>();
  if (sel === null) return t;
  for (const m of legalMoves(g)) {
    if (m[0] === 0 && m[1] === sel) t.set(m[2], g.s.b[m[2]] ? "cap" : "go");
    if (m[0] === 1 && (m[1] === sel || m[2] === sel)) t.set(m[1] === sel ? m[2] : m[1], "swap");
  }
  return t;
}
/** Squares that pop in after a move: where a piece landed, or both swapped pieces. */
const popOf = (g: Game) => (g.last ? (g.last[0] === 0 ? [g.last[2]] : [g.last[1], g.last[2]]) : []);

export function MonsivGame() {
  const [tab, setTab] = useStoredState<Tab>("monsiv-react-tab", "play");
  const play = usePlayGame(tab === "play");
  const puz = usePuzzles(tab === "puzzles");

  let g: Game, sel: number | null, locked: boolean, onCell: (i: number) => void;
  let status: string, tone = "", hint: string, flash: Flash | null = null, hintSq: number | null = null, flip = false, anim: number, logEmpty: string;

  if (tab === "puzzles") {
    const pz = puz.pz;
    g = pz?.g ?? play.g;
    sel = pz?.sel ?? null;
    const human = !!pz && pz.phase === "solve" && g.winner === null;
    locked = !human; onCell = puz.click;
    flip = pz?.side === 8;
    flash = pz?.flash ?? null; hintSq = pz?.hintSq ?? null; anim = pz?.anim ?? -1;
    status = pz?.status ?? "";
    tone = pz?.phase === "solved" ? "win" : pz?.phase === "failed" ? "fail" : "";
    hint = pz?.phase !== "solve" ? "" : sel !== null ? SEL_HINT : "Tap one of your pieces to see its moves. A wrong move ends the puzzle.";
    logEmpty = pz?.p ? "Your move. The computer defends as well as it can." : "Carving a puzzle…";
  } else {
    g = play.g; sel = play.sel; locked = !play.humanTurn; onCell = play.clickCell; anim = play.anim;
    const st = play.settings, s = g.s;
    if (g.winner !== null) {
      tone = "win";
      const you = st.mode === "cpu" ? (g.winner === st.side ? " You win." : " The computer wins.") : "";
      status = `${who(g.winner)} ${winText(g.reason!)}.${you}`;
    } else if (play.thinking) status = "Computer is thinking…";
    else if (st.mode === "cpu") status = `Your move (${who(st.side)})`;
    else status = `${who(s.turn)} to move`;
    hint = sel !== null ? SEL_HINT : "Tap one of your pieces. Dots show where it can step; a gold ⇄ marks a neighbour it can swap with.";
    logEmpty = "No moves yet. White goes first.";
  }
  const marks = locked ? new Map<number, Mark>() : targetsOf(g, sel);
  const last = g.last ? [g.last[1], g.last[2]] : [];

  return (
    <div className="wrap">
      <header>
        <h1>MONSIV</h1>
        <p className="tag">Five pieces, one throne, and the swap.</p>
      </header>
      <div className="game">
        <section className="stage" aria-label="Game board">
          <div className={`status${tone ? ` ${tone}` : ""}`} role="status" aria-live="polite">{status}</div>
          <Board b={g.s.b} marks={marks} selected={sel} last={last} flash={flash} hint={hintSq} flip={flip}
            pop={anim === g.history.length ? popOf(g) : []} popKey={anim} locked={locked} onCell={onCell} />
          <p className="hint">{hint}</p>
        </section>
        <aside>
          <Segmented className="tabs" label="Mode" value={tab} onChange={setTab}
            options={[{ value: "play", label: "Play" }, { value: "puzzles", label: "Puzzles" }] as { value: Tab; label: string }[]} />
          {tab === "puzzles" ? (
            <PuzzlePanel ps={puz.ps} pz={puz.pz} next={puz.next} hint={puz.hint} showSolution={puz.showSolution} retry={puz.retry}
              togglePause={puz.togglePause} step={puz.step} setSpeed={puz.setSpeed} setPick={puz.setPick} />
          ) : (
            <PlayPanel settings={play.settings} change={play.changeSettings} newGame={play.newGame} canUndo={play.canUndo} undo={play.takeBack} />
          )}
          {tab === "puzzles" ? (
            <p className="note pz-only">Every puzzle is built by the computer from a numbered seed, so puzzle 7·12 is the same for everyone, and each one is checked to have exactly one winning first move. Wins can come by taking the Throne, reaching the far row, or leaving the other side with no move. Solving raises your rating and missing lowers it, chess-style; a hint makes it count half.</p>
          ) : null}
          <div className="panel">
            <p className="label">Moves</p>
            <MoveLog notes={g.history.map(h => h.note)} empty={logEmpty} />
          </div>
          <RulesPanel />
        </aside>
      </div>
    </div>
  );
}
