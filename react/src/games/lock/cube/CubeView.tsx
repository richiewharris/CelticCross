// The cube: six faces of carved stone placed in 3D with CSS transforms, each drawn as its own SVG in the
// dial's look (stone, grooves, raised aged-bronze pins, rivets on crossings, round knobs on loose ends).
// The cube's own turn is pushed straight to the DOM on every animation frame (see useCube), so React
// only redraws a face when its stones change or it comes into or out of view.
import { useId, type KeyboardEvent, type MutableRefObject, type PointerEvent, type ReactNode } from "react";
import { BITS, E, N, S_, W, signedSteps } from "../engine/knot";
import { FACES, faceTransform, type CubeGeom } from "./engine";

export interface CubeDom { scene: HTMLDivElement | null; body: HTMLDivElement | null; shades: (HTMLDivElement | null)[] }
export const emptyCubeDom = (): CubeDom => ({ scene: null, body: null, shades: [] });

const f2 = (n: number) => +n.toFixed(2);

/** Point on a stone (row i, column j, side s units) at local u (right), v (down) in 0..1. */
const at = (i: number, j: number, s: number, u: number, v: number): [number, number] => [f2((j + u) * s), f2((i + v) * s)];
const MID: Record<number, [number, number]> = { [N]: [.5, 0], [E]: [1, .5], [S_]: [.5, 1], [W]: [0, .5] };

/** The strand pieces on a stone as SVG paths (a crossing has two: up-down and across). */
export function stonePieces(m: number, i: number, j: number, s: number): string[] {
  const line = (a: number, b: number) => { const A = at(i, j, s, ...MID[a]), B = at(i, j, s, ...MID[b]); return `M${A[0]} ${A[1]}L${B[0]} ${B[1]}`; };
  if (m === 15) return [line(N, S_), line(E, W)];
  const [a, b] = BITS.filter(x => m & x);
  if (m === (N | S_) || m === (E | W)) return [line(a, b)];
  const A = MID[a], B = MID[b], C: [number, number] = [A[0] === .5 ? B[0] : A[0], A[1] === .5 ? B[1] : A[1]];
  const cr = (A[0] - C[0]) * (B[1] - C[1]) - (A[1] - C[1]) * (B[0] - C[0]);
  const P = at(i, j, s, ...A), Q = at(i, j, s, ...B), r = f2(s / 2);
  return [`M${P[0]} ${P[1]}A${r} ${r} 0 0 ${cr > 0 ? 1 : 0} ${Q[0]} ${Q[1]}`];
}

/** Aged bronze pin: dark edge, dull brown-bronze body, green patina and a worn highlight (as on the dial). */
function Ribbon({ d, w }: { d: string; w: number }) {
  return (
    <>
      <path d={d} stroke="#1d150c" strokeWidth={f2(w * 1.45)} fill="none" />
      <path d={d} stroke="#8a6b3e" strokeWidth={f2(w)} fill="none" />
      <path d={d} stroke="#5f7a62" strokeWidth={f2(w * .55)} strokeDasharray=".7 4 1.8 6" strokeOpacity=".55" fill="none" />
      <path d={d} stroke="#c4a36c" strokeWidth={f2(Math.max(.3, w * .22))} strokeOpacity=".75" fill="none" />
    </>
  );
}

const RIVETS: [number, number][] = [[.12, .12], [.88, .12], [.12, .88], [.88, .88]];

