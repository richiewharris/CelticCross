import { Fragment, useEffect, useRef } from "react";
import { GRADES, GRADE_NAME, summarize, type Entry } from "../engine/review";
import { NAMES, sideName, sideOf, sqName, type Side } from "../engine/rules";

export interface ReviewState { list: Entry[]; done: number; v: number; playing: boolean }

export function ReviewSummary({ list, whoLabel }: { list: Entry[]; whoLabel: (s: Side) => string }) {
  return (
    <div className="revsum">
      {summarize(list).map(x => (
        <div className="who" key={x.side}>
          <h3>{sideName(x.side)}{whoLabel(x.side)}</h3>
          <div className="perf">{x.n ? x.perf : "…"}</div>
          <div className="rank">{x.n ? `${x.rank} · ${x.acc}% accuracy` : ""}</div>
          <div className="rank">{x.place != null ? `Setup ${x.place}% (${x.nPlace} pieces)` : ""}</div>
          <div className="rank">{x.moves != null ? `Play ${x.moves}% (${x.nMoves} moves)` : ""}</div>
          <dl>{GRADES.map(q => <Fragment key={q}><dt><span className={`dot q-${q}`} />{GRADE_NAME[q]}</dt><dd>{x.counts[q]}</dd></Fragment>)}</dl>
        </div>
      ))}
    </div>
  );
}

export function describe(e: Entry) {
  const who = sideName(e.by);
  const what = e.kind === "place"
    ? `${who} set ${e.by === sideOf(e.piece) ? "their" : "the rival's"} ${NAMES[e.piece]} on ${sqName(e.to)}`
    : `${who}: ${e.note}`;
  if (!e.q) return `${what}. Assessing…`;
  const better = e.best ? (e.kind === "place" ? ` Better: ${sqName(e.best.to)}.` : ` Better: ${e.best.note}.`) : "";
  const decisive = e.kind === "move" && e.decisive ? ": the turning point, the last move where a defence still held" : "";
  return `${what}. ${GRADE_NAME[e.q]}${decisive}.${e.q === "best" ? "" : better}`;
}

export function ReviewPanel(props: {
  review: ReviewState; ending: string; whoLabel: (s: Side) => string;
  go: (v: number) => void; togglePlay: () => void; close: () => void;
}) {
  const { review: r } = props, total = r.list.length;
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (r.playing) listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [r.v, r.playing]);
  const e = r.v > 0 ? r.list[r.v - 1] : null;
  let note = "The starting board. Step through the game, or tap any move.";
  if (e) {
    note = describe(e);
    if (r.v === total && props.ending) note += ` ${props.ending}`;
  }
  let moveNo = 0;
  return (
    <div className="panel">
      <p className="label">Game review</p>
      <p className="revprog" aria-live="polite">{r.done < total ? `Assessing ${r.done} of ${total}…` : "Each move is judged by a deep search of where it led; the counts below are for moves in play."}</p>
      <ReviewSummary list={r.list} whoLabel={props.whoLabel} />
      <div className="revnav" role="group" aria-label="Play the game back">
        <button className="btn" type="button" aria-label="Back to the start" disabled={r.v === 0} onClick={() => props.go(0)}>⏮</button>
        <button className="btn" type="button" aria-label="Back one move" disabled={r.v === 0} onClick={() => props.go(r.v - 1)}>◀</button>
        <button className="btn" type="button" onClick={props.togglePlay}>{r.playing ? "Pause" : "Play"}</button>
        <button className="btn" type="button" aria-label="Forward one move" disabled={r.v >= total} onClick={() => props.go(r.v + 1)}>▶</button>
        <button className="btn" type="button" aria-label="To the end" disabled={r.v >= total} onClick={() => props.go(total)}>⏭</button>
      </div>
      <p className="revnote">{note}</p>
      <ol className="revlist" ref={listRef}>
        {r.list.map((x, i) => (
          <Fragment key={i}>
            {i === 0 || r.list[i - 1].kind !== x.kind ? <li className="sep">{x.kind === "place" ? "Setup" : "Play"}</li> : null}
            <li>
              <button type="button" aria-current={r.v === i + 1} onClick={() => props.go(i + 1)}>
                <span className="who2">{x.kind === "place" ? `${i + 1}.` : `${++moveNo}.`}</span><span className="who2">{sideName(x.by)}</span><span>{x.note}</span>
                {x.q ? <span className={`tagq q-${x.q}`}>{GRADE_NAME[x.q]}</span> : <span className="who2">…</span>}
              </button>
            </li>
          </Fragment>
        ))}
      </ol>
      <div className="row"><button className="btn" type="button" onClick={props.close}>Close review</button></div>
    </div>
  );
}
