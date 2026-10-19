// Drawing the three dice as SVG fragments (drawn around 0,0; the caller places and scales them).
import { useId } from "react";
import type { Die } from "../engine/dice";

const f = (n: number) => n.toFixed(2);
type Pt = [number, number];

// Wire patterns on a face, in face coordinates (0–1). The number is simply how many wires run
// across the top face: one way for 1–3, both ways for 4–6.
const E = 0.05;
const H = (y: number): [Pt, Pt] => [[E, y], [1 - E, y]];
const Vt = (x: number): [Pt, Pt] => [[x, E], [x, 1 - E]];
const WIRES: Record<number, [Pt, Pt][]> = {
  1: [H(.5)],
  2: [H(.33), H(.67)],
  3: [H(.24), H(.5), H(.76)],
  4: [H(.33), H(.67), Vt(.33), Vt(.67)],
  5: [H(.24), H(.5), H(.76), Vt(.33), Vt(.67)],
  6: [H(.24), H(.5), H(.76), Vt(.24), Vt(.5), Vt(.76)],
};

/** An isometric cube standing at (x, y) whose top face shows `value` wires, size s. */
export function Cube({ x, y, s, value, blank }: { x: number; y: number; s: number; value: number; blank?: boolean }) {
  const k = 0.866;
  const top: Pt = [x, y - s], right: Pt = [x + s * k, y - s / 2], bot: Pt = [x, y], left: Pt = [x - s * k, y - s / 2];
  const P = (u: number, v: number): Pt => [bot[0] + u * (right[0] - bot[0]) + v * (left[0] - bot[0]), bot[1] + u * (right[1] - bot[1]) + v * (left[1] - bot[1])];
  const pts = (a: Pt[]) => a.map(p => f(p[0]) + "," + f(p[1])).join(" ");
  const down = (p: Pt): Pt => [p[0], p[1] + s];
  const w = s * .085, lines = blank ? [] : WIRES[value] ?? [];
  const seg = (a0: Pt, b0: Pt) => { const a = P(a0[0], a0[1]), b = P(b0[0], b0[1]); return { x1: f(a[0]), y1: f(a[1]), x2: f(b[0]), y2: f(b[1]) }; };
  const edge = f(s * .04);
  return (
    <>
      <polygon points={pts([left, bot, down(bot), down(left)])} fill="#4a2f1b" />
      <polygon points={pts([bot, right, down(right), down(bot)])} fill="#331f12" />
      <polygon points={pts([left, top, right, bot])} fill="#6b4627" />
      {/* each wire: a dark groove under a bright copper strand, so every crossing reads clearly */}
      {lines.map(([a0, b0], i) => <line key={`g${i}`} {...seg(a0, b0)} stroke="#2a170b" strokeWidth={f(w * 1.9)} strokeLinecap="butt" />)}
      {lines.map(([a0, b0], i) => <line key={`w${i}`} {...seg(a0, b0)} stroke={i % 2 ? "#f0b878" : "#d6955a"} strokeWidth={f(w)} strokeLinecap="butt" />)}
      <polygon points={pts([left, top, right, bot])} fill="none" stroke="#1d120a" strokeWidth={edge} />
      <polyline points={pts([left, down(left), down(bot), down(right), right])} fill="none" stroke="#1d120a" strokeWidth={edge} />
      <line x1={f(bot[0])} y1={f(bot[1])} x2={f(bot[0])} y2={f(bot[1] + s)} stroke="#1d120a" strokeWidth={edge} />
    </>
  );
}

/** The four-sided die: a caltrop of four bone legs, seen at an angle on the table. Three legs rest on
 *  the table and one stands straight up; the standing leg's notches give the number. */
