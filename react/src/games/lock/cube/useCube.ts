// State and effects for the cube: dealing locks, turning stones, turning the cube (drag, keys, buttons,
// snapping to a face-square orientation), and the try / open / scramble animations.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useStoredState } from "../../../kit/useStoredState";
import { NEW_PROFILE, openedMessage, rotCCW, rotCW, skillGain, type Profile, type TierId } from "../engine/knot";
import {
  CUBE_TIERS, ORIENTATIONS, cubeGeom, cubeTransform, deal, dragCube, faceLight, frontFace, makeKnot, qaxis, qmul, qnorm,
  qslerp, snapQuat, solved, turnCube, visibleFaces, type CubeTurn, type Quat,
} from "./engine";
import { emptyCubeDom, type CubeDom } from "./CubeView";
import { useLockRecord } from "../record";

export interface CubeState {
  tier: TierId; sol: number[]; cur: number[];
  turnsLeft: number; budget: number; open: boolean;
  msg: string; msgKind: "" | "good" | "bad"; cheated: boolean;
}

const newMsg = (tier: TierId) => CUBE_TIERS[tier].obscured
  ? "Only the face toward you shows its knot. Turn the cube to read the rest."
  : "Turn the cube to see the rest of the knot.";

function freshLock(tier: TierId, sol: number[], skill: number, cheat: boolean, msg: string, msgKind: CubeState["msgKind"] = "") {
  const d = deal(tier, sol, skill);
  const s: CubeState = { tier, sol, cur: d.cur, turnsLeft: d.budget, budget: d.budget, open: false, msg, msgKind, cheated: cheat };
  return { s, q: ORIENTATIONS[d.orient] };
}

/** Which faces show and which can be touched, for the cube turned to q. */
interface View { front: number; vis: number[] }
const viewOf = (q: Quat): View => ({ front: frontFace(q), vis: visibleFaces(q) });
const sameView = (a: View, b: View) => a.front === b.front && a.vis.join() === b.vis.join();
export const shadeOf = (q: Quat) => faceLight(q).map(l => +((1 - l) * .6).toFixed(3));

