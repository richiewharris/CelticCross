// Tables and notes shared by the race pages: a result table, the challenge leaderboard and the rules.
import { BONUS_TABLE, MINUTES, bonusCapSec, bonusOf, failPenaltySec, rankRuns, type RaceOptions, type RaceRun } from "./engine";
import { SEATS, seatName, type RaceDoc, type RaceScore } from "../../../online/races";

export interface BoardRow { key: string; name: string; run: RaceRun; me?: boolean; racer?: boolean; note?: string }

export function ResultTable({ rows, caption, limit }: { rows: BoardRow[]; caption: string; limit?: number }) {
  const ranked = rankRuns(rows);
  let shown = limit ? ranked.slice(0, limit) : ranked;
  const mine = ranked.find(r => r.me);
  if (limit && mine && !shown.includes(mine)) shown = [...shown, mine];
  return (
    <div className="race-table-wrap">
      <table className="race-table">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Opened</th><th scope="col">Failed</th><th scope="col"><span aria-hidden="true">+s</span><span className="sr">Bonus seconds</span></th><th scope="col"><span aria-hidden="true">−s</span><span className="sr">Penalty seconds</span></th></tr>
        </thead>
        <tbody>
          {shown.map(r => (
            <tr key={r.key} className={r.me ? "me" : undefined}>
              <td>{r.place}</td>
              <th scope="row">
                <span className="race-name">{r.name}</span>
                {r.me ? <span className="race-tag you">you</span> : null}
                {r.racer ? <span className="race-tag">racer</span> : null}
                {r.note ? <span className="race-note">{r.note}</span> : null}
              </th>
              <td>{r.run.solves}</td><td>{r.run.fails}</td><td>{r.run.bonus}</td><td>{r.run.penalty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The window (ms after the start) in which a run can still be reported: twice the race plus 5 minutes. */
const windowMs = (o: RaceOptions) => (o.minutes * 120 + 300) * 1000;
const liveNote = (run: RaceRun, startedAt: number | null, o: RaceOptions, now: number) =>
  run.finished ? undefined : startedAt !== null && now > startedAt + windowMs(o) ? "unfinished" : "playing…";

/** Everyone who has played this race's locks: the two racers, then every challenger. */
export function boardRows(d: RaceDoc, scores: RaceScore[], uid: string | null, now = Date.now()): BoardRow[] {
  const racers: BoardRow[] = d.status === "running" || d.status === "done"
    ? SEATS.filter(s => d.seats[s]).map(s => ({ key: `seat-${s}`, name: seatName(d, s), run: d.runs[s], racer: true, me: d.seats[s] === uid, note: liveNote(d.runs[s], d.startedAt, d.options, now) }))
    : [];
  return [...racers, ...scores.map(x => ({ key: x.uid, name: x.name || "Challenger", run: x, me: x.uid === uid, note: liveNote(x, x.startedAt, d.options, now) }))];
}

export function Leaderboard({ d, scores, uid }: { d: RaceDoc; scores: RaceScore[]; uid: string | null }) {
  const rows = boardRows(d, scores, uid);
  if (!rows.length) return <p className="race-empty">No one has played this race's locks yet.</p>;
  return <ResultTable rows={rows} caption="Challenge leaderboard" limit={20} />;
}

/** "How a race works", for the options in hand. */
export function RulesPanel({ o }: { o: RaceOptions }) {
  const pen = failPenaltySec(o.minutes), bon = bonusOf({ ...o, bonus: true }), cap = bonusCapSec(o) / 60;
  return (
    <div className="panel">
      <p className="label">How a race works</p>
      <ul className="how">
        <li>Open as many locks as you can before your clock runs out. Every racer gets the same locks in the same order, and there's no skipping.</li>
        <li>Pressing the center with a broken knot is a failed try.{o.penalty ? ` Each one costs ${pen} s.` : " With the penalty off it costs only time."}</li>
        {o.bonus ? <li>Each lock you open adds {bon} s to your clock, up to {cap} min in all, so a clock can at most double.</li> : null}
        <li>{o.resets === "free"
          ? "Free resets: Start over, Retry this lock and Scramble cost nothing."
          : "No resets: after a failed try the stones scramble by themselves and you go again."}</li>
        <li>Each lock keeps its own turns. When they run out, press the center{o.resets === "free" ? " or start over" : ""}.</li>
        <li>Most locks opened wins. A tie goes to fewer failed tries, then it's a draw.</li>
      </ul>
    </div>
  );
}

/** The bonus per lock, by race length and tier, with the chosen one marked. */
export function BonusTable({ o }: { o: RaceOptions }) {
  const names = ["Iron", "Bronze", "Silver", "Gold", "Ogham"];
  return (
    <div className="panel">
      <p className="label">Seconds per lock</p>
      <div className="race-table-wrap">
        <table className="race-table race-bonus">
          <caption className="sr">Solve bonus in seconds, by race length and lock</caption>
          <thead><tr><th scope="col"><span className="sr">Race</span></th>{names.map(n => <th key={n} scope="col">{n.slice(0, 2)}<span className="sr">{n.slice(2)}</span></th>)}</tr></thead>
          <tbody>
            {MINUTES.map(m => (
              <tr key={m}>
                <th scope="row">{m} min</th>
                {BONUS_TABLE[m].map((b, t) => <td key={t} className={o.bonus && o.minutes === m && o.tier === t + 1 ? "on" : undefined}>+{b}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tier-desc">A failed try costs 10 s per minute of race: {MINUTES.map(failPenaltySec).join(", ")} s.</p>
    </div>
  );
}
