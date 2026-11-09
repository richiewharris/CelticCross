// The puzzle sets: deck building, drafting, the Playing turn and combat.
import { useEffect, useMemo, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import type { CardDef } from "./engine/cards";
import { cloneState, nextDecision } from "./engine/engine";
import { Inspector } from "./components/Panels";
import { optionAt, Table, type Sel } from "./components/Table";
import { PUZZLES, SETS, type BoardPuzzle, type Puzzle, type PuzzleSet } from "./puzzles/data";
import { unpackState } from "./puzzles/position";
import { optionLabel } from "./text";

export function Puzzles({ focus, setFocus }: { focus: CardDef | null; setFocus: (d: CardDef) => void }) {
  const [setId, setSetId] = useStoredState<PuzzleSet>("roth-react-puzzle-set", "deck");
  const [solved, setSolved] = useStoredState<Record<string, boolean>>("roth-react-solved", {});
  const [idx, setIdx] = useState(0);
  const list = PUZZLES.filter((p) => p.set === setId);
  const p = list[Math.min(idx, list.length - 1)];
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { setPicked(null); setReveal(false); }, [p.id]);
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (p.answer.includes(i)) { setReveal(true); setSolved({ ...solved, [p.id]: true }); }
  };
  const info = SETS.find((s) => s.id === setId)!;
  return (
    <div className="game puzzles">
      <section className="stage" aria-label="Puzzle">
        <nav className="chips" aria-label="Puzzle set">
          {SETS.map((s) => {
            const n = PUZZLES.filter((x) => x.set === s.id);
            const done = n.filter((x) => solved[x.id]).length;
            return (
              <button key={s.id} type="button" className={s.id === setId ? "cur" : ""} aria-pressed={s.id === setId}
                onClick={() => { setSetId(s.id); setIdx(0); }}>{s.title} <span className="count">{done}/{n.length}</span></button>
            );
          })}
        </nav>
        <p className="note">{info.intro}</p>
        <nav className="chips small" aria-label="Puzzles in this set">
          {list.map((x, i) => (
            <button key={x.id} type="button" className={`${i === idx ? "cur" : ""}${solved[x.id] ? " done" : ""}`} aria-pressed={i === idx}
              aria-label={`${x.title}, ${x.level}${solved[x.id] ? ", solved" : ""}`} onClick={() => setIdx(i)}>{i + 1}{solved[x.id] ? " ✓" : ""}</button>
          ))}
        </nav>
        <div className="puzzle-head">
          <h2>{p.title}</h2>
          <span className={`level l-${p.level.toLowerCase()}`}>{p.level}</span>
        </div>
        <p className="question">{p.question}</p>
        {p.kind === "board" ? <BoardView p={p} picked={picked} reveal={reveal} choose={choose} setFocus={setFocus} /> : (
          <div className="choice-list">
            {p.choices.map((c, i) => (
              <button key={i} type="button" className={`btn choice${reveal && p.answer.includes(i) ? " right" : picked === i && !p.answer.includes(i) ? " wrong" : ""}`}
                disabled={picked !== null} onClick={() => choose(i)}>{c}</button>
            ))}
          </div>
        )}
        {picked !== null ? <Feedback p={p} picked={picked} reveal={reveal} onReveal={() => setReveal(true)} onRetry={() => setPicked(null)} onNext={idx < list.length - 1 ? () => setIdx(idx + 1) : null} /> : null}
      </section>
      <aside><Inspector def={focus} /></aside>
    </div>
  );
}

function BoardView({ p, picked, reveal, choose, setFocus }: { p: BoardPuzzle; picked: number | null; reveal: boolean; choose: (i: number) => void; setFocus: (d: CardDef) => void }) {
  const { S, d } = useMemo(() => { const T = unpackState(p.state); const S = cloneState(T); const d = nextDecision(S)!; return { S, d }; }, [p.state]);
  const [sel, setSel] = useState<Sel>(null);
  useEffect(() => { setSel(null); }, [p.id, picked]);
  const open = picked === null;
  const onCard = (uid: number) => {
    const opts = d.options.map((o, i) => ({ o, i })).filter(({ o }) => "uid" in o && (o as { uid: number }).uid === uid);
    if (opts.length === 1) choose(opts[0].i); else if (opts.length > 1) setSel({ uid });
  };
  const onSpot = (spot: number) => {
    const j = optionAt(d, sel, spot);
    if (j >= 0) { choose(j); return; }
    const opts = d.options.map((o, i) => ({ o, i })).filter(({ o }) => o.t === "duel" && o.act === "use" && o.spot === spot);
    if (opts.length === 1) choose(opts[0].i); else if (opts.length) setSel({ spot });
  };
  return (
    <>
      <Table S={S} me={d.player} d={d} sel={sel} onCard={open ? onCard : undefined} onSpot={open ? onSpot : undefined}
        onFocusCard={setFocus} names={["You", "Your rival"]} />
      <div className="choice-list">
        {d.options.map((o, i) => (
          <button key={i} type="button" disabled={!open}
            className={`btn choice${reveal && p.answer.includes(i) ? " right" : picked === i && !p.answer.includes(i) ? " wrong" : ""}`}
            onClick={() => choose(i)}>{optionLabel(S, d, o)}</button>
        ))}
      </div>
    </>
  );
}

function Feedback({ p, picked, reveal, onReveal, onRetry, onNext }: { p: Puzzle; picked: number; reveal: boolean; onReveal: () => void; onRetry: () => void; onNext: (() => void) | null }) {
  const right = p.answer.includes(picked);
  return (
    <div className={`feedback ${right ? "right" : "wrong"}`} role="status" aria-live="polite">
      <p className="verdict">{right ? "Right." : "Not this time."}</p>
      {reveal ? <p>{p.explain}</p> : null}
      <div className="row">
        {!right ? <button type="button" className="btn" onClick={onRetry}>Try again</button> : null}
        {!right && !reveal ? <button type="button" className="btn" onClick={onReveal}>Show the answer</button> : null}
        {onNext ? <button type="button" className="btn primary" onClick={onNext}>Next puzzle</button> : null}
      </div>
    </div>
  );
}
