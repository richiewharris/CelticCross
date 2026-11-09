// The card art, drawn in SVG: a scene for the card's element or type (fire, water, wind, earth, night for omens,
// blood for geasa, gold for oaths), seeded by the card's id so no two cards draw quite alike, with the card's
// own motif in front (a hero's faction sigil, a support's kind, what a geis forbids). Ogham spells the name.
import { useId, type ReactNode } from "react";
import type { CardDef } from "../engine/cards";
import { Emblem, iconBody } from "./Icons";

const W = 120, H = 66;

/** A small seeded random source: the same card always draws the same scene. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number) => Math.round(n * 10) / 10;

const flame = (x: number, h: number, w: number) =>
  `M${r1(x - w)} ${H}C${r1(x - w)} ${r1(H - h * 0.45)} ${r1(x - w * 0.15)} ${r1(H - h * 0.62)} ${r1(x)} ${r1(H - h)}C${r1(x + w * 0.25)} ${r1(H - h * 0.6)} ${r1(x + w)} ${r1(H - h * 0.45)} ${r1(x + w)} ${H}Z`;
function wave(y: number, amp: number, len: number, phase: number) {
  let d = `M${-len + phase} ${y}`;
  for (let x = -len + phase; x < W + len; x += len) d += `q${len / 4} ${-amp} ${len / 2} 0t${len / 2} 0`;
  return d + `V${H + 2}H${-len}Z`;
}
function spiral(cx: number, cy: number, r: number, turns: number, dir: 1 | -1, tail: number) {
  const pts: string[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * turns * Math.PI * 2;
    const rr = (r * i) / n;
    pts.push(`${r1(cx + rr * Math.cos(t) * dir)} ${r1(cy + rr * Math.sin(t))}`);
  }
  const [lx, ly] = pts[n].split(" ").map(Number);
  return `M${pts.join("L")}L${r1(lx - tail * dir)} ${r1(ly)}`;
}
/** A triquetra, the three-cornered knot, centred at (x, y). */
const triquetra = (x: number, y: number, r: number) => (
  <g transform={`translate(${x} ${y})`} fill="none" stroke="currentColor" strokeWidth={r * 0.16}>
    {[0, 120, 240].map((a) => <path key={a} transform={`rotate(${a})`} d={`M0 ${r * 0.18}A${r * 0.62} ${r * 0.62} 0 0 1 0 ${-r}A${r * 0.62} ${r * 0.62} 0 0 1 0 ${r * 0.18}`} />)}
    <circle r={r * 0.5} />
  </g>
);

type Grad = { id: string; stops: [number, string][]; radial?: boolean };
const Defs = ({ g }: { g: Grad[] }) => (
  <defs>
    {g.map((x) => x.radial ? (
      <radialGradient key={x.id} id={x.id} cx="50%" cy="85%" r="85%">{x.stops.map(([o, c], i) => <stop key={i} offset={o} stopColor={c} />)}</radialGradient>
    ) : (
      <linearGradient key={x.id} id={x.id} x1="0" y1="0" x2="0" y2="1">{x.stops.map(([o, c], i) => <stop key={i} offset={o} stopColor={c} />)}</linearGradient>
    ))}
  </defs>
);

