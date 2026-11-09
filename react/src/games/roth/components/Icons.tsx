// Small SVG icons for the cards: elements, kinds of support, effects, stats and card types.
// Each draws in a 24×24 box with currentColor, so the card's palette colours it.
import type { ReactNode } from "react";

const P = ({ d, fill }: { d: string; fill?: boolean }) => (
  <path d={d} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={fill ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
);

const ICONS: Record<string, ReactNode> = {
  // elements
  Fire: <P fill d="M12 2c1.5 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.4 2-4.5.2 1.6 1 2.6 2 3-.6-3 .3-5.8 1-8.5z" />,
  Wind: <><P d="M3 9h11a3 3 0 1 0-3-3" /><P d="M3 14h15a3 3 0 1 1-3 3" /><P d="M3 19h7" /></>,
  Earth: <><P fill d="M2 20 9 7l4 7 3-4 6 10z" /></>,
  Water: <><P d="M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0" /><P d="M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0" /></>,
  // kinds
  Weapon: <><P d="M5 19 17 7" /><P fill d="m15 3 6 0 0 6-3 0 0-3-3 0z" /><P d="M4 14l6 6" /><P d="M3 21l2-2" /></>,
  Feat: <><P fill d="M12 2l2.4 6.6L21 9l-5.2 4.3L17.6 21 12 17l-5.6 4 1.8-7.7L3 9l6.6-.4z" /></>,
  Ally: <><circle cx="8" cy="8" r="3" fill="currentColor" /><circle cx="16" cy="8" r="3" fill="currentColor" /><P d="M3 20c0-4 2.5-6 5-6s5 2 5 6" /><P d="M11 20c0-4 2.5-6 5-6s5 2 5 6" /></>,
  Word: <><P d="M6 3h10a2 2 0 0 1 2 2v14a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2z" /><P d="M9 8h6M9 12h6M9 16h4" /></>,
  // effects and stats
  strike: <><P d="M4 20 15 9" /><P fill d="m13 4 7 0 0 7-2.5 0 0-4.5-4.5 0z" /></>,
  heal: <><P fill d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" /></>,
  shield: <><P fill d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" /></>,
  valour: <><P fill d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" /></>,
  init: <><P fill d="M13 2 4 14h7l-1 8 9-12h-7z" /></>,
  // card types
  hero: <><P fill d="M12 2l3 4 4-2-1 6H6L5 4l4 2z" /><P d="M6 13h12M8 13v8h8v-8" /></>,
  champion: <><P fill d="M12 2l7 3v6c0 5-3 9-7 11-4-2-7-6-7-11V5z" /><P d="M12 6v10M8 10h8" /></>,
  geis: <><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><P d="M6 18 18 6" /></>,
  oath: <><P d="M12 3v18M7 8h10" /><P d="M7 8l-2 2M17 8l2 2M12 21l-2-2M12 21l2-2" /></>,
  omen: <><P fill d="M15 3a9 9 0 1 0 6 15.5A7 7 0 0 1 15 3z" /></>,
  global: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><P d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  targeted: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" fill="currentColor" /><P d="M12 1v4M12 19v4M1 12h4M19 12h4" /></>,
  yours: <><P fill d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z" /></>,
  pierce: <><P d="M3 12h15" /><P fill d="m16 7 6 5-6 5z" /><P d="M9 5v14" /></>,
};

export function Icon({ name, title, className }: { name: string; title?: string; className?: string }) {
  const body = ICONS[name];
  if (!body) return null;
  return (
    <svg className={`ico ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} aria-label={title}>
      {body}
    </svg>
  );
}

/** A faction's emblem for the art panel: a knot-like sigil per alignment. */
export function Emblem({ alignment }: { alignment: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const };
  switch (alignment) {
    case "Ulaid": // the red hand / three spirals of Emain
      return <g {...s}>{[0, 120, 240].map((r) => <path key={r} transform={`rotate(${r} 50 50)`} d="M50 50c4-10 16-14 22-6s0 18-9 16-8-10-2-12" />)}</g>;
    case "Connachta": // the bull's horns over Cruachan
      return <g {...s}><path d="M28 40c0-12 10-16 22-10 12-6 22-2 22 10" /><path d="M36 60h28M40 52l10 18 10-18" /><circle cx="50" cy="45" r="6" /></g>;
    case "Sidhe": // a mound with a door
      return <g {...s}><path d="M20 70c6-26 54-26 60 0z" /><path d="M44 70V58a6 6 0 0 1 12 0v12" /><path d="M50 22v8M36 28l4 6M64 28l-4 6" /></g>;
    case "Fomoire": // the single eye
      return <g {...s}><path d="M18 50c12-16 52-16 64 0-12 16-52 16-64 0z" /><circle cx="50" cy="50" r="8" /><circle cx="50" cy="50" r="2" fill="currentColor" /></g>;
    case "Merrow": // the waves and the red cap
      return <g {...s}><path d="M18 58c8-6 14-6 22 0s14 6 22 0 14-6 20 0" /><path d="M18 70c8-6 14-6 22 0s14 6 22 0 14-6 20 0" /><path d="M38 44c0-10 24-10 24 0z" /></g>;
    case "Deorad": // the exile's road
      return <g {...s}><path d="M30 76c10-14 30-12 40-40" /><path d="M64 30l6 6 2-10z" /><circle cx="30" cy="76" r="3" /></g>;
    default:
      return <g {...s}><circle cx="50" cy="50" r="16" /><path d="M50 30v40M30 50h40" /></g>;
  }
}
