// Pieces of the "Earned turns" page: the purse of turns under the dial, and the glow on joins just made.
import { f, geom, MID, piecesFor, RIN, toPath, uvxy } from "../engine/dial";
import { N, OPP, S_, type TierId } from "../engine/knot";
import type { Join } from "./engine";

/** Past this many turns in hand the purse shows a count only. */
const MAX_PIPS = 16;

/** The turns in hand, as pips that grow when turns are earned, with a brief "+N". */
export function Purse(p: { pool: number; gain: number; flashKey: number | null }) {
  const many = p.pool > MAX_PIPS;
  return (
    <div className="earn-purse" aria-hidden="true">
      <span className="earn-purse-label">Turns</span>
      {!many && (
        <span className="pips">
          {Array.from({ length: p.pool }, (_, i) => (
            <span key={i} className={`pip on${p.flashKey != null && i >= p.pool - p.gain ? " earn-new" : ""}`} />
          ))}
        </span>
      )}
      <span className={`earn-count${p.pool === 0 ? " empty" : ""}`}>
        {p.pool}
        {p.flashKey != null && p.gain > 0 && <span key={p.flashKey} className="earn-pop">+{p.gain}</span>}
      </span>
    </div>
  );
}

/** The strand piece of stone k that runs through `side` (a crossing carries two). */
function pieceThrough(m: number, side: number) {
  const pcs = piecesFor(m);
  return m === 15 ? pcs[side === N || side === S_ ? 0 : 1] : pcs[0];
}

/**
 * Joins just made, lit up on the disc: the strand on both stones and a bright knot where they meet,
 * plus "+N" over the stone that was turned. Drawn in disc coordinates (it spins with the disc);
 * the label is turned back by `phi` so it reads upright.
 */
export function JoinGlow(p: { tier: TierId; sol: number[]; joins: Join[]; made: number[]; k: number; gain: number; phi: number; flashKey: number }) {
  const g = geom(p.tier);
  const rw = Math.min(g.w * .15, 2 * Math.PI * (RIN + g.w / 2) / g.C * .15);
  const [tx, ty] = uvxy(g, p.k, .5, .5);
  return (
    <g key={p.flashKey} className="earn-glow" pointerEvents="none">
      {p.made.map(i => {
        const j = p.joins[i], [u, v] = MID[j.side], [x, y] = uvxy(g, j.a, u, v);
        const da = toPath(g, j.a, pieceThrough(p.sol[j.a], j.side)), db = toPath(g, j.b, pieceThrough(p.sol[j.b], OPP[j.side]));
        return (
          <g key={i}>
            <path d={da} stroke="#f3cf6a" strokeWidth={f(rw * 1.25)} strokeLinecap="round" fill="none" opacity=".85" />
            <path d={db} stroke="#f3cf6a" strokeWidth={f(rw * 1.25)} strokeLinecap="round" fill="none" opacity=".85" />
            <circle cx={f(x)} cy={f(y)} r={f(rw * 3.2)} fill="#f3cf6a" opacity=".35" />
            <circle cx={f(x)} cy={f(y)} r={f(rw * 1.7)} fill="#fff3c4" stroke="#f3cf6a" strokeWidth="1.2" />
          </g>
        );
      })}
      <g transform={`translate(${f(tx)} ${f(ty)}) rotate(${f(-p.phi)})`}>
        <g className="earn-glow-label">
          <text textAnchor="middle" dy="5" fontSize="16" fontWeight="700" fill="#fff3c4" stroke="#120e0a" strokeWidth="3.5" paintOrder="stroke"
            fontFamily="IBM Plex Mono, monospace">+{p.gain}</text>
        </g>
      </g>
    </g>
  );
}
