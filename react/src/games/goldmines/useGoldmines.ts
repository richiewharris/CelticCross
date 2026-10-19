// Game state and the animation loop. The pan itself is hot, mutable data kept in a ref and stepped
// every frame; React state only changes on discrete events (a pan starts or ends, a flake is picked,
// the status line changes), so the page does not re-render per frame.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { CX, W0, aim, drive, idleHands, tapAt as hitTest, toScreen, type Hands } from "./engine/control";
import {
  endDay, finishPan, fmt, newDay, scoopAt, statusFor, type Day, type DayResult, type PanResult, type Phase, type Status,
} from "./engine/day";
import { STEEP, collect, dip, goldSettled, refreshExposure, stonesLeft, stonesUp, type Pan, type Particle } from "./engine/pan";
import { rand, type Rng } from "./engine/rng";
import { drawFrame, makeSurface, newFx, type Fx, type Surface } from "./draw";
import { useAnimationFrame } from "./useAnimationFrame";

export type Card = { kind: "summary"; r: PanResult; pansLeft: number } | { kind: "dayEnd"; r: DayResult } | null;
export interface Meta { best: number; coach: boolean }
export interface GaugeRefs { water: RefObject<HTMLElement>; tilt: RefObject<HTMLElement>; settle: RefObject<HTMLElement> }

interface World {
  phase: Phase; day: Day; pan: Pan | null; spot: string | null;
  hands: Hands; fx: Fx; expTimer: number; uiTimer: number; last: number;
  pendingStones: { p: Particle; at: number }[];
  coach: boolean; reduce: boolean;
}

const INK = "#ece6d6", LOST = "#e58c7f", GOLD = "#f6d77a";

