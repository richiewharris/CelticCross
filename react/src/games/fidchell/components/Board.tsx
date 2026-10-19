// The yew board: carved art, peg pieces that glide and fade, move marks and the keyboard cursor.
import { memo, useId, useState, type KeyboardEvent } from "react";
import { GOLD, MID, N, at, capsOf, genMoves, inB, type Move, type Piece, type State } from "../engine/rules";

export const PAD = 50, CELL = 84, PR = 30, HR = 12; // cell, peg radius and hole radius
export const cx = (i: number) => PAD + CELL / 2 + (i % N) * CELL;
export const cy = (i: number) => PAD + CELL / 2 + ((i / N) | 0) * CELL;

type Ids = Record<"yew" | "wood" | "hole" | "gold" | "white" | "pegShadow" | "plait", string>;
const url = (id: string) => `url(#${id})`;

function Defs({ ids }: { ids: Ids }) {
  const plait = "M0 4 C 6 4, 6 12, 12 12 S 18 4, 24 4", plait2 = "M0 12 C 6 12, 6 4, 12 4 S 18 12, 24 12";
  return (
    <defs>
      <filter id={ids.yew} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".006 .09" numOctaves={3} seed={11} result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .17  0 0 0 0 .1  0 0 0 0 .05  0 0 0 1.1 -.35" result="streak" />
        <feComposite in="streak" in2="SourceGraphic" operator="in" result="streakIn" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="streakIn" /></feMerge>
      </filter>
      <linearGradient id={ids.wood} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7a4f2c" />
        <stop offset=".55" stopColor="#5f3b20" />
        <stop offset="1" stopColor="#47291a" />
      </linearGradient>
      <radialGradient id={ids.hole} cx="50%" cy="42%" r="55%">
        <stop offset="0" stopColor="#070504" />
        <stop offset=".75" stopColor="#140c07" />
        <stop offset="1" stopColor="#2a1a0f" />
      </radialGradient>
      <radialGradient id={ids.gold} cx="36%" cy="32%" r="72%">
        <stop offset="0" stopColor="#e3c891" />
        <stop offset=".45" stopColor="#a7844c" />
        <stop offset="1" stopColor="#4c381c" />
      </radialGradient>
      <radialGradient id={ids.white} cx="36%" cy="32%" r="72%">
        <stop offset="0" stopColor="#fffbf2" />
        <stop offset=".5" stopColor="#ddd3ba" />
        <stop offset="1" stopColor="#857c66" />
      </radialGradient>
      <filter id={ids.pegShadow} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="1.6" dy="2.4" stdDeviation="1.6" floodColor="#000" floodOpacity=".6" />
      </filter>
      {/* A two-strand plait for the carved border */}
      <pattern id={ids.plait} width="24" height="16" patternUnits="userSpaceOnUse">
        <path d={plait} fill="none" stroke="#2a180c" strokeWidth="3.6" />
        <path d={plait} fill="none" stroke="#8e6b3f" strokeWidth="1.6" />
        <path d={plait2} fill="none" stroke="#2a180c" strokeWidth="3.6" />
        <path d={plait2} fill="none" stroke="#8e6b3f" strokeWidth="1.6" />
      </pattern>
    </defs>
  );
}

