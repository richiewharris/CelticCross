// The puzzle box (current version): a carved stone dial under a bronze cover with a one-third window.
// Layers, bottom to top: the loose stones with their grooves, the raised bronze knot pins, the slotted
// stone face that shows once the pins drop, the hub (and Cheat badges), then the cover.
// Animated values (spin, pin height, hub press, cover slide) are drawn from `anim` on each render and
// can also be pushed straight to the DOM between renders with applyAnim(), as the original does.
import { useId, type KeyboardEvent, type MutableRefObject, type PointerEvent, type ReactNode } from "react";
import { coverPaths, f, geom, MID, piecesFor, RIN, tileOutline, toPath, uvxy, visible, type Geom } from "../engine/dial";
import { looseEnds, signedSteps, type TierId } from "../engine/knot";

export interface Anim { phi: number; raise: number; hub: number; cover: number; pinPhi: number | null }
export const restingAnim = (phi: number): Anim => ({ phi, raise: 1, hub: 1, cover: 0, pinPhi: null });

export interface DialDom {
  svg: SVGSVGElement | null; disc: SVGGElement | null; top: SVGGElement | null; face: SVGGElement | null;
  pins: SVGGElement | null; pinLift: SVGGElement | null; hubFace: SVGGElement | null; cover: SVGGElement | null;
  raiseOffset: SVGFEOffsetElement | null; raiseBlur: SVGFEGaussianBlurElement | null; raiseFlood: SVGFEFloodElement | null;
}
export const emptyDom = (): DialDom => ({ svg: null, disc: null, top: null, face: null, pins: null, pinLift: null, hubFace: null, cover: null, raiseOffset: null, raiseBlur: null, raiseFlood: null });

// How far the pins stand out of their grooves: 1 = raised, 0 = pushed home.
// Above 1 they lift higher (the press catches them); a little below 0 they overshoot as they drop.
function raiseLook(t: number) {
  const up = Math.max(0, t), c = Math.min(1, up);
  return {
    dx: f(2 * up), dy: f(2.8 * up),
    blur: f(1.1 + 1.6 * Math.max(0, t - 1)),
    flood: f(.7 * c),
    lift: `translate(${f(-.9 * t)} ${f(-1.3 * t)})`,
    // the pins darken as they go down into the stone
    bright: `brightness(${f(0.6 + 0.4 * c + 0.12 * Math.max(0, t - 1))})`,
    // the slotted stone face shows from halfway down, so you watch the pins drop into it
    face: f(Math.min(1, Math.max(0, (1 - t) * 2.2 - .1))),
  };
}
const rot = (v: number) => `rotate(${f(v)})`;
const pinRot = (a: Anim, open: boolean) => rot(open && a.pinPhi != null ? a.pinPhi : a.phi);

/** Push the animated values straight onto the drawn SVG (used on every animation frame). */
export function applyAnim(dom: DialDom, a: Anim, open: boolean) {
  const t = rot(a.phi);
  dom.disc?.setAttribute("transform", t); dom.top?.setAttribute("transform", t); dom.face?.setAttribute("transform", t);
  dom.pins?.setAttribute("transform", pinRot(a, open));
  const r = raiseLook(a.raise);
  dom.raiseOffset?.setAttribute("dx", r.dx); dom.raiseOffset?.setAttribute("dy", r.dy);
  dom.raiseBlur?.setAttribute("stdDeviation", r.blur);
  dom.raiseFlood?.setAttribute("flood-opacity", r.flood);
  dom.pinLift?.setAttribute("transform", r.lift);
  if (dom.pins) dom.pins.style.filter = r.bright;
  dom.face?.setAttribute("opacity", r.face);
  dom.hubFace?.setAttribute("transform", `scale(${f(a.hub)})`);
  dom.cover?.setAttribute("transform", `translate(${f(-a.cover)} 0)`);
}

/** Aged bronze pin: dark edge, dull brown-bronze body, green patina and a worn highlight. */
function Ribbon({ d, w }: { d: string; w: number }) {
  return (
    <>
      <path d={d} stroke="#1d150c" strokeWidth={f(w * 1.45)} fill="none" />
      <path d={d} stroke="#8a6b3e" strokeWidth={f(w)} fill="none" />
      <path d={d} stroke="#5f7a62" strokeWidth={f(w * .55)} strokeDasharray="1.5 9 4 13" strokeOpacity=".55" fill="none" />
      <path d={d} stroke="#c4a36c" strokeWidth={f(Math.max(.6, w * .22))} strokeOpacity=".75" fill="none" />
    </>
  );
}

