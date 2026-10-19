// State and effects for the current version: dealing locks, turning stones, spinning the dial,
// and the press / open / scramble animations (run frame by frame as in the original).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { geom, norm, snapPhi, visible } from "./engine/dial";
import {
  NEW_PROFILE, TIERS, deal, makeKnot, openedMessage, rotCCW, rotCW, skillGain, solved, type Profile, type TierId,
} from "./engine/knot";
import { applyAnim, emptyDom, restingAnim, type Anim, type DialDom } from "./components/Dial";

export interface LockState {
  tier: TierId; sol: number[]; cur: number[];
  turnsLeft: number; budget: number; open: boolean;
  msg: string; msgKind: "" | "good" | "bad"; cheated: boolean;
}

function freshLock(tier: TierId, sol: number[], skill: number, cheat: boolean, msg: string, msgKind: LockState["msgKind"] = "") {
  const d = deal(tier, sol, skill);
  const s: LockState = { tier, sol, cur: d.cur, turnsLeft: d.budget, budget: d.budget, open: false, msg, msgKind, cheated: cheat };
  return { s, phi: d.phi };
}
const NEW_MSG = "Spin the disc to see the rest of the knot.";

const easeIn = (t: number) => t * t * t;

export function useLock() {
  const [profile, setProfile] = useStoredState<Profile>("lock-react-profile", NEW_PROFILE);
  const first = useRef<{ s: LockState; phi: number } | null>(null);
  if (!first.current) first.current = freshLock(2, makeKnot(TIERS[2]), profile.skill, false, NEW_MSG);
  const [s, setS] = useState<LockState>(first.current.s);
  const [drawnPhi, setDrawnPhi] = useState(first.current.phi);
  const [cheat, setCheatState] = useState(false);
  const [svgOpen, setSvgOpen] = useState(false);

  // Mirrors of state for use inside animation callbacks.
  const sRef = useRef(s), pRef = useRef(profile), cheatRef = useRef(cheat);
  pRef.current = profile;
  const commit = useCallback((next: LockState) => { sRef.current = next; setS(next); }, []);
  const anim = useRef<Anim>(restingAnim(first.current.phi));
  const dom = useRef<DialDom>(emptyDom());
  const busy = useRef(false);
  const reduce = useRef(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;

  // After every render, the animated values win over whatever React drew.
  useLayoutEffect(() => { applyAnim(dom.current, anim.current, sRef.current.open); });
  const apply = () => applyAnim(dom.current, anim.current, sRef.current.open);
  const redraw = () => setDrawnPhi(anim.current.phi); // the original's drawDisc()

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

  // ---- Actions ----
  const newLock = (tier: TierId) => {
    const f = freshLock(tier, makeKnot(TIERS[tier]), pRef.current.skill, cheatRef.current, NEW_MSG);
    anim.current = restingAnim(f.phi);
    commit(f.s); setDrawnPhi(f.phi); setSvgOpen(false);
  };

  const spinSet = (v: number) => { anim.current.phi = v; apply(); };
  const spinTo = (target: number) => tween(anim.current.phi, target, 280, spinSet, redraw);
  const spinBy = (dir: number) => {
    if (busy.current || sRef.current.open) return;
    const g = geom(sRef.current.tier);
    spinTo(snapPhi(g, anim.current.phi) + dir * g.da);
  };

  const turn = (k: number, ccw: boolean) => {
    const S = sRef.current;
    if (busy.current || S.open) return;
    const g = geom(S.tier);
    if (S.cur[k] === 15 || !visible(g, k, anim.current.phi)) return;
    if (S.turnsLeft <= 0) { commit({ ...S, msg: "No turns left. Press the center.", msgKind: "bad" }); return; }
    const cur = S.cur.slice(); cur[k] = ccw ? rotCCW(cur[k]) : rotCW(cur[k]);
    const left = S.turnsLeft - 1;
    commit({ ...S, cur, turnsLeft: left, msg: left === 0 ? "That was your last turn. Press the center." : "", msgKind: "" });
    redraw();
    dom.current.disc?.querySelector<SVGElement>(`[data-k="${k}"]`)?.focus({ preventScroll: true });
  };

  const pressHub = (done: () => void) => {
    const setHub = (v: number) => { anim.current.hub = v; apply(); };
    tween(1, .88, 165, setHub, () => tween(.88, 1, 240, setHub, done));
  };

  const clunk = () => {
    const svg = dom.current.svg; if (!svg) return;
    svg.classList.remove("clunk"); void svg.getBoundingClientRect(); svg.classList.add("clunk");
  };

  const tryOpen = () => {
    if (busy.current || sRef.current.open) return;
    busy.current = true;
    pressHub(() => {
      const S = sRef.current, g = geom(S.tier), P = pRef.current;
      if (solved(S.cur, g.R, g.C)) {
        // The shield slides away, the pins are pushed home, then the disc spins free.
        const gain = skillGain(P.skill, S.tier, S.turnsLeft, S.cheated);
        const np = { skill: P.skill + gain, opened: P.opened + (S.cheated ? 0 : 1), attempts: P.attempts + 1 };
        pRef.current = np; setProfile(np);
        commit({ ...S, open: true, msg: openedMessage(S.cheated, gain), msgKind: "good" });
        // The shield catches, snaps about 28% open, then glides the rest of the way.
        const slide = (v: number) => { anim.current.cover = v; apply(); };
        const setRaise = (v: number) => { anim.current.raise = v; apply(); };
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
      } else {
        // The dial spins and the stones fall back to a new random state.
        const np = { ...P, attempts: P.attempts + 1 };
        pRef.current = np; setProfile(np);
        const from = anim.current.phi;
        const fresh = freshLock(S.tier, S.sol, np.skill, cheatRef.current, "The knot was broken. The dial spins and the stones scramble.", "bad");
        commit({ ...S, msg: "The knot was broken…", msgKind: "bad" });
        const target = fresh.phi + 360 * Math.ceil((from + 360 - fresh.phi) / 360);
        let swapped = false;
        tween(from, target, 1500, v => {
          if (!swapped && v >= (from + target) / 2) { swapped = true; commit(fresh.s); setDrawnPhi(v); }
          spinSet(v);
        }, () => {
          if (!swapped) commit(fresh.s);
          anim.current.phi = target; setDrawnPhi(target); apply();
          busy.current = false;
        });
      }
    });
  };

  const toggleCheat = () => {
    const c = !cheatRef.current;
    cheatRef.current = c; setCheatState(c);
    if (c && !sRef.current.open) commit({ ...sRef.current, cheated: true });
    redraw();
  };
  const pickTier = (t: TierId) => { if (!busy.current) newLock(t); };
  const newOrNext = () => { if (!busy.current) newLock(sRef.current.tier); };

  // ---- Pointer: spin, tap and press ----
  interface Drag { a0: number; phi0: number; x0: number; y0: number; moved: boolean; k: number | null; hub: boolean; id: number; long: boolean; timer: ReturnType<typeof setTimeout> | null }
  const drag = useRef<Drag | null>(null);
  const svgPoint = (e: PointerEvent<SVGSVGElement>): [number, number] => {
    const svg = e.currentTarget, ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [q.x, q.y];
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (busy.current || sRef.current.open || e.button === 1) return;
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
    if (d.moved) spinTo(snapPhi(geom(sRef.current.tier), anim.current.phi));
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
    s, profile, cheat, svgOpen, drawnPhi, anim: anim.current, dom,
    spinBy, tryOpen, newOrNext, toggleCheat, pickTier,
    handlers: { onPointerDown, onPointerMove, onPointerUp: (e: PointerEvent<SVGSVGElement>) => endDrag(e, false), onPointerCancel: (e: PointerEvent<SVGSVGElement>) => endDrag(e, true), onKeyDown },
  };
}
