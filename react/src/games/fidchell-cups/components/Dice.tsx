const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function Die({ x, v, dim, queen }: { x: number; v: number; dim: boolean; queen: boolean }) {
  return (
    <g opacity={dim ? 0.35 : 1}>
      <rect x={x - 28} y="7" width="56" height="56" rx="10" fill="url(#boneD)" stroke={queen ? "#e8c97e" : "#6d6250"} strokeWidth={queen ? 2.2 : 1} />
      <rect x={x - 24} y="10" width="48" height="8" rx="4" fill="#fffaf0" opacity=".3" />
      {v ? PIPS[v].map(([a, b], k) => (
        <g key={k}>
          <circle cx={x + a * 13} cy={35 + b * 13} r="4.4" fill="none" stroke="#3b2f22" strokeWidth="1.3" />
          <circle cx={x + a * 13} cy={35 + b * 13} r="1.6" fill="#3b2f22" />
        </g>
      )) : null}
    </g>
  );
}

/** The two bone dice. Used dice are dimmed; the Queen's number rings them in gold. `tumble` replays the throw. */
export function Dice(p: { d: readonly number[] | null; used?: readonly boolean[]; queen?: boolean; tumble?: number }) {
  return (
    <svg id="dice" key={p.tumble} className={p.tumble ? "tumble" : undefined} viewBox="0 0 150 70" aria-hidden="true">
      <defs>
        <linearGradient id="boneD" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3ead6" /><stop offset=".6" stopColor="#d8cbac" /><stop offset="1" stopColor="#a4977b" />
        </linearGradient>
      </defs>
      <Die x={38} v={p.d ? p.d[0] : 0} dim={!!p.used?.[0]} queen={!!p.queen} />
      <Die x={112} v={p.d ? p.d[1] : 0} dim={!!p.used?.[1]} queen={!!p.queen} />
    </svg>
  );
}
