// A race room (#/lock/race/<id>): wait for the opponent and share the link → both press Ready →
// 3-2-1 → race → results, then the challenge leaderboard where anyone with the link can play the same
// locks once for a score (and again for practice).
import { useEffect, useMemo, useRef, useState } from "react";
import { AccountLine } from "../../../online/AccountLine";
import { recordGameEnd, recordGameStart } from "../../../online/analytics";
import { otherSeat, raceLine, raceUrl, rememberChallenge, seatName, type RaceDoc, type RaceSeat } from "../../../online/races";
import { allowedSec, describeOptions, outcome, tierName, type RaceRun } from "./engine";
import { RacePlay } from "./RacePlay";
import { Leaderboard, ResultTable, RulesPanel } from "./RaceBoards";
import { runWriter, useRaceRoom, type RaceRoomState } from "./useRaceRoom";
import type { RaceSink } from "./useRaceRun";
import "../../../online/online.css";

type Play = { mode: "live" } | { mode: "challenge"; counted: boolean } | null;
const goKey = (id: string) => `lock-race-go-${id}`;
const session = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string) => { try { sessionStorage.setItem(k, "1"); } catch { /* ignore */ } },
};

export function LinkBox({ id, label }: { id: string; label: string }) {
  const link = raceUrl(id);
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  const share = async () => { try { await navigator.share({ title: "Celtic Cross Lock: a race", text: "Race me at the Celtic Cross Lock", url: link }); } catch { /* cancelled */ } };
  return (
    <div className="online-link">
      <input readOnly value={link} aria-label={label} onFocus={e => e.currentTarget.select()} />
      <button className="btn primary" type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
      {typeof navigator.share === "function" ? <button className="btn" type="button" onClick={() => void share()}>Share</button> : null}
    </div>
  );
}

