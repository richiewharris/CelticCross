// The zoomed view of the wheel as a straight lane: the enemy quadrant across the ford on top, yours below, each a hero
// and its two supports, in the same order as the duel. The spot in play is marked; spots you can act on are buttons.
import type { CardDef } from "../engine/cards";
import { isHeroSpot, ownerOfSpot, quadOf, type Side, type State } from "../engine/engine";
import { CardFace } from "./Card";
import { Icon } from "./Icons";
import { spotValour, type Mark } from "./Wheel";

function Spot(props: { S: State; me: Side; spot: number; mark?: Mark; onSpot?: (spot: number) => void; onFocusCard?: (d: CardDef) => void }) {
  const { S, me, spot, mark } = props;
  const c = S.board[spot];
  const hero = isHeroSpot(spot);
  const q = quadOf(spot);
  const geis = hero ? S.quadGeis[q] : null, oath = hero ? S.quadOath[q] : null;
  const omens = hero ? S.players.flatMap((P) => P.omens.filter((o) => o.faceUp && o.target === spot).map((o) => o.card.def.name)) : [];
  const val = spotValour(S, spot);
  const click = props.onSpot && mark && mark !== "faced" && mark !== "duel" ? () => props.onSpot!(spot) : undefined;
  const desc = `Spot ${spot + 1}${c ? `: ${c.def.name}` : ", empty"}${geis ? `, bound by ${geis.def.name}` : ""}${oath ? `, sworn to ${oath.def.name}` : ""}`;
  return (
    <div className={`lane-spot${hero ? " hero" : ""}${mark ? " m-" + mark : ""}${ownerOfSpot(spot) === me ? " my-half" : " their-half"}`}>
      <span className="lane-no" aria-hidden="true">{spot + 1}{mark === "faced" ? " · you face this" : mark === "target" ? " · placing here" : ""}</span>
      {c ? (
        <CardFace def={c.def} owner={c.owner === me ? "mine" : "theirs"} onFocusCard={props.onFocusCard} onClick={click} playable={!!click} label={desc} />
      ) : click ? (
        <button type="button" className="empty-spot" aria-label={desc} onClick={click}>+</button>
      ) : (
        <div className="empty-spot" role="img" aria-label={desc}>{hero ? "hero" : "support"}</div>
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

export function FordLane(props: {
  S: State; me: Side; mine: number; marks?: Map<number, Mark>; onSpot?: (spot: number) => void; onFocusCard?: (d: CardDef) => void;
}) {
  const { S, me } = props;
  const myQ = props.mine, theirQ = (myQ + 2) % 4;
  const row = (q: number) => [q * 3, q * 3 + 1, q * 3 + 2].map((s) => (
    <Spot key={s} S={S} me={me} spot={s} mark={props.marks?.get(s)} onSpot={props.onSpot} onFocusCard={props.onFocusCard} />
  ));
  return (
    <div className="lane" role="group" aria-label={`Spots ${theirQ * 3 + 1}–${theirQ * 3 + 3} across the ford from spots ${myQ * 3 + 1}–${myQ * 3 + 3}`}>
      <div className="lane-row theirs">{row(theirQ)}</div>
      <div className="lane-ford" aria-hidden="true"><span>the ford</span></div>
      <div className="lane-row mine">{row(myQ)}</div>
    </div>
  );
}
