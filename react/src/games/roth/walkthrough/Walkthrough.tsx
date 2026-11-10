// A guided game: one whole match, move by move, with what happened, the arithmetic behind it, and what a strong
// player was thinking. The match is replayed from its seed and the recorded moves (script.json), so the board is the
// real engine's board at every step.
import { useEffect, useMemo } from "react";
import { useStoredState } from "../../../kit/useStoredState";
import { DECKS, type CardDef } from "../engine/cards";
import { applyDecision, cloneState, newMatch, nextDecision, NARRATE, type Decision, type State } from "../engine/engine";
import { Rich } from "../components/Card";
import { Inspector } from "../components/Panels";
import { Table } from "../components/Table";
import { logLine, optionLabel } from "../text";
import script from "./script.json";
import { CHAPTERS, COACH, ENDING } from "./notes";

interface Step { line: string; mine: boolean; maths: string[]; others: string[]; S: State; next: Decision | null }

/** Play the scripted match once, keeping a copy of the board after every move. */
export function replayScript(): { start: State; first: Decision | null; steps: Step[]; end: State } {
  const S = newMatch([DECKS[script.you as "ulster"], DECKS[script.them as "connacht"]], {}, script.seed, false);
  const first = nextDecision(S);
  const start = cloneState(S);
  const steps: Step[] = [];
  for (const i of script.picks) {
    const d = nextDecision(S);
    if (!d) break;
    const o = d.options[i];
    const line = logLine(S, d, o, 0).replace(/^The computer/, "Connacht").replace(/^You/, "You (Ulster)");
    const others = d.player === 0 ? d.options.filter((_, j) => j !== i).map((x) => optionLabel(S, d, x)) : [];
    const maths: string[] = [];
    NARRATE.lines = maths;
    try { applyDecision(S, d, i); } finally { NARRATE.lines = null; }
    const next = nextDecision(S);
    steps.push({ line, mine: d.player === 0, maths, others, S: cloneState(S), next });
  }
  return { start, first, steps, end: S };
}

const SHOW_OTHERS = 8;

export function Walkthrough({ focus, setFocus }: { focus: CardDef | null; setFocus: (d: CardDef) => void }) {
  const game = useMemo(replayScript, []);
  const last = game.steps.length + 1; // page 0 = the start, pages 1..n = after move n-1, last = the result
  const [page, setPage] = useStoredState<number>("roth-react-walk", 0);
  const p = Math.max(0, Math.min(last, page));
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [p]);
  const move = p >= 1 && p <= game.steps.length ? p - 1 : -1;
  const st = move >= 0 ? game.steps[move] : null;
  const S = p === 0 ? game.start : st ? st.S : game.end;
  const d = p === 0 ? game.first : st ? st.next : null;
  const chapter = CHAPTERS.find((c) => c.at === move);
  const current = move >= 0 ? [...CHAPTERS].reverse().find((c) => c.at <= move) : undefined;
  const result = game.end.result;
  const P = game.start.players;

  return (
    <div className="game walk">
      <section className="stage" aria-label="Guided game">
        <div className="walk-nav">
          <button type="button" className="btn" disabled={p === 0} onClick={() => setPage(p - 1)}>← Back</button>
          <span className="walk-count" aria-live="polite">{p === 0 ? "Start" : p === last ? "Result" : `Move ${p} of ${game.steps.length}`}</span>
          <button type="button" className="btn primary" disabled={p === last} onClick={() => setPage(p + 1)}>Next →</button>
        </div>
        <nav className="chips small" aria-label="Jump to">
          <button type="button" className={p === 0 ? "cur" : ""} onClick={() => setPage(0)}>Start</button>
          {CHAPTERS.map((c) => <button key={c.at} type="button" className={c === current ? "cur" : ""} onClick={() => setPage(c.at + 1)}>{c.short}</button>)}
          <button type="button" className={p === last ? "cur" : ""} onClick={() => setPage(last)}>Result</button>
        </nav>

        <div className="walk-text">
          {p === 0 ? (
            <>
              <h2>A whole game, move by move</h2>
              <p>You are <b>Ulster</b> (the starter deck), playing first. Your rival is the <b>Connacht</b> starter. Both sides were played by the computer at Skilled, so this is a strong game to watch: press <b>Next</b> to step through it, and point at any card to read it.</p>
              <h3>The Muster</h3>
              <p>Before anything is placed, each player draws to <b>12 cards</b> in hand (at least 2 heroes and 4 supports) and fills <b>four Omen spots</b> face down. The rest of the deck waits in the Reserve.</p>
              <p className="note"><b>Your hand:</b> {P[0].hand.map((c) => c.def.name).join(", ")}. <b>Your omens:</b> {P[0].omens.map((o) => o.card.def.name).join(", ")}.</p>
              <p className="note"><b>Connacht's hand</b> (hidden in a real game): {P[1].hand.map((c) => c.def.name).join(", ")}. <b>Its omens:</b> {P[1].omens.map((o) => o.card.def.name).join(", ")}.</p>
            </>
          ) : p === last ? (
            <>
              <h2>{result && result.winner === 0 ? "Ulster wins" : "The result"}</h2>
              {ENDING.map((t, i) => <p key={i}><Rich text={t} /></p>)}
              <button type="button" className="btn" onClick={() => setPage(0)}>Watch it again</button>
            </>
          ) : st ? (
            <>
              {chapter ? (
                <div className="walk-chapter">
                  <h2>{chapter.title}</h2>
                  {chapter.body.map((t, i) => <p key={i}><Rich text={t} /></p>)}
                </div>
              ) : null}
              <p className={`walk-move ${st.mine ? "mine" : "theirs"}`}>{st.line}</p>
              {st.maths.length ? (
                <div className="walk-maths" aria-label="The numbers">
                  {st.maths.join(" ").split(/(?<=\.)\s(?=[A-ZÁÉÍÓÚ])/).map((t, i) => <p key={i}>{t}</p>)}
                </div>
              ) : null}
              {COACH[move] ? <p className="walk-coach"><Rich text={COACH[move]} /></p> : null}
              {st.others.length ? (
                <details className="walk-others">
                  <summary>Other choices here ({st.others.length})</summary>
                  <ul>{st.others.slice(0, SHOW_OTHERS).map((t, i) => <li key={i}>{t}</li>)}{st.others.length > SHOW_OTHERS ? <li>…and {st.others.length - SHOW_OTHERS} more</li> : null}</ul>
                </details>
              ) : null}
            </>
          ) : null}
        </div>

        <Table S={S} me={0} d={d} sel={null} onFocusCard={setFocus} names={["You (Ulster)", "Connacht"]} />
      </section>
      <aside><Inspector def={focus} /></aside>
    </div>
  );
}
