import { useId } from "react";
import { SPOTS, type SpotState } from "../engine/day";

const PATH = "M-10 40 C 60 30, 70 90, 120 110 S 190 170, 220 120 S 280 60, 330 170";

/** The map of the river with its panning spots; a spot lights up gold once it has paid. */
export function RiverMap({ spots, onPick }: { spots: SpotState[]; onPick: (id: string) => void }) {
  const grad = `rw${useId().replace(/:/g, "")}`;
  return (
    <svg id="river" viewBox="0 0 320 210" aria-label="Map of the river with panning spots">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3f5f59" /><stop offset="1" stopColor="#2c4541" /></linearGradient>
      </defs>
      <rect width="320" height="210" fill="#232a26" />
      <path d={PATH} fill="none" stroke="#3a3328" strokeWidth="44" strokeLinecap="round" opacity=".7" />
      <path d={PATH} fill="none" stroke={`url(#${grad})`} strokeWidth="30" strokeLinecap="round" />
      <path d={PATH} fill="none" stroke="rgb(220 240 235 / .18)" strokeWidth="1.2" strokeDasharray="6 9" />
      <ellipse cx="200" cy="99" rx="9" ry="7" fill="#6b6559" stroke="#2a2620" />
      <path d="M58 52 l14 22 M66 48 l12 20" stroke="#18140f" strokeWidth="1.6" />
      <text x="16" y="198" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#a3a08f">downstream →</text>
      {SPOTS.map(s => {
        const st = spots.find(x => x.id === s.id);
        const lit = st != null && st.lastMg != null && st.lastMg > 0;
        return (
          <g key={s.id} className="spot-mark" data-id={s.id} tabIndex={-1} role="button" aria-label={s.name} onClick={() => onPick(s.id)}>
            <circle className="ring" cx={s.x} cy={s.y} r="11" fill={lit ? "#e2b33c" : "#141716"} stroke="#e2b33c" strokeWidth="1.6" />
            <text x={s.x} y={s.y + 4} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fontWeight="500" fill={lit ? "#141716" : "#f6d77a"}>{s.id}</text>
          </g>
        );
      })}
    </svg>
  );
}