export function useGoldmines(gauges: GaugeRefs, rng: Rng = Math.random) {
  const [meta, setMeta] = useStoredState<Meta>("goldmines-react-meta", { best: 0, coach: false });
  const w = useRef<World>(null as unknown as World);
  if (!w.current) {
    w.current = {
      phase: "choose", day: newDay(rng), pan: null, spot: null, hands: idleHands(), fx: newFx(),
      expTimer: 0, uiTimer: 0, last: performance.now(), pendingStones: [], coach: meta.coach,
      reduce: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  }
  w.current.coach = meta.coach;

  const snap = () => {
    const s = w.current;
    return { phase: s.phase, day: s.day, haul: haulOf(s), status: statusFor(s.phase, s.day, s.pan) };
  };
  const [view, setView] = useState(snap);
  const [card, setCard] = useState<Card>(null);
  const [dragging, setDragging] = useState(false);
  const sync = useCallback(() => setView(snap()), []);

  const float = (text: string, x: number, y: number, col = GOLD) => w.current.fx.floats.push({ text, x, y, t: 0, col });
  const flyGold = (pan: Pan, p: Particle) => {
    const [x, y] = toScreen(pan, p);
    w.current.fx.flyers.push({ kind: "gold", p, x, y, vx: 0, vy: 0, spin: 0, t: 0, mg: p.mg, done: false });
  };
  const tossStone = (pan: Pan, p: Particle) => {
    p.alive = false;
    const [x, y] = toScreen(pan, p);
    w.current.fx.flyers.push({ kind: "stone", p, x, y, vx: (x < CX ? -1 : 1) * rand(rng, 260, 380), vy: rand(rng, -320, -220), spin: rand(rng, -6, 6), t: 0, mg: 0, done: false });
  };

  // ----- actions -----
  const startPan = useCallback((id: string) => {
    const s = w.current;
    if (s.phase !== "choose" || s.day.pansLeft <= 0) return;
    const pan = scoopAt(s.day, id, rng);
    if (!pan) return;
    Object.assign(s, { pan, spot: id, phase: "pan", expTimer: 0, uiTimer: 0 });
    s.hands.holdShake = s.hands.holdWash = false; s.hands.keyTilt = 0;
    setCard(null); sync();
  }, [rng, sync]);

  const finish = useCallback(() => {
    const s = w.current;
    if (s.phase !== "pan" || !s.pan || !s.spot) return;
    const { day, result } = finishPan(s.day, s.spot, s.pan);
    for (const p of result.collected) flyGold(s.pan, p);
    s.day = day; s.phase = "summary";
    setCard({ kind: "summary", r: result, pansLeft: day.pansLeft });
    sync();
  }, [sync]);

  const next = useCallback(() => {
    const s = w.current;
    if (s.day.pansLeft > 0) { s.phase = "choose"; s.pan = null; setCard(null); sync(); return; }
    const r = endDay(s.day, meta.best);
    setMeta(m => ({ ...m, best: r.best }));
    s.phase = "dayEnd";
    setCard({ kind: "dayEnd", r });
    sync();
  }, [meta.best, setMeta, sync]);

  const newDayNow = useCallback(() => {
    const s = w.current;
    s.day = newDay(rng); s.phase = "choose"; s.pan = null; s.fx.displayMg = 0;
    setCard(null); sync();
  }, [rng, sync]);

  const pickStones = useCallback(() => {
    const s = w.current;
    if (s.phase !== "pan" || !s.pan) return;
    const up = stonesUp(s.pan);
    if (!up.length) { float(stonesLeft(s.pan) ? "Shake first, so the stones come up" : "No stones left", CX, 120, INK); return; }
    const now = performance.now();
    up.forEach((p, i) => s.pendingStones.push({ p, at: now + i * 90 }));
  }, []);

  const doDip = useCallback(() => {
    const s = w.current;
    if (s.phase !== "pan" || !s.pan || s.fx.dipAnim > 0) return;
    s.hands.keyTilt = 0; s.hands.holdWash = false;
    s.fx.dipAnim = 1; dip(s.pan, rng);
  }, [rng]);

  const toggleCoach = useCallback(() => setMeta(m => ({ ...m, coach: !m.coach })), [setMeta]);
  const hold = useCallback((key: "holdShake" | "holdWash", on: boolean) => {
    if (on && w.current.phase !== "pan") return false;
    w.current.hands[key] = on;
    return true;
  }, []);

  const tap = (x: number, y: number) => {
    const s = w.current, pan = s.pan;
    if (s.phase !== "pan" || !pan) return;
    const hit = hitTest(pan, x, y);
    if (!hit) return;
    if (hit.kind === "toss") tossStone(pan, hit.p);
    else if (hit.kind === "stoneDeep") float("Shake first, so it comes up", x, y - 10, INK);
    else if (hit.kind === "buried") float("Still under the sand", x, y - 10, INK);
    else {
      collect(pan, hit.p);
      flyGold(pan, hit.p);
      float(hit.p.nugget ? "A nugget!" : `+${fmt(hit.p.mg)}`, x, y - 12);
      sync();
    }
  };

  // ----- the canvas: size, input -----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surface = useRef<Surface | null>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    surface.current = makeSurface(cv);
    const ro = new ResizeObserver(() => { surface.current = makeSurface(cv); });
    ro.observe(cv);
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => { w.current.reduce = mq.matches; };
    mq.addEventListener("change", onMq);
    return () => { ro.disconnect(); mq.removeEventListener("change", onMq); };
  }, []);

  const toLogical = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * W0, (e.clientY - r.top) / r.height * W0];
  };
  const canvasHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (w.current.phase !== "pan" || e.button > 0) return;
      const [x, y] = toLogical(e);
      Object.assign(w.current.hands, { dragging: true, sx: x, sy: y, x, y, t0: performance.now(), moved: false });
      e.currentTarget.setPointerCapture(e.pointerId); setDragging(true);
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      const h = w.current.hands;
      if (!h.dragging) return;
      const [x, y] = toLogical(e);
      h.x = x; h.y = y;
      if (Math.hypot(x - h.sx, y - h.sy) > 8) h.moved = true;
    },
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => {
      const h = w.current.hands;
      if (!h.dragging) return;
      h.dragging = false; setDragging(false);
      if (!h.moved && performance.now() - h.t0 < 450) { const [x, y] = toLogical(e); tap(x, y); }
    },
    onPointerCancel: () => { w.current.hands.dragging = false; setDragging(false); },
    onKeyDown: (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      const h = w.current.hands;
      if (w.current.phase !== "pan") return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); h.keyOx = (e.key === "ArrowLeft" ? -1 : 1) * 46; h.keyOxT = performance.now(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); h.keyTilt = e.shiftKey ? 0.92 : 0.55; }
      else if (e.key === " ") { e.preventDefault(); doDip(); }
      else if (e.key === "s" || e.key === "S") pickStones();
      else if (e.key === "Enter") { e.preventDefault(); finish(); } // (the original let this Enter also click the card's button, skipping the summary)
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLCanvasElement>) => { if (e.key === "ArrowDown") w.current.hands.keyTilt = 0; },
  };

  // ----- main loop -----
  const lastView = useRef({ haul: view.haul, status: view.status });
  useAnimationFrame(now => {
    const s = w.current, fx = s.fx;
    const dtReal = Math.min(0.25, (now - s.last) / 1000), dt = Math.min(0.05, dtReal);
    s.last = now;
    const pan = s.pan;
    const wb = gauges.water.current, tb = gauges.tilt.current, sb = gauges.settle.current;
    let refresh = false;
    if (pan && s.phase === "pan") {
      // pan offset and tilt follow the drag, keys or hold buttons
      const lost = drive(pan, aim(s.hands, now, fx.dipAnim > 0), Math.max(dtReal, 0), rng);
      for (const g of lost) {
        const [x] = toScreen(pan, g);
        float(g.nugget ? "The nugget washed out!" : "A flake washed out", Math.min(520, Math.max(80, x)), 560, LOST);
      }
      s.expTimer -= dt;
      if (s.expTimer <= 0) { s.expTimer = 0.18; refreshExposure(pan); }
      if (wb) wb.style.width = (pan.W * 100).toFixed(1) + "%";
      if (tb) { tb.style.width = (pan.tilt * 100).toFixed(1) + "%"; tb.style.background = pan.tilt > STEEP ? "var(--garnet)" : ""; }
      if (s.coach && sb) sb.style.width = (goldSettled(pan) * 100).toFixed(0) + "%";
      s.uiTimer -= dt;
      if (s.uiTimer <= 0) { s.uiTimer = 0.25; refresh = true; }
    } else {
      if (wb) wb.style.width = "0%";
      if (tb) tb.style.width = "0%";
    }
    // stones picked out one after another
    if (s.pendingStones.length) {
      const due = s.pendingStones.filter(q => q.at <= now);
      s.pendingStones = s.pendingStones.filter(q => q.at > now);
      for (const q of due) if (q.p.alive && s.pan) tossStone(s.pan, q.p);
    }
    if (fx.dipAnim > 0) fx.dipAnim = Math.max(0, fx.dipAnim - dt * 2.2);
    for (const f of fx.flyers) {
      f.t += dt * (f.kind === "stone" ? 1.4 : 1.25);
      if (f.kind === "stone") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt; }
    }
    for (const f of fx.flyers) if (f.kind === "gold" && f.t >= 1 && !f.done) { f.done = true; fx.displayMg += f.mg; }
    if (fx.flyers.some(f => f.t >= 1)) fx.flyers = fx.flyers.filter(f => f.t < 1);
    for (const m of fx.floats) m.t += dt;
    if (fx.floats.some(m => m.t >= 1.6)) fx.floats = fx.floats.filter(m => m.t < 1.6);
    if (s.phase !== "pan" && !fx.flyers.some(f => f.kind === "gold")) fx.displayMg += (s.day.mg - fx.displayMg) * Math.min(1, dt * 6);
    if (surface.current) drawFrame(surface.current, pan, s.coach, s.reduce, fx, now / 1000);
    if (refresh) {
      const st = statusFor(s.phase, s.day, s.pan), lv = lastView.current;
      if (st.text !== lv.status.text || st.kind !== lv.status.kind || st.step !== lv.status.step) sync();
    }
  });
  useEffect(() => { lastView.current = { haul: view.haul, status: view.status }; }, [view]);

  return {
    ...view, card, meta, dragging, canvasRef, canvasHandlers,
    startPan, finish, next, newDay: newDayNow, pickStones, dip: doDip, toggleCoach, hold,
  };
}

function haulOf(s: World) {
  return fmt(s.phase === "pan" ? s.day.mg + (s.pan ? s.pan.keptMg : 0) : s.day.mg);
}
export type { Status };