/** The wood, the plaited border, guide lines, the 25 holes (marked like the Ballinderry board) and coordinates. */
const BoardArt = memo(function BoardArt({ ids }: { ids: Ids }) {
  const lo = PAD + CELL / 2, hi = PAD + CELL / 2 + (N - 1) * CELL;
  const coord = { fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, fill: "#d9b98a", opacity: 0.55, textAnchor: "middle" as const };
  return (
    <g>
      <rect x="4" y="4" width="512" height="512" rx="14" fill={url(ids.wood)} filter={url(ids.yew)} />
      <rect x="4.5" y="4.5" width="511" height="511" rx="14" fill="none" stroke="#1d110a" strokeWidth="1.2" />
      <path d="M14 14H506V506H14Z M40 40V480H480V40Z" fill={url(ids.plait)} fillRule="evenodd" opacity=".9" />
      <rect x="13.5" y="13.5" width="493" height="493" rx="8" fill="none" stroke="#2a180c" strokeWidth="1" />
      <rect x="40.5" y="40.5" width="439" height="439" rx="3" fill="none" stroke="#2a180c" strokeWidth="1" />
      <rect x="42" y="42" width="436" height="436" rx="2" fill="none" stroke="rgb(255 225 180 / .12)" strokeWidth=".6" />
      {Array.from({ length: N }, (_, k) => {
        const p = lo + k * CELL;
        return (
          <g key={k}>
            <line x1={lo} y1={p} x2={hi} y2={p} stroke="#2a180c" strokeWidth=".8" opacity=".55" />
            <line x1={p} y1={lo} x2={p} y2={hi} stroke="#2a180c" strokeWidth=".8" opacity=".55" />
          </g>
        );
      })}
      {Array.from({ length: N * N }, (_, i) => {
        const r = (i / N) | 0, c = i % N;
        const marked = (r === MID && c === MID) || ((r === 0 || r === N - 1) && (c === 0 || c === N - 1));
        return (
          <g key={i}>
            {marked ? <>
              <circle cx={cx(i)} cy={cy(i)} r={HR + 10} fill="none" stroke="#2a180c" strokeWidth="1.2" />
              <circle cx={cx(i)} cy={cy(i)} r={HR + 10.8} fill="none" stroke="rgb(255 225 180 / .14)" strokeWidth=".5" />
            </> : null}
            <circle cx={cx(i)} cy={cy(i)} r={HR} fill={url(ids.hole)} stroke="rgb(255 225 180 / .16)" strokeWidth=".6" />
          </g>
        );
      })}
      {Array.from({ length: N }, (_, k) => (
        <g key={k}>
          <text x={lo + k * CELL} y="494" {...coord}>{"abcdefg"[k]}</text>
          <text x="27" y={lo + k * CELL + 3.5} {...coord}>{N - k}</text>
        </g>
      ))}
    </g>
  );
});

/** One peg. Captured pegs stay a moment, shrinking and fading where they were taken. */
export function Peg({ p, ids }: { p: Piece; ids: Pick<Ids, "gold" | "white"> }) {
  const g = p.side === GOLD;
  const transform = `translate(${cx(p.pos)}px, ${cy(p.pos)}px)${p.alive ? "" : " scale(.55)"}`;
  return (
    <g className={`pc${p.alive ? "" : " gone"}`} style={{ transform }}>
      <circle r={PR} fill={url(g ? ids.gold : ids.white)} stroke={g ? "#3a2a14" : "#6d6552"} strokeWidth="1" />
      <circle r={PR * 0.69} fill="none" stroke={g ? "rgb(40 26 10 / .35)" : "rgb(90 80 60 / .3)"} strokeWidth=".7" />
      <circle r={PR * 0.33} fill="none" stroke={g ? "rgb(40 26 10 / .3)" : "rgb(90 80 60 / .25)"} strokeWidth=".6" />
      <circle cx="-1.7" cy="-2.3" r="2.9" fill={g ? "#f0dcac" : "#fffdf7"} opacity=".9" />
    </g>
  );
}

function Arrow({ m }: { m: Move }) {
  const x1 = cx(m[0]), y1 = cy(m[0]), x2 = cx(m[1]), y2 = cy(m[1]);
  const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const sx = x1 + ux * (PR + 3), sy = y1 + uy * (PR + 3), ex = x2 - ux * (HR + 2), ey = y2 - uy * (HR + 2);
  return <>
    <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#e8c97e" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
    <path d={`M${ex + ux * 6} ${ey + uy * 6} L${ex - uy * 6} ${ey + ux * 6} L${ex + uy * 6} ${ey - ux * 6} Z`} fill="#e8c97e" opacity=".9" />
  </>;
}

