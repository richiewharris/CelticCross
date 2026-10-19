// Piece glyphs, drawn in a 100x100 box (the original page's <symbol>s, inlined).
import type { CSSProperties } from "react";

/** The bare shape of a Throne (1), Angel (2) or Cross (3); colours come from the parent. */
export function Glyph({ t }: { t: number }) {
  if (t === 1) return (
    <>
      <path d="M28 62 V38 A22 22 0 0 1 72 38 V62 H62 V40 A12 12 0 0 0 38 40 V62 Z" />
      <rect x="20" y="63" width="60" height="9" rx="2" />
      <rect x="25" y="75" width="50" height="7" rx="1" />
      <rect x="19" y="85" width="62" height="7" rx="1.5" />
    </>
  );
  if (t === 3) return (
    <>
      <rect x="45" y="22" width="10" height="56" />
      <rect x="22" y="45" width="56" height="10" />
      <polygon points="50,10 39,27 61,27" />
      <polygon points="50,90 39,73 61,73" />
      <polygon points="10,50 27,39 27,61" />
      <polygon points="90,50 73,39 73,61" />
      <polygon points="50,36 64,50 50,64 36,50" />
    </>
  );
  return (
    <>
      <ellipse cx="50" cy="20" rx="15" ry="4.5" fill="none" strokeWidth="3.5" className="halo" />
      <path d="M47 70 C36 62 20 62 9 74 C22 73 32 79 47 79 Z" />
      <path d="M53 70 C64 62 80 62 91 74 C78 73 68 79 53 79 Z" />
      <path d="M36 82 Q50 64 64 82 Z" />
      <circle cx="50" cy="47" r="18" />
    </>
  );
}

/** A Monsiv piece: code 1-3 white, 9-11 black. */
export function MonsivPiece({ code, pop, className }: { code: number; pop?: boolean; className?: string }) {
  const white = (code & 8) === 0, t = code & 7;
  const fill = white ? "var(--piece-white)" : "var(--piece-black)";
  const line = white ? "var(--piece-white-line)" : "var(--piece-black)";
  const face = white ? "var(--piece-white)" : "#e9e1cf";
  const style = t === 2 ? ({ "--face": face } as CSSProperties) : undefined;
  const cls = [className, pop ? "pop" : ""].filter(Boolean).join(" ");
  return (
    <svg viewBox="0 0 100 100" className={cls || undefined} aria-hidden="true" style={style}>
      <g fill={fill} stroke={line} strokeWidth={white ? 3 : 0} strokeLinejoin="round"><Glyph t={t} /></g>
      {t === 2 ? (
        <>
          <path d="M38 48 Q50 40 62 48 Q62 62 50 64 Q38 62 38 48 Z" fill={face} />
          <path d="M42 52 q3 2.5 6 0 M52 52 q3 2.5 6 0" fill="none" stroke={line} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="50" cy="20" rx="15" ry="4.5" fill="none" stroke={line} strokeWidth="3.5" />
        </>
      ) : null}
    </svg>
  );
}

/** A small glyph in the text colour, for the rules list. */
export function RuleGlyph({ t }: { t: number }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g fill="currentColor" stroke={t === 2 ? "currentColor" : undefined}><Glyph t={t} /></g>
    </svg>
  );
}
