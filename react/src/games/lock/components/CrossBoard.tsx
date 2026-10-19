// The classic puzzle box: fifteen carved stones on a ringed cross, each a button.
import type { CSSProperties, KeyboardEvent, PointerEvent, Ref } from "react";
import { CELLS, describe, type Dir, type Tile } from "../engine/cross";

const COLOR = ["", "var(--gold)", "var(--verdigris)", "var(--garnet)"];
const END: Record<Dir, [number, number]> = { n: [50, 0], e: [100, 50], s: [50, 100], w: [0, 50] };
const RINGPT: Record<Dir, [number, number]> = { n: [50, 33], e: [67, 50], s: [50, 67], w: [33, 50] };
const strandPath = (d: Dir) => { const [x1, y1] = END[d], [x2, y2] = RINGPT[d]; return `M${x1} ${y1} L${x2} ${y2}`; };
const NOTCH: Record<Dir, { x: number; y: number; width: number; height: number }> = {
  n: { x: 28, y: 0, width: 44, height: 7 }, s: { x: 28, y: 93, width: 44, height: 7 },
  w: { x: 0, y: 28, width: 7, height: 44 }, e: { x: 93, y: 28, width: 7, height: 44 },
};
const DIRS: Dir[] = ["n", "e", "s", "w"];
const KNOT = "M50 32 Q62 50 50 68 Q38 50 50 32 Z M32 50 Q50 38 68 50 Q50 62 32 50 Z";

/** One stone: strands out to its edges over an interlaced central boss; red notches mark broken joins. */
export function TileSvg({ t, bad }: { t: Tile; bad?: Dir[] | null }) {
  const live = DIRS.filter(d => t[d]);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" fill="none" stroke="rgb(0 0 0 / .14)" strokeWidth="1.2" />
      {live.map(d => <path key={d} d={strandPath(d)} stroke="var(--strand-edge)" strokeWidth="20" strokeLinecap="butt" fill="none" />)}
      <circle cx="50" cy="50" r="18" fill="none" stroke="var(--strand-edge)" strokeWidth="11" />
      <circle cx="50" cy="50" r="18" fill="none" stroke="#b7ab90" strokeWidth="5" />
      <path d={KNOT} fill="none" stroke="var(--strand-edge)" strokeWidth="6" />
      <path d={KNOT} fill="none" stroke="#cfc3a6" strokeWidth="2.4" />
      <circle cx="50" cy="50" r="3.5" fill="#2a251f" />
      {live.map(d => {
        const p = strandPath(d), v = t[d];
        return (
          <g key={d}>
            <path d={p} stroke={COLOR[v]} strokeWidth="12" fill="none" />
            {v === 2 ? <path d={p} stroke="var(--strand-edge)" strokeWidth="3" fill="none" /> : null}
            {v === 3 ? <path d={p} stroke="#f0c6a8" strokeWidth="5" strokeLinecap="round" strokeDasharray="0.1 9" fill="none" /> : null}
          </g>
        );
      })}
      {bad?.map(d => <rect key={d} {...NOTCH[d]} fill="var(--garnet)" stroke="#fff3e6" strokeWidth="1.5" />)}
    </svg>
  );
}

export interface CellLook { sel?: boolean; wrong?: boolean; hint?: boolean; over?: boolean; lifted?: boolean; bad?: Dir[] | null }

export function CrossBoard(p: {
  tiles: Tile[]; arr: number[]; open: boolean;
  look: (i: number) => CellLook;
  /** Bumped per cell when it should flash (a fresh element restarts the animation). */
  flash?: number[]; flashed?: Set<number>;
  boardRef?: Ref<HTMLDivElement>;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: PointerEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className={`board${p.open ? " open" : ""}`} ref={p.boardRef}
      onPointerDown={p.onPointerDown} onPointerMove={p.onPointerMove} onPointerUp={p.onPointerUp} onPointerCancel={p.onPointerCancel} onKeyDown={p.onKeyDown}>
      <svg className="ring" viewBox="0 0 500 700" aria-hidden="true">
        <circle cx="250" cy="250" r="141" fill="none" stroke="#3a352e" strokeWidth="58" />
        <circle cx="250" cy="250" r="141" fill="none" stroke="#575247" strokeWidth="50" />
        <circle cx="250" cy="250" r="118" fill="none" stroke="#2c2823" strokeWidth="2" />
        <circle cx="250" cy="250" r="164" fill="none" stroke="#2c2823" strokeWidth="2" />
        <circle cx="250" cy="250" r="141" fill="none" stroke="#6b6558" strokeWidth="3" strokeDasharray="4 14" />
      </svg>
      {CELLS.map(([r, c], i) => {
        const t = p.tiles[p.arr[i]], L = p.look(i);
        const cls = ["cell", L.sel && "sel", L.wrong && "wrong", L.hint && "hint", p.flashed?.has(i) && "flash", L.over && "over", L.lifted && "lifted"].filter(Boolean).join(" ");
        const style: CSSProperties = { gridRow: r + 1, gridColumn: c + 1 };
        return (
          <button key={`${i}:${p.flash?.[i] ?? 0}`} type="button" className={cls} data-i={i} style={style}
            aria-label={`Stone ${i + 1}, ${describe(t)}${L.sel ? ", selected" : ""}`}>
            <TileSvg t={t} bad={L.bad} />
          </button>
        );
      })}
    </div>
  );
}
