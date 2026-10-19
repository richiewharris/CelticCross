import { memo, useRef, type KeyboardEvent } from "react";
import { MEAD, MID, N, type Piece } from "../engine/rules";

export const PAD = 50, CELL = 60, PR = 22, HR = 8;
export const cx = (i: number) => PAD + CELL / 2 + (i % N) * CELL;
export const cy = (i: number) => PAD + CELL / 2 + ((i / N) | 0) * CELL;
const MONO = "IBM Plex Mono, monospace";

export interface Overlay {
  /** Cups that can move (dashed rings), when none is picked up. */
  from?: number[];
  sel?: number | null;
  /** Where the picked-up cup can go, with the die that takes it there; red when it drinks. */
  targets?: { at: number; die: number; cap: boolean }[];
  /** The hint arrow. */
  arrow?: { from: number; to: number } | null;
  /** Cups that may be drunk for the Queen (gold) or for treason (red). */
  pick?: { squares: number[]; treason: boolean } | null;
  /** Cups of the player's the rival could drink next (hints). */
  threats?: number[];
  cursor?: number | null;
}

export function Defs() {
  return (
    <defs>
      <filter id="yew" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".006 .09" numOctaves={3} seed={11} result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .17  0 0 0 0 .1  0 0 0 0 .05  0 0 0 1.1 -.35" result="streak" />
        <feComposite in="streak" in2="SourceGraphic" operator="in" result="streakIn" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="streakIn" /></feMerge>
      </filter>
      <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7a4f2c" /><stop offset=".55" stopColor="#5f3b20" /><stop offset="1" stopColor="#47291a" />
      </linearGradient>
      <radialGradient id="hole" cx="50%" cy="42%" r="55%">
        <stop offset="0" stopColor="#070504" /><stop offset=".75" stopColor="#140c07" /><stop offset="1" stopColor="#2a1a0f" />
      </radialGradient>
      <radialGradient id="bronzeRim" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#e3c891" /><stop offset=".5" stopColor="#a7844c" /><stop offset="1" stopColor="#4c381c" /></radialGradient>
      <radialGradient id="silverRim" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#f4f2ec" /><stop offset=".5" stopColor="#b3afa4" /><stop offset="1" stopColor="#5c5951" /></radialGradient>
      <radialGradient id="bronzeWall" cx="60%" cy="66%" r="70%"><stop offset="0" stopColor="#3a2a14" /><stop offset="1" stopColor="#7d6036" /></radialGradient>
      <radialGradient id="silverWall" cx="60%" cy="66%" r="70%"><stop offset="0" stopColor="#4a4740" /><stop offset="1" stopColor="#9b978c" /></radialGradient>
      <radialGradient id="meadDrink" cx="42%" cy="38%" r="70%"><stop offset="0" stopColor="#f2c45c" /><stop offset=".6" stopColor="#c68a24" /><stop offset="1" stopColor="#7c4f10" /></radialGradient>
      <radialGradient id="wineDrink" cx="42%" cy="38%" r="70%"><stop offset="0" stopColor="#a63345" /><stop offset=".6" stopColor="#6b1726" /><stop offset="1" stopColor="#360812" /></radialGradient>
      <filter id="pegShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.6" dy="2.4" stdDeviation="1.6" floodColor="#000" floodOpacity=".6" /></filter>
      <pattern id="plait" width="24" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 4 C 6 4, 6 12, 12 12 S 18 4, 24 4" fill="none" stroke="#2a180c" strokeWidth="3.6" />
        <path d="M0 4 C 6 4, 6 12, 12 12 S 18 4, 24 4" fill="none" stroke="#8e6b3f" strokeWidth="1.6" />
        <path d="M0 12 C 6 12, 6 4, 12 4 S 18 12, 24 12" fill="none" stroke="#2a180c" strokeWidth="3.6" />
        <path d="M0 12 C 6 12, 6 4, 12 4 S 18 12, 24 12" fill="none" stroke="#8e6b3f" strokeWidth="1.6" />
      </pattern>
    </defs>
  );
}

