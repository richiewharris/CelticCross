import { NAMES, type Piece } from "../engine/rules";
import { MorPiece } from "../glyphs";

/** The pieces still to set during setup. */
export function Tray(props: {
  label: string; kinds: Piece[]; counts: Partial<Record<Piece, number>>; picked: Piece | null;
  enabled: (k: Piece) => boolean; onPick: (k: Piece) => void;
}) {
  return (
    <div className="trayrow">
      <p className="label">{props.label}</p>
      <div className="tray">
        {props.kinds.map(k => (
          <button key={k} type="button" aria-pressed={props.picked === k} aria-label={`${NAMES[k]}, ${props.counts[k] ?? 0} left`} disabled={!props.enabled(k)} onClick={() => props.onPick(k)}>
            <MorPiece p={k} />
            <span className="n">{props.counts[k] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
