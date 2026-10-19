// The pieces of the stacked-discs page: the pile (rims of the discs beneath, the live dial on top and
// the disc lifting away) and the ledger panel listing the discs.
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { TIERS } from "../engine/knot";
import { Dial, type Anim } from "../components/Dial";
import { METAL, ROMAN, layerNeed, type Layer, type Stack } from "./engine";

/** The disc that just opened, lifting off and sliding away over the next one. */
export function LiftingDisc({ layer, anim }: { layer: Layer; anim: Anim }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.setAttribute("inert", "");
    if (typeof el.animate !== "function") return;
    el.animate([
      { transform: "none", opacity: 1, filter: "drop-shadow(0 0 0 rgb(0 0 0 / 0))" },
      { transform: "translate(-3%, -9%) scale(1.07) rotate(-6deg)", opacity: 1, filter: "drop-shadow(4px 22px 16px rgb(0 0 0 / .7))", offset: .4 },
      { transform: "translate(-62%, -20%) scale(1.1) rotate(-26deg)", opacity: 0, filter: "drop-shadow(4px 26px 18px rgb(0 0 0 / .5))" },
    ], { duration: 850, easing: "cubic-bezier(.45, 0, .55, 1)", fill: "forwards" });
  }, []);
  return (
    <div ref={ref} className="stk-lift" aria-hidden="true">
      <Dial tier={layer.tier} cur={layer.cur} sol={layer.sol} phi={anim.phi} anim={anim} open={false} svgOpen cheat={false} />
    </div>
  );
}

/**
 * The stack in the box: the edges of the discs beneath step down below the top one, narrower each time,
 * so you can count what's left. `liftKey` changes when a disc lifts away: the new top disc rises out of its shadow.
 */
export function Pile(p: { st: Stack; children: ReactNode; lifting: ReactNode; liftKey: number | null; reduce: boolean }) {
  const live = useRef<HTMLDivElement>(null);
  const below = p.st.open ? [] : p.st.layers.map((l, i) => ({ l, i })).slice(p.st.at + 1);
  useLayoutEffect(() => {
    const el = live.current;
    if (p.liftKey == null || p.reduce || !el || typeof el.animate !== "function") return;
    el.animate([
      { filter: "brightness(.4)", transform: "translateY(7px) scale(.97)" },
      { filter: "brightness(.55)", transform: "translateY(7px) scale(.97)", offset: .35 },
      { filter: "none", transform: "none" },
    ], { duration: 850, easing: "ease-out" });
  }, [p.liftKey, p.reduce]);
  return (
    <div className="stk-pile" style={{ "--n": below.length } as CSSProperties}>
      {below.map(({ l, i }, j) => (
        <div key={i} className={`stk-rim stk-m${l.tier}`} style={{ "--i": j + 1, zIndex: 10 - j } as CSSProperties} aria-hidden="true">
          <span>{ROMAN[i]}</span>
        </div>
      ))}
      <div className="stk-live" ref={live}>{p.children}</div>
      {p.lifting}
    </div>
  );
}

/** Each disc top to bottom: its size and how many stones are about turned, but not exactly what it needs (unless Cheat). */
export function StackPanel({ st, cheat }: { st: Stack; cheat: boolean }) {
  return (
    <div className="panel">
      <p className="label">The stack</p>
      <ol className="stk-list">
        {st.layers.map((l, i) => {
          const T = TIERS[l.tier], done = i < st.at || st.open, now = i === st.at && !st.open;
          const state = done ? "Opened" : cheat ? `needs ${layerNeed(l)}` : now ? "On top" : "Sealed";
          return (
            <li key={i} className={done ? "done" : now ? "now" : undefined} aria-current={now ? "step" : undefined}>
              <span className={`stk-num stk-m${l.tier}`} aria-hidden="true">{ROMAN[i]}</span>
              <span className="stk-name">{METAL[l.tier]}<small>{T.rings * T.sectors} stones · about {T.turned} turned</small></span>
              <span className="stk-state">{state}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
