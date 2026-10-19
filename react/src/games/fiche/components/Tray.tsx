// The rolling tray, split down the middle: Player 1's dice land on the left half, Player 2's on
// the right. A die in flight tumbles in from its owner's edge, flickering through faces, and settles.
import { useEffect, useState } from "react";
import { DIST, type Die } from "../engine/dice";
import type { Player, Roll } from "../engine/game";
import { DieArt } from "./DieArt";

const f = (n: number) => n.toFixed(2);
const TW = 420, HALF = TW / 2;
export const ROLL_MS = 750;

/** A die on its way into the tray; t0 is a performance.now() time. */
export interface Flight { p: Player; d: Die; v: number; seed: number; t0: number; dur: number }

const slotFor = (p: Player, k: number): [number, number] => [(p === 1 ? 0 : HALF) + 57 + (k % 2) * 96, 72 + Math.floor(k / 2) * 106];

interface Frame { face: number; seed: number; x: number; y: number; rot: number }

function frameAt(fl: Flight, index: number, target: [number, number], now: number): Frame {
  const [tx, ty] = target, sx = fl.p === 1 ? -70 : TW + 70, sy = ty - 30;
  const k = Math.min(1, Math.max(0, (now - fl.t0) / fl.dur)), e = 1 - Math.pow(1 - k, 3);
  const bounce = Math.sin(k * Math.PI * 2.4) * (1 - k) * 18;
  const face = k < 0.85 ? DIST[fl.d][(Math.floor(now / 70) + index) % DIST[fl.d].length][0] : fl.v;
  return { face, seed: k < 0.85 ? Math.random() : fl.seed, x: sx + (tx - sx) * e, y: sy + (ty - sy) * e - bounce, rot: (1 - e) * (fl.p === 1 ? -420 : 420) };
}

export function Tray(props: {
  rolls: Roll[]; flight: Flight | null; pvp: boolean;
  /** Shown in the empty tray before the first roll: who rolls first, on their half. */
  first: { p: Player; lines: [string, string] } | null;
}) {
  const { rolls, flight } = props;
  const count = (p: Player) => rolls.filter(r => r.p === p).length;
  const n = Math.max(count(1), count(2)) + 1, H = Math.max(3, Math.ceil(n / 2)) * 106 + 30;
  const target = flight ? slotFor(flight.p, count(flight.p)) : null;
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!flight) return;
    let raf = 0;
    const tick = (t: number) => { setNow(t); if (t - flight.t0 < flight.dur) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flight]);

  const fr = flight && target ? frameAt(flight, rolls.length, target, now) : null;
  const you = props.pvp ? "PLAYER 1" : "YOUR SIDE", them = props.pvp ? "PLAYER 2" : "RIVAL'S SIDE";
  const nth = rolls.map((r, i) => rolls.slice(0, i).filter(x => x.p === r.p).length);
  const italic = { textAnchor: "middle" as const, fontFamily: "Spectral, Georgia, serif", fontStyle: "italic", fontSize: 14, fill: "#a99c84" };

  return (
    <svg id="tray" viewBox={`0 0 ${TW} ${H}`} aria-label="Rolling tray, your half on the left and your rival's on the right">
      <defs><radialGradient id="fiche-felt" cx="50%" cy="45%" r="70%"><stop offset="0" stopColor="#3a2a1c" /><stop offset="1" stopColor="#1f160f" /></radialGradient></defs>
      <rect x="2" y="2" width={TW - 4} height={H - 4} rx="14" fill="url(#fiche-felt)" stroke="#3d3328" strokeWidth="2" />
      <rect x={HALF - 3} y="10" width="6" height={H - 20} rx="3" fill="#120c07" stroke="rgb(255 220 170 / .12)" />
      <rect x="2" y="2" width={HALF - 4} height={H - 4} rx="14" fill="rgb(217 164 65 / .035)" />
      <rect x={HALF + 2} y="2" width={HALF - 4} height={H - 4} rx="14" fill="rgb(159 180 196 / .035)" />
      <text x={HALF / 2} y="24" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" letterSpacing="2" fill="#d9a441" opacity=".55">{you}</text>
      <text x={HALF + HALF / 2} y="24" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" letterSpacing="2" fill="#9fb4c4" opacity=".55">{them}</text>
      {rolls.map((r, i) => {
        const [x, y] = slotFor(r.p, nth[i]);
        return (
          <g key={i}>
            <g transform={`translate(${x} ${y}) scale(.78)`}><DieArt d={r.d} value={r.v} seed={r.seed} /></g>
            <text x={x} y={y + 50} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="15" fontWeight="500" fill={r.p === 1 ? "#d9a441" : "#9fb4c4"}>{r.v}{r.v === 3 ? " ↻" : ""}</text>
          </g>
        );
      })}
      {fr && flight ? (
        <g transform={`translate(${f(fr.x)} ${f(fr.y)}) rotate(${f(fr.rot)}) scale(.78)`}><DieArt d={flight.d} value={fr.face} seed={fr.seed} /></g>
      ) : null}
      {!rolls.length && !flight && props.first ? (
        <>
          <text x={props.first.p === 1 ? HALF / 2 : HALF + HALF / 2} y={H / 2} {...italic}>{props.first.lines[0]}</text>
          <text x={props.first.p === 1 ? HALF / 2 : HALF + HALF / 2} y={H / 2 + 18} {...italic}>{props.first.lines[1]}</text>
        </>
      ) : null}
    </svg>
  );
}