function Scene({ kind, seed, uid, extra }: { kind: string; seed: string; uid: string; extra?: string }): ReactNode {
  const rnd = seeded(seed);
  const bg = `${uid}-bg`;
  switch (kind) {
    case "Fire": {
      const back = Array.from({ length: 7 }, (_, i) => flame(i * 20 + rnd() * 8 - 2, 30 + rnd() * 22, 9 + rnd() * 4));
      const front = Array.from({ length: 6 }, (_, i) => flame(i * 22 + 8 + rnd() * 8, 16 + rnd() * 18, 7 + rnd() * 3));
      const core = Array.from({ length: 4 }, (_, i) => flame(i * 30 + 14 + rnd() * 10, 8 + rnd() * 10, 4 + rnd() * 2));
      return (
        <>
          <Defs g={[{ id: bg, stops: [[0, "#2a0a05"], [0.55, "#8e2a14"], [1, "#e88a3c"]] }]} />
          <rect width={W} height={H} fill={`url(#${bg})`} />
          {back.map((d, i) => <path key={`b${i}`} d={d} fill="#6e1a0b" opacity=".85" />)}
          {front.map((d, i) => <path key={`f${i}`} d={d} fill="#e5762e" />)}
          {core.map((d, i) => <path key={`c${i}`} d={d} fill="#ffd27a" />)}
          {Array.from({ length: 8 }, (_, i) => <circle key={`s${i}`} cx={r1(rnd() * W)} cy={r1(4 + rnd() * 30)} r={r1(0.4 + rnd() * 0.8)} fill="#ffd890" opacity=".8" />)}
        </>
      );
    }
    case "Water": {
      const ph = rnd() * 20;
      return (
        <>
          <Defs g={[{ id: bg, stops: [[0, "#9fdbe6"], [0.45, "#2f8199"], [1, "#0a2630"]] }]} />
          <rect width={W} height={H} fill={`url(#${bg})`} />
          <path d={wave(30, 4, 26, ph)} fill="#227a91" />
          <path d={wave(42, 4, 22, ph + 9)} fill="#17596c" />
          <path d={wave(54, 3.5, 18, ph + 3)} fill="#0e3b48" />
          <g fill="none" stroke="#d9f3f7" strokeWidth="1.2" strokeLinecap="round" opacity=".85">
            {Array.from({ length: 4 }, (_, i) => {
              const x = 10 + i * 30 + rnd() * 10, y = 26 + rnd() * 4;
              return <path key={i} d={`M${r1(x - 9)} ${r1(y + 4)}C${r1(x - 6)} ${r1(y - 2)} ${r1(x + 2)} ${r1(y - 4)} ${r1(x + 4)} ${r1(y)}a2.4 2.4 0 1 1 -2.6 2.2`} />;
            })}
          </g>
        </>
      );
    }
    case "Wind": {
      return (
        <>
          <Defs g={[{ id: bg, stops: [[0, "#e7eff5"], [0.5, "#8aa2b8"], [1, "#2a3848"]] }]} />
          <rect width={W} height={H} fill={`url(#${bg})`} />
          <g fill="none" stroke="#f6fafc" strokeLinecap="round" opacity=".8">
            {Array.from({ length: 3 }, (_, i) => {
              const cx = 18 + i * 38 + rnd() * 14, cy = 18 + rnd() * 26;
              return <path key={i} d={spiral(cx, cy, 6 + rnd() * 6, 1.6, i % 2 ? 1 : -1, 22 + rnd() * 20)} strokeWidth="1.5" />;
            })}
            {Array.from({ length: 5 }, (_, i) => {
              const y = 8 + rnd() * 52, x = rnd() * 80;
              return <path key={`l${i}`} d={`M${r1(x)} ${r1(y)}h${r1(18 + rnd() * 26)}`} strokeWidth=".9" opacity=".7" />;
            })}
          </g>
        </>
      );
    }
    case "Earth": {
      const far = `M0 ${r1(36 + rnd() * 6)}Q${r1(30 + rnd() * 20)} ${r1(18 + rnd() * 8)} ${r1(60 + rnd() * 10)} ${r1(34 + rnd() * 4)}T${W} ${r1(28 + rnd() * 8)}V${H}H0Z`;
      const near = `M0 ${r1(50 + rnd() * 4)}Q${r1(40 + rnd() * 20)} ${r1(36 + rnd() * 6)} ${r1(80 + rnd() * 10)} ${r1(48 + rnd() * 4)}T${W} ${r1(46 + rnd() * 6)}V${H}H0Z`;
      const sx = 20 + rnd() * 80;
      const dolmen = rnd() > 0.5;
      return (
        <>
          <Defs g={[{ id: bg, stops: [[0, "#f3e2b4"], [0.6, "#c9a35c"], [1, "#8a6a32"]] }]} />
          <rect width={W} height={H} fill={`url(#${bg})`} />
          <circle cx={r1(20 + rnd() * 80)} cy="16" r="7" fill="#fff4d4" opacity=".7" />
          <path d={far} fill="#8a6a32" />
          <path d={near} fill="#5a4220" />
          {dolmen ? (
            <g fill="#2a1e0d"><rect x={r1(sx - 7)} y="34" width="3.5" height="16" /><rect x={r1(sx + 3.5)} y="35" width="3.5" height="15" /><path d={`M${r1(sx - 10)} 35l3-4h16l2 3z`} /></g>
          ) : (
            <g fill="#2a1e0d"><path d={`M${r1(sx - 3)} 52V30q3-5 6 0v22z`} /><path d={`M${r1(sx + 8)} 52V39q2-3 4 0v13z`} /></g>
          )}
          <rect y="56" width={W} height="10" fill="#2c2010" />
        </>
      );
    }
    case "night": {
      return (
        <>
          <Defs g={[{ id: bg, radial: true, stops: [[0, "#6b68b8"], [0.55, "#2c2a6a"], [1, "#100f2c"]] }]} />
          <rect width={W} height={H} fill={`url(#${bg})`} />
          {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={r1(rnd() * W)} cy={r1(rnd() * H * 0.8)} r={r1(0.3 + rnd() * 0.7)} fill="#f2efff" opacity={r1(0.5 + rnd() * 0.5)} />)}
          {(() => {
            const mx = rnd() > 0.5 ? 22 + rnd() * 8 : 90 + rnd() * 8, my = 15 + rnd() * 6;
            return extra === "global" ? (
              <g><circle cx={r1(mx)} cy={r1(my)} r="12" fill="none" stroke="#e8e2ff" strokeOpacity=".25" strokeWidth="1" /><circle cx={r1(mx)} cy={r1(my)} r="8" fill="#f3eed8" /><circle cx={r1(mx - 2.5)} cy={r1(my - 2)} r="1.6" fill="#d9d2b6" /></g>
            ) : (
              <path d={`M${r1(mx + 3)} ${r1(my - 9)}a9.5 9.5 0 1 0 6 17 7.5 7.5 0 0 1-6-17z`} fill="#f3eed8" />
            );
          })()}
          {extra === "yours" ? <path d={`M0 ${H}V54Q60 40 ${W} 54V${H}Z`} fill="#0d0c24" /> : null}
        </>
      );
    }
    case "geis": {
      const n = 12;
      return (
        <>
          <Defs g={[{ id: bg, radial: true, stops: [[0, "#c8584b"], [0.55, "#5e1914"], [1, "#1c0705"]] }]} />
          <rect width={W} height={H} fill={`url(#${bg})`} />
          <g fill="none" stroke="#f3c8bf" strokeWidth="1.3" opacity=".75">
            {Array.from({ length: n }, (_, i) => {
              const a = (i / n) * 360 + rnd() * 4;
              return <ellipse key={i} cx="60" cy="10" rx="2.6" ry="5" transform={`rotate(${r1(a)} 60 33)`} />;
            })}
          </g>
        </>
      );
    }
    case "oath": {
      const w = 15 + rnd() * 5;
      return (
        <>
          <Defs g={[{ id: bg, radial: true, stops: [[0, "#f4dca4"], [0.6, "#a07a3c"], [1, "#3a2a10"]] }]} />
          <rect width={W} height={H} fill={`url(#${bg})`} />
          <path d={`M0 56Q60 48 ${W} 56V${H}H0Z`} fill="#3a2a10" />
          <path d={`M${r1(60 - w)} 58V22c0-9 ${r1(w * 0.6)}-14 ${r1(w)}-14s${r1(w)} 5 ${r1(w)} 14v36zM60 25a5 5 0 1 0 0 10 5 5 0 0 0 0-10z`} fill="#2e2110" fillRule="evenodd" />
          <g fill="none" stroke="#c9a463" strokeWidth=".9" opacity=".7">
            <path d={spiral(60 - w * 0.45, 46, 4, 1.5, 1, 0)} /><path d={spiral(60 + w * 0.45, 46, 4, 1.5, -1, 0)} />
          </g>
        </>
      );
    }
    default: { // a faction's own glow, for a hero whose Focus is a kind of support
      return (
        <>
          <defs>
            <radialGradient id={bg} cx="50%" cy="40%" r="80%">
              <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--al) 60%, #fff)" }} />
              <stop offset=".6" style={{ stopColor: "color-mix(in srgb, var(--al) 70%, #000)" }} />
              <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--al) 25%, #000)" }} />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${bg})`} />
          <g fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.1">
            {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${-10 + i * 20} ${H}C${i * 20} 40 ${10 + i * 20} 26 ${r1(20 + i * 20 + rnd() * 6)} 0`} />)}
            {Array.from({ length: 7 }, (_, i) => <path key={`m${i}`} d={`M${10 + i * 20} ${H}C${i * 20} 40 ${-10 + i * 20} 26 ${r1(-20 + i * 20 + rnd() * 6)} 0`} />)}
          </g>
        </>
      );
    }
  }
}

const ELEMENTS = new Set(["Fire", "Wind", "Earth", "Water"]);

/** What a geis forbids, as an icon name (the motif behind its slash). */
function forbidIcon(d: CardDef): string {
  if (d.type !== "geis") return "geis";
  const f = d.forbids;
  return f.element ?? f.kind ?? (f.heal ? "heal" : "rest");
}

/** An omen's motif, from what it does: a crow for the Morrígan's, a bolt for Initiative, and so on. */
function omenIcon(d: CardDef): string {
  if (d.type !== "omen") return "omen";
  const f = d.fx;
  if (f.noHeals) return "crow";
  if (f.darkness) return "eye";
  if (f.mist) return "mist";
  if (f.truce !== undefined) return "truce";
  if (f.debility) return "debility";
  if (f.ignoreGeis) return "geis";
  if (f.element) return f.element.el;
  if (f.kind) return f.kind.kind;
  if (f.initMod) return "init";
  if (f.startValour) return "valour";
  if (f.healMod !== undefined || f.heal) return "heal";
  if (f.firstHitSoak || f.shieldStart || f.shield) return "shield";
  return f.strikeMod !== undefined && f.strikeMod < 0 ? "blunt" : "strike";
}
/** Extra motifs drawn only in the art (24×24 like the icons). */
const MOTIF: Record<string, ReactNode> = {
  blunt: <g transform="rotate(200 12 12)">{iconBody("strike")}</g>,
  crow: <path fill="currentColor" d="M1 13c3-3 7-4.5 10-3.5 1-2 3.5-3 6-2l3.5-1.5-1.5 3c1 2 .5 4-1 5.5 1.5 1.5 3 3.5 4 6-3-2-6-3-9-3-4 0-8-1.5-12-4.5z" />,
  eye: <g fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1.5 12c5-7 16-7 21 0-5 7-16 7-21 0z" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /></g>,
  mist: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 8c3-2 5-2 8 0s5 2 8 0 3-1 4 0" /><path d="M4 13c3-2 5-2 8 0s5 2 8 0" /><path d="M2 18c3-2 5-2 8 0s5 2 8 0 3-1 4 0" /></g>,
  truce: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 19 19 5M5 5l14 14" /><path d="M3 21l2-2M21 21l-2-2" /></g>,
  debility: <g fill="currentColor"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" opacity=".9" /><path d="M12.6 6.5 10.5 11l3 1.5-2.2 5" fill="none" stroke="#1a1840" strokeWidth="1.6" /></g>,
};

/** The art panel's picture for a card. */
export function CardArt({ d }: { d: CardDef }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (d.type === "unknown") return null;
  let scene = "faction";
  let extra: string | undefined;
  if (d.type === "support" && d.element) scene = d.element;
  else if ((d.type === "hero" || d.type === "champion") && d.focus && ELEMENTS.has(d.focus)) scene = d.focus;
  else if (d.type === "omen") { scene = "night"; extra = d.scope; }
  else if (d.type === "geis") scene = "geis";
  else if (d.type === "oath") scene = "oath";
  else if (d.type === "attendant") scene = d.to ?? "faction";
  const al = "alignment" in d ? d.alignment : "None";
  const legendary = "rarity" in d && d.rarity === "legendary";
  return (
    <svg className="cf-pic" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Scene kind={scene} seed={d.id} uid={uid} extra={extra} />
      {d.type === "hero" || d.type === "champion" ? (
        <g>
          {d.type === "hero"
            ? <circle cx="60" cy="33" r="21" fill="#0c0906" fillOpacity=".5" stroke="#efd79f" strokeWidth="1.3" />
            : <path d="M60 10l19 6v15c0 12-8 20-19 25-11-5-19-13-19-25V16z" fill="#0c0906" fillOpacity=".5" stroke="#efd79f" strokeWidth="1.3" />}
          {d.type === "hero" ? <circle cx="60" cy="33" r="18" fill="none" stroke="#efd79f" strokeOpacity=".55" strokeWidth=".6" strokeDasharray="1.2 1.6" /> : null}
          <g color="#fff6e0" transform={`translate(${60 - 19} ${33 - 19 + (d.type === "champion" ? 1 : 0)}) scale(.38)`}><Emblem alignment={al} /></g>
        </g>
      ) : d.type === "support" ? (
        <g transform="translate(43 16) scale(1.42)">
          <g color="#000" opacity=".4" transform="translate(.7 .9)">{iconBody(d.kind ?? "Weapon")}</g>
          <g color="#fffaf0">{iconBody(d.kind ?? "Weapon")}</g>
        </g>
      ) : d.type === "geis" ? (
        <g>
          <circle cx="60" cy="33" r="15" fill="#160504" fillOpacity=".55" />
          <g color="#fff1ea" transform="translate(50 23) scale(.84)">{iconBody(forbidIcon(d))}</g>
          <path d="M49 44 71 22" stroke="#ff8d7a" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M49 44 71 22" stroke="#3a0b07" strokeWidth="1" strokeLinecap="round" />
        </g>
      ) : d.type === "oath" ? (
        <g color="#f1d388" transform="translate(52.5 38.5) scale(.62)">
          {iconBody(d.boon.strike ? "strike" : d.boon.init ? "init" : d.boon.valour ? "valour" : d.boon.heal ? "heal" : "shield")}
        </g>
      ) : d.type === "attendant" ? (
        <g>
          <rect x="22" y="16" width="76" height="34" rx="17" fill="#07120e" fillOpacity=".55" stroke="#bfe8d4" strokeOpacity=".7" strokeWidth=".9" />
          <g color="#e9fff4" transform="translate(28 21) scale(1)">{iconBody(d.mode === "curse" ? "valour" : d.mode === "enchant" || d.mode === "reforge" ? d.kind ?? "Weapon" : d.from ?? "Fire")}</g>
          <g color="#bfe8d4" transform="translate(51 25) scale(.7)">{iconBody("into")}</g>
          <g color="#fff6d8" transform="translate(68 21) scale(1)">{iconBody(d.mode === "reforge" ? d.toKind ?? "Word" : d.to ?? "Fire")}</g>
        </g>
      ) : d.type === "omen" ? (
        <g transform="translate(46 19) scale(1.18)">
          <g color="#000" opacity=".45" transform="translate(.6 .8)">{MOTIF[omenIcon(d)] ?? iconBody(omenIcon(d))}</g>
          <g color="#f5f1ff">{MOTIF[omenIcon(d)] ?? iconBody(omenIcon(d))}</g>
        </g>
      ) : null}
      {legendary ? (
        <g color="#f6d27a" opacity=".9">{triquetra(9, 9, 6)}{triquetra(W - 9, 9, 6)}</g>
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------- ogham
// The name cut in ogham along the art's foot, the old Irish stone script: four groups of one to five strokes
// (below the stem, above it, slanting across it, and short notches for the vowels), read left to right.
const OGHAM: Record<string, [0 | 1 | 2 | 3, number]> = {
  b: [0, 1], l: [0, 2], f: [0, 3], v: [0, 3], w: [0, 3], s: [0, 4], n: [0, 5],
  h: [1, 1], d: [1, 2], t: [1, 3], c: [1, 4], k: [1, 4], q: [1, 5],
  m: [2, 1], g: [2, 2], z: [2, 4], r: [2, 5],
  a: [3, 1], o: [3, 2], u: [3, 3], e: [3, 4], i: [3, 5], j: [3, 5], y: [3, 5],
  p: [0, 1], x: [1, 4],
};
export function Ogham({ text }: { text: string }) {
  const s = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const G = 2.1, GAP = 3.2, WORD = 5;
  let x = 4;
  const strokes: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === " ") { x += WORD; continue; }
    let code = OGHAM[ch];
    if (ch === "n" && s[i + 1] === "g") { code = [2, 3]; i++; }
    if (!code) continue;
    const [grp, n] = code;
    for (let k = 0; k < n; k++) {
      if (grp === 0) strokes.push(`M${r1(x)} 6v4.5`);
      else if (grp === 1) strokes.push(`M${r1(x)} 1.5v4.5`);
      else if (grp === 2) strokes.push(`M${r1(x - 1.4)} 10.5l2.8-9`);
      else strokes.push(`M${r1(x)} 4.4v3.2`);
      x += G;
    }
    x += GAP - G;
  }
  x += 2;
  const w = Math.max(30, r1(x + 2));
  return (
    <svg className="cf-ogham" viewBox={`0 0 ${w} 12`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={`M1 6H${w - 1}M1 3.5 3.5 6 1 8.5M${w - 1} 3.5 ${w - 3.5} 6 ${w - 1} 8.5`} />
      <path d={strokes.join("")} />
    </svg>
  );
}
