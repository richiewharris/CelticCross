// The Muster, from your seat: the four cards you drew, the one you're deciding on, and where it can go. Counters show
// what your hand still needs (the Muster won't let you finish short of it).
import type { CardDef } from "../engine/cards";
import { musterNeeds, type Decision, type Option, type Side, type State } from "../engine/engine";
import { cardName } from "../text";
import { CardFace } from "./Card";

type MusterOpt = Extract<Option, { t: "muster" }>;

export function MusterView(props: { S: State; me: Side; d: Decision | null; onPick?: (i: number) => void; onFocusCard?: (d: CardDef) => void }) {
  const { S, me, d } = props;
  const P = S.players[me];
  const mine = !!d && d.kind === "muster" && d.player === me && !!props.onPick;
  const count = (t: string) => P.hand.filter((c) => c.def.type === t || (t === "hero" && c.def.type === "host")).length;
  const needs = musterNeeds(P);
  const meters = [
    ...needs.map((q) => ({ label: q.label, have: count(q.t), of: q.n, need: true })),
    { label: "in hand", have: P.hand.length, of: S.rules.handSize, need: false },
    { label: "omens", have: P.omens.length, of: S.rules.omenSpots, need: false },
  ];
  const opts = mine ? d!.options.map((o, i) => ({ o: o as MusterOpt, i })) : [];
  const label = (o: MusterOpt) => (o.how === "keep" ? "Keep in hand" : o.how === "aside" ? "Set aside for the Reserve" : o.swap !== undefined ? `Put it in place of ${cardName(S, o.swap)}` : "Put it in an Omen spot");
  const waiting = S.musterP !== me;
  return (
    <section className="muster" aria-label="The Muster">
      <div className="muster-meters" role="list" aria-label="Your hand so far">
        {meters.map((m) => (
          <span key={m.label} role="listitem" className={`meter${m.need ? (m.have >= m.of ? " met" : " short") : ""}`}>
            <b>{m.have}</b>/{m.of} {m.label}
          </span>
        ))}
        <span className="meter quiet"><b>{P.reserve.length}</b> set aside · <b>{P.deck.length}</b> still to draw</span>
      </div>
      {waiting ? (
        <p className="muster-wait">{S.musterP === me ? "" : "The computer is drawing its Muster."}</p>
      ) : (
        <>
          <p className="muster-help">You drew {P.musterQ.length === 4 ? "four cards" : `these (${P.musterQ.length} left of four)`}. Decide each in turn: keep it in hand, or set it aside for the Reserve, where you can draw it in a duel. Omens go face down in your Omen spots.</p>
          <div className="muster-draw">
            {P.musterQ.map((c, k) => (
              <div key={c.uid} className={`muster-card${k === 0 ? " now" : ""}`}>
                <CardFace def={c.def} owner="mine" onFocusCard={props.onFocusCard} selected={k === 0} />
                {k === 0 && mine ? <span className="muster-now">Deciding</span> : null}
              </div>
            ))}
          </div>
          {mine ? (
            <div className="muster-actions">
              {opts.map(({ o, i }) => (
                <button key={i} type="button" className={`btn ${o.how === "aside" ? "" : "primary"}`} onClick={() => props.onPick!(i)}>{label(o)}</button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
