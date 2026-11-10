// The round board: twelve spots in four quadrants (a hero and its two supports), your half nearest you.
// Spot k sits at 15° + 30°·k round the circle, so spots 1 and 7, and 4 and 10, face each other across it.
// Zoomed, the wheel turns so the spot in play comes to the front, and its cards show in full.
import { useRef, type ReactNode } from "react";
import type { CardDef } from "../engine/cards";
import { isHeroSpot, ownerOfSpot, quadOf, type Side, type State } from "../engine/engine";
import { CardFace } from "./Card";
import { Icon } from "./Icons";

export type Mark = "faced" | "target" | "duel" | "choosable" | "chosen";

/** Where a spot's Valour stands now: the duel under way, a finished duel, or still to come. */
export function spotValour(S: State, spot: number): { v: number; shield: number; felled: boolean; live: boolean } | null {
  const C = S.combat;
  const c = S.board[spot];
  if (!isHeroSpot(spot) || !c || c.def.type !== "hero") return null;
  const side = ownerOfSpot(spot);
  if (!C) return null;
  const firstPair = S.reversed ? [3, 9] : [0, 6];
  const d = firstPair.includes(spot) ? 0 : 1;
  if (C.duel === d && C.stage !== "done") return { v: Math.max(0, C.valour[side]), shield: C.shield[side], felled: false, live: true };
  if (C.duel > d || C.stage === "done") return { v: C.endValour[d][side], shield: 0, felled: C.felled[d][side], live: false };
  return null;
}

const Z = 1.3; // zoom factor
const ZR = 35; // spot radius (% of the wheel) when zoomed
const BOX_H = 0.66; // zoomed viewport height / width
const angleOf = (spot: number, turn: number) => 15 + 30 * spot + turn;

