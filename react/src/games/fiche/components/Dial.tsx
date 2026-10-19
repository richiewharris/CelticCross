// The dial: a bronze drum turning on a vertical axis behind a window, with the numbers embossed
// around it. The total sits under the pointer at the centre, and the drum turns to each new total.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../useReducedMotion";

const f = (n: number) => n.toFixed(2);
const DSTEP = 21, DR = 300;
const DMARK: Record<number, [string, string]> = { 7: ["again", "#a9d6a2"], 9: ["loses", "#f08c80"], 12: ["draw", "#d8cdb6"], 20: ["wins", "#ffe2a6"] };

/** Ease out with a little overshoot. */
const back = (k: number) => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

export function DialFace({ pos }: { pos: number }) {
  const ribs = [], nums = [];
  // the drum's ribs, turning with it
  for (let k = Math.floor(pos) - 6; k <= Math.ceil(pos) + 6; k++) {
    const a = ((k + 0.5 - pos) * DSTEP * Math.PI) / 180;
    if (Math.abs(a) > 1.5) continue;
    const x = f(320 + DR * Math.sin(a));
    ribs.push(<line key={k} x1={x} y1="20" x2={x} y2="98" stroke="#1a1109" strokeWidth={f(1.6 * Math.cos(a))} opacity={f(.7 * Math.cos(a))} />);
  }
  for (let n = 0; n <= 30; n++) {
    const a = ((n - pos) * DSTEP * Math.PI) / 180;
    if (Math.abs(a) > 1.45) continue;
    const c = Math.cos(a), x = 320 + DR * Math.sin(a), m = DMARK[n];
    const fill = n > 20 ? "#c97a6e" : m ? m[1] : "url(#fiche-num)";
    const font = { textAnchor: "middle" as const, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, fontSize: 40 };
    nums.push(
      <g key={n} transform={`translate(${f(x)} 0) scale(${f(Math.max(.05, c))} 1)`} opacity={f(.25 + .75 * c)}>
        <text x="1.6" y={m ? 70 : 76} {...font} fill="#0d0805" opacity=".8">{n}</text>
        <text x="-1" y={m ? 67 : 73} {...font} fill="#fff4dc" opacity=".35">{n}</text>
        <text x="0" y={m ? 68 : 74} {...font} fill={fill}>{n}</text>
        {m ? <text x="0" y="88" textAnchor="middle" fontFamily="Spectral, Georgia, serif" fontStyle="italic" fontSize="12" fill={m[1]}>{m[0]}</text> : null}
      </g>,
    );
  }
  return (
    <>
      <defs>
        <linearGradient id="fiche-drum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#140e08" /><stop offset=".22" stopColor="#5a4223" /><stop offset=".5" stopColor="#9c7a45" /><stop offset=".78" stopColor="#5a4223" /><stop offset="1" stopColor="#140e08" /></linearGradient>
        <linearGradient id="fiche-drumV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset=".25" stopColor="#000" stopOpacity="0" /><stop offset=".75" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".6" /></linearGradient>
        <linearGradient id="fiche-num" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbe9c2" /><stop offset=".55" stopColor="#d0aa68" /><stop offset="1" stopColor="#7c5a2c" /></linearGradient>
        <clipPath id="fiche-win"><rect x="34" y="20" width="572" height="78" rx="10" /></clipPath>
      </defs>
      <rect x="2" y="2" width="636" height="114" rx="14" fill="#2a1d12" stroke="#120b06" strokeWidth="2" />
      <rect x="10" y="9" width="620" height="100" rx="12" fill="none" stroke="rgb(255 220 170 / .1)" />
      <g clipPath="url(#fiche-win)">
        <rect x="34" y="20" width="572" height="78" fill="url(#fiche-drum)" />
        {ribs}
        {nums}
        <rect x="34" y="20" width="572" height="78" fill="url(#fiche-drumV)" />
      </g>
      <rect x="34" y="20" width="572" height="78" rx="10" fill="none" stroke="#0c0704" strokeWidth="2.5" />
      <rect x="282" y="20" width="76" height="78" rx="4" fill="rgb(255 240 210 / .06)" stroke="rgb(255 225 170 / .35)" strokeWidth="1.2" />
      <path d="M312 9 L328 9 L320 21 Z" fill="#d9b77d" stroke="#2a1a0a" />
      <path d="M312 109 L328 109 L320 97 Z" fill="#d9b77d" stroke="#2a1a0a" />
    </>
  );
}

/** The dial, turning to `total` whenever it changes. */
export function Dial({ total }: { total: number }) {
  const reduce = useReducedMotion();
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  useEffect(() => {
    const from = posRef.current, t0 = performance.now();
    if (from === total) return;
    const dur = reduce ? 1 : 380 + Math.min(700, Math.abs(total - from) * 70);
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      posRef.current = k < 1 ? from + (total - from) * back(k) : total;
      setPos(posRef.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [total, reduce]);
  return (
    <svg id="dial" className="wide" viewBox="0 0 640 118" role="img" aria-label={`Total ${total}`}>
      <DialFace pos={pos} />
    </svg>
  );
}