/** The yew board: plaited border, grid lines, the 49 holes with the five marked ones, and the coordinates. */
const BoardArt = memo(function BoardArt() {
  const a = PAD + CELL / 2, z = a + (N - 1) * CELL;
  const ks = Array.from({ length: N }, (_, k) => k);
  return (
    <g>
      <rect x="4" y="4" width="512" height="512" rx="14" fill="url(#wood)" filter="url(#yew)" />
      <rect x="4.5" y="4.5" width="511" height="511" rx="14" fill="none" stroke="#1d110a" strokeWidth="1.2" />
      <path d="M14 14H506V506H14Z M40 40V480H480V40Z" fill="url(#plait)" fillRule="evenodd" opacity=".9" />
      <rect x="13.5" y="13.5" width="493" height="493" rx="8" fill="none" stroke="#2a180c" strokeWidth="1" />
      <rect x="40.5" y="40.5" width="439" height="439" rx="3" fill="none" stroke="#2a180c" strokeWidth="1" />
      <rect x="42" y="42" width="436" height="436" rx="2" fill="none" stroke="rgb(255 225 180 / .12)" strokeWidth=".6" />
      {ks.map(k => {
        const p = a + k * CELL;
        return (
          <g key={k}>
            <line x1={a} y1={p} x2={z} y2={p} stroke="#2a180c" strokeWidth=".8" opacity=".55" />
            <line x1={p} y1={a} x2={p} y2={z} stroke="#2a180c" strokeWidth=".8" opacity=".55" />
          </g>
        );
      })}
      {Array.from({ length: N * N }, (_, i) => {
        const r = (i / N) | 0, c = i % N;
        const marked = (r === MID && c === MID) || ((r === 0 || r === N - 1) && (c === 0 || c === N - 1));
        return (
          <g key={i}>
            {marked ? <>
              <circle cx={cx(i)} cy={cy(i)} r={HR + 9} fill="none" stroke="#2a180c" strokeWidth="1.2" />
              <circle cx={cx(i)} cy={cy(i)} r={HR + 9.8} fill="none" stroke="rgb(255 225 180 / .14)" strokeWidth=".5" />
            </> : null}
            <circle cx={cx(i)} cy={cy(i)} r={HR} fill="url(#hole)" stroke="rgb(255 225 180 / .16)" strokeWidth=".6" />
          </g>
        );
      })}
      {ks.map(k => (
        <g key={k}>
          <text x={a + k * CELL} y="494" textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill="#d9b98a" opacity=".55">{"abcdefg"[k]}</text>
          <text x="27" y={a + k * CELL + 3.5} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill="#d9b98a" opacity=".55">{N - k}</text>
        </g>
      ))}
    </g>
  );
});

/** One cup of mead (bronze) or wine (silver), seen from above, with a handle. */
export function Cup({ p, gone }: { p: Piece; gone?: boolean }) {
  const mead = p.side === MEAD;
  return (
    <g className={`pc${p.fresh ? " fresh" : ""}${gone ? " gone" : ""}`} style={{ transform: `translate(${cx(p.pos)}px, ${cy(p.pos)}px)` }}>
      <path d={`M${PR - 2} -5 C ${PR + 7} -6, ${PR + 7} 6, ${PR - 2} 5`} fill="none" stroke={mead ? "#6e5328" : "#7d7a71"} strokeWidth="3.4" strokeLinecap="round" />
      <circle r={PR} fill={`url(#${mead ? "bronzeRim" : "silverRim"})`} stroke={mead ? "#3a2a14" : "#4a4740"} strokeWidth=".8" />
      <circle r={PR - 3.4} fill={`url(#${mead ? "bronzeWall" : "silverWall"})`} />
      <circle className="liquid" r={PR - 5.6} fill={`url(#${mead ? "meadDrink" : "wineDrink"})`} />
      <ellipse className="liquid" cx="-5" cy="-6" rx="5.2" ry="2.4" fill="#fff" opacity={mead ? 0.28 : 0.18} transform="rotate(-30 -5 -6)" />
      <circle r={PR - 0.5} fill="none" stroke="rgb(255 250 235 / .35)" strokeWidth=".5" />
    </g>
  );
}

