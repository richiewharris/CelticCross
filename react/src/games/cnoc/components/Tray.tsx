import { NAMES, PH, type Piece } from "../engine/rules";
import { CnocPiece } from "../glyphs";

/** The pieces still to set during setup. */
export function Tray(props: {
  label: string; kinds: Piece[]; counts: Partial<Record<Piece, number>>; picked: Piece | null;
  enabled: (k: Piece) => boolean; onPick: (k: Piece) => void;
  /** Combining variant, rival's setup: the Host's choice to bring a Phalanx, made with the Lord. */
  phalanxToggle?: { on: boolean; set: (on: boolean) => void } | null;
}) {
  return (
    <div className="trayrow">
      <p className="label">{props.label}</p>
      <div className="tray">
        {props.kinds.map(k => k === PH ? (
          <button key={k} type="button" className="phx" aria-pressed={props.picked === k}
            aria-label={`Phalanx, uses 3 Spearmen, ${props.counts[k] ?? 0} left`} disabled={!props.enabled(k)} onClick={() => props.onPick(k)}>
            <CnocPiece p={k} /><span className="n">{props.counts[k] ?? 0}</span><small>uses 3 Spearmen</small>
          </button>
        ) : (
          <button key={k} type="button" aria-pressed={props.picked === k} aria-label={`${NAMES[k]}, ${props.counts[k] ?? 0} left`} disabled={!props.enabled(k)} onClick={() => props.onPick(k)}>
            <CnocPiece p={k} />
            <span className="n">{props.counts[k] ?? 0}</span>
          </button>
        ))}
        {props.phalanxToggle ? (
          <button type="button" className="phx" aria-pressed={props.phalanxToggle.on} onClick={() => props.phalanxToggle!.set(!props.phalanxToggle!.on)}
            aria-label="Bring a Phalanx in place of 3 Spearmen (the Sí will set it)">
            <CnocPiece p={PH} /><small>{props.phalanxToggle.on ? "Phalanx: yes" : "Bring a Phalanx?"}<br />uses 3 Spearmen</small>
          </button>
        ) : null}
      </div>
    </div>
  );
}
