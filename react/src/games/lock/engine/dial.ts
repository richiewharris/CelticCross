// Geometry of the dial: where stones, strands and the window sit in the SVG (viewBox -210..210).
// Pure maths and path strings, no DOM.
import { BITS, E, N, S_, TIERS, W, WC, WIN, type TierId } from "./knot";

export const RIN = 54, ROUT = 186;

export const rad = (d: number) => d * Math.PI / 180;
/** A point at compass bearing `deg` (0 = up, clockwise) and radius rho. */
export const pt = (deg: number, rho: number): [number, number] => [rho * Math.sin(rad(deg)), -rho * Math.cos(rad(deg))];
export const f = (n: number) => n.toFixed(2);

const MID: Record<number, [number, number]> = { 1: [.5, 1], 2: [1, .5], 4: [.5, 0], 8: [0, .5] };
const CORNER: Record<number, [number, number]> = { 3: [1, 1], 6: [1, 0], 12: [0, 0], 9: [0, 1] };
export { MID };

export interface Geom { R: number; C: number; w: number; da: number }
export function geom(tier: TierId): Geom {
  const T = TIERS[tier];
  return { R: T.rings, C: T.sectors, w: (ROUT - RIN) / T.rings, da: 360 / T.sectors };
}

/** Stone-local (u across the sector, v outwards) to SVG coordinates. */
export function uvxy(g: Geom, k: number, u: number, v: number): [number, number] {
  const r = (k / g.C) | 0, s = k % g.C;
  return pt((s + u) * g.da, RIN + (r + v) * g.w);
}
function linePts(a: number, b: number) {
  const A = MID[a], B = MID[b], out: [number, number][] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
  return out;
}
function arcPts(mask: number, a: number, b: number) {
  const c = CORNER[mask], A = MID[a], B = MID[b];
  const a0 = Math.atan2(A[1] - c[1], A[0] - c[0]), a1 = Math.atan2(B[1] - c[1], B[0] - c[0]);
  let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const out: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const t = a0 + d * i / 12; out.push([c[0] + .5 * Math.cos(t), c[1] + .5 * Math.sin(t)]); }
  return out;
}
/** The strand pieces on a stone, in stone-local coordinates (a crossing has two). */
export function piecesFor(m: number): [number, number][][] {
  if (m === 15) return [linePts(N, S_), linePts(E, W)];
  const bits = BITS.filter(b => m & b);
  if (m === 5 || m === 10) return [linePts(bits[0], bits[1])];
  return [arcPts(m, bits[0], bits[1])];
}
export const toPath = (g: Geom, k: number, uv: [number, number][]) =>
  uv.map(([u, v], i) => { const [x, y] = uvxy(g, k, u, v); return (i ? "L" : "M") + f(x) + " " + f(y); }).join("");

export function tileOutline(g: Geom, k: number, inset = 0): string {
  const r = (k / g.C) | 0, s = k % g.C, ri = RIN + r * g.w + inset, ro = RIN + (r + 1) * g.w - inset, a0 = s * g.da, a1 = a0 + g.da;
  const ai = inset / ri * 180 / Math.PI, ao = inset / ro * 180 / Math.PI;
  const p = [pt(a0 + ai, ri), pt(a0 + ao, ro), pt(a1 - ao, ro), pt(a1 - ai, ri)];
  return `M${f(p[0][0])} ${f(p[0][1])}L${f(p[1][0])} ${f(p[1][1])}A${ro} ${ro} 0 0 1 ${f(p[2][0])} ${f(p[2][1])}L${f(p[3][0])} ${f(p[3][1])}A${ri} ${ri} 0 0 0 ${f(p[0][0])} ${f(p[0][1])}Z`;
}

/** An angle folded into -180..180. */
export const norm = (d: number) => { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
/** Is stone k inside the window when the disc is turned by phi degrees? */
export function visible(g: Geom, k: number, phi: number): boolean {
  const s = k % g.C;
  return Math.abs(norm((s + .5) * g.da + phi - WC)) < WIN - 2;
}
/** The spin that centres the nearest sector in the window. */
export const snapPhi = (g: Geom, phi: number) => { const q = phi - WC; return Math.round((q / g.da) - .5) * g.da + .5 * g.da + WC; };

/** The bronze cover: a plate with a one-third window and a hole for the hub. */
export function coverPaths() {
  const outer = "M-205 -205H205V205H-205Z";
  const a = pt(WC - WIN, ROUT + 4), b = pt(WC + WIN, ROUT + 4), c = pt(WC + WIN, RIN - 2), d = pt(WC - WIN, RIN - 2);
  const hole = `M${f(a[0])} ${f(a[1])}A${ROUT + 4} ${ROUT + 4} 0 0 1 ${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}A${RIN - 2} ${RIN - 2} 0 0 0 ${f(d[0])} ${f(d[1])}Z`;
  const hr = RIN - 4, center = `M${hr} 0A${hr} ${hr} 0 1 0 ${-hr} 0A${hr} ${hr} 0 1 0 ${hr} 0Z`;
  return { plate: outer + hole + center, hole, center };
}
