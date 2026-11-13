// The zoomed view of the wheel as a straight lane: the enemy band across the ford on top, yours below, each a hero
// and its two flanks, in the same order as the duel. The seat in play is marked; seats you can act on are buttons.
import { useEffect, useRef, useState } from "react";
import type { CardDef } from "../engine/cards";
import { isHeroSpot, ownerOfSpot, quadOf, type Side, type State } from "../engine/engine";
import { CardFace } from "./Card";
import { Icon } from "./Icons";
import { spotValour, type Mark } from "./Wheel";
import { bandName, seatName, seatShort } from "../text";

function Spot(props: { S: State; me: Side; spot: number; mark?: Mark; onSpot?: (spot: number) => void; onFocusCard?: (d: CardDef) => void; ghost?: CardDef | null }) {
  const { S, me, spot, mark } = props;
  const c = S.board[spot];
  const hero = isHeroSpot(spot);
  const q = quadOf(spot);
  const geis = hero ? S.quadGeis[q] : null, oath = hero ? S.quadOath[q] : null;
  const omens = hero ? S.players.flatMap((P) => P.omens.filter((o) => o.faceUp && o.target === spot).map((o) => o.card.def.name)) : [];
  const val = spotValour(S, spot);
  // the spot you face is a button too: it opens the actions aimed at it
  const click = props.onSpot && mark && mark !== "duel" ? () => props.onSpot!(spot) : undefined;
  const desc = `${seatName(S, spot, me).replace(/^the /, "").replace(/^./, (x) => x.toUpperCase())}${c ? `: ${c.def.name}` : ", empty"}${geis ? `, bound by ${geis.def.name}` : ""}${oath ? `, sworn to ${oath.def.name}` : ""}`;
  return (
    <div className={`lane-spot${hero ? " hero" : ""}${mark ? " m-" + mark : ""}${ownerOfSpot(spot) === me ? " my-half" : " their-half"}`}>
      <span className="lane-no" aria-hidden="true">{seatShort(spot)}{mark === "faced" ? " · before you" : mark === "target" ? " · placing here" : ""}</span>
      {c ? (
        <CardFace def={c.def} owner={c.owner === me ? "mine" : "theirs"} onFocusCard={props.onFocusCard} onClick={click} playable={!!click} label={desc} />
      ) : props.ghost ? (
        <div className="ghost"><CardFace def={props.ghost} owner="mine" label={`${props.ghost.name}, picked for ${seatName(S, spot, me)}`} /></div>
      ) : click ? (
        <button type="button" className="empty-spot" aria-label={desc} onClick={click}>+</button>
      ) : (
        <div className="empty-spot" role="img" aria-label={desc}>{seatShort(spot).toLowerCase()}</div>
      )}
      {geis || oath || omens.length || val ? (
        <div className="lane-tags">
          {val ? <span className="tag"><Icon name="valour" /> {val.v}{val.shield ? <> <Icon name="shield" /> {val.shield}</> : null}</span> : null}
          {geis ? <span className="tag geis"><Icon name="geis" /> {geis.def.name}</span> : null}
          {oath ? <span className="tag oath"><Icon name="oath" /> {oath.def.name}</span> : null}
          {omens.map((n, i) => <span key={i} className="tag omen"><Icon name="omen" /> {n}</span>)}
        </div>
      ) : null}
    </div>
  );
}

/** A quadrant as a fan of three cards, each over the one before by half. The card in play (or the one you pick) comes
 *  to the front; tap a card behind, use the arrows or swipe sideways to bring it forward; tap the front card to act. */
function QuadStack(props: {
  S: State; me: Side; q: number; marks?: Map<number, Mark>; onSpot?: (spot: number) => void; onFocusCard?: (d: CardDef) => void; label: string;
  ghost?: { spot: number; def: CardDef } | null;
}) {
  const spots = [props.q * 3, props.q * 3 + 1, props.q * 3 + 2];
  const marked = spots.findIndex((s) => { const m = props.marks?.get(s); return m === "target" || m === "faced" || m === "chosen" || m === "duel"; });
  const auto = marked >= 0 ? marked : Math.max(0, spots.findIndex((s) => props.marks?.get(s) === "choosable"));
  const [front, setFront] = useState(auto);
  useEffect(() => { setFront(auto); }, [auto, props.q]);
  const from = useRef<number | null>(null);
  const step = (k: number) => setFront((f) => Math.max(0, Math.min(2, f + k)));
  return (
    <div className="qstack-wrap">
      <button type="button" className="qstack-arrow" aria-label={`Show the card before, in ${props.label}`} disabled={front === 0} onClick={() => step(-1)}>‹</button>
      <div className="qstack" role="group" aria-label={props.label}
        onPointerDown={(e) => { from.current = e.clientX; }}
        onPointerUp={(e) => { if (from.current !== null && Math.abs(e.clientX - from.current) > 40) step(e.clientX < from.current ? 1 : -1); from.current = null; }}>
        {spots.map((s, i) => {
          const on = i === front;
          return (
            <div key={s} className={`qslot${on ? " front" : ""}`} style={{ left: `${i * 25}%`, zIndex: on ? 5 : 4 - Math.abs(i - front) }}
              onClickCapture={(e) => { if (!on) { e.stopPropagation(); e.preventDefault(); setFront(i); } }}>
              <div key={on ? `f${s}` : s} className={on ? "qfold" : undefined}>
                <Spot S={props.S} me={props.me} spot={s} mark={props.marks?.get(s)} onSpot={props.onSpot} onFocusCard={props.onFocusCard} ghost={props.ghost?.spot === s ? props.ghost.def : null} />
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="qstack-arrow" aria-label={`Show the next card, in ${props.label}`} disabled={front === 2} onClick={() => step(1)}>›</button>
    </div>
  );
}

export function FordLane(props: {
  S: State; me: Side; mine: number; marks?: Map<number, Mark>; onSpot?: (spot: number) => void; onFocusCard?: (d: CardDef) => void;
  /** The card picked in the drafting slider, shown faintly in the spot it would go to. */
  ghost?: { spot: number; def: CardDef } | null;
}) {
  const { S, me } = props;
  const myQ = props.mine, theirQ = (myQ + 2) % 4;
  return (
    <div className="lane" role="group" aria-label={`${bandName(S, theirQ * 3, me)} across the ford from ${bandName(S, myQ * 3, me)}`}>
      {/* keyed by the quadrant: moving on to the next one turns the lane like the wheel */}
      <div key={`t${theirQ}`} className="lane-row theirs turn-in">
        <QuadStack S={S} me={me} q={theirQ} marks={props.marks} onSpot={props.onSpot} onFocusCard={props.onFocusCard} label={`${bandName(S, theirQ * 3, me)}, across the ford`} />
      </div>
      <div className="lane-ford" aria-hidden="true"><span>the ford</span></div>
      <div key={`m${myQ}`} className="lane-row mine turn-in">
        <QuadStack S={S} me={me} q={myQ} marks={props.marks} onSpot={props.onSpot} onFocusCard={props.onFocusCard} label={bandName(S, myQ * 3, me)} ghost={props.ghost} />
      </div>
    </div>
  );
}