export function Wheel(props: {
  S: State; me: Side; marks?: Map<number, Mark>; onSpot?: (spot: number) => void;
  onFocusCard?: (d: CardDef) => void; center?: ReactNode; label?: string; focus?: number | null;
  /** Whole-wheel view: the spot to turn to the bottom centre (where you are). */
  front?: number | null;
  /** Two spots joined by a highlighted line through the hub (your spot and the one you face). */
  chord?: [number, number];
}) {
  const { S, me, marks } = props;
  const turn = me === 0 ? 0 : 180;
  const zoom = props.focus !== undefined && props.focus !== null;
  // turn the wheel so the focus spot sits at the bottom (90°), the short way round from where it was
  const last = useRef(0);
  let rot = 0;
  const toFront = zoom ? props.focus! : props.front ?? null;
  if (toFront !== null) {
    rot = 90 - angleOf(toFront, turn);
    while (rot - last.current > 180) rot -= 360;
    while (rot - last.current < -180) rot += 360;
  }
  last.current = rot;
  const wheelStyle = zoom ? {
    width: `${Z * 100}%`, left: `${(-(Z - 1) / 2) * 100}%`,
    // put the front spot's centre a card's half-height above the bottom edge
    top: `${((BOX_H - 0.16 - (0.5 + ZR / 100) * Z) / BOX_H) * 100}%`,
  } : undefined;
  return (
    <div className={`wheel-box${zoom ? " zoom" : ""}`}>
      <div className="wheel" role="group" aria-label={props.label ?? "The wheel"} style={wheelStyle}>
        <div className="wheel-rot" style={{ transform: `rotate(${rot}deg)` }}>
          <svg className="wheel-bg" viewBox="-50 -50 100 100" aria-hidden="true">
            <circle r="48" className="rim" />
            <circle r="31" className="hub" />
            {[0, 1, 2, 3].map((q) => {
              const a = ((30 * (3 * q) + turn) * Math.PI) / 180;
              return <line key={q} x1={31 * Math.cos(a)} y1={31 * Math.sin(a)} x2={48 * Math.cos(a)} y2={48 * Math.sin(a)} className="spoke" />;
            })}
            {!zoom && props.front == null ? <line x1="-46" y1="0" x2="46" y2="0" className="ford" transform={`rotate(${turn})`} /> : null}
            {props.chord ? (() => {
              const [a, b] = props.chord.map((s) => (angleOf(s, turn) * Math.PI) / 180);
              return <line x1={31 * Math.cos(a)} y1={31 * Math.sin(a)} x2={31 * Math.cos(b)} y2={31 * Math.sin(b)} className="chord" />;
            })() : null}
          </svg>
          {S.board.map((c, spot) => {
            if (zoom && quadOf(spot) !== quadOf(props.focus!)) return null; // zoomed: just the quadrant in play
            const a = (angleOf(spot, turn) * Math.PI) / 180;
            const hero = isHeroSpot(spot);
            const r = zoom ? ZR : hero ? 37 : 38;
            const style = { left: `${50 + r * Math.cos(a)}%`, top: `${50 + r * Math.sin(a)}%` };
            const mark = marks?.get(spot);
            const q = quadOf(spot);
            const geis = hero ? S.quadGeis[q] : null;
            const oath = hero ? S.quadOath[q] : null;
            const omens = hero ? S.players.flatMap((P) => P.omens.filter((o) => o.faceUp && o.target === spot).map((o) => o.card.def.name)) : [];
            const val = spotValour(S, spot);
            const champ = S.combat && val?.live ? S.combat.champ[ownerOfSpot(spot)] : null;
            const owner = c ? (c.owner === me ? "mine" : "theirs") : undefined;
            const click = props.onSpot && mark && mark !== "faced" && mark !== "duel" ? () => props.onSpot!(spot) : undefined;
            const desc = `Spot ${spot + 1}${c ? `: ${c.def.name}` : ", empty"}${geis ? `, bound by ${geis.def.name}` : ""}${oath ? `, sworn to ${oath.def.name}` : ""}${omens.length ? `, ${omens.join(", ")}` : ""}${val ? `, Valour ${val.v}${val.shield ? ` and Shield ${val.shield}` : ""}${val.felled ? ", felled" : ""}` : ""}${champ ? `, ${champ.def.name} standing in` : ""}`;
            return (
              <div key={spot} className={`spot${hero ? " hero" : ""}${mark ? " m-" + mark : ""}${ownerOfSpot(spot) === me ? " my-half" : " their-half"}${val?.felled ? " felled" : ""}`} style={style}>
                <div className="spot-up" style={{ transform: `translate(-50%, -50%) rotate(${-rot}deg)` }}>
                  <span className="spot-no" aria-hidden="true">{spot + 1}</span>
                  {c ? (
                    <CardFace def={c.def} owner={owner} variant={zoom ? "full" : "compact"} onFocusCard={props.onFocusCard} onClick={click} playable={!!click} label={desc} />
                  ) : click ? (
                    <button type="button" className="empty-spot" aria-label={desc} onClick={click}>+</button>
                  ) : (
                    <div className="empty-spot" role="img" aria-label={desc}>{hero ? "hero" : "support"}</div>
                  )}
                  {geis || oath || omens.length || val || champ ? (
                    <div className="spot-tags" aria-hidden="true">
                      {val ? <span className={`valour${val.live ? " live" : ""}`}><Icon name="valour" />{val.v}{val.shield ? <><Icon name="shield" />{val.shield}</> : null}</span> : null}
                      {champ ? <span className="tag champ"><Icon name="champion" /> {champ.def.name}</span> : null}
                      {geis ? <span className="tag geis"><Icon name="geis" /> {geis.def.name.replace(/^Geis of (the )?/, "")}</span> : null}
                      {oath ? <span className="tag oath"><Icon name="oath" /> {oath.def.name.replace(/^Oath (of|on) (the )?/, "")}</span> : null}
                      {omens.map((n, i) => <span key={i} className="tag omen"><Icon name="omen" /> {n}</span>)}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {!zoom ? <div className="wheel-center">{props.center}</div> : null}
      </div>
      {zoom ? (() => {
        const across = (quadOf(props.focus!) * 3 + 6) % 12;
        const c = S.board[across];
        return (
          <div className="across" aria-label={`Across the ford: ${c ? c.def.name : "no hero yet"}`}>
            <span className="zone-label">Across the ford (spot {across + 1})</span>
            {c ? <CardFace def={c.def} owner={c.owner === me ? "mine" : "theirs"} onFocusCard={props.onFocusCard} /> : <div className="empty-spot">no hero yet</div>}
          </div>
        );
      })() : null}
    </div>
  );
}