const RIVETS: [number, number][] = [[.12, .12], [.88, .12], [.12, .88], [.88, .88]];
function Rivets({ g, k }: { g: Geom; k: number }) {
  return <>{RIVETS.map(([u, v], i) => { const [x, y] = uvxy(g, k, u, v); return <circle key={i} cx={f(x)} cy={f(y)} r="1.6" fill="#3a352d" stroke="rgb(255 248 230 / .15)" strokeWidth=".4" pointerEvents="none" />; })}</>;
}

const HUB_ARM = "M0 0 C 3.5 -12, 19 -19, 26 -9 C 31 0, 23 10, 15 7 C 9 4.5, 11 -3.5, 16.5 -1.8";
const COVER = coverPaths();

export interface DialProps {
  tier: TierId; cur: number[]; sol: number[];
  /** The spin used for which stones can be tapped and for the Cheat badges (redrawn when a spin settles). */
  phi: number;
  anim: Anim;
  open: boolean;
  /** The loose stones are hidden once the pins have dropped home. */
  svgOpen: boolean;
  cheat: boolean;
  /** Extra marks drawn on the spinning disc above the pins, in disc coordinates (variants use it). */
  overlay?: ReactNode;
  domRef?: MutableRefObject<DialDom>;
  onPointerDown?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (e: PointerEvent<SVGSVGElement>) => void;
  onKeyDown?: (e: KeyboardEvent<SVGSVGElement>) => void;
}

