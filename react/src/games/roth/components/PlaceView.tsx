// Drafting: the cards you can put on the spot being filled, as a row to swipe through. Tap a card to bring it to the
// middle and pick it; then confirm. A Slúagh host also asks which of your monsters ride with it.
import { useEffect, useRef } from "react";
import type { CardDef } from "../engine/cards";
import { isHeroSpot, type Decision, type Option, type State } from "../engine/engine";
import { cardName, seatName } from "../text";
import { CardFace } from "./Card";

type PlaceOpt = Extract<Option, { t: "place" }>;

export function PlaceView(props: {
  S: State; d: Decision; sel: number | null; join: string | null;
  onSelect: (uid: number | null, join?: string | null) => void; onPick: (i: number) => void; onFocusCard?: (d: CardDef) => void;
}) {
  const { S, d, sel } = props;
  const P = S.players[d.player];
  const opts = d.options.map((o, i) => ({ o: o as PlaceOpt, i }));
  const uids = [...new Set(opts.map(({ o }) => o.uid))];
  const cards = uids.map((u) => P.hand.find((c) => c.uid === u)!).filter(Boolean);
  const refs = useRef(new Map<number, HTMLElement>());
  useEffect(() => {
    if (sel === null) return;
    refs.current.get(sel)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [sel]);
  const variants = sel === null ? [] : opts.filter(({ o }) => o.uid === sel);
  const key = (o: PlaceOpt) => (o.join ?? []).join(",");
  const chosen = variants.length === 1 ? variants[0] : variants.find(({ o }) => key(o) === props.join) ?? null;
  const seat = seatName(S, d.spot!, d.player), Seat = seat.replace(/^the /, "").replace(/^./, (x) => x.toUpperCase());
  const what = isHeroSpot(d.spot!) ? "hero" : "support";
  return (
    <section className="place" aria-label={`Choose a ${what} for ${seat}`}>
      <p className="place-head"><b>{Seat}</b>: choose a {what}.</p>
      <div className="place-row" role="listbox" aria-label={`${what}s you can place`}>
        {cards.map((c) => (
          <div key={c.uid} ref={(el) => { if (el) refs.current.set(c.uid, el); else refs.current.delete(c.uid); }}
            className={`place-card${sel === c.uid ? " on" : ""}`} role="option" aria-selected={sel === c.uid}>
            <CardFace def={c.def} owner="mine" playable selected={sel === c.uid} onFocusCard={props.onFocusCard}
              onClick={() => props.onSelect(sel === c.uid ? null : c.uid, null)} label={`${c.def.name}${sel === c.uid ? ", picked" : ""}`} />
          </div>
        ))}
      </div>
      {variants.length > 1 ? (
        <div className="place-join" role="radiogroup" aria-label="Monsters to ride with the host">
          <span className="zone-label">Which monsters ride with it?</span>
          {variants.map(({ o, i }) => (
            <button key={i} type="button" role="radio" aria-checked={chosen?.i === i} className={`btn small${chosen?.i === i ? " primary" : ""}`}
              onClick={() => props.onSelect(o.uid, key(o))}>
              {o.join && o.join.length ? o.join.map((u) => cardName(S, u).replace(/^The /, "")).join(", ") : "No monsters"}
            </button>
          ))}
        </div>
      ) : null}
      <div className="place-confirm">
        <button type="button" className="btn primary" disabled={!chosen} onClick={() => chosen && props.onPick(chosen.i)}>
          {chosen ? `Place ${cardName(S, chosen.o.uid)}` : sel !== null ? "Choose its monsters" : "Pick a card"}
        </button>
      </div>
    </section>
  );
}
