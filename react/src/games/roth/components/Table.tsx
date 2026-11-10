// The whole table from one seat: the enemy's hand and omens, the wheel, your omens and your hand.
import { useState, type ReactNode } from "react";
import { useStoredState } from "../../../kit/useStoredState";
import type { CardDef } from "../engine/cards";
import { draftSpot, facedSpot, ownerOfSpot, quadOf, type Decision, type Option, type Side, type State } from "../engine/engine";
import { CardFace } from "./Card";
import { DuelView, MoveTicker } from "./DuelView";
import type { MoveEvent } from "../useMatch";
import { MusterView } from "./MusterView";
import { FordLane } from "./FordLane";
import { Icon } from "./Icons";
import { Legend } from "./Panels";
import { globalGeasa } from "../text";
import { Wheel, type Mark } from "./Wheel";

/** The spot the zoomed wheel turns to the front: the one you're filling or facing. */
function focusSpot(S: State, me: Side, d: Decision | null): number | null {
  if (S.phase === "draft") {
    if (d && d.player === me && d.spot !== undefined) return d.spot;
    const s = draftSpot(Math.min(S.step, 6), me);
    return S.board[s] ? d?.spot ?? null : s;
  }
  if (S.phase === "play" && S.step <= 6) return facedSpot(S.step, me, S.reversed);
  return null;
}

export type Sel = { uid?: number; spot?: number } | null;

const uidOf = (o: Option): number | undefined => ("uid" in o ? (o as { uid: number }).uid : undefined);
/** The options a picked card or spot narrows the choice to. */
export function selFilter(sel: Sel): ((o: Option) => boolean) | null {
  if (!sel) return null;
  if (sel.uid !== undefined) return (o) => uidOf(o) === sel.uid;
  if (sel.spot !== undefined) return (o) => o.t === "duel" && o.act === "use" && o.spot === sel.spot;
  return null;
}
/** A spot clicked while a card is picked: the option that aims that card there, if any. */
export function optionAt(d: Decision, sel: Sel, spot: number): number {
  if (!sel || sel.uid === undefined) return -1;
  return d.options.findIndex((o) => uidOf(o) === sel.uid && ((o.t === "omen" || o.t === "late") ? o.target === spot : o.t === "swear" ? o.spot === spot : false));
}

function phaseText(S: State): string {
  switch (S.phase) {
    case "muster": return "The Muster";
    case "draft": return `Drafting · step ${S.step}`;
    case "play": return `${S.reversed ? "Backwards round" : "Playing turn"} · step ${Math.min(S.step, 6)}`;
    case "late": return "Omens before combat";
    case "combat": return S.combat ? `The Ford · ${S.combat.duel === 2 ? "the final duel" : `duel ${S.combat.duel + 1}`}${S.combat.stage === "done" ? "" : ` · turn ${S.combat.turn + 1}`}` : "The Ford";
    default: return "Match over";
  }
}

