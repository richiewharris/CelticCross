// The duel at the ford, up close: each fighter as a full card with its Valour and Shield, its geis and oath,
// and the two supports of its quadrant (used ones dimmed). Your side at the bottom.
import type { CardDef } from "../engine/cards";
import { actorOf, effSupport, effWeakness, fighter, ownerOfSpot, quadOf, supportReady, toDeath, type Side, type State } from "../engine/engine";
import { reuseOf, type SupportDef } from "../engine/cards";
import { CardFace } from "./Card";
import { Icon } from "./Icons";
import { globalGeasa } from "../text";

const sdOf = (d: CardDef) => d as SupportDef;
/** What a used support is waiting for before it can be used again. */
function waitText(s: SupportDef, n: number): string {
  const r = reuseOf(s);
  const w = [r.turns ? "a turn between" : null, r.rest ? `a rest` : null, r.valour ? `${r.valour} Valour` : null, r.draw ? "a card off the Reserve" : null].filter(Boolean);
  return `used ×${n}${w.length ? ` · again: ${w.join(", ")}` : ""}`;
}

export function DuelView(props: {
  S: State; me: Side; usable?: Set<number>; chosen?: number; onSpot?: (spot: number) => void; onFocusCard?: (d: CardDef) => void;
}) {
  const { S, me } = props;
  const C = S.combat;
  if (!C) return null;
  const death = toDeath(S);
  const side = (p: Side) => {
    const hs = C.hs[p];
    const q = quadOf(hs);
    const f = fighter(S, C, p);
    const hero = S.board[hs]!;
    const geis = S.quadGeis[q], oath = S.quadOath[q];
    const omens = S.players.flatMap((P) => P.omens.filter((o) => o.faceUp && o.target === hs).map((o) => o.card.def));
    const done = C.stage === "done";
    const v = done ? C.endValour[C.duel][p] : Math.max(0, C.valour[p]);
    const sh = done ? 0 : C.shield[p];
    const felled = done ? C.felled[C.duel][p] : C.valour[p] <= 0;
    const mine = p === me;
    return (
      <div className={`duel-side ${mine ? "mine" : "theirs"}${felled ? " felled" : ""}${!done && (death || C.turn < 4) && actorOf(C) === p ? " acting" : ""}`}>
        <div className="duel-fighter">
          <CardFace def={f} owner={hero.owner === me ? "mine" : "theirs"} onFocusCard={props.onFocusCard} label={`${f.name}, ${mine ? "your" : "the enemy's"} fighter: Valour ${v}${sh ? `, Shield ${sh}` : ""}`} />
          <div className="duel-meter" aria-hidden="true">
            <span className="hearts">{Array.from({ length: Math.max(v, 0) }, (_, i) => <Icon key={i} name="valour" />)}{v === 0 ? "felled" : ""}</span>
            {sh ? <span className="shields">{Array.from({ length: sh }, (_, i) => <Icon key={i} name="shield" />)}</span> : null}
            <span className="cap">of {C.cap[p]}</span>
          </div>
          {death ? <p className="duel-pile">Reserve {S.players[p].reserve.length} · discards {S.players[p].discard.length}</p> : null}
          <div className="duel-tags">
            {C.champ[p] ? <span className="tag champ">standing in for {hero.def.name}</span> : null}
            {geis ? <span className="tag geis">⊘ {geis.def.name}</span> : null}
            {globalGeasa(S, me).map((g) => <span key={g.key} className="tag geis">⊘ {g.text}</span>)}
            {oath ? <span className="tag oath">✠ {oath.def.name}</span> : null}
            {omens.map((o, i) => <span key={i} className="tag omen">☽ {o.name}</span>)}
            {(() => { const printed = f.weaknesses ?? (f.weakness ? [f.weakness] : []); const w = effWeakness(S, p, f).filter((x) => !printed.includes(x)); return w.length ? <span className="tag attendant">cursed: also weak to {w.join(", ")}</span> : null; })()}
          </div>
        </div>
        <div className="duel-supports">
          {[hs + 1, hs + 2].map((s) => {
            const c = S.board[s];
            if (!c) return <div key={s} className="empty-spot">empty</div>;
            const used = death ? !!C.uses[s] && !(C.drawn === null && supportReady(S, C, p, s)) && !done : !!(C.used & (1 << s));
            const again = death && C.uses[s] ? (used ? waitText(sdOf(c.def), C.uses[s]) : `used ×${C.uses[s]}, ready`) : null;
            const can = props.usable?.has(s);
            const sd = c.def as SupportDef;
            const eff = effSupport(S, p, sd);
            const turned = eff !== sd ? `counts as ${[eff.element !== sd.element ? eff.element : null, eff.kind !== sd.kind ? eff.kind : null].filter(Boolean).join(" ")}${(eff.channel ?? 0) + (eff.attuned ?? 0) ? `, +${(eff.channel ?? 0) + (eff.attuned ?? 0)}` : ""}` : null;
            return (
              <CardFace key={s} def={c.def} owner={c.owner === me ? "mine" : "theirs"} dim={used} playable={can} selected={props.chosen === s}
                badge={death ? [again, c.owner !== ownerOfSpot(s) ? "supplanted in" : null, turned].filter(Boolean).join(" · ") || undefined
                  : used ? "used" : [c.owner !== ownerOfSpot(s) ? "supplanted in" : null, turned].filter(Boolean).join(" · ") || undefined}
                onFocusCard={props.onFocusCard} onClick={can && props.onSpot ? () => props.onSpot!(s) : undefined} />
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <div className="duel" role="group" aria-label={`Duel ${C.duel + 1}`}>
      {side((1 - me) as Side)}
      <div className="duel-ford" aria-hidden="true"><span>the ford · {C.duel === 2 ? "the final duel" : `duel ${C.duel + 1}`}{C.stage === "done" ? "" : death ? ` · turn ${C.turn + 1}` : ` · turn ${Math.min(C.turn + 1, 4)} of 4`}</span></div>
      {C.drawn ? (
        <div className="duel-drawn">
          <span className="zone-label">{actorOf(C) === me ? "You drew" : "The enemy drew"}</span>
          <CardFace def={C.drawn.def} owner={C.drawn.owner === me ? "mine" : "theirs"} selected onFocusCard={props.onFocusCard} />
        </div>
      ) : null}
      {side(me)}
    </div>
  );
}
