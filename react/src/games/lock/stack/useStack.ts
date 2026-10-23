// State and effects for the stacked discs: dealing stacks, turning stones on the top disc, spinning
// it, and the press / open / lift-off / scramble / reset animations (frame by frame, as useLock does).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useStoredState } from "../../../kit/useStoredState";
import { geom, norm, snapPhi, visible } from "../engine/dial";
import { NEW_PROFILE, type Profile, type TierId } from "../engine/knot";
import { applyAnim, emptyDom, restingAnim, type Anim, type DialDom } from "../components/Dial";
import { useLockRecord } from "../record";
import { current, dealStack, layerSolved, press, resetStack, stackSkillGain, stranded, turnStone, type Layer, type Stack } from "./engine";

export interface StackState { st: Stack; msg: string; msgKind: "" | "good" | "bad"; cheated: boolean }
/** The disc that just opened, drawn over the next one while it lifts away. */
export interface Lift { key: number; layer: Layer; anim: Anim }

const NEW_MSG = "Spin the top disc to see the rest of its knot. One purse of turns pays for the whole stack.";
const easeIn = (t: number) => t * t * t;
const ord = (n: number) => `disc ${n}`;

export function useStack() {
  const [profile, setProfile] = useStoredState<Profile>("lock-react-stack-profile", NEW_PROFILE);
  const first = useRef<StackState | null>(null);
  if (!first.current) first.current = { st: dealStack(2, profile.skill), msg: NEW_MSG, msgKind: "", cheated: false };
  const [s, setS] = useState<StackState>(first.current);
  const [drawnPhi, setDrawnPhi] = useState(current(first.current.st).phi);
  const [cheat, setCheatState] = useState(false);
  const [svgOpen, setSvgOpen] = useState(false);
  const [lift, setLift] = useState<Lift | null>(null);
  const rec = useLockRecord("stack");

  const sRef = useRef(s), pRef = useRef(profile), cheatRef = useRef(cheat);
  pRef.current = profile;
  const commit = useCallback((next: StackState) => { sRef.current = next; setS(next); }, []);
  const anim = useRef<Anim>(restingAnim(current(first.current.st).phi));
  const dom = useRef<DialDom>(emptyDom());
  const busy = useRef(false);
  const reduce = useRef(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;

  const isOpen = () => sRef.current.st.open;
  useLayoutEffect(() => { applyAnim(dom.current, anim.current, sRef.current.st.open); });
  const apply = () => applyAnim(dom.current, anim.current, isOpen());
  const redraw = () => setDrawnPhi(anim.current.phi);

  // ---- Timers, cancelled on unmount ----
  const alive = useRef(true);
  const frames = useRef(new Set<number>()), timeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    alive.current = true;
    const fr = frames.current, to = timeouts.current;
    return () => { alive.current = false; fr.forEach(cancelAnimationFrame); to.forEach(clearTimeout); fr.clear(); to.clear(); };
  }, []);
  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => { timeouts.current.delete(id); if (alive.current) fn(); }, ms);
    timeouts.current.add(id);
    return id;
  };
  const tween = (from: number, to: number, ms: number, set: (v: number) => void, done?: () => void, ease?: (t: number) => number) => {
    if (reduce || ms <= 0) { set(to); done?.(); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      if (!alive.current) return;
      const t = Math.min(1, (now - t0) / ms), e = ease ? ease(t) : 1 - Math.pow(1 - t, 3);
      set(from + (to - from) * e);
      if (t < 1) { const id = requestAnimationFrame(n => { frames.current.delete(id); step(n); }); frames.current.add(id); } else done?.();
    };
    const id = requestAnimationFrame(n => { frames.current.delete(id); step(n); });
    frames.current.add(id);
  };
  const wait = (ms: number, fn: () => void) => { if (reduce) fn(); else later(ms, fn); };

  // ---- Showing a stack ----
  const show = (next: StackState) => {
    const L = current(next.st);
    anim.current = restingAnim(L.phi);
    commit(next); setDrawnPhi(L.phi); setSvgOpen(false);
  };
  const newStack = (tier: TierId) => {
    setLift(null);
    rec.drop();
    show({ st: dealStack(tier, pRef.current.skill), msg: NEW_MSG, msgKind: "", cheated: cheatRef.current });
  };

  const spinSet = (v: number) => { anim.current.phi = v; apply(); };
  const spinTo = (target: number) => tween(anim.current.phi, target, 280, spinSet, redraw);
  const spinBy = (dir: number) => {
    if (busy.current || isOpen()) return;
    const g = geom(current(sRef.current.st).tier);
    spinTo(snapPhi(g, anim.current.phi) + dir * g.da);
  };

  /** Spin the dial a full turn or more, swapping in `next` halfway (the stones scramble as it spins). */
  const spinSwap = (next: StackState, done: () => void) => {
    const from = anim.current.phi, phi = current(next.st).phi;
    const target = phi + 360 * Math.ceil((from + 360 - phi) / 360);
    let swapped = false;
    const swap = (v: number) => { swapped = true; commit(next); setSvgOpen(false); anim.current = { ...restingAnim(v) }; setDrawnPhi(v); };
    tween(from, target, 1500, v => {
      if (!swapped && v >= (from + target) / 2) swap(v);
      spinSet(v);
    }, () => {
      if (!swapped) swap(target);
      anim.current.phi = target; setDrawnPhi(target); apply();
      done();
    });
  };

  const shake = () => {
    const svg = dom.current.svg; if (!svg || reduce) return;
    svg.classList.remove("shake"); void svg.getBoundingClientRect(); svg.classList.add("shake");
  };

  /** Out of turns with a broken knot: the attempt ends and the whole stack resets. */
  const runDry = () => {
    const S = sRef.current, n = S.st.at + 1;
    busy.current = true;
    const P = pRef.current, np = { ...P, attempts: P.attempts + 1 };
    pRef.current = np; setProfile(np);
    rec.end(S.st.tier, "failed", S.cheated);
    const why = `Out of turns with ${ord(n)}'s knot still broken.`;
    commit({ ...S, msg: `${why} The stack resets…`, msgKind: "bad" });
    shake();
    wait(1300, () => {
      const fresh: StackState = { st: resetStack(S.st, np.skill), msg: `${why} The whole stack has reset: fresh discs and a fresh purse.`, msgKind: "bad", cheated: cheatRef.current };
      spinSwap(fresh, () => { busy.current = false; });
    });
  };

  const turn = (k: number, ccw: boolean) => {
    const S = sRef.current;
    if (busy.current || S.st.open) return;
    const L = current(S.st), g = geom(L.tier);
    if (L.cur[k] === 15 || !visible(g, k, anim.current.phi)) return;
    if (S.st.left <= 0) return;
    rec.begin(S.st.tier);
    const st = turnStone(S.st, k, ccw);
    const done = layerSolved(current(st));
    commit({ ...S, st, msg: st.left === 0 && done ? "That was your last turn. Press the center." : "", msgKind: "" });
    redraw();
    dom.current.disc?.querySelector<SVGElement>(`[data-k="${k}"]`)?.focus({ preventScroll: true });
    if (stranded(st)) runDry();
  };

  const pressHub = (done: () => void) => {
    const setHub = (v: number) => { anim.current.hub = v; apply(); };
    tween(1, .88, 165, setHub, () => tween(.88, 1, 240, setHub, done));
  };
  const clunk = () => {
    const svg = dom.current.svg; if (!svg) return;
    svg.classList.remove("clunk"); void svg.getBoundingClientRect(); svg.classList.add("clunk");
  };
  const slide = (v: number) => { anim.current.cover = v; apply(); };
  const setRaise = (v: number) => { anim.current.raise = v; apply(); };

  const liftKey = useRef(0);
  const tryOpen = () => {
    if (busy.current || isOpen()) return;
    busy.current = true;
    pressHub(() => {
      const S = sRef.current, P = pRef.current;
      const r = press(S.st);
      const n = S.st.at + 1, total = S.st.layers.length;
      if (r.kind === "box") {
        // The bottom disc: the original's full opening. The shield slides away, the pins drop home, the disc spins free.
        const gain = stackSkillGain(P.skill, S.st.tier, total, S.st.left, S.cheated);
        const np = { skill: P.skill + gain, opened: P.opened + (S.cheated ? 0 : 1), attempts: P.attempts + 1 };
        pRef.current = np; setProfile(np);
        rec.end(S.st.tier, "opened", S.cheated);
        const msg = S.cheated ? "The last disc opens, and the box with it. Practice stack, so no skill gained."
          : `The last disc opens, and the box with it.${gain > 0 ? ` Skill +${gain}.` : ""}`;
        commit({ ...S, st: r.st, msg, msgKind: "good" });
        wait(220, () => tween(0, 120, 90, slide, () => wait(260, () => tween(120, 430, 500, slide, () => {
          tween(1, 1.55, 260, setRaise, () => tween(1.55, -0.22, 560, setRaise, () => {
            clunk();
            tween(-0.22, 0, 220, setRaise, () => wait(320, () => {
              anim.current.pinPhi = anim.current.phi;
              redraw(); setSvgOpen(true); apply();
              const from = anim.current.phi;
              tween(from, from + 360, 2400, spinSet, () => { busy.current = false; redraw(); });
            }));
          }, easeIn));
        }))));
      } else if (r.kind === "next") {
        // A short opening: the shield whips away, the pins drop, a quarter spin, then the disc lifts off.
        commit({ ...S, msg: `Disc ${n} of ${total} opens…`, msgKind: "good" });
        const liftOff = () => {
          const layer = current(S.st);
          if (!reduce) setLift({ key: ++liftKey.current, layer, anim: { ...anim.current } });
          const left = r.st.left;
          const msg = left === 0 ? "" : `Disc ${n} lifts away. Disc ${n + 1} of ${total} beneath: ${left} turn${left === 1 ? "" : "s"} left in the purse.`;
          show({ ...S, st: r.st, msg, msgKind: "good" });
          wait(900, () => {
            setLift(null);
            busy.current = false;
            if (stranded(r.st)) runDry();
          });
        };
        tween(0, 430, 420, slide, () => {
          tween(1, 1.4, 160, setRaise, () => tween(1.4, -0.2, 380, setRaise, () => {
            clunk();
            tween(-0.2, 0, 160, setRaise, () => {
              anim.current.pinPhi = anim.current.phi;
              redraw(); setSvgOpen(true); apply();
              const from = anim.current.phi;
              tween(from, from + 120, 650, spinSet, () => wait(80, liftOff));
            });
          }, easeIn));
        });
      } else {
        // A broken knot: this disc's stones scramble again. The purse stays as it is.
        const np = { ...P, attempts: P.attempts + 1 };
        pRef.current = np; setProfile(np);
        commit({ ...S, msg: "The knot was broken…", msgKind: "bad" });
        const left = r.st.left;
        const next: StackState = { ...S, st: r.st, msg: `The knot was broken. ${n === 1 ? "The top disc" : `Disc ${n}`} spins and its stones scramble. No turns come back: ${left} left.`, msgKind: "bad" };
        spinSwap(next, () => { busy.current = false; });
      }
    });
  };

  const toggleCheat = () => {
    const c = !cheatRef.current;
    cheatRef.current = c; setCheatState(c);
    if (c && !isOpen()) commit({ ...sRef.current, cheated: true });
    redraw();
  };
  const pickTier = (t: TierId) => { if (!busy.current) newStack(t); };
  const newOrNext = () => { if (!busy.current) newStack(sRef.current.st.tier); };

  // ---- Pointer: spin, tap and press (as useLock) ----
  interface Drag { a0: number; phi0: number; x0: number; y0: number; moved: boolean; k: number | null; hub: boolean; id: number; long: boolean; timer: ReturnType<typeof setTimeout> | null }
  const drag = useRef<Drag | null>(null);
  const svgPoint = (e: PointerEvent<SVGSVGElement>): [number, number] => {
    const svg = e.currentTarget, ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [q.x, q.y];
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (busy.current || isOpen() || e.button === 1) return;
    const [x, y] = svgPoint(e);
    const t = e.target as Element;
    if (!(t.closest("#disc") || dom.current.top?.contains(t))) return;
    const tile = t.closest<SVGElement>("[data-k]"), hub = !!t.closest("#hub");
    const dd: Drag = { a0: Math.atan2(x, -y) * 180 / Math.PI, phi0: anim.current.phi, x0: x, y0: y, moved: false, k: tile ? +tile.dataset.k! : null, hub, id: e.pointerId, long: false, timer: null };
    drag.current = dd;
    if (e.pointerType !== "mouse") dd.timer = later(450, () => { if (drag.current === dd && !dd.moved && dd.k != null) { dd.long = true; turn(dd.k, true); } });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const [x, y] = svgPoint(e);
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) < 6) return;
    if (d.long) return;
    d.moved = true; if (d.timer) clearTimeout(d.timer);
    const a = Math.atan2(x, -y) * 180 / Math.PI;
    spinSet(d.phi0 + norm(a - d.a0));
  };
  const endDrag = (e: PointerEvent<SVGSVGElement>, cancel: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.timer) clearTimeout(d.timer);
    if (d.moved) spinTo(snapPhi(geom(current(sRef.current.st).tier), anim.current.phi));
    else if (!cancel && d.hub && e.button === 0) tryOpen();
    else if (!cancel && d.k != null && !d.long) turn(d.k, e.button === 2);
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    if (e.key === "ArrowLeft") { e.preventDefault(); spinBy(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); spinBy(1); }
    else if ((e.key === "Enter" || e.key === " ") && t.id === "hub") { e.preventDefault(); tryOpen(); }
    else if ((e.key === "Enter" || e.key === " ") && t instanceof SVGElement && t.dataset.k) { e.preventDefault(); turn(+t.dataset.k, e.shiftKey); }
  };

  return {
    s, profile, cheat, svgOpen, drawnPhi, anim: anim.current, dom, lift, reduce,
    spinBy, tryOpen, newOrNext, toggleCheat, pickTier,
    handlers: { onPointerDown, onPointerMove, onPointerUp: (e: PointerEvent<SVGSVGElement>) => endDrag(e, false), onPointerCancel: (e: PointerEvent<SVGSVGElement>) => endDrag(e, true), onKeyDown },
  };
}