export interface BoardProps {
  s: State;
  /** Pieces are remounted (no glide) when this changes, e.g. on a new game. */
  round?: number;
  /** It's a human's turn: show the selection, the targets and the hints. */
  active: boolean;
  sel?: number | null;
  /** Hints: the side-to-move's pieces in danger and a suggested move. */
  danger?: Iterable<number> | null;
  arrow?: Move | null;
  cursor?: number;
  /** Force the keyboard cursor on (for the playground). */
  showCursor?: boolean;
  onCursor?: (i: number) => void;
  onCell?: (i: number) => void;
  onEscape?: () => void;
}

export function Board(p: BoardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids: Ids = { yew: `${uid}yew`, wood: `${uid}wood`, hole: `${uid}hole`, gold: `${uid}gold`, white: `${uid}white`, pegShadow: `${uid}pegShadow`, plait: `${uid}plait` };
  const [focused, setFocused] = useState(false);
  const { s, sel = null, cursor = at(N - 1, MID) } = p;

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const r = (cursor / N) | 0, c = cursor % N;
    const mv = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (mv) { e.preventDefault(); const nr = r + mv[0], nc = c + mv[1]; if (inB(nr, nc)) p.onCursor?.(at(nr, nc)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onCell?.(cursor); }
    else if (e.key === "Escape" && sel !== null) p.onEscape?.();
  };

  const ov = [];
  if (p.active) {
    const me = s.turn;
    if (sel !== null) {
      ov.push(<circle key="sel" cx={cx(sel)} cy={cy(sel)} r={PR + 5} fill="none" stroke="#f0d79c" strokeWidth="2.2" />);
      for (const m of genMoves(s.b, me)) {
        if (m[0] !== sel) continue;
        const t = m[1];
        ov.push(capsOf(s.b, m, me).length
          ? <g key={`t${t}`}><circle cx={cx(t)} cy={cy(t)} r={HR + 3} fill="none" stroke="#d0584a" strokeWidth="2.4" /><circle cx={cx(t)} cy={cy(t)} r="5" fill="#d0584a" /></g>
          : <circle key={`t${t}`} cx={cx(t)} cy={cy(t)} r="5.5" fill="#f0d79c" opacity=".85" />);
      }
    }
    if (p.danger) for (const x of p.danger) ov.push(<circle key={`d${x}`} cx={cx(x)} cy={cy(x)} r={PR + 5} fill="none" stroke="#d0584a" strokeWidth="1.8" strokeDasharray="4 3" />);
    if (p.arrow) ov.push(<Arrow key="arrow" m={p.arrow} />);
  }
  if (focused || p.showCursor) ov.push(<rect key="cur" x={cx(cursor) - PR - 8} y={cy(cursor) - PR - 8} width={2 * PR + 16} height={2 * PR + 16} rx="10" fill="none" stroke="#f0d79c" strokeWidth="1.6" strokeDasharray="4 3" />);

  return (
    <svg className={`board${p.active ? "" : " locked"}`} viewBox="0 0 520 520" tabIndex={0} aria-label="Board. Arrow keys move the cursor, Enter selects."
      onKeyDown={onKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      <Defs ids={ids} />
      <BoardArt ids={ids} />
      <g>
        {s.last ? <>
          {[s.last.from, s.last.to].map((i, k) => <circle key={k} cx={cx(i)} cy={cy(i)} r={PR + 5} fill="none" stroke="#d2b27a" strokeWidth="1" opacity=".55" />)}
          {s.last.caps.map(i => <circle key={`c${i}`} cx={cx(i)} cy={cy(i)} r={HR + 4} fill="none" stroke="#d0584a" strokeWidth="1.2" strokeDasharray="2 3" opacity=".8" />)}
        </> : null}
      </g>
      <g key={p.round ?? 0} filter={url(ids.pegShadow)}>
        {s.pieces.map(pc => <Peg key={pc.id} p={pc} ids={ids} />)}
      </g>
      <g>{ov}</g>
      <g>
        {Array.from({ length: N * N }, (_, i) => (
          <rect key={i} className="cellhit" x={cx(i) - CELL / 2} y={cy(i) - CELL / 2} width={CELL} height={CELL} onClick={() => p.onCell?.(i)} />
        ))}
      </g>
    </svg>
  );
}