const easeInOut = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function useCube() {
  const [profile, setProfile] = useStoredState<Profile>("lock-react-cube-profile", NEW_PROFILE);
  const first = useRef<{ s: CubeState; q: Quat } | null>(null);
  if (!first.current) first.current = freshLock(2, makeKnot(CUBE_TIERS[2]), profile.skill, false, newMsg(2));
  const [s, setS] = useState<CubeState>(first.current.s);
  const [view, setView] = useState<View>(() => viewOf(first.current!.q));
  const [cheat, setCheatState] = useState(false);
  const [home, setHome] = useState(false);
  const [moving, setMoving] = useState(false);
  const rec = useLockRecord("cube");

  const sRef = useRef(s), pRef = useRef(profile), cheatRef = useRef(cheat), viewRef = useRef(view);
  pRef.current = profile;
  const commit = useCallback((next: CubeState) => { sRef.current = next; setS(next); }, []);
  const q = useRef<Quat>(first.current.q);
  const dom = useRef<CubeDom>(emptyCubeDom());
  const busy = useRef(false);
  const reduce = useRef(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;

  /** Push the cube's turn and face shading to the DOM, and redraw if a face came into or out of view. */
  const apply = () => {
    const d = dom.current;
    if (d.body) d.body.style.transform = cubeTransform(q.current);
    shadeOf(q.current).forEach((o, f) => { const el = d.shades[f]; if (el) el.style.opacity = String(o); });
    const v = viewOf(q.current);
    if (!sameView(v, viewRef.current)) { viewRef.current = v; setView(v); }
  };
  useLayoutEffect(() => { apply(); });

  // A focused stone that turns out of view hands focus back to the cube.
  useEffect(() => {
    const a = document.activeElement;
    if (a instanceof SVGElement && a.dataset.k && !a.hasAttribute("tabindex")) dom.current.scene?.focus({ preventScroll: true });
  });

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
  const wait = (ms: number, fn: () => void) => { if (reduce) fn(); else later(ms, fn); };
  const stopTween = useRef<(() => void) | null>(null);
  /** Run set(t) for t from 0 to 1 over ms (eased), one frame at a time. */
  const tween = (ms: number, set: (t: number) => void, done?: () => void, ease: (t: number) => number = t => 1 - Math.pow(1 - t, 3)) => {
    stopTween.current?.();
    if (reduce || ms <= 0) { set(1); done?.(); return; }
    let stopped = false, id = 0;
    stopTween.current = () => { stopped = true; cancelAnimationFrame(id); frames.current.delete(id); };
    const t0 = performance.now();
    const step = (now: number) => {
      if (!alive.current || stopped) return;
      const t = Math.min(1, (now - t0) / ms);
      set(ease(t));
      if (t < 1) { id = requestAnimationFrame(n => { frames.current.delete(id); step(n); }); frames.current.add(id); }
      else { stopTween.current = null; done?.(); }
    };
    id = requestAnimationFrame(n => { frames.current.delete(id); step(n); });
    frames.current.add(id);
  };

  // ---- Turning the cube ----
  /** Glide to an orientation along the short way round. */
  const aim = useRef<Quat | null>(null);
  const glideTo = (target: Quat, ms = 320, done?: () => void) => {
    const from = q.current;
    setMoving(true); aim.current = target;
    tween(ms, t => { q.current = qslerp(from, target, t); apply(); }, () => { q.current = target; aim.current = null; apply(); setMoving(false); done?.(); });
  };
  const settle = () => glideTo(snapQuat(q.current).q, 260);
  const turnBy = (t: CubeTurn) => {
    if (busy.current || drag.current?.moved) return;
    // from wherever the cube is heading, so quick presses add up
    glideTo(snapQuat(turnCube(aim.current ?? snapQuat(q.current).q, t)).q);
  };

  // ---- Actions ----
  const newLock = (tier: TierId) => {
    stopTween.current?.(); aim.current = null;
    const fr = freshLock(tier, makeKnot(CUBE_TIERS[tier]), pRef.current.skill, cheatRef.current, newMsg(tier));
    q.current = fr.q;
    rec.drop();
    commit(fr.s); setHome(false); setMoving(false); apply();
  };

  /** Can this stone be turned now (on a face you can see, showing its knot, not a crossing)? */
  const turnable = (k: number) => {
    const S = sRef.current, g = cubeGeom(CUBE_TIERS[S.tier].N), f = g.face[k], v = viewRef.current;
    const shown = !CUBE_TIERS[S.tier].obscured || f === v.front || cheatRef.current;
    return v.vis.includes(f) && shown && S.cur[k] !== 15;
  };

  const turn = (k: number, ccw: boolean) => {
    const S = sRef.current;
    if (busy.current || S.open || !turnable(k)) return;
    if (S.turnsLeft <= 0) { commit({ ...S, msg: "No turns left. Press the triskele to try the lock.", msgKind: "bad" }); return; }
    const cur = S.cur.slice(); cur[k] = ccw ? rotCCW(cur[k]) : rotCW(cur[k]);
    const left = S.turnsLeft - 1;
    rec.begin(S.tier);
    commit({ ...S, cur, turnsLeft: left, msg: left === 0 ? "That was your last turn. Press the triskele." : "", msgKind: "" });
    if (!reduce) {
      // the stone and its pin swing round into place
      dom.current.body?.querySelectorAll<SVGGElement>(`[data-tile="${k}"]`).forEach(el =>
        el.animate?.([{ transform: `rotate(${ccw ? 90 : -90}deg)` }, { transform: "rotate(0deg)" }], { duration: 200, easing: "cubic-bezier(.3,1.3,.5,1)" }));
    }
  };

  const clunk = () => {
    const el = dom.current.scene; if (!el) return;
    el.classList.remove("clunk"); void el.getBoundingClientRect(); el.classList.add("clunk");
  };

  const tryOpen = () => {
    if (busy.current || sRef.current.open) return;
    busy.current = true;
    stopTween.current?.(); aim.current = null;
    const S = sRef.current, g = cubeGeom(CUBE_TIERS[S.tier].N), P = pRef.current;
    const start = snapQuat(q.current).q;
    if (solved(g, S.cur)) {
      // The pins are pushed home into their grooves, the cube settles with a clunk, then spins free.
      const gain = skillGain(P.skill, S.tier, S.turnsLeft, S.cheated);
      const np = { skill: P.skill + gain, opened: P.opened + (S.cheated ? 0 : 1), attempts: P.attempts + 1 };
      pRef.current = np; setProfile(np);
      rec.end(S.tier, "opened", S.cheated);
      commit({ ...S, open: true, msg: openedMessage(S.cheated, gain), msgKind: "good" });
      glideTo(start, 200, () => {
        setHome(true);
        wait(520, () => {
          clunk();
          wait(360, () => {
            setMoving(true);
            tween(2600, t => { q.current = qnorm(qmul(qaxis([0, 1, 0], 360 * t), qmul(qaxis([1, 0, 0], 360 * Math.sin(Math.PI * t) * .12), start))); apply(); },
              () => { q.current = start; apply(); setMoving(false); busy.current = false; }, easeInOut);
          });
        });
      });
    } else {
      // The cube tumbles and the stones fall back to a new random state; turns refill.
      const np = { ...P, attempts: P.attempts + 1 };
      pRef.current = np; setProfile(np);
      rec.end(S.tier, "failed", S.cheated);
      const fresh = freshLock(S.tier, S.sol, np.skill, cheatRef.current, "The knot was broken. The cube tumbles and the stones scramble.", "bad");
      commit({ ...S, msg: "The knot was broken…", msgKind: "bad" });
      const target = fresh.q;
      let swapped = false;
      setMoving(true);
      tween(1500, t => {
        if (!swapped && t >= .5) { swapped = true; commit(fresh.s); }
        q.current = qnorm(qmul(qaxis([0, 1, 0], 360 * t), qslerp(start, target, t))); apply();
      }, () => {
        if (!swapped) commit(fresh.s);
        q.current = target; apply(); setMoving(false); busy.current = false;
      }, easeInOut);
    }
  };

  const toggleCheat = () => {
    const c = !cheatRef.current;
    cheatRef.current = c; setCheatState(c);
    if (c && !sRef.current.open) commit({ ...sRef.current, cheated: true });
  };
  const pickTier = (t: TierId) => { if (!busy.current) newLock(t); };
  const newOrNext = () => { if (!busy.current) newLock(sRef.current.tier); };

  // ---- Pointer: drag to turn the cube, tap a stone to turn it ----
  interface Drag { x0: number; y0: number; x: number; y: number; moved: boolean; k: number | null; id: number; long: boolean; timer: ReturnType<typeof setTimeout> | null; button: number }
  const drag = useRef<Drag | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (busy.current || e.button === 1 || drag.current) return;
    const t = e.target as Element;
    const tile = t.closest<SVGElement>("[data-k]");
    const k = tile && !sRef.current.open ? +tile.dataset.k! : null;
    const dd: Drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, k, id: e.pointerId, long: false, timer: null, button: e.button };
    drag.current = dd;
    if (e.pointerType !== "mouse") dd.timer = later(450, () => { if (drag.current === dd && !dd.moved && dd.k != null) { dd.long = true; turn(dd.k, true); } });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || d.long) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 7) return;
    if (!d.moved) { d.moved = true; if (d.timer) clearTimeout(d.timer); stopTween.current?.(); aim.current = null; setMoving(true); }
    const size = dom.current.body?.offsetWidth || 240;
    q.current = dragCube(q.current, e.clientX - d.x, e.clientY - d.y, 150 / size);
    d.x = e.clientX; d.y = e.clientY;
    apply();
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancel: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.timer) clearTimeout(d.timer);
    if (d.moved) settle();
    else if (!cancel && d.k != null && !d.long) turn(d.k, d.button === 2);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as Element;
    if (t instanceof HTMLInputElement || e.altKey || e.ctrlKey || e.metaKey) return;
    const keyTurn: Record<string, CubeTurn> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", e: "roll", E: "roll", q: "unroll", Q: "unroll" };
    if (keyTurn[e.key]) { e.preventDefault(); turnBy(keyTurn[e.key]); return; }
    if ((e.key === "Enter" || e.key === " ") && t instanceof SVGElement && t.dataset.k) { e.preventDefault(); turn(+t.dataset.k, e.shiftKey); }
  };

  return {
    s, profile, cheat, home, moving, view, q, dom,
    turnBy, tryOpen, newOrNext, toggleCheat, pickTier, onKeyDown,
    handlers: {
      onPointerDown, onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLDivElement>) => endDrag(e, false),
      onPointerCancel: (e: PointerEvent<HTMLDivElement>) => endDrag(e, true),
    },
  };
}
