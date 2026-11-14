// The Muster, from your seat: the four cards you drew, the one you're deciding on, and where it can go. Counters show
// what your hand still needs (the Muster won't let you finish short of it).
import type { CardDef } from "../engine/cards";
import { musterNeeds, needsSetting, type Card, type Decision, type Option, type Side, type State } from "../engine/engine";
import { cardName } from "../text";
import { SETTINGS } from "../engine/settings";
import { CardFace } from "./Card";

type MusterOpt = Extract<Option, { t: "muster" }>;

export function MusterView(props: { S: State; me: Side; d: Decision | null; onPick?: (i: number) => void; onFocusCard?: (d: CardDef) => void }) {
  const { S, me, d } = props;
  if (needsSetting(S) && d?.kind === "setting") {
    const mine = !!d && d.kind === "setting" && d.player === me;
    return (
      <section className="muster" aria-label="The setting">
        <p className="muster-help">{mine ? "You are the second player, so you choose where the duels are fought. Pick a setting below; it holds for the whole match." : "The second player is choosing where the duels are fought."}</p>
        <ul className="settings-list">
          {SETTINGS.map((x) => <li key={x.id}><b>{x.name}</b>: {x.text}</li>)}
        </ul>
      </section>
    );
  }
  const P = S.players[me];
  const mine = !!d && d.kind === "muster" && d.player === me && !!props.onPick;
  const needs = musterNeeds(P);
  const opts = mine ? d!.options.map((o, i) => ({ o: o as MusterOpt, i })) : [];
  const label = (o: MusterOpt) => (o.how === "keep" ? "Keep in hand" : o.how === "aside" ? "Set aside for the Reserve" : o.swap !== undefined ? `Put it in place of ${cardName(S, o.swap)}` : "Put it in an Omen spot");
  const waiting = S.musterP !== me;
  /** One line for a card in a list: its name and the gist. */
  const row = (c: Card, extra?: string) => (
    <li key={c.uid}>
      <button type="button" className="ms-row" onClick={() => props.onFocusCard?.(c.def)}>
        <b>{c.def.name}</b><span>{extra ?? gist(c.def)}</span>
      </button>
    </li>
  );
  const groups: { label: string; cards: Card[]; need?: number }[] = [
    { label: needs[0].label, cards: P.hand.filter((c) => c.def.type === "hero" || c.def.type === "host"), need: needs[0].n },
    { label: "supports", cards: P.hand.filter((c) => c.def.type === "support"), need: 4 },
    ...(needs.some((q) => q.t === "monster") ? [{ label: "monsters", cards: P.hand.filter((c) => c.def.type === "monster"), need: 4 }] : []),
    { label: "geasa, oaths and the rest", cards: P.hand.filter((c) => !["hero", "host", "support", "monster"].includes(c.def.type)) },
  ];
  return (
    <section className="muster" aria-label="The Muster">
      <div className="ms-col ms-hand" aria-label="Your hand so far">
        <h3>Hand <small>{P.hand.length} / {S.rules.handSize}</small></h3>
        {groups.map((g) => (g.cards.length || g.need ? (
          <div key={g.label} className="ms-group">
            <p className="ms-glabel">{g.label}{g.need ? <span className={g.cards.length >= g.need ? "met" : "short"}>{Math.min(g.cards.length, g.need)} of {g.need} needed</span> : null}</p>
            {g.need ? <span className="ms-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (100 * g.cards.length) / g.need)}%` }} className={g.cards.length >= g.need ? "met" : ""} /></span> : null}
            <ul>{g.cards.map((c) => row(c))}</ul>
          </div>
        ) : null))}
        <p className="ms-note">You need {needs.map((q) => `${q.n} ${q.label}`).join(" and ")} to fill your half of the wheel. The Muster won't finish short of them.</p>
      </div>
      <div className="ms-col ms-drawn">
        {waiting ? (
          <p className="muster-wait">The computer is drawing its Muster.</p>
        ) : (
          <>
            <h3>Drawn: {P.musterQ.length === 4 ? "four cards" : `${P.musterQ.length} left of four`}</h3>
            <p className="muster-help">Decide each in turn: keep it in hand, or set it aside for the Reserve, where you can draw it in a duel. Omens go face down in your Omen spots.</p>
            <div className="muster-draw">
              {P.musterQ.map((c, k) => (
                <div key={c.uid} className={`muster-card${k === 0 ? " now" : ""}`}>
                  <CardFace def={c.def} owner="mine" onFocusCard={props.onFocusCard} selected={k === 0} />
                  {k === 0 && mine ? (
                    <div className="muster-actions">
                      {opts.map(({ o, i }) => (
                        <button key={i} type="button" className={`btn ${o.how === "aside" ? "" : "primary"}`} onClick={() => props.onPick!(i)}>{label(o)}</button>
                      ))}
                    </div>
                  ) : k === 0 ? null : <span className="muster-next">next</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="ms-col ms-side">
        <h3>Reserve <small>{P.reserve.length} · {P.deck.length} still to draw</small></h3>
        <p className="ms-note">Shuffled before the first duel. On a duel turn you may draw its top card and play it.</p>
        <ul>{P.reserve.map((c) => row(c))}</ul>
        <h3>Omen spots <small>{P.omens.length} / {S.rules.omenSpots}</small></h3>
        <ul className="ms-omens">
          {P.omens.map((o) => row(o.card, "face down"))}
          {Array.from({ length: Math.max(0, S.rules.omenSpots - P.omens.length) }, (_, k) => <li key={`e${k}`} className="ms-empty">empty</li>)}
        </ul>
      </div>
    </section>
  );
}

/** The gist of a card in a few words. */
function gist(d: CardDef): string {
  if (d.type === "hero" || d.type === "champion") return `Valour ${d.valour} · Init ${(d as { init?: number }).init ?? 0}`;
  return (d as { text?: string }).text ?? d.type;
}
