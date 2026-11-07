// #/lock/race: choose a race's options, then make a race link (two players, then a challenge for
// anyone) or practise alone with the same options (nothing goes online).
import { useId, useState, type ReactNode } from "react";
import { useStoredState } from "../../../kit/useStoredState";
import { AccountLine } from "../../../online/AccountLine";
import { recordGameEnd, recordGameStart } from "../../../online/analytics";
import { raceHash } from "../../../online/races";
import {
  DEFAULT_OPTIONS, KINDS, MINUTES, describeOptions, failPenaltySec, isRaceOptions, newSeed, solveBonusSec, tierDesc, tierName,
  type RaceOptions, type RaceRun,
} from "./engine";
import { TIER_IDS } from "../engine/knot";
import { RacePlay } from "./RacePlay";
import { BonusTable, ResultTable, RulesPanel } from "./RaceBoards";
import { createRace } from "./useRaceRoom";
import "../../../online/online.css";

function Choice<T extends string | number | boolean>(p: { label: string; value: T; options: { v: T; label: ReactNode }[]; onChange(v: T): void; note?: ReactNode }) {
  const name = useId(), lid = `${name}-l`;
  return (
    <div className="race-choice">
      <p className="label" id={lid}>{p.label}</p>
      <div className="race-seg" role="radiogroup" aria-labelledby={lid} style={{ gridTemplateColumns: `repeat(${p.options.length}, 1fr)` }}>
        {p.options.map((x, i) => [
          <input key={`i${i}`} type="radio" name={name} id={`${name}-${i}`} checked={p.value === x.v} onChange={() => p.onChange(x.v)} />,
          <label key={`l${i}`} htmlFor={`${name}-${i}`}>{x.label}</label>,
        ])}
      </div>
      {p.note ? <p className="tier-desc">{p.note}</p> : null}
    </div>
  );
}

export function RaceSetup() {
  const [stored, setO] = useStoredState<RaceOptions>("lock-react-race-options", DEFAULT_OPTIONS);
  const o = isRaceOptions(stored) ? stored : DEFAULT_OPTIONS;
  const set = (p: Partial<RaceOptions>) => setO({ ...o, ...p });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [practice, setPractice] = useState<{ seed: number; o: RaceOptions } | null>(null);
  const [result, setResult] = useState<{ run: RaceRun; o: RaceOptions } | null>(null);

  const make = async () => {
    setBusy(true); setErr(null);
    try { window.location.hash = raceHash(await createRace(o)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const startPractice = (opts: RaceOptions) => {
    setResult(null);
    recordGameStart("lock", { mode: "solo", variant: "race", level: tierName(opts) });
    setPractice({ seed: newSeed(), o: opts });
  };

  if (practice) {
    const stop = () => setPractice(null);
    return (
      <RacePlay key={practice.seed} o={practice.o} seed={practice.seed} title="Practice" cheatAllowed
        sink={{
          progress: () => {},
          finish: run => {
            recordGameEnd("lock", { mode: "solo", variant: "race", level: tierName(practice.o), result: "practice", score: run.solves });
            setResult({ run, o: practice.o }); setPractice(null);
          },
        }}
        aside={<><div className="panel"><button className="btn" type="button" onClick={stop}>Stop practice</button></div><RulesPanel o={practice.o} /></>} />
    );
  }

  return (
    <div className="game race-setup">
      <section className="box race-card online" aria-label="Set up a race">
        {result ? (
          <div className="race-result" aria-live="polite">
            <p className="label">Practice over</p>
            <p className="race-big good">{`${result.run.solves} lock${result.run.solves === 1 ? "" : "s"} opened, ${result.run.fails} failed tr${result.run.fails === 1 ? "y" : "ies"}.`}</p>
            <ResultTable caption={describeOptions(result.o)} rows={[{ key: "me", name: "You", run: result.run, me: true }]} />
            <div className="controls">
              <button className="btn primary" type="button" onClick={() => startPractice(result.o)}>Practice again</button>
              <button className="btn" type="button" onClick={() => setResult(null)}>Change the options</button>
            </div>
          </div>
        ) : null}
        <p className="label">Set up a race</p>
        <Choice label="Length" value={o.minutes} onChange={v => set({ minutes: v })} options={MINUTES.map(m => ({ v: m, label: `${m} min` }))} />
        <Choice label="Puzzle" value={o.kind} onChange={v => set({ kind: v })} options={KINDS.map(k => ({ v: k.kind, label: k.label }))} />
        <Choice label="Lock" value={o.tier} onChange={v => set({ tier: v })} note={tierDesc(o)}
          options={TIER_IDS.map(t => ({ v: t, label: tierName({ kind: o.kind, tier: t }) }))} />
        <Choice label="Resets" value={o.resets} onChange={v => set({ resets: v })}
          note={o.resets === "free" ? "Start over, Retry and Scramble as often as you like." : "No Start over or Retry: a failed try scrambles the lock by itself."}
          options={[{ v: "free", label: "Free resets" }, { v: "none", label: "No resets" }]} />
        <Choice label="Failed try" value={o.penalty} onChange={v => set({ penalty: v })}
          options={[{ v: true, label: `−${failPenaltySec(o.minutes)} s` }, { v: false, label: "No penalty" }]} />
        <Choice label="Lock opened" value={o.bonus} onChange={v => set({ bonus: v })}
          note={o.bonus ? `Up to ${o.minutes} min of bonus in all.` : undefined}
          options={[{ v: true, label: `+${solveBonusSec(o.minutes, o.tier)} s` }, { v: false, label: "No bonus" }]} />
        <p className="race-desc" aria-live="polite">{describeOptions(o)}</p>
        <div className="controls">
          <button className="btn primary" type="button" disabled={busy} onClick={() => void make()}>{busy ? "Making the link…" : "Make a race link"}</button>
          <button className="btn" type="button" onClick={() => startPractice(o)}>Practice solo</button>
        </div>
        {err ? <p className="race-err" role="alert">{err}</p> : null}
        <p className="race-small">A race link is for two players. When the race is over, anyone with the link can play the same locks as a challenge and go on the leaderboard.</p>
        <AccountLine />
      </section>
      <aside>
        <RulesPanel o={o} />
        <BonusTable o={o} />
      </aside>
    </div>
  );
}
