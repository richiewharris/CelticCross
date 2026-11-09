// The round board: twelve spots in four quadrants (a hero and its two supports), your half nearest you.
// Spot k sits at 15° + 30°·k round the circle, so spots 1 and 7, and 4 and 10, face each other across it.
import type { ReactNode } from "react";
import type { CardDef } from "../engine/cards";
import { isHeroSpot, ownerOfSpot, quadOf, type Side, type State } from "../engine/engine";
import { CardFace } from "./Card";

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

export function Wheel(props: {
  S: State; me: Side; marks?: Map<number, Mark>; onSpot?: (spot: number) => void;
  onFocusCard?: (d: CardDef) => void; center?: ReactNode; label?: string;
}) {
  const { S, me, marks } = props;
  const turn = me === 0 ? 0 : 180;
  return (
    <div className="wheel-box">
    <div className="wheel" role="group" aria-label={props.label ?? "The wheel"}>
      <svg className="wheel-bg" viewBox="-50 -50 100 100" aria-hidden="true">
        <circle r="48" className="rim" />
        <circle r="31" className="hub" />
        {[0, 1, 2, 3].map((q) => {
          const a = ((15 + 30 * (3 * q) - 15 + turn) * Math.PI) / 180;
          return <line key={q} x1={31 * Math.cos(a)} y1={31 * Math.sin(a)} x2={48 * Math.cos(a)} y2={48 * Math.sin(a)} className="spoke" />;
        })}
        <line x1="-46" y1="0" x2="46" y2="0" className="ford" />
      </svg>
      {S.board.map((c, spot) => {
        const a = ((15 + 30 * spot + turn) * Math.PI) / 180;
        const hero = isHeroSpot(spot);
        const r = hero ? 37 : 38;
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
        const desc = `Spot ${spot + 1}${c ? `: ${c.def.name}` : ", empty"}${geis ? `, bound by ${geis.def.name}` : ""}${oath ? `, sworn to ${oath.def.name}` : ""}${val ? `, Valour ${val.v}${val.shield ? ` and Shield ${val.shield}` : ""}${val.felled ? ", felled" : ""}` : ""}${champ ? `, ${champ.def.name} standing in` : ""}`;
        return (
          <div key={spot} className={`spot${hero ? " hero" : ""}${mark ? " m-" + mark : ""}${ownerOfSpot(spot) === me ? " my-half" : " their-half"}${val?.felled ? " felled" : ""}`} style={style}>
            <span className="spot-no" aria-hidden="true">{spot + 1}</span>
            {c ? (
              <CardFace def={c.def} owner={owner} onFocusCard={props.onFocusCard} onClick={click} playable={!!click} label={desc} />
            ) : click ? (
              <button type="button" className="empty-spot" aria-label={desc} onClick={click}>+</button>
            ) : (
              <div className="empty-spot" role="img" aria-label={desc} />
            )}
            {geis || oath || omens.length || val || champ ? (
              <div className="spot-tags" aria-hidden="true">
                {val ? <span className={`valour${val.live ? " live" : ""}`}>♥{val.v}{val.shield ? ` ◈${val.shield}` : ""}</span> : null}
                {champ ? <span className="tag champ">⚜ {champ.def.name}</span> : null}
                {geis ? <span className="tag geis">⊘ {geis.def.name.replace(/^Geis of (the )?/, "")}</span> : null}
                {oath ? <span className="tag oath">✠ {oath.def.name.replace(/^Oath (of|on) (the )?/, "")}</span> : null}
                {omens.map((n, i) => <span key={i} className="tag omen">☽ {n}</span>)}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="wheel-center">{props.center}</div>
    </div>
    </div>
  );
}
