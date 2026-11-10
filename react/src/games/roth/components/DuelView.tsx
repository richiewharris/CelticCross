// The duel at the ford, up close: each fighter as a full card with its Valour and Shield, its geis and oath,
// and the two supports of its quadrant (used ones dimmed). Your side at the bottom.
import { useEffect, useRef, useState } from "react";
import type { MoveEvent } from "../useMatch";
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

/** True on narrow screens, where the duel uses compact tiles so a whole turn fits on one screen. */
export function useNarrow(max = 760): boolean {
  const q = `(max-width: ${max}px)`;
  const [on, setOn] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const f = () => setOn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [q]);
  return on;
}

/** Valour as pips: filled for what the fighter has, hollow for what it has lost, faint for room to heal; Shield in blue. */
export function ValourBar({ v, start, cap, shield }: { v: number; start: number; cap: number; shield: number }) {
  const top = Math.max(cap, v, start);
  return (
    <span className="vbar" role="img" aria-label={`Valour ${v} of ${start}${cap > start ? `, can heal to ${cap}` : ""}${shield ? `, Shield ${shield}` : ""}`}>
      <span className="vbar-pips" aria-hidden="true">
        {Array.from({ length: top }, (_, i) => <i key={i} className={i < v ? "pip on" : i < start ? "pip lost" : "pip room"} />)}
        {Array.from({ length: shield }, (_, i) => <i key={`s${i}`} className="pip shield" />)}
      </span>
      <span className="vbar-n" aria-hidden="true"><b>{v}</b>/{start}{shield ? <span className="vbar-sh"> +{shield}</span> : null}</span>
    </span>
  );
}

/** The moves since your last one, in words, with what they changed. */
export function MoveTicker({ last }: { last: MoveEvent[] }) {
  let from = last.length - 1;
  while (from > 0 && !last[from].mine) from--;
  const shown = last.slice(Math.max(0, from)).slice(-3);
  if (!shown.length) return null;
  return (
    <div className="ticker" role="log" aria-live="polite" aria-label="The last moves">
      {shown.map((e) => (
        <p key={e.n} className={`tick ${e.mine ? "mine" : "theirs"}`}>
          <span className="tick-text">{e.text}</span>{e.fx ? <span className="tick-fx">{e.fx}</span> : null}
        </p>
      ))}
    </div>
  );
}

/** Floating "−3" / "+2" over a fighter whose Valour or Shield just changed. */
function useFloats(S: State) {
  const C = S.combat;
  const prev = useRef<{ key: string; v: number[]; sh: number[] } | null>(null);
  const [floats, setFloats] = useState<{ p: Side; text: string; kind: string; id: number }[]>([]);
  const key = C ? `${C.duel}:${C.hs[0]}:${C.hs[1]}:${C.champ[0]?.uid ?? ""}:${C.champ[1]?.uid ?? ""}` : "";
  const v = C ? [C.valour[0], C.valour[1]] : [0, 0], sh = C ? [C.shield[0], C.shield[1]] : [0, 0];
  useEffect(() => {
    const was = prev.current;
    prev.current = { key, v, sh };
    if (!was || was.key !== key) return;
    const add: { p: Side; text: string; kind: string; id: number }[] = [];
    for (const p of [0, 1] as Side[]) {
      const dv = v[p] - was.v[p], ds = sh[p] - was.sh[p];
      if (dv) add.push({ p, text: `${dv > 0 ? "+" : "−"}${Math.abs(dv)}`, kind: dv > 0 ? "heal" : "hurt", id: Math.random() });
      if (ds > 0) add.push({ p, text: `+${ds} Shield`, kind: "shield", id: Math.random() });
    }
    if (!add.length) return;
    setFloats((f) => [...f, ...add]);
    const t = setTimeout(() => setFloats((f) => f.filter((x) => !add.includes(x))), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v[0], v[1], sh[0], sh[1]]);
  return floats;
}

export function DuelView(props: {
  S: State; me: Side; usable?: Set<number>; chosen?: number; onSpot?: (spot: number) => void; onFocusCard?: (d: CardDef) => void;
  /** The support used by the last move, to pulse it. */
  lastSpot?: { spot: number; n: number };
}) {
  const { S, me } = props;
  const C = S.combat;
  const floats = useFloats(S);
  const narrow = useNarrow();
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
      <div className={`duel-side ${mine ? "mine" : "theirs"}${felled ? " felled" : ""}${!done && (death || C.turn < 4) && actorOf(C) === p ? " acting" : ""}${floats.some((x) => x.p === p && x.kind === "hurt") ? " hit" : ""}`}>
        {floats.filter((x) => x.p === p).map((x) => <span key={x.id} className={`float ${x.kind}`} aria-hidden="true">{x.text}</span>)}
        <div className="duel-fighter">
          <div className="duel-portrait">
            <CardFace def={f} owner={hero.owner === me ? "mine" : "theirs"} variant={narrow ? "compact" : "full"} onFocusCard={props.onFocusCard} label={`${f.name}, ${mine ? "your" : "the enemy's"} fighter: Valour ${v}${sh ? `, Shield ${sh}` : ""}`} />
          </div>
          <div className="duel-info">
            <p className="duel-name"><b>{f.name}</b> <small>{mine ? "you" : "the enemy"} · Initiative {C.init[p]}{felled ? " · felled" : ""}</small></p>
            <ValourBar v={v} start={C.startV[C.duel]?.[p] || v} cap={C.cap[p]} shield={sh} />
            {death ? <p className="duel-pile"><Icon name="omen" /> Reserve {S.players[p].reserve.length} · discards {S.players[p].discard.length}</p> : null}
          <div className="duel-tags">
            {C.champ[p] ? <span className="tag champ"><Icon name="champion" /> standing in for {hero.def.name}</span> : null}
            {geis ? <span className="tag geis"><Icon name="geis" /> {geis.def.name}</span> : null}
            {globalGeasa(S, me).map((g) => <span key={g.key} className="tag geis"><Icon name="global" /> {g.text}</span>)}
            {oath ? <span className="tag oath"><Icon name="oath" /> {oath.def.name}</span> : null}
            {omens.map((o, i) => <span key={i} className="tag omen"><Icon name="omen" /> {o.name}</span>)}
            {(() => { const printed = f.weaknesses ?? (f.weakness ? [f.weakness] : []); const w = effWeakness(S, p, f).filter((x) => !printed.includes(x)); return w.length ? <span className="tag attendant">cursed: also weak to {w.join(", ")}</span> : null; })()}
          </div>
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
              <div key={props.lastSpot?.spot === s ? `${s}-${props.lastSpot.n}` : s} className={`sup-wrap${props.lastSpot?.spot === s ? " pulse" : ""}`}>
              <CardFace def={c.def} owner={c.owner === me ? "mine" : "theirs"} variant={narrow ? "compact" : "full"} dim={used} playable={can} selected={props.chosen === s}
                badge={death ? [again, c.owner !== ownerOfSpot(s) ? "supplanted in" : null, turned].filter(Boolean).join(" · ") || undefined
                  : used ? "used" : [c.owner !== ownerOfSpot(s) ? "supplanted in" : null, turned].filter(Boolean).join(" · ") || undefined}
                onFocusCard={props.onFocusCard} onClick={can && props.onSpot ? () => props.onSpot!(s) : undefined} />
              </div>
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