export function Table(props: {
  S: State; me: Side; d: Decision | null; sel: Sel; onCard?: (uid: number) => void; onSpot?: (spot: number) => void;
  onFocusCard?: (d: CardDef) => void; names?: [string, string];
  /** Picks an option of the pending decision directly (the Muster's buttons). */
  onPick?: (i: number) => void;
  /** Shown right under the wheel (the drafting slider). */
  afterWheel?: ReactNode;
  /** Recent moves, for the duel's ticker and to pulse the support just used. */
  last?: MoveEvent[];
}) {
  const { S, me, d, sel } = props;
  const [wide, setWide] = useState(false);
  const [fullHand, setFullHand] = useStoredState<boolean>("roth-react-fullhand", false);
  const small = !fullHand;
  const mineToAct = !!d && d.player === me && !!props.onCard;
  const playable = new Set<number>();
  const marks = new Map<number, Mark>();
  if (d) {
    if (mineToAct) for (const o of d.options) { const u = uidOf(o); if (u !== undefined) playable.add(u); }
    if (d.kind === "place" && d.spot !== undefined) marks.set(d.spot, "target");
    if (d.kind === "action" && d.spot !== undefined) marks.set(d.spot, "faced");
    if (d.kind === "duel" && S.combat) {
      for (const s of S.combat.hs) marks.set(s, "duel");
      if (mineToAct) for (const o of d.options) if (o.t === "duel" && o.act === "use") marks.set(o.spot, "choosable");
    }
    if (mineToAct && sel?.uid !== undefined) {
      for (const o of d.options) {
        if (uidOf(o) !== sel.uid) continue;
        if ((o.t === "omen" || o.t === "late") && o.target !== undefined) marks.set(o.target, "choosable");
        if (o.t === "swear") marks.set(o.spot, "choosable");
      }
    }
    if (sel?.spot !== undefined) marks.set(sel.spot, "chosen");
  }
  const focus = focusSpot(S, me, d);
  const duel = S.phase === "combat" && !!S.combat;
  const usable = new Set<number>();
  if (mineToAct && d?.kind === "duel") for (const o of d.options) if (o.t === "duel" && o.act === "use") usable.add(o.spot);
  const them = (1 - me) as Side;
  const P = S.players[me], O = S.players[them];
  const omenRow = (p: Side) => S.players[p].omens.map((o) => {
    const mine = p === me;
    const shown = mine || o.faceUp;
    const target = o.target !== undefined ? `on ${S.board[o.target]?.def.name ?? "spot " + (o.target + 1)}` : undefined;
    return (
      <CardFace key={o.card.uid} def={shown ? o.card.def : { type: "unknown", id: "unknown", name: "?" }} owner={mine ? "mine" : "theirs"}
        variant={mine && !small ? "full" : "compact"} faceDown={mine && !o.faceUp} badge={o.faceUp ? target : mine && !o.faceUp && small ? "face down" : undefined} onFocusCard={props.onFocusCard}
        playable={mine && playable.has(o.card.uid)} selected={sel?.uid === o.card.uid}
        onClick={mine && playable.has(o.card.uid) ? () => props.onCard!(o.card.uid) : undefined} />
    );
  });
  return (
    <div className="table">
      {O.hand.length || O.omens.length ? (
        <div className="zone theirs" aria-label={`${props.names?.[1] ?? "The computer"}'s hand and omens`}>
          <span className="zone-label">{props.names?.[1] ?? "The computer"}: {O.hand.length} in hand</span>
          <div className="omens">{omenRow(them)}</div>
        </div>
      ) : null}
      <div className="view-bar">
        <span className="phase-line">{phaseText(S)}{S.globalGeis.length ? ` · on every hero: ${globalGeasa(S, me).map((g) => g.text).join(", ")}` : ""}</span>
        <details className="legend-pop">
          <summary aria-label="What the icons mean">?</summary>
          <Legend />
        </details>
        {focus !== null || duel ? (
          <button type="button" className="btn quiet small" aria-pressed={wide} onClick={() => setWide(!wide)}>
            {wide ? (duel ? "Back to the duel" : "Close up") : "Whole wheel"}
          </button>
        ) : null}
      </div>
      {S.phase === "muster" ? (
        <MusterView S={S} me={me} d={d} onPick={props.onPick} onFocusCard={props.onFocusCard} />
      ) : duel && !wide ? (
        <>
          {props.last?.length ? <MoveTicker last={props.last} /> : null}
          <DuelView S={S} me={me} usable={usable} chosen={sel?.spot} onSpot={props.onSpot} onFocusCard={props.onFocusCard}
            lastSpot={(() => { const e = props.last?.[props.last.length - 1]; return e && e.spot !== undefined ? { spot: e.spot, n: e.n } : undefined; })()} />
        </>
      ) : !wide && focus !== null ? (
        <FordLane S={S} me={me} mine={ownerOfSpot(focus) === me ? quadOf(focus) : (quadOf(focus) + 2) % 4} marks={marks} onSpot={props.onSpot} onFocusCard={props.onFocusCard} />
      ) : (
        <Wheel S={S} me={me} marks={marks} onSpot={props.onSpot} onFocusCard={props.onFocusCard}
          focus={null}
          // your spot at the bottom centre: the one you're filling, or yours across from the spot you face
          front={focus === null ? null : ownerOfSpot(focus) === me ? focus : (focus + 6) % 12}
          chord={focus !== null && S.phase === "play" ? [focus, (focus + 6) % 12] : undefined}
          center={(
            <>
              {globalGeasa(S, me).map((g) => <span key={g.key} className="tag geis global" title={g.text}><Icon name="global" /> {g.text}</span>)}
            </>
          )} />
      )}
      {props.afterWheel}
      {S.attendants?.length ? (
        <div className="zone attendants" aria-label="Attendants in play">
          <span className="zone-label">Attendants in play</span>
          <div className="omens">
            {S.attendants.map((c) => <CardFace key={c.uid} def={c.def} owner={c.owner === me ? "mine" : "theirs"} badge={c.owner === me ? "yours" : "theirs"} onFocusCard={props.onFocusCard} />)}
          </div>
        </div>
      ) : null}
      <div className="zone mine" aria-label="Your omens and hand">
        {P.omens.length ? <><span className="zone-label">{props.names?.[0] ?? "You"}: omens</span><div className="omens">{omenRow(me)}</div></> : null}
        {P.hand.length ? (
          <span className="zone-label">Hand · {P.hand.length} <small className="hint">swipe a card down to read it in full</small>
            <button type="button" className="btn quiet small hand-size" aria-pressed={fullHand} onClick={() => setFullHand(!fullHand)}>{fullHand ? "Small cards" : "Full cards"}</button>
          </span>
        ) : null}
        <div className={`hand${small ? " small" : ""}`}>
          {P.hand.map((c) => (
            <CardFace key={c.uid} def={c.def} owner="mine" variant={small ? "compact" : "full"} onFocusCard={props.onFocusCard}
              playable={playable.has(c.uid)} selected={sel?.uid === c.uid}
              onClick={playable.has(c.uid) ? () => props.onCard!(c.uid) : undefined} />
          ))}
        </div>
      </div>
      {S.phase === "muster" ? null : <details className="all-cards">
        <summary>Every card on the wheel</summary>
        {[0, 1, 2, 3].map((q) => (
          <div key={q} className="quad-row">
            <span className="zone-label">Spots {q * 3 + 1}–{q * 3 + 3}{(q < 2 ? 0 : 1) === me ? " (yours)" : " (theirs)"}
              {S.quadGeis[q] ? ` · bound by ${S.quadGeis[q]!.def.name}` : ""}{S.quadOath[q] ? ` · sworn to ${S.quadOath[q]!.def.name}` : ""}</span>
            <div className="hand">
              {[0, 1, 2].map((k) => {
                const c = S.board[q * 3 + k];
                return c ? <CardFace key={k} def={c.def} owner={c.owner === me ? "mine" : "theirs"} onFocusCard={props.onFocusCard} /> : <div key={k} className="empty-spot">empty</div>;
              })}
            </div>
          </div>
        ))}
      </details>}
    </div>
  );
}