export function RaceRoom({ id }: { id: string }) {
  const R = useRaceRoom(id);
  const [play, setPlay] = useState<Play>(null);
  const [myFinal, setMyFinal] = useState<RaceRun | null>(null);
  const [challengeFinal, setChallengeFinal] = useState<{ run: RaceRun; counted: boolean } | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const d = R.doc;

  // The race has started: begin this racer's run (once per tab; a reload mid-race ends the run).
  const seatRun = d && R.seat ? d.runs[R.seat] : null;
  useEffect(() => {
    if (!d || !R.seat || d.status !== "running" || play || !seatRun || seatRun.finished) return;
    if (session.get(goKey(id))) {
      setInterrupted(true);
      const fin = { ...seatRun, finished: true, finishedAt: Date.now() };
      setMyFinal(fin);
      void R.updateRun(fin).catch(() => {});
      return;
    }
    session.set(goKey(id));
    recordGameStart("lock", { mode: "online", variant: "race", level: tierName(d.options) });
    setPlay({ mode: "live" });
  }, [d?.status, R.seat, seatRun?.finished, play]); // eslint-disable-line react-hooks/exhaustive-deps

  // My run is over and the other racer has gone quiet well past their clock: close the race.
  const mine = d && R.seat ? (d.runs[R.seat].finished ? d.runs[R.seat] : myFinal) : null;
  useEffect(() => {
    if (!d || !R.seat || d.status !== "running" || !mine?.finished || d.startedAt === null) return;
    const other = d.runs[otherSeat(R.seat)];
    if (other.finished) return;
    const due = d.startedAt + (3 + allowedSec(d.options, other) + 30) * 1000;
    const t = setTimeout(() => void R.endRace(), Math.max(0, due - Date.now()));
    return () => clearTimeout(t);
  }, [d, R.seat, mine?.finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveSink: RaceSink = useMemo(() => {
    const write = runWriter(R.updateRun, m => R.setError(m));
    return {
      progress: write,
      finish: run => {
        write(run); setMyFinal(run); setPlay(null);
        recordGameEnd("lock", { mode: "online", variant: "race", level: d ? tierName(d.options) : undefined, result: "finished", score: run.solves });
      },
    };
  }, [id, R.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const counted = play?.mode === "challenge" && play.counted;
  const countedRef = useRef(counted); countedRef.current = counted;
  const challengeSink: RaceSink = useMemo(() => {
    const write = runWriter(R.postScore, m => R.setError(m));
    return {
      progress: run => { if (countedRef.current) write(run); },
      finish: run => {
        const c = !!countedRef.current;
        if (c) write(run);
        setChallengeFinal({ run, counted: c }); setPlay(null);
        if (d && c) rememberChallenge({ id, line: raceLine(d.options), solves: run.solves, fails: run.fails, at: Date.now(), counted: c });
        recordGameEnd("lock", { mode: "solo", variant: "race", level: d ? tierName(d.options) : undefined, result: c ? "challenge" : "practice", score: run.solves });
      },
    };
  }, [id, R.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const startChallenge = async (asRacer: boolean) => {
    if (!d) return;
    const c = asRacer ? false : await R.startScore();
    setChallengeFinal(null);
    recordGameStart("lock", { mode: "solo", variant: "race", level: tierName(d.options) });
    setPlay({ mode: "challenge", counted: c });
  };

  const header = (
    <div className="race-head">
      <p className="label">Race</p>
      <p className="race-desc">{d ? describeOptions(d.options) : ""}</p>
    </div>
  );

  if (R.phase === "connecting") return <div className="box race-card"><p aria-live="polite">Connecting…</p></div>;
  if (R.phase === "missing") return <div className="box race-card"><p className="race-err">This race link doesn't lead to a race. Check that it was copied whole.</p><a className="race-link" href="#/lock/race">Set up a new race</a></div>;
  if (R.phase === "error" || !d) return <div className="box race-card"><p className="race-err" role="alert">{R.error ?? "Something went wrong."}</p><a className="race-link" href="#/lock/race">Back to races</a></div>;

  const errorLine = R.error ? <p className="race-err" role="alert">{R.error}</p> : null;

  if (play) {
    const other = R.seat ? otherSeat(R.seat) : null;
    const opp = play.mode === "live" && other ? { name: seatName(d, other), solves: d.runs[other].solves, fails: d.runs[other].fails, finished: d.runs[other].finished } : null;
    return (
      <>
        <RacePlay key={play.mode} o={d.options} seed={d.seed} title={play.mode === "live" ? "Race" : play.counted ? "Challenge" : "Practice"}
          opponent={opp} sink={play.mode === "live" ? liveSink : challengeSink} cheatAllowed={play.mode === "challenge" && !play.counted}
          aside={<RulesPanel o={d.options} />} />
        {errorLine}
      </>
    );
  }

  return (
    <div className="game race-room">
      <section className="box race-card online" aria-label="Race room">
        {header}
        <RoomBody R={R} d={d} id={id} mine={mine} interrupted={interrupted} challengeFinal={challengeFinal} onChallenge={startChallenge} />
        {errorLine}
      </section>
      <aside>
        <RulesPanel o={d.options} />
        <div className="panel online"><AccountLine /></div>
      </aside>
    </div>
  );
}

function Players({ d, seat }: { d: RaceDoc; seat: RaceSeat | null }) {
  return (
    <ul className="race-players">
      {(["a", "b"] as const).map(s => (
        <li key={s} className={d.ready[s] ? "ready" : undefined}>
          <span className="race-name">{d.seats[s] ? seatName(d, s) : "Waiting…"}</span>
          {seat === s ? <span className="race-tag you">you</span> : null}
          <span className="race-state">{!d.seats[s] ? "empty seat" : d.ready[s] ? "ready" : "not ready"}</span>
        </li>
      ))}
    </ul>
  );
}

function RoomBody({ R, d, id, mine, interrupted, challengeFinal, onChallenge }: {
  R: RaceRoomState; d: RaceDoc; id: string; mine: RaceRun | null; interrupted: boolean;
  challengeFinal: { run: RaceRun; counted: boolean } | null; onChallenge: (asRacer: boolean) => void;
}) {
  const seat = R.seat;
  if (d.status === "open") {
    if (seat === "a") {
      return (
        <>
          <p className="race-big" aria-live="polite">Waiting for an opponent…</p>
          <p>Send this link to a friend. When they open it and join, you both press Ready and the race starts with a 3-2-1.</p>
          <LinkBox id={id} label="Race link" />
          <p className="race-small">You can leave this page open; it updates by itself. Your races are also under Your games.</p>
        </>
      );
    }
    return (
      <>
        <p className="race-big">You've been challenged to a race.</p>
        <p>{seatName(d, "a")} wants to race you: {describeOptions(d.options)}.</p>
        <div className="controls"><button className="btn primary" type="button" disabled={R.busy} onClick={() => void R.join()}>Join the race</button></div>
        <p className="race-small">{R.name ? `You'll race as ${R.name}.` : "You'll race as Player 2. Sign in with Google to race under your name."}</p>
      </>
    );
  }

  if (d.status === "ready") {
    if (!seat) return <p>This race is full and about to start. Once it does, you can play the same locks as a challenge from this page.</p>;
    const other = otherSeat(seat);
    return (
      <>
        <Players d={d} seat={seat} />
        {d.ready[seat]
          ? <p className="race-big" aria-live="polite">Waiting for {seatName(d, other)} to press Ready…</p>
          : <div className="controls"><button className="btn primary race-ready" type="button" disabled={R.busy} onClick={() => void R.ready()}>Ready</button></div>}
        <p className="race-small">When you're both ready a 3-2-1 counts you in. Each clock runs on its own device from there.</p>
      </>
    );
  }

  // running or done
  const board = (
    <>
      <Leaderboard d={d} scores={R.scores} uid={R.uid} />
      <p className="race-small">Anyone with the link can play this race's locks as a challenge and post one score: their first run counts; later runs are practice.</p>
      <LinkBox id={id} label="Challenge link" />
    </>
  );

  if (seat) {
    const other = otherSeat(seat);
    const theirs = d.runs[other];
    const mineNow = d.runs[seat].finished ? d.runs[seat] : mine ?? d.runs[seat];
    const over = d.status === "done" || (mineNow.finished && theirs.finished);
    const res = outcome(mineNow, theirs);
    const verdict = !mineNow.finished ? "Your run is starting…"
      : !over ? `Your run is over: ${mineNow.solves} opened. Waiting for ${seatName(d, other)} to finish (${theirs.solves} so far)…`
      : !theirs.finished ? `${seatName(d, other)} didn't finish. ${res === "a" ? "You win" : res === "b" ? "They win on what they reported" : "A draw"}.`
      : res === "a" ? "You win!" : res === "b" ? `${seatName(d, other)} wins.` : "A draw.";
    const why = over && theirs.finished && mineNow.solves === theirs.solves && mineNow.fails !== theirs.fails ? " Same number of locks; fewer failed tries breaks the tie." : "";
    return (
      <>
        {interrupted ? <p className="race-err">The page reloaded during your run, so your run ended there.</p> : null}
        <p className={`race-big${over && res === "a" ? " good" : ""}`} aria-live="polite">{verdict}{why}</p>
        <ResultTable caption="This race" rows={(["a", "b"] as const).map(s => ({ key: s, name: seatName(d, s), run: s === seat ? mineNow : d.runs[s], me: s === seat, note: (s === seat ? mineNow : d.runs[s]).finished ? undefined : "racing…" }))} />
        {over ? (
          <div className="controls">
            <button className="btn primary" type="button" disabled={R.busy} onClick={() => void R.rematch()}>{d.next ? "Join the rematch" : "Rematch"}</button>
            <button className="btn" type="button" onClick={() => onChallenge(true)}>Play these locks again (practice)</button>
            <a className="race-link" href="#/lock/race">New race</a>
          </div>
        ) : null}
        {board}
      </>
    );
  }

  const myScore = R.scores.find(s => s.uid === R.uid);
  return (
    <>
      {challengeFinal ? (
        <p className="race-big good" aria-live="polite">
          {`You opened ${challengeFinal.run.solves} lock${challengeFinal.run.solves === 1 ? "" : "s"} with ${challengeFinal.run.fails} failed tr${challengeFinal.run.fails === 1 ? "y" : "ies"}.`}
          {challengeFinal.counted ? " Your score is on the board." : " That was practice; your first run is the one that counts."}
        </p>
      ) : (
        <p className="race-big">{d.status === "running" ? "This race is on right now." : "This race is over."} Play the same locks against the clock and see where you'd have finished.</p>
      )}
      <div className="controls">
        <button className="btn primary" type="button" disabled={R.busy} onClick={() => void onChallenge(false)}>{myScore ? "Play again (practice)" : "Play this challenge"}</button>
        <a className="race-link" href="#/lock/race">Make your own race</a>
      </div>
      {!myScore ? <p className="race-small">{R.name ? `Your score goes on the board as ${R.name}.` : "Your score goes on the board as Challenger. Sign in with Google to show your name."} Only your first run counts.</p> : null}
      {board}
    </>
  );
}