function Caltrop({ value, rot }: { value: number; rot: number }) {
  const id = "fiche-bone" + useId().replace(/[^\w-]/g, "");
  const L = 38, w = 11;
  const iso = (x: number, y: number, z: number): Pt => [(x - y) * 0.866, (x + y) * 0.5 - z];
  // the hub sits at the height where the three lower legs meet the table
  const hz = L / 3;
  const legs = [0, 120, 240].map(k => {
    const a = ((rot + k) * Math.PI) / 180, h = (L * Math.sqrt(8)) / 3;
    return { end: iso(Math.cos(a) * h, Math.sin(a) * h, 0), depth: Math.cos(a) * h + Math.sin(a) * h };
  });
  const hub = iso(0, 0, hz), top = iso(0, 0, hz + L);
  const bone = (s0: Pt, e0: Pt, key: string) => {
    const dx = e0[0] - s0[0], dy = e0[1] - s0[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    return (
      <g key={key}>
        <line x1={f(s0[0])} y1={f(s0[1])} x2={f(e0[0])} y2={f(e0[1])} stroke="#4a3b28" strokeWidth={f(w + 2.2)} strokeLinecap="round" />
        {/* knuckled end, like the end of a long bone */}
        {[-1, 1].map(sgn => <circle key={sgn} cx={f(e0[0] + nx * sgn * w * .42)} cy={f(e0[1] + ny * sgn * w * .42)} r={f(w * .62)} fill={`url(#${id})`} stroke="#4a3b28" strokeWidth="1.1" />)}
        <line x1={f(s0[0])} y1={f(s0[1])} x2={f(e0[0])} y2={f(e0[1])} stroke={`url(#${id})`} strokeWidth={f(w)} strokeLinecap="round" />
        <line x1={f(s0[0] - nx * w * .22)} y1={f(s0[1] - ny * w * .22)} x2={f(e0[0] - nx * w * .22)} y2={f(e0[1] - ny * w * .22)} stroke="#fffaf0" strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
      </g>
    );
  };
  const tip = top[1] + w * .95, hw = w / 2 + .6;
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="-30" y1="-50" x2="30" y2="30">
          <stop offset="0" stopColor="#f6ecd4" /><stop offset=".55" stopColor="#d9c8a3" /><stop offset="1" stopColor="#9c8763" />
        </linearGradient>
      </defs>
      <ellipse cx="3" cy="15" rx="38" ry="15" fill="rgb(0 0 0 / .2)" />
      {legs.filter(l => l.depth < 0).map((l, i) => bone(hub, l.end, `b${i}`))}
      <circle cx={f(hub[0])} cy={f(hub[1])} r={f(w * .95)} fill={`url(#${id})`} stroke="#4a3b28" strokeWidth="1.1" />
      {/* the standing leg, with its notches cut around it near the tip */}
      {bone(hub, top, "up")}
      {Array.from({ length: value }, (_, k) => {
        const y = tip + 2.5 + k * 5.6;
        return (
          <g key={`n${k}`}>
            <path d={`M${f(top[0] - hw)} ${f(y)} Q${f(top[0])} ${f(y + 3.2)} ${f(top[0] + hw)} ${f(y)}`} fill="none" stroke="#2e2112" strokeWidth="2.6" strokeLinecap="round" />
            <path d={`M${f(top[0] - hw + 1)} ${f(y + 1.9)} Q${f(top[0])} ${f(y + 4.9)} ${f(top[0] + hw - 1)} ${f(y + 1.9)}`} fill="none" stroke="#fffaf0" strokeWidth=".8" opacity=".5" />
          </g>
        );
      })}
      {legs.filter(l => l.depth >= 0).map((l, i) => bone(hub, l.end, `f${i}`))}
    </>
  );
}

/** The twin cubes on a rod. Value 1 means it stands on end. */
function Twin({ value, seed }: { value: number; seed: number }) {
  if (value === 1) {
    return (
      <>
        <ellipse cx="5" cy="30" rx="28" ry="12" fill="rgb(0 0 0 / .3)" />
        <Cube x={0} y={36} s={26} value={1} blank />
        <rect x="-4" y="-6" width="8" height="18" fill="#8a8580" stroke="#2a2724" strokeWidth=".8" />
        <Cube x={0} y={-6} s={26} value={1} />
      </>
    );
  }
  const lo = Math.max(1, value - 4), hi = Math.min(4, value - 1);
  const a = lo + Math.floor(seed * (hi - lo + 1)), b = value - a;
  // The two cubes sit one behind the other along the cube's own edge direction,
  // joined face to face by the rod, so the rod follows the same angle as the cubes.
  const S2 = 26, gap = 24, ux = 0.866, uy = 0.5, step = S2 + gap;
  const c1: Pt = [(-ux * step) / 2, 10 - (uy * step) / 2], c2: Pt = [(ux * step) / 2, 10 + (uy * step) / 2];
  // rod: from the middle of the back cube's right-hand face toward the front cube
  const r0: Pt = [c1[0] + (ux * S2) / 2, c1[1] + S2 * .25], r1: Pt = [r0[0] + ux * (gap + 4), r0[1] + uy * (gap + 4)];
  return (
    <>
      <ellipse cx="4" cy="24" rx="66" ry="20" transform="rotate(30 4 24)" fill="rgb(0 0 0 / .26)" />
      <Cube x={c1[0]} y={c1[1]} s={S2} value={a} />
      <line x1={f(r0[0])} y1={f(r0[1])} x2={f(r1[0])} y2={f(r1[1])} stroke="#2a2724" strokeWidth="9" strokeLinecap="round" />
      <line x1={f(r0[0])} y1={f(r0[1] - 1.2)} x2={f(r1[0])} y2={f(r1[1] - 1.2)} stroke="#a7a29a" strokeWidth="4.5" strokeLinecap="round" />
      <Cube x={c2[0]} y={c2[1]} s={S2} value={b} />
    </>
  );
}

/** Die d showing `value`. `seed` (0–1) varies the caltrop's turn and how the twin cubes split the sum. */
export function DieArt({ d, value, seed = 0.5 }: { d: Die; value: number; seed?: number }) {
  if (d === 0) return <Caltrop value={value} rot={20 + seed * 80} />;
  if (d === 1) return <><ellipse cx="5" cy="24" rx="42" ry="15" fill="rgb(0 0 0 / .28)" /><Cube x={0} y={22} s={40} value={value} /></>;
  return <Twin value={value} seed={seed} />;
}

/** The face each die shows in the hand. */
export const HAND_FACE = [4, 6, 8] as const;
