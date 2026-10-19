// Piece glyphs for Cnoc Mór, drawn in a 100x100 box (the original page's <symbol>s).
import { Disc } from "../../kit/Disc";
import { CH, LO, RI, SP, sideOf, type Piece } from "./engine/rules";

export function Glyph({ p }: { p: Piece }) {
  switch (p) {
    case LO: return <><path d="M27 64 L30 36 L41 49 L50 30 L59 49 L70 36 L73 64 Z" /><rect x="26" y="66" width="48" height="8" rx="2" /></>;
    case SP: return <><path d="M50 16 L61 44 L50 58 L39 44 Z" /><rect x="47" y="56" width="6" height="28" rx="2" /><rect x="40" y="58" width="20" height="5" rx="2" /></>;
    case CH: return <><circle cx="50" cy="50" r="24" fill="none" strokeWidth="7" /><circle cx="50" cy="50" r="7" /><path d="M50 27V73M27 50H73M34 34L66 66M66 34L34 66" fill="none" strokeWidth="4.5" /></>;
    case RI: return <><path d="M60 24 A27 27 0 1 0 60 76 A21 21 0 1 1 60 24 Z" /><circle cx="66" cy="38" r="4" /><circle cx="72" cy="54" r="3" /></>;
    default: return null;
  }
}

/** A piece: red gold for the Host, white silver for the Sí. */
export function MorPiece({ p, pop }: { p: Piece; pop?: boolean }) {
  const host = sideOf(p) === 0;
  return (
    <Disc fill={host ? "var(--gold)" : "var(--silver)"} ink={host ? "var(--gold-ink)" : "var(--silver-ink)"} pop={pop}>
      <Glyph p={p} />
    </Disc>
  );
}

/** The flatter piece drawing used in the rules list (no inner ring; only the Chariot is stroked). */
export function RuleIcon({ p }: { p: Piece }) {
  const host = sideOf(p) === 0, ink = host ? "var(--gold-ink)" : "var(--silver-ink)";
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill={host ? "var(--gold)" : "var(--silver)"} stroke={ink} strokeWidth="3" />
      <g fill={ink} stroke={p === CH ? ink : undefined}><Glyph p={p} /></g>
    </svg>
  );
}
