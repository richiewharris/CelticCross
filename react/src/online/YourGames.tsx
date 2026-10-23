// "Your games": every online game you're in, grouped by whose move it is, with links back in.
import { useState } from "react";
import { GameScope } from "../kit/GameScope";
import { gameById } from "../games/registry";
import { AccountLine } from "./AccountLine";
import { inviteUrl, onlineHash } from "./route";
import { isMyTurn, useMyGames, type MyGames } from "./useMyGames";
import type { OnlineGameSummary } from "./types";
import "./online.css";

/** Seat names for each online game (kept here so this page doesn't load every game's code). */
const SEATS: Record<string, Record<string, string>> = {
  monsiv: { white: "White", black: "Black" },
  cnoc: { host: "Host", si: "Sí" },
  fidchell: { gold: "Gold", white: "White" },
};
const seatName = (game: string, seat: string | undefined) => (seat ? SEATS[game]?.[seat] ?? seat : "?");

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

function Row({ g, uid, kind }: { g: OnlineGameSummary; uid: string | null; kind: "mine" | "theirs" | "open" | "done" }) {
  const d = g.doc, title = gameById(d.game)?.title ?? d.game;
  const mySeat = Object.keys(d.seats).find(k => d.seats[k] === uid);
  const other = Object.keys(d.seats).find(k => k !== mySeat);
  const [copied, setCopied] = useState(false);
  let line: string;
  if (kind === "open") line = `Waiting for a friend to take the ${seatName(d.game, other)} seat`;
  else if (kind === "done") {
    const r = d.result;
    line = !r ? "Finished" : r.winner === null ? "Draw" : r.winner === mySeat ? "You won" : "You lost";
    if (r?.text) line += ` · ${r.text}`;
  } else line = `${d.moves.length} move${d.moves.length === 1 ? "" : "s"} played`;
  const copy = async () => { try { await navigator.clipboard.writeText(inviteUrl(d.game, g.id)); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } };
  return (
    <li className={`yg-row ${kind}`}>
      <a className="yg-main" href={onlineHash(d.game, g.id)}>
        <span className="yg-title">{title}<span className="yg-side"> · you play {seatName(d.game, mySeat)}</span></span>
        <span className="yg-line">{line}</span>
      </a>
      <span className="yg-when">{ago(d.updatedAt)}</span>
      {kind === "open" ? <button type="button" className="yg-copy" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button>
        : <a className="yg-open" href={onlineHash(d.game, g.id)}>{kind === "mine" ? "Play" : kind === "done" ? "View" : "Open"}</a>}
    </li>
  );
}

function Section({ title, games, uid, kind, empty }: { title: string; games: OnlineGameSummary[]; uid: string | null; kind: "mine" | "theirs" | "open" | "done"; empty?: string }) {
  if (!games.length && !empty) return null;
  return (
    <section className="yg-section" aria-label={title}>
      <h2>{title}{games.length ? <span className="yg-count">{games.length}</span> : null}</h2>
      {games.length ? <ul>{games.map(g => <Row key={g.id} g={g} uid={uid} kind={kind} />)}</ul> : <p className="yg-empty">{empty}</p>}
    </section>
  );
}

export function groupGames(v: MyGames) {
  const live = v.games.filter(g => g.doc.status !== "done");
  return {
    mine: live.filter(g => isMyTurn(g, v.uid)),
    theirs: live.filter(g => g.doc.status === "active" && !isMyTurn(g, v.uid)),
    open: live.filter(g => g.doc.status === "open"),
    done: v.games.filter(g => g.doc.status === "done").slice(0, 12),
  };
}

export function YourGames() {
  const v = useMyGames(true);
  const G = groupGames(v);
  const none = v.state === "ready" && !v.games.length;
  return (
    <GameScope id="home">
      <div className="home yg online">
        <header>
          <h1>Your games</h1>
          <p className="lede">Your online games of Monsiv, Cnoc and Fidchell. Pick one up where you left off.</p>
        </header>
        <AccountLine />
        {v.state === "loading" || v.state === "idle" ? <p className="yg-empty" aria-live="polite">Loading your games…</p> : null}
        {v.state === "error" ? <p className="online-error" role="alert">{v.error}</p> : null}
        {none ? (
          <p className="yg-empty">No online games yet. Open <a href="#/monsiv">Monsiv</a>, <a href="#/cnoc">Cnoc</a> or <a href="#/fidchell">Fidchell</a>, choose Online and make an invite link.
            {v.account?.anonymous !== false ? " If you played on another device, sign in with Google there and here to see the same games." : ""}</p>
        ) : null}
        {v.state === "ready" && v.games.length ? (
          <>
            <Section title="Your move" games={G.mine} uid={v.uid} kind="mine" empty="Nothing waiting on you." />
            <Section title="Their move" games={G.theirs} uid={v.uid} kind="theirs" />
            <Section title="Waiting for a friend to join" games={G.open} uid={v.uid} kind="open" />
            <Section title="Finished" games={G.done} uid={v.uid} kind="done" />
          </>
        ) : null}
      </div>
    </GameScope>
  );
}

/** The top-bar link, with a count of games waiting on your move. */
export function YourGamesLink({ current }: { current: boolean }) {
  const v = useMyGames(false);
  const mine = v.games.filter(g => isMyTurn(g, v.uid)).length;
  if (v.state === "idle" && !current) return null;
  return (
    <a href="#/games" className="yg-link" aria-current={current ? "page" : undefined}
      aria-label={mine ? `Your games: ${mine} waiting on your move` : "Your games"}>
      Your games{mine ? <span className="yg-badge" aria-hidden="true">{mine}</span> : null}
    </a>
  );
}
