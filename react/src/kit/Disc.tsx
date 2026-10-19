import type { ReactNode } from "react";

/** A round playing piece: a disc in the side's colours with a glyph on top. */
export function Disc(props: { fill: string; ink: string; children: ReactNode; pop?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`${props.className ?? "piece"}${props.pop ? " pop" : ""}`} aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill={props.fill} stroke={props.ink} strokeWidth="3" />
      <circle cx="50" cy="50" r="37" fill="none" stroke={props.ink} strokeOpacity=".3" strokeWidth="1.5" />
      <g fill={props.ink} stroke={props.ink}>{props.children}</g>
    </svg>
  );
}
