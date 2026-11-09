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
  Weapon: <><P d="M19.5 4.5 9 15" /><P fill d="M20.5 2.5 21.5 3.5 20 8 16 4z" /><P d="M6 12l6 6" /><P d="M9 15l-5.5 5.5" /><circle cx="3.5" cy="20.5" r="1.4" fill="currentColor" /></>,
  Feat: <><P fill d="M12 2l2.4 6.6L21 9l-5.2 4.3L17.6 21 12 17l-5.6 4 1.8-7.7L3 9l6.6-.4z" /></>,
  Ally: <><circle cx="8" cy="8" r="3" fill="currentColor" /><circle cx="16" cy="8" r="3" fill="currentColor" /><P d="M3 20c0-4 2.5-6 5-6s5 2 5 6" /><P d="M11 20c0-4 2.5-6 5-6s5 2 5 6" /></>,
  // a Word is an ogham stone: a standing stone with notches cut along its edge
  Word: <><P d="M8 21V7c0-3 2-5 4-5s4 2 4 5v14" /><P d="M5 21h14" /><P d="M16 7h3M16 10h3M16 13h3M5 9h3M5 12h3" /></>,
  // effects and stats
  strike: <><P d="M5 19 13 11" /><P fill d="M21 3c-1 4.5-3.5 8-7.5 9.5L11.5 10.5C13 6.5 16.5 4 21 3z" /><P d="M3 21l2-2" /></>,
  heal: <><P fill d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" /></>,
  shield: <><P fill d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" /></>,
  valour: <><P fill d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" /></>,
  init: <><P fill d="M13 2 4 14h7l-1 8 9-12h-7z" /></>,
  // card types
  hero: <><P fill d="M12 2l3 4 4-2-1 6H6L5 4l4 2z" /><P d="M6 13h12M8 13v8h8v-8" /></>,
  // a champion: a round targe with a spear behind it
  champion: <><P d="M4 20 20 4" /><P fill d="M20 4l-1 4.5-3.5-3.5z" /><circle cx="11" cy="13" r="6" fill="currentColor" /><circle cx="11" cy="13" r="2" fill="none" stroke="var(--ico-cut, #0003)" strokeWidth="1.4" /></>,
  geis: <><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><P d="M6 18 18 6" /></>,
  // an oath is sworn through a holed stone
  oath: <><P fill d="M6 22V9c0-4 3-7 6-7s6 3 6 7v13zM12 8.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" /></>,
  omen: <><P fill d="M15 3a9 9 0 1 0 6 15.5A7 7 0 0 1 15 3z" /></>,
  global: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><P d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  targeted: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" fill="currentColor" /><P d="M12 1v4M12 19v4M1 12h4M19 12h4" /></>,
  // yours: a ring-fort (ráth) with its gate, your own ground
  yours: <><P d="M7.5 5.2A8.5 8.5 0 1 0 16.5 5.2" /><P d="M9.6 9.2A4 4 0 1 0 14.4 9.2" /><P d="M12 2v8" /></>,
  // an attendant: a cloaked figure with a staff
  attendant: <><circle cx="11" cy="5" r="2.6" fill="currentColor" /><P fill d="M6.5 21c.4-5.5 1.6-10 4.5-11.5 2.9 1.5 4.1 6 4.5 11.5z" /><P d="M18.5 3v18" /><P d="M16.5 5.5h4" /></>,
  // the enemy's side: two spears crossed
  enemy: <><P d="M4 20 20 4M20 20 4 4" /><P fill d="M20 4l-.8 4-3.2-3.2zM4 4l4 .8L4.8 8z" /></>,
  // turns into: an arrow
  into: <><P d="M3 12h15" /><P fill d="m15 7 6 5-6 5z" /></>,
  // Spirit (anam): a soul-flame rising in a spiral
  Spirit: <><P d="M12 21c-4 0-6.5-2.6-6.5-6 0-4.5 4-6 4-10 2.5 1.5 3.5 3.5 3 6 1-1 1.8-2.4 1.8-4 2 2 3.7 4.7 3.7 8 0 3.4-2.5 6-6 6z" /><P d="M12 17.5a2 2 0 1 1 1.8-2.8" /></>,
  // a host of the Slúagh: three birds in flight
  host: <><P d="M2 9c2-1.5 3.5-1.5 5 0 1.5-1.5 3-1.5 5 0" /><P d="M7 15c2-1.5 3.5-1.5 5 0 1.5-1.5 3-1.5 5 0" /><P d="M12 5c2-1.5 3.5-1.5 5 0 1.5-1.5 3-1.5 5 0" /></>,
  // a monster: a horned skull
  monster: <><P fill d="M12 4c4.4 0 7 3 7 6.8 0 2.4-1.2 4-2.7 4.9V19h-8.6v-3.3C6.2 14.8 5 13.2 5 10.8 5 7 7.6 4 12 4zM9.2 10a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm5.6 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" /><P d="M6 6 3 2M18 6l3-4" /></>,
  rest: <><P d="M4 14h16v4H4zM6 14V9h5v5" /><P d="M15 4h4l-4 5h4" /></>,
  // pierce: a spear passing through a shield
  pierce: <><P d="M10 4.5 15 6.5v5c0 3.5-2.2 6.3-5 7.5-2.8-1.2-5-4-5-7.5v-5z" /><P d="M1.5 12h18" /><P fill d="m18 8.5 4.5 3.5-4.5 3.5z" /></>,
};

/** An icon's drawing, for reuse inside a larger SVG (the card art). */
export const iconBody = (name: string): ReactNode => ICONS[name] ?? null;

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
    case "Sluagh": // the flock of the dead over a grave-mound
      return <g {...s}><path d="M22 70c8-14 48-14 56 0" /><path d="M26 38c5-4 9-4 12 0 3-4 7-4 12 0" /><path d="M44 26c5-4 9-4 12 0 3-4 7-4 12 0" /><path d="M54 46c5-4 9-4 12 0 3-4 7-4 12 0" /></g>;
    case "Deorad": // the exile's road
      return <g {...s}><path d="M30 76c10-14 30-12 40-40" /><path d="M64 30l6 6 2-10z" /><circle cx="30" cy="76" r="3" /></g>;
    default:
      return <g {...s}><circle cx="50" cy="50" r="16" /><path d="M50 30v40M30 50h40" /></g>;
  }
}
