// The "Play a friend online" panel: make an invite link, join a seat, follow whose turn it is,
// resign, rematch, and reopen your recent games. The board itself stays with each game.
import { useEffect, useId, useState } from "react";
import { askToNotify, notifyPermission } from "./notify";
import { inviteUrl, leaveOnline, onlineHash } from "./route";
import type { OnlineSession } from "./useOnlineGame";
import type { OnlineAdapter, SeatId } from "./types";
import "./online.css";

export interface OnlinePanelProps<S, M, O> {
  session: OnlineSession<S, M, O>;
  adapter: OnlineAdapter<S, M, O>;
  /** The options a new invite will use (taken from the game's own settings). */
  options: O;
  /** The game's name in sentences ("Cnoc"). */
  title: string;
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function OnlinePanel<S, M, O>({ session: o, adapter, options, title }: OnlinePanelProps<S, M, O>) {
  const name = useId();
  const [seat, setSeat] = useState<SeatId>(adapter.seats[0].id);
  const [copied, setCopied] = useState(false);
  const [perm, setPerm] = useState(notifyPermission);
  const [confirmResign, setConfirmResign] = useState(false);
  const seatLabel = (id: SeatId | null | undefined) => adapter.seats.find(x => x.id === id)?.label ?? String(id);
  const describe = adapter.describeOptions?.(o.doc?.options ?? options);

  useEffect(() => { if (!o.id) void o.loadMyGames(); }, [o.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setConfirmResign(false); }, [o.phase]);

  const errorLine = o.error ? <p className="online-error" role="alert">{o.error}</p> : null;
  const notifyButton = perm === "default" && o.mySeat && o.phase !== "done"
    ? <button className="btn" type="button" onClick={async () => setPerm(await askToNotify())}>Notify me on my move</button> : null;

  // ---- Not in a game: make an invite ----
  if (!o.id) {
    const waiting = (o.myGames ?? []).filter(g => g.doc.status !== "done");
    return (
      <div className="panel online">
        <p className="label">Play a friend online</p>
        <p className="online-note">Make a link and send it to a friend. The game starts when they open it.{describe ? ` Rules: ${describe}.` : ""}</p>
        <div className="online-seats" role="radiogroup" aria-label="Your side">
          {adapter.seats.map(x => (
            <label key={x.id} className={seat === x.id ? "on" : ""}>
              <input type="radio" name={name} checked={seat === x.id} onChange={() => setSeat(x.id)} /> Play the {x.label}
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" type="button" disabled={o.busy} onClick={() => void o.create(options, seat)}>{o.busy ? "Making the link…" : "Make an invite link"}</button>
        </div>
        {errorLine}
        {waiting.length ? (
          <div className="online-list">
            <p className="label">Your online games</p>
            <ul>
              {waiting.map(g => {
                const mine = Object.keys(g.doc.seats).find(k => g.doc.seats[k] === o.uid);
                const state = g.doc.status === "open" ? "waiting for a friend" : g.doc.turn === o.uid ? "your move" : "their move";
                return <li key={g.id}><a href={onlineHash(adapter.game, g.id)}>{`The ${seatLabel(mine)} · ${state}`}</a> <span>{ago(g.doc.updatedAt)}</span></li>;
              })}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const leave = <button className="btn" type="button" onClick={() => leaveOnline(adapter.game)}>Leave online play</button>;

  if (o.phase === "connecting") return <div className="panel online"><p className="label">Online game</p><p className="online-note" aria-live="polite">Connecting…</p></div>;
  if (o.phase === "missing") return <div className="panel online"><p className="label">Online game</p><p className="online-error">This game link doesn't lead to a game. Check that it was copied whole.</p><div className="row">{leave}</div></div>;
  if (o.phase === "error" || !o.doc) return <div className="panel online"><p className="label">Online game</p>{errorLine ?? <p className="online-error">Something went wrong.</p>}<div className="row">{leave}</div></div>;

  const d = o.doc;
  const freeSeats = adapter.seats.filter(x => d.seats[x.id] === null);
  const otherSeat = adapter.seats.find(x => x.id !== o.mySeat);
  const link = inviteUrl(adapter.game, o.id);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };
  const share = async () => { try { await navigator.share({ title: `${title}: a game for you`, text: `Play ${title} with me`, url: link }); } catch { /* cancelled */ } };

  let body;
  if (d.status === "open" && o.mySeat) {
    body = (
      <>
        <p className="online-note" aria-live="polite">You play the {seatLabel(o.mySeat)}. Send this link to your friend; the game starts when they take the {freeSeats.map(x => x.label).join(" and ")} seat.</p>
        <div className="online-link">
          <input readOnly value={link} aria-label="Invite link" onFocus={e => e.currentTarget.select()} />
          <button className="btn primary" type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
          {typeof navigator.share === "function" ? <button className="btn" type="button" onClick={() => void share()}>Share</button> : null}
        </div>
        <div className="row">{notifyButton}{leave}</div>
      </>
    );
  } else if (d.status === "open") {
    body = (
      <>
        <p className="online-note">You've been invited to a game of {title}{describe ? ` (${describe})` : ""}.</p>
        <div className="row">
          {freeSeats.map(x => <button key={x.id} className="btn primary" type="button" disabled={o.busy} onClick={() => void o.join(x.id)}>Play the {x.label}</button>)}
          {leave}
        </div>
      </>
    );
  } else if (d.status === "active") {
    const status = !o.mySeat ? `Watching: the ${seatLabel(Object.keys(d.seats).find(k => d.seats[k] === d.turn))} to move.`
      : o.illegalAt !== null ? "A move broke the rules, so the game has stopped."
      : o.myTurn ? "Your move." : `Waiting for the ${otherSeat?.label ?? "other player"} to move…`;
    body = (
      <>
        <p className={`online-turn${o.myTurn ? " mine" : ""}`} aria-live="polite">{o.mySeat ? `You play the ${seatLabel(o.mySeat)}. ` : ""}{status}</p>
        <div className="row">
          {notifyButton}
          {o.mySeat ? (confirmResign
            ? <><button className="btn" type="button" onClick={() => void o.resign()}>Yes, resign</button><button className="btn" type="button" onClick={() => setConfirmResign(false)}>Keep playing</button></>
            : <button className="btn" type="button" onClick={() => setConfirmResign(true)}>Resign</button>) : null}
          {leave}
        </div>
        {perm === "granted" && o.mySeat ? <p className="online-note small">You'll get a notice when it's your move, while this page is open.</p> : null}
      </>
    );
  } else {
    const r = d.result;
    const verdict = !r ? "The game is over." : r.winner === null ? `A draw. ${r.text}` : o.mySeat ? (r.winner === o.mySeat ? `You win! ${r.text}` : `You lose. ${r.text}`) : `The ${seatLabel(r.winner)} win. ${r.text}`;
    body = (
      <>
        <p className="online-turn" aria-live="polite">{verdict}</p>
        <div className="row">
          {o.mySeat ? <button className="btn primary" type="button" disabled={o.busy} onClick={() => void o.rematch()}>{d.next ? "Join the rematch" : "Rematch (swap sides)"}</button> : null}
          {leave}
        </div>
      </>
    );
  }

  return (
    <div className="panel online">
      <p className="label">Online game</p>
      {body}
      {errorLine}
    </div>
  );
}
