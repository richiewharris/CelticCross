import { NAMES, PLURAL, RI, SP, sideName, type Side } from "../engine/rules";
import { MorPiece } from "../glyphs";

/** The two reserves at the foot of the hill; tap yours to bring a piece in. */
export function Reserves(props: { rh: number; rs: number; canDrop: (s: Side) => boolean; pressed: Side | null; onPick: (s: Side) => void }) {
  return (
    <div className="reserves" aria-label="Reserves">
      {([0, 1] as Side[]).map(side => {
        const n = side === 0 ? props.rh : props.rs, kind = side === 0 ? SP : RI;
        const what = `${n} ${n === 1 ? NAMES[kind].toLowerCase() : PLURAL[kind]}`;
        return (
          <button key={side} type="button" className="res" disabled={!props.canDrop(side)} aria-pressed={props.pressed === side}
            aria-label={`${sideName(side)} reserve: ${what}`} onClick={() => props.onPick(side)}>
            <MorPiece p={kind} />
            <span><b>{sideName(side)} reserve</b>{what}</span>
          </button>
        );
      })}
    </div>
  );
}
