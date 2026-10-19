// The carved scoring disk: a spiral groove from 0 at the outer end winding in to 20 at the centre,
// with a bronze peg walked along it one hole at a time. The original page keeps it hidden in favour
// of the dial, and so does this port; the Playground shows it.
import { useEffect, useState } from "react";
import { useReducedMotion } from "../useReducedMotion";

const DC = 130, R_OUT = 108, R_IN = 30, TURNS = 2;
const SPIRAL = (() => {
  const N = 2000, pts: [number, number][] = [], TH = TURNS * Math.PI * 2;
  for (let i = 0; i <= N; i++) { const th = (TH * i) / N, r = R_IN + (R_OUT - R_IN) * (th / TH); pts.push([th, r]); }
  const xy = ([th, r]: [number, number]): [number, number] => [DC + r * Math.cos(-th - Math.PI / 2), DC + r * Math.sin(-th - Math.PI / 2)];
  const cum = [0];
  for (let i = 1; i <= N; i++) { const a = xy(pts[i - 1]), b = xy(pts[i]); cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[N], holes: [number, number][] = [];
  for (let t = 0; t < 20; t++) { const target = total * (1 - t / 19); let i = 0; while (i < N && cum[i] < target) i++; holes.push(xy(pts[i])); }
  holes.push([DC, DC]);
  // the groove runs from the rim inward and ends in the centre hole
  const path = pts.filter((_, i) => i % 10 === 0).reverse().map((p, i) => (i ? "L" : "M") + xy(p).map(v => v.toFixed(1)).join(" ")).join("") + `L${DC} ${DC}`;
  return { holes, path };
})();
const MARK: Record<number, [string, string]> = { 7: ["again", "#7fae7a"], 9: ["loses", "#d0584a"], 12: ["draw", "#a99c84"], 20: ["wins", "#d9b77d"] };

export function Spiral({ total, hidden }: { total: number; hidden?: boolean }) {
  const reduce = useReducedMotion();
  const [pegAt, setPegAt] = useState(0);
  const target = Math.min(20, total);
  // Walk the peg forward one hole every 110 ms; jump straight back on a new round.
  useEffect(() => {
    if (reduce || target <= pegAt) { if (pegAt !== target) setPegAt(target); return; }
    const t = setTimeout(() => setPegAt(pegAt + 1), 110);
    return () => clearTimeout(t);
  }, [target, pegAt, reduce]);
  const [px, py] = SPIRAL.holes[pegAt];
  return (
    <div className="disk-wrap" hidden={hidden}>
      <svg id="pegs" viewBox="0 0 260 260" aria-label="Scoring spiral">
        <defs>
          <radialGradient id="fiche-dk" cx="45%" cy="38%" r="70%"><stop offset="0" stopColor="#6b4a2c" /><stop offset="1" stopColor="#3a2516" /></radialGradient>
          <radialGradient id="fiche-peg" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#f3d79a" /><stop offset=".55" stopColor="#b08d55" /><stop offset="1" stopColor="#5c4421" /></radialGradient>
        </defs>
        <circle cx={DC + 3} cy={DC + 5} r="126" fill="rgb(0 0 0 / .35)" />
        <circle cx={DC} cy={DC} r="126" fill="url(#fiche-dk)" stroke="#1d120a" strokeWidth="1.5" />
        <circle cx={DC} cy={DC} r="121" fill="none" stroke="#b08d55" strokeWidth="1.2" opacity=".75" />
        <circle cx={DC} cy={DC} r="118" fill="none" stroke="rgb(255 220 170 / .12)" strokeDasharray="2 5" />
        <path d={SPIRAL.path} fill="none" stroke="#1d120a" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity=".8" />
        <path d={SPIRAL.path} fill="none" stroke="rgb(255 220 170 / .1)" strokeWidth="1" transform="translate(0 -1.5)" />
        {SPIRAL.holes.map(([x, y], t) => {
          const m = MARK[t], big = t === 20;
          // the number, set just outside the groove
          const dx = x - DC, dy = y - DC, d = Math.hypot(dx, dy) || 1, off = t === 20 ? 0 : m ? 20 : 13;
          const lx = t === 0 ? x - 13 : x + (dx / d) * off, ly = t === 0 ? y + 3.5 : y + (dy / d) * off + 3.2;
          return (
            <g key={t}>
              {m ? <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={big ? 17 : 11} fill="none" stroke={m[1]} strokeWidth="2" /> : null}
              <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={big ? 9 : 5} fill="#0f0905" stroke="rgb(255 220 170 / .18)" />
              {t !== 20 ? <text x={lx.toFixed(1)} y={ly.toFixed(1)} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={m ? 11.5 : 10} fontWeight={m ? 600 : 500} fill={m ? m[1] : "#d8c39c"}>{t}</text> : null}
            </g>
          );
        })}
        <text x={DC} y={DC + 31} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="12.5" fontWeight="600" fill="#d9b77d">20</text>
        <g style={{ transition: "transform .12s ease-out", transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`, opacity: total > 20 ? .45 : 1 }}>
          <circle cx="0" cy="0" r="7.5" fill="url(#fiche-peg)" stroke="#2a1a0a" />
          <circle cx="-2.2" cy="-2.6" r="1.8" fill="#fff" opacity=".55" />
        </g>
      </svg>
      <p className="total">Total <b>{total}</b>{total > 20 ? " · over" : ""}</p>
    </div>
  );
}