function Marks({ o }: { o: Overlay }) {
  const ring = (i: number, key: string, stroke: string, width: number, dash?: string, r = PR + 5, opacity?: number) =>
    <circle key={key} cx={cx(i)} cy={cy(i)} r={r} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={dash} opacity={opacity} />;
  let arrow = null;
  if (o.arrow) {
    const x1 = cx(o.arrow.from), y1 = cy(o.arrow.from), x2 = cx(o.arrow.to), y2 = cy(o.arrow.to);
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const sx = x1 + ux * (PR + 3), sy = y1 + uy * (PR + 3), ex = x2 - ux * 12, ey = y2 - uy * 12;
    arrow = <>
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#e8c97e" strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M${ex + ux * 6} ${ey + uy * 6} L${ex - uy * 5} ${ey + ux * 5} L${ex + uy * 5} ${ey - ux * 5} Z`} fill="#e8c97e" />
    </>;
  }
  return (
    <>
      {o.from?.map(f => ring(f, `f${f}`, "#f0d79c", 1.1, "3 4", PR + 5, 0.8))}
      {o.sel != null ? ring(o.sel, "sel", "#f0d79c", 2) : null}
      {o.targets?.map((t, k) => (
        <g key={`t${k}`}>
          <circle cx={cx(t.at)} cy={cy(t.at)} r="10" fill={t.cap ? "#d0584a" : "#f0d79c"} opacity=".92" />
          <text x={cx(t.at)} y={cy(t.at) + 3.8} textAnchor="middle" fontFamily={MONO} fontSize="11" fontWeight="500" fill="#17130f">{t.die}</text>
        </g>
      ))}
      {arrow}
      {o.pick?.squares.map(i => ring(i, `p${i}`, o.pick!.treason ? "#d0584a" : "#e8c97e", 1.8, "4 3"))}
      {o.threats?.map(x => ring(x, `x${x}`, "#d0584a", 1.4, "2 3", PR + 8, 0.9))}
      {o.cursor != null ? (
        <rect x={cx(o.cursor) - PR - 7} y={cy(o.cursor) - PR - 7} width={2 * PR + 14} height={2 * PR + 14} rx="9" fill="none" stroke="#f0d79c" strokeWidth="1.5" strokeDasharray="4 3" />
      ) : null}
    </>
  );
}

export interface BoardProps {
  pieces: Piece[];
  /** Changes with each new game, so cups from the last game are not reused. */
  nonce?: number;
  overlay?: Overlay;
  locked?: boolean;
  onCell?: (i: number) => void;
  onKeyDown?: (e: KeyboardEvent<SVGSVGElement>) => void;
  onFocusChange?: (focused: boolean) => void;
}

/** The yew board of cups. Drunk cups fade out where they stood; refills pour in. */
export function Board(p: BoardProps) {
  // Only cups seen alive on this board fade out when drunk (a reloaded game starts without its ghosts).
  const seen = useRef<{ nonce: number | undefined; ids: Set<number> }>({ nonce: p.nonce, ids: new Set() });
  if (seen.current.nonce !== p.nonce) seen.current = { nonce: p.nonce, ids: new Set() };
  const ids = seen.current.ids;
  for (const pc of p.pieces) if (pc.alive) ids.add(pc.id);
  return (
    <svg id="board" viewBox="0 0 520 520" tabIndex={0} aria-label="Board. Arrow keys move the cursor, Enter selects."
      className={p.locked ? "locked" : undefined} onKeyDown={p.onKeyDown}
      onFocus={() => p.onFocusChange?.(true)} onBlur={() => p.onFocusChange?.(false)}>
      <Defs />
      <g id="boardArt"><BoardArt /></g>
      <g id="marks" />
      <g id="pieces" filter="url(#pegShadow)" key={p.nonce}>
        {p.pieces.filter(pc => pc.alive || ids.has(pc.id)).map(pc => <Cup key={pc.id} p={pc} gone={!pc.alive} />)}
      </g>
      <g id="overlay">{p.overlay ? <Marks o={p.overlay} /> : null}</g>
      <g id="hits">
        {Array.from({ length: N * N }, (_, i) => (
          <rect key={i} className="cellhit" x={cx(i) - CELL / 2} y={cy(i) - CELL / 2} width={CELL} height={CELL} onClick={() => p.onCell?.(i)} />
        ))}
      </g>
    </svg>
  );
}
