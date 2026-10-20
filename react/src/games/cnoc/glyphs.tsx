// Piece glyphs for Cnoc, drawn in a 100x100 box.
import { Disc } from "../../kit/Disc";
import { CH, LO, PH, RI, SP, sideOf, type Piece } from "./engine/rules";

export function Glyph({ p }: { p: Piece }) {
  switch (p) {
    case LO: return <><path d="M27 64 L30 36 L41 49 L50 30 L59 49 L70 36 L73 64 Z" /><rect x="26" y="66" width="48" height="8" rx="2" /></>;
    case SP: return <><path d="M50 16 L61 44 L50 58 L39 44 Z" /><rect x="47" y="56" width="6" height="28" rx="2" /><rect x="40" y="58" width="20" height="5" rx="2" /></>;
    case CH: return <><circle cx="50" cy="50" r="24" fill="none" strokeWidth="7" /><circle cx="50" cy="50" r="7" /><path d="M50 27V73M27 50H73M34 34L66 66M66 34L34 66" fill="none" strokeWidth="4.5" /></>;
    case RI: return <><path d="M60 24 A27 27 0 1 0 60 76 A21 21 0 1 1 60 24 Z" stroke="none" /><circle cx="66" cy="38" r="4" stroke="none" /><circle cx="72" cy="54" r="3" stroke="none" /></>;
    // The Phalanx: three spear tips over a shield wall.
    case PH: return <><path d="M30 20 L37 36 L30 45 L23 36 Z M50 14 L57 31 L50 40 L43 31 Z M70 20 L77 36 L70 45 L63 36 Z" /><rect x="28" y="43" width="4" height="14" rx="1.5" /><rect x="48" y="38" width="4" height="19" rx="1.5" /><rect x="68" y="43" width="4" height="14" rx="1.5" /><rect x="21" y="56" width="58" height="17" rx="4" /><path d="M37 56V73M50 56V73M63 56V73" fill="none" stroke="var(--gold)" strokeWidth="2.5" /></>;
    default: return null;
  }
}

/** A Cnoc piece: red gold for the Host, white silver for the Sí. */
export function CnocPiece({ p, pop, className }: { p: Piece; pop?: boolean; className?: string }) {
  const host = sideOf(p) === 0;
  return (
    <Disc fill={host ? "var(--gold)" : "var(--silver)"} ink={host ? "var(--gold-ink)" : "var(--silver-ink)"} pop={pop} className={className}>
      <Glyph p={p} />
    </Disc>
  );
}