export function Dial(p: DialProps) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${uid}-${n}`;
  const url = (n: string) => `url(#${id(n)})`;
  const dom = p.domRef?.current;
  const set = <K extends keyof DialDom>(key: K) => (el: DialDom[K]) => { if (dom) dom[key] = el; };

  const g = geom(p.tier);
  const rw = Math.min(g.w * .15, 2 * Math.PI * (RIN + g.w / 2) / g.C * .15);
  const ends = looseEnds(p.cur, g.R, g.C);
  const showAids = p.cheat && !p.open;
  const stones: ReactNode[] = [], grooves: ReactNode[] = [], plain: ReactNode[] = [], cross: ReactNode[] = [];
  const caps: ReactNode[] = [], aids: ReactNode[] = [], slots: ReactNode[] = [], rims: ReactNode[] = [], face: ReactNode[] = [];
  const groove = (d: string, key: string) => <path key={key} d={d} stroke="#0f0c09" strokeWidth={f(rw * 1.7)} fill="none" pointerEvents="none" />;
  const slot = (d: string, key: string) => <path key={key} d={d} stroke="#000" strokeWidth={f(rw * 1.7)} fill="none" />;
  const slotRim = (d: string, key: string) => <path key={key} d={d} stroke="#2a2620" strokeWidth={f(rw * 1.7 + 1.6)} fill="none" />;

  for (let k = 0; k < p.cur.length; k++) {
    const m = p.cur[k], r = (k / g.C) | 0, s = k % g.C;
    const vis = visible(g, k, p.phi);
    const label = m === 15 ? "Fixed crossing" : `Stone, ring ${r + 1}`;
    const out6 = tileOutline(g, k, .6), out14 = tileOutline(g, k, 1.4);
    face.push(
      <path key={`f${k}`} d={out6} fill={url("stoneGrad")} stroke="#2a2620" strokeWidth=".6" />,
      <path key={`fi${k}`} d={out14} fill="none" stroke="rgb(255 248 230 / .1)" strokeWidth=".5" />,
    );
    const live = vis && m !== 15;
    stones.push(
      <path key={`t${k}`} className={`tile${vis ? "" : " hidden"}`} data-k={k} d={out6} fill={url("stoneGrad")} stroke="#2a2620" strokeWidth=".6"
        tabIndex={live ? 0 : undefined} role={live ? "button" : undefined}
        aria-label={live ? `${label}. Enter turns clockwise, Shift+Enter anticlockwise.` : undefined} />,
      <path key={`ti${k}`} d={out14} fill="none" stroke="rgb(255 248 230 / .1)" strokeWidth=".5" pointerEvents="none" />,
    );
    if (m === 15) {
      stones.push(<Rivets key={`r${k}`} g={g} k={k} />);
      face.push(<Rivets key={`fr${k}`} g={g} k={k} />);
      const [vert, horiz] = piecesFor(15).map(pc => toPath(g, k, pc));
      grooves.push(groove(vert, `gv${k}`), groove(horiz, `gh${k}`));
      slots.push(slot(vert, `sv${k}`), slot(horiz, `sh${k}`)); rims.push(slotRim(vert, `rv${k}`), slotRim(horiz, `rh${k}`));
      const vOver = (r + s) % 2 === 0;
      cross.push(<Ribbon key={`c1${k}`} d={vOver ? horiz : vert} w={rw} />, <Ribbon key={`c2${k}`} d={vOver ? vert : horiz} w={rw} />);
    } else {
      const d = toPath(g, k, piecesFor(m)[0]);
      grooves.push(groove(d, `g${k}`));
      slots.push(slot(d, `s${k}`)); rims.push(slotRim(d, `r${k}`));
      plain.push(<Ribbon key={`p${k}`} d={d} w={rw} />);
    }
    if (showAids && m !== 15 && m !== p.sol[k]) {
      const n = signedSteps(m, p.sol[k]);
      const [x, y] = uvxy(g, k, .5, .5);
      const lbl = n < 0 ? "↺" : n === 2 ? "2" : "↻";
      aids.push(
        <g key={`a${k}`} pointerEvents="none" transform={`translate(${f(x)} ${f(y)}) rotate(${f(-p.phi)})`}>
          <circle r="9" fill="#d0584a" stroke="#fff3e6" strokeWidth="1.2" />
          <text textAnchor="middle" dy="4" fontSize="11" fontWeight="700" fill="#fff" fontFamily="IBM Plex Mono, monospace">{lbl}</text>
        </g>,
      );
    }
  }
  for (const [k, b] of ends) {
    const [u, v] = MID[b];
    const [x, y] = uvxy(g, k, .5 + (u - .5) * .86, .5 + (v - .5) * .86);
    caps.push(<circle key={`e${k}-${b}`} cx={f(x)} cy={f(y)} r={f(rw * 1.05)} fill="#a3834f" stroke="#1d150c" strokeWidth={f(rw * .4)} />);
    if (showAids) aids.push(<circle key={`ea${k}-${b}`} cx={f(x)} cy={f(y)} r={f(rw * 2.4)} fill="none" stroke="#d0584a" strokeWidth="1.6" pointerEvents="none" />);
  }

  const a = p.anim, rl = raiseLook(a.raise), spin = rot(a.phi);
  return (
    <svg id="lock" ref={set("svg")} className={p.svgOpen ? "open" : undefined} viewBox="-210 -210 420 420" tabIndex={0}
      aria-label="Lock. Left and right arrow keys spin the disc."
      onPointerDown={p.onPointerDown} onPointerMove={p.onPointerMove} onPointerUp={p.onPointerUp} onPointerCancel={p.onPointerCancel}
      onKeyDown={p.onKeyDown} onContextMenu={e => e.preventDefault()}>
      <defs>
        <radialGradient id={id("plate")} cx="50%" cy="40%" r="75%">
          <stop offset="0" stopColor="#4a3a27" />
          <stop offset="1" stopColor="#231b13" />
        </radialGradient>
        <radialGradient id={id("stoneGrad")} cx="45%" cy="42%" r="80%">
          <stop offset="0" stopColor="#8b877d" />
          <stop offset="1" stopColor="#6d6a61" />
        </radialGradient>
        {/* Carved stone: fine mineral grain and pitting multiplied over the stone colour. */}
        <filter id={id("stoneTex")} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={3} seed={7} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .32  0 0 0 0 .3  0 0 0 0 .27  0 0 0 -1.4 1.05" result="speck" />
          <feComposite in="speck" in2="SourceGraphic" operator="in" result="speckIn" />
          <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={3} result="mottle" />
          <feColorMatrix in="mottle" type="matrix" values="0 0 0 0 .2  0 0 0 0 .19  0 0 0 0 .16  0 0 0 .55 -.18" result="mot" />
          <feComposite in="mot" in2="SourceGraphic" operator="in" result="motIn" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="motIn" /><feMergeNode in="speckIn" /></feMerge>
        </filter>
        <mask id={id("slots")} maskUnits="userSpaceOnUse" x="-210" y="-210" width="420" height="420">
          <rect x="-210" y="-210" width="420" height="420" fill="#fff" />
          <g>{slots}</g>
        </mask>
        <radialGradient id={id("bossGrad")} cx="40%" cy="36%" r="70%">
          <stop offset="0" stopColor="#6a5233" />
          <stop offset=".7" stopColor="#3d2f1f" />
          <stop offset="1" stopColor="#271d13" />
        </radialGradient>
        {/* Raised pins: the knot casts a soft shadow down and to the right onto the flat
            disc. Applied outside the spinning group so the light stays put while it turns. */}
        <filter id={id("raise")} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feGaussianBlur ref={set("raiseBlur")} in="SourceAlpha" stdDeviation={rl.blur} result="blur" />
          <feOffset ref={set("raiseOffset")} in="blur" dx={rl.dx} dy={rl.dy} result="off" />
          <feFlood ref={set("raiseFlood")} floodColor="#000" floodOpacity={rl.flood} />
          <feComposite in2="off" operator="in" result="shadow" />
          <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={id("hubShadow")} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="1.2" dy="1.8" stdDeviation="1" floodColor="#000" floodOpacity=".65" />
        </filter>
      </defs>
      <rect x="-210" y="-210" width="420" height="420" fill="#120e0a" />
      <circle r="190" fill="#0b0806" stroke="#2a2118" strokeWidth="3" />
      <g id="disc" ref={set("disc")} filter={url("stoneTex")} transform={spin}>{stones}{grooves}</g>
      <g filter={url("raise")}>
        <g ref={set("pinLift")} transform={rl.lift}>
          <g ref={set("pins")} transform={pinRot(a, p.open)} style={{ filter: rl.bright }}>
            <g pointerEvents="none">{plain}{cross}{caps}</g>
          </g>
        </g>
      </g>
      {/* The stone face that comes to the front once the pins drop: the same stones,
          with slots cut where the knot runs so the pins show through. */}
      <g ref={set("face")} mask={url("slots")} filter={url("stoneTex")} opacity={rl.face} pointerEvents="none" transform={spin}>{face}{rims}</g>
      <g filter={url("hubShadow")}>
        <g ref={set("top")} transform={spin}>
          <g id="hub" role="button" tabIndex={0} aria-label="Center button. Press to try the lock.">
            <circle r={RIN - 4} fill="#0b0806" />
            <g ref={set("hubFace")} transform={`scale(${f(a.hub)})`}>
              <circle className="hub-face" r={RIN - 9} fill={url("bossGrad")} stroke="#8a6b3e" strokeWidth="1.1" />
              <circle r={RIN - 12} fill="none" stroke="rgb(255 240 210 / .14)" strokeWidth=".6" />
              {[0, 120, 240].map(r => <path key={r} transform={`rotate(${r})`} d={HUB_ARM} fill="none" stroke="#a88a55" strokeWidth="2.2" strokeLinecap="round" />)}
              <circle r="2.6" fill="#a88a55" />
            </g>
          </g>
          {aids}
          {p.overlay}
        </g>
      </g>
      <g id="cover" ref={set("cover")} transform={`translate(${f(-a.cover)} 0)`} opacity={p.cheat && !p.open ? ".38" : "1"}>
        <path d={COVER.plate} fill={url("plate")} fillRule="evenodd" stroke="#0c0906" strokeWidth="1" />
        <rect x="-198" y="-198" width="396" height="396" rx="14" fill="none" stroke="#9c7a3c" strokeWidth="1.1" pointerEvents="none" />
        <rect x="-190" y="-190" width="380" height="380" rx="10" fill="none" stroke="#9c7a3c" strokeWidth="1" strokeDasharray="2 6" pointerEvents="none" />
        <path d={COVER.hole} fill="none" stroke="#b08a48" strokeWidth="1.4" pointerEvents="none" />
        <path d={COVER.center} fill="none" stroke="#b08a48" strokeWidth="1.4" pointerEvents="none" />
        <text x="-112" y="4" textAnchor="middle" fill="#9c7a3c" fontFamily="IBM Plex Mono, monospace" fontSize="10" letterSpacing="3" pointerEvents="none">PRESS ▶</text>
      </g>
    </svg>
  );
}

/** The two little pictures under "How to pick it": a joined strand and a loose end. */
export function Example({ kind }: { kind: "good" | "bad" }) {
  const Rib = ({ d }: { d: string }) => (
    <><path d={d} stroke="#120e0a" strokeWidth="13" fill="none" /><path d={d} stroke="#d6a640" strokeWidth="8.5" fill="none" /><path d={d} stroke="#7a5a1c" strokeWidth="1.3" fill="none" /></>
  );
  return (
    <svg viewBox="0 0 120 60" aria-hidden="true">
      <rect x="2" y="2" width="56" height="56" fill="#6a6558" stroke="#2f2b25" strokeWidth="1.6" />
      <rect x="62" y="2" width="56" height="56" fill="#6a6558" stroke="#2f2b25" strokeWidth="1.6" />
      <Rib d="M30 60 Q30 30 60 30" />
      {kind === "good" ? <Rib d="M60 30 Q90 30 90 60" /> : <><Rib d="M90 2 L90 58" /><circle cx="55" cy="30" r="5.5" fill="#d6a640" stroke="#120e0a" strokeWidth="2.6" /></>}
    </svg>
  );
}
