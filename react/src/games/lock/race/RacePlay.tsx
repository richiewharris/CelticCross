// A run in play: 3-2-1, then the clock, the counts (and the other racer's live count), the +N / −N
// notes, and the lock itself. When the clock runs out the sink gets the final count.
import { useMemo, type ReactNode } from "react";
import { clockText, describeOptions, type RaceOptions } from "./engine";
import { useRaceRun, type RaceSink } from "./useRaceRun";
import { RacePuzzle, type PuzzleCtl } from "./RacePuzzles";

export interface Opponent { name: string; solves: number; fails: number; finished: boolean }

export interface RacePlayProps {
  o: RaceOptions;
  seed: number;
  /** "Race", "Challenge" or "Practice", for the heading of the counts. */
  title: string;
  opponent?: Opponent | null;
  sink: RaceSink;
  cheatAllowed?: boolean;
  /** Extra panels beside the lock. */
  aside?: ReactNode;
}

export function RacePlay(p: RacePlayProps) {
  const R = useRaceRun(p.o, p.sink);
  const ctl: PuzzleCtl = useMemo(() => ({ solved: R.solved, failed: R.failed, setPuzzle: R.setPuzzle }), [R.solved, R.failed, R.setPuzzle]);
  const secs = Math.ceil(R.left / 1000);
  const low = R.phase === "racing" && R.left <= 10000;
  return (
    <div className="race-play">
      <div className={`race-hud${low ? " low" : ""}`} role="group" aria-label={`${p.title}: clock and counts`}>
        <div className="race-time">
          <div className="race-clock" role="timer" aria-label={`${secs} second${secs === 1 ? "" : "s"} left`}>{clockText(R.left)}</div>
          <div className="race-toasts" aria-live="polite">
            {R.toasts.map(t => <span key={t.id} className={`race-toast ${t.kind}`}>{t.text}</span>)}
          </div>
        </div>
        <dl className="race-stats">
          <div><dt>Lock</dt><dd>{R.puzzle + 1}</dd></div>
          <div><dt>Opened</dt><dd>{R.run.solves}</dd></div>
          <div><dt>Failed</dt><dd>{R.run.fails}</dd></div>
          {p.opponent ? <div className="race-opp"><dt title={p.opponent.name}>{p.opponent.name}</dt><dd>{p.opponent.solves}{p.opponent.finished ? <small> done</small> : null}</dd></div> : null}
        </dl>
      </div>
      {R.phase === "countdown" ? (
        <div className="race-countdown box" aria-live="assertive">
          <p className="label">{p.title} · {describeOptions(p.o)}</p>
          <div key={R.count} className="race-count">{R.count > 0 ? R.count : "Go!"}</div>
          <p className="tag">The first lock shows when the count reaches zero.</p>
        </div>
      ) : R.phase === "racing" ? (
        <RacePuzzle o={p.o} seed={p.seed} ctl={ctl} cheatAllowed={!!p.cheatAllowed} aside={p.aside} />
      ) : (
        <div className="race-countdown box" aria-live="assertive"><div className="race-count">Time!</div></div>
      )}
    </div>
  );
}