/** Shared gradients and filters, referenced by every face. */
export function CubeDefs({ uid }: { uid: string }) {
  const id = (n: string) => `${uid}-${n}`;
  return (
    <svg className="cube-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={id("stone")} cx="45%" cy="42%" r="80%">
          <stop offset="0" stopColor="#8b877d" />
          <stop offset="1" stopColor="#6d6a61" />
        </radialGradient>
        <filter id={id("tex")} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves={3} seed={7} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .32  0 0 0 0 .3  0 0 0 0 .27  0 0 0 -1.4 1.05" result="speck" />
          <feComposite in="speck" in2="SourceGraphic" operator="in" result="speckIn" />
          <feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves={2} seed={3} result="mottle" />
          <feColorMatrix in="mottle" type="matrix" values="0 0 0 0 .2  0 0 0 0 .19  0 0 0 0 .16  0 0 0 .55 -.18" result="mot" />
          <feComposite in="mot" in2="SourceGraphic" operator="in" result="motIn" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="motIn" /><feMergeNode in="speckIn" /></feMerge>
        </filter>
        <filter id={id("raise")} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation=".55" result="blur" />
          <feOffset in="blur" dx=".9" dy="1.25" result="off" />
          <feFlood floodColor="#000" floodOpacity=".7" />
          <feComposite in2="off" operator="in" result="shadow" />
          <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={id("boss")} cx="40%" cy="36%" r="70%">
          <stop offset="0" stopColor="#6a5233" />
          <stop offset=".7" stopColor="#3d2f1f" />
          <stop offset="1" stopColor="#271d13" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export interface FaceProps {
  uid: string; g: CubeGeom; f: number; cur: number[]; sol: number[];
  /** The knot shows on this face (always, except on obscured tiers away from the front). */
  reveal: boolean;
  /** Its stones can be turned now. */
  live: boolean;
  cheat: boolean; open: boolean;
  ends: [number, number][];
}

/** One face of the cube: an N×N grid of stones in a 100×100 box. */
export function FaceSvg(p: FaceProps) {
  const url = (n: string) => `url(#${p.uid}-${n})`;
  const n = p.g.N, s = 100 / n, rw = s * .15, base = p.f * n * n;
  const stones: ReactNode[] = [], grooves: ReactNode[] = [], pins: ReactNode[] = [], aids: ReactNode[] = [];
  const showAids = p.cheat && !p.open && p.reveal;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = base + i * n + j, m = p.cur[k], [x, y] = at(i, j, s, 0, 0), [cx, cy] = at(i, j, s, .5, .5);
    const fixed = m === 15 && p.reveal, live = p.live && !fixed && m !== 15;
    const origin = { transformOrigin: `${cx}px ${cy}px` };
    stones.push(
      <g key={k} data-tile={k} className="cube-tile" style={origin}>
        <rect className={`stone${live ? " live" : ""}`} data-k={k} x={f2(x + .5)} y={f2(y + .5)} width={f2(s - 1)} height={f2(s - 1)} rx=".6"
          fill={url("stone")} stroke="#2a2620" strokeWidth=".5"
          tabIndex={live ? 0 : undefined} role={live ? "button" : undefined}
          aria-label={live ? `Stone, ${FACES[p.f].name} face, row ${i + 1}, column ${j + 1}. Enter turns clockwise, Shift+Enter anticlockwise.` : undefined} />
        <rect x={f2(x + 1.2)} y={f2(y + 1.2)} width={f2(s - 2.4)} height={f2(s - 2.4)} rx=".4" fill="none" stroke="rgb(255 248 230 / .1)" strokeWidth=".4" pointerEvents="none" />
        {fixed && RIVETS.map(([u, v], r) => { const [rx, ry] = at(i, j, s, u, v); return <circle key={r} cx={rx} cy={ry} r={f2(Math.max(.9, s * .03))} fill="#3a352d" stroke="rgb(255 248 230 / .15)" strokeWidth=".3" pointerEvents="none" />; })}
      </g>,
    );
    if (!p.reveal) continue;
    const paths = stonePieces(m, i, j, s);
    grooves.push(<g key={k} data-tile={k} className="cube-tile" style={origin}>{paths.map((d, q) => <path key={q} d={d} stroke="#0f0c09" strokeWidth={f2(rw * 1.7)} fill="none" />)}</g>);
    // At a crossing one strand runs over the other, alternating like a woven knot.
    const order = m === 15 && (i + j + p.f) % 2 === 0 ? [paths[1], paths[0]] : paths;
    pins.push(
      <g key={k} data-tile={k} className="cube-tile" style={origin}>
        {order.map((d, q) => <Ribbon key={q} d={d} w={rw} />)}
        {p.ends.filter(([e]) => e === k).map(([, b]) => {
          const [u, v] = MID[b], [ex, ey] = at(i, j, s, .5 + (u - .5) * .86, .5 + (v - .5) * .86);
          return <circle key={b} cx={ex} cy={ey} r={f2(rw * 1.05)} fill="#a3834f" stroke="#1d150c" strokeWidth={f2(rw * .4)} />;
        })}
      </g>,
    );
    if (showAids) {
      if (m !== 15 && m !== p.sol[k]) {
        const t = signedSteps(m, p.sol[k]), r = Math.max(4.5, s * .17);
        aids.push(
          <g key={`a${k}`} className="cube-badge" data-need={k} data-steps={t} transform={`translate(${cx} ${cy})`}>
            <circle r={f2(r)} fill="#d0584a" stroke="#fff3e6" strokeWidth=".7" />
            <text textAnchor="middle" dy={f2(r * .42)} fontSize={f2(r * 1.2)} fontWeight="700" fill="#fff" fontFamily="IBM Plex Mono, monospace">{t < 0 ? "↺" : t === 2 ? "2" : "↻"}</text>
          </g>,
        );
      }
      for (const [e, b] of p.ends) if (e === k) {
        const [u, v] = MID[b], [ex, ey] = at(i, j, s, .5 + (u - .5) * .86, .5 + (v - .5) * .86);
        aids.push(<circle key={`e${k}-${b}`} cx={ex} cy={ey} r={f2(rw * 2.4)} fill="none" stroke="#d0584a" strokeWidth="1" />);
      }
    }
  }
  return (
    <svg className="cube-face-svg" viewBox="0 0 100 100" aria-hidden={p.live ? undefined : true}>
      <rect width="100" height="100" fill="#0b0806" />
      <g filter={url("tex")}>{stones}<g pointerEvents="none">{grooves}</g></g>
      <rect x=".6" y=".6" width="98.8" height="98.8" fill="none" stroke="#5b4527" strokeWidth="1.2" pointerEvents="none" />
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="#120d08" strokeWidth=".8" pointerEvents="none" />
      <g className="cube-pins" filter={url("raise")} pointerEvents="none"><g className="cube-pins-lift">{pins}</g></g>
      <g pointerEvents="none">{aids}</g>
    </svg>
  );
}

export interface CubeViewProps {
  g: CubeGeom; cur: number[]; sol: number[]; ends: [number, number][];
  /** Faces showing their knot, and faces whose stones can be turned. */
  reveal: boolean[]; live: boolean[];
  cheat: boolean; open: boolean; home: boolean;
  /** The cube's starting transform and face shading (later frames are pushed straight to the DOM). */
  transform: string; shade: number[];
  domRef?: MutableRefObject<CubeDom>;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: PointerEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export function CubeView(p: CubeViewProps) {
  const uid = useId().replace(/:/g, "");
  const dom = p.domRef?.current;
  return (
    <div className={`cube-scene${p.home ? " home" : ""}${p.open ? " open" : ""}`} ref={el => { if (dom) dom.scene = el; }} tabIndex={0}
      role="group" aria-label="The cube. Arrow keys turn it; Q and E roll it. Tab to a stone on a face you can see and press Enter to turn it."
      onPointerDown={p.onPointerDown} onPointerMove={p.onPointerMove} onPointerUp={p.onPointerUp} onPointerCancel={p.onPointerCancel}
      onKeyDown={p.onKeyDown} onContextMenu={e => e.preventDefault()}>
      <CubeDefs uid={uid} />
      <div className="cube-floor" aria-hidden="true" />
      <div className="cube-body" ref={el => { if (dom) dom.body = el; }} style={{ transform: p.transform }}>
        {FACES.map((F, f) => {
          const ends = p.ends.filter(([k]) => p.g.face[k] === f);
          return (
            <div key={F.name} className={`cube-face face-${F.name}`} style={{ transform: faceTransform(f, "calc(var(--cube-s) / 2)") }}>
              <FaceSvg uid={uid} g={p.g} f={f} cur={p.cur} sol={p.sol} reveal={p.reveal[f]} live={p.live[f]} cheat={p.cheat} open={p.open} ends={ends} />
              <div className="cube-shade" ref={el => { if (dom) dom.shades[f] = el; }} style={{ opacity: p.shade[f] }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ARM = "M0 0 C 3.5 -12, 19 -19, 26 -9 C 31 0, 23 10, 15 7 C 9 4.5, 11 -3.5, 16.5 -1.8";
/** The triskele boss on the "Try the lock" button. */
export function Triskele() {
  return (
    <svg viewBox="-40 -40 80 80" className="triskele" aria-hidden="true">
      <circle r="37" fill="#0b0806" />
      <circle r="33" fill="#3d2f1f" stroke="#8a6b3e" strokeWidth="1.6" />
      <circle r="30" fill="none" stroke="rgb(255 240 210 / .14)" strokeWidth=".8" />
      {[0, 120, 240].map(r => <path key={r} transform={`rotate(${r})`} d={ARM} fill="none" stroke="#a88a55" strokeWidth="2.6" strokeLinecap="round" />)}
      <circle r="3" fill="#a88a55" />
    </svg>
  );
}

/** The two little pictures under "How to pick it": a strand joined across a cube edge, and a loose end. */
export function Example({ kind }: { kind: "good" | "bad" }) {
  const Rib = ({ d }: { d: string }) => (
    <><path d={d} stroke="#120e0a" strokeWidth="13" fill="none" /><path d={d} stroke="#d6a640" strokeWidth="8.5" fill="none" /><path d={d} stroke="#7a5a1c" strokeWidth="1.3" fill="none" /></>
  );
  // A front stone and the stone round the edge on the right face, drawn slanted.
  return (
    <svg viewBox="0 0 120 64" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" fill="#6a6558" stroke="#2f2b25" strokeWidth="1.6" />
      <path d="M60 4 L100 14 L100 50 L60 60 Z" fill="#56524a" stroke="#2f2b25" strokeWidth="1.6" />
      <Rib d="M32 60 Q32 32 60 32" />
      {kind === "good" ? <Rib d="M60 32 Q80 31 80 55" /> : <><Rib d="M80 9 L80 55" /><circle cx="56" cy="32" r="5.5" fill="#d6a640" stroke="#120e0a" strokeWidth="2.6" /></>}
    </svg>
  );
}
