// Canvas drawing for the pan, the stream under it, the vial and the flying bits. Imperative, called
// once per animation frame from the game loop; React never re-renders per frame.
import { CX, CY, ROUT, VIAL, W0 } from "./engine/control";
import { fmt } from "./engine/day";
import { GRID, RIN, sedimentGrid, type Pan, type Particle } from "./engine/pan";

export interface Flyer { kind: "stone" | "gold"; p: Particle; x: number; y: number; vx: number; vy: number; spin: number; t: number; mg: number; done: boolean }
export interface Floater { text: string; x: number; y: number; t: number; col: string }
/** Animation-only state that lives beside the game: flying stones and gold, floating words. */
export interface Fx { flyers: Flyer[]; floats: Floater[]; dipAnim: number; displayMg: number }
export const newFx = (): Fx => ({ flyers: [], floats: [], dipAnim: 0, displayMg: 0 });

export interface Surface { ctx: CanvasRenderingContext2D; scale: number; bed: HTMLCanvasElement }

/** Size the canvas to its box (up to 2x for sharp screens) and paint the streambed once. */
export function makeSurface(cv: HTMLCanvasElement): Surface | null {
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const w = cv.getBoundingClientRect().width || 600, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr);
  const scale = cv.width / W0;
  const bed = document.createElement("canvas"); bed.width = cv.width; bed.height = cv.height;
  const b = bed.getContext("2d");
  if (b) {
    b.setTransform(scale, 0, 0, scale, 0, 0);
    const g = b.createLinearGradient(0, 0, 0, W0); g.addColorStop(0, "#26302b"); g.addColorStop(1, "#1a201d");
    b.fillStyle = g; b.fillRect(0, 0, W0, W0);
    // Streambed pebbles (a fixed seed, so the bed looks the same every time)
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 420; i++) {
      const x = r() * W0, y = r() * W0, rr = 4 + r() * 16, l = 22 + r() * 22;
      b.fillStyle = `hsl(${25 + r() * 20} ${6 + r() * 10}% ${l}%)`;
      b.beginPath(); b.ellipse(x, y, rr, rr * (0.6 + r() * 0.35), r() * 3, 0, 7); b.fill();
      b.fillStyle = `rgb(255 245 220 / ${0.05 + r() * 0.06})`;
      b.beginPath(); b.ellipse(x - rr * 0.25, y - rr * 0.25, rr * 0.45, rr * 0.25, 0, 0, 7); b.fill();
    }
    b.fillStyle = "rgb(30 52 48 / .55)"; b.fillRect(0, 0, W0, W0);
  }
  return { ctx, scale, bed };
}

// A soft blob of wet sediment, stamped across the pan to build up the pile
let sedCache: HTMLCanvasElement | null = null;
function sed() {
  if (sedCache) return sedCache;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  if (x) {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgb(132 108 76 / .9)"); g.addColorStop(0.55, "rgb(124 101 72 / .5)"); g.addColorStop(1, "rgb(120 98 70 / 0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  return (sedCache = c);
}

export function particlePath(c: CanvasRenderingContext2D, p: Particle, s: number) {
  c.beginPath();
  if (p.shape) {
    const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
    p.shape.forEach(([a, b], i) => { const x = a * s * cs - b * s * sn, y = a * s * sn + b * s * cs; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.closePath();
  } else c.ellipse(0, 0, s, p.kind === "gravel" ? s * 0.72 : s, p.rot, 0, 7);
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, now: number, isExposed: boolean) {
  ctx.save(); ctx.translate(p.x * RIN, p.y * RIN);
  if (p.kind === "gold") {
    particlePath(ctx, p, p.r);
    ctx.fillStyle = p.nugget ? "#d9a52e" : "#e2b33c"; ctx.fill();
    ctx.strokeStyle = "rgb(110 70 10 / .6)"; ctx.lineWidth = 0.5; ctx.stroke();
    particlePath(ctx, p, p.r * 0.5); ctx.fillStyle = "#fff0a8"; ctx.fill();
    if (isExposed) {
      const tw = 0.5 + 0.5 * Math.sin(now * 3 + p.phase);
      if (tw > 0.55) {
        const L = p.r * (1.6 + tw * 1.6);
        ctx.strokeStyle = `rgb(255 248 210 / ${(tw - 0.55) * 1.8})`; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.moveTo(0, -L); ctx.lineTo(0, L); ctx.stroke();
      }
    }
  } else if (p.kind === "stone") {
    particlePath(ctx, p, p.r); ctx.fillStyle = p.col; ctx.fill();
    ctx.strokeStyle = "rgb(0 0 0 / .45)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.translate(-p.r * 0.22, -p.r * 0.25); particlePath(ctx, p, p.r * 0.55); ctx.fillStyle = "rgb(255 245 225 / .13)"; ctx.fill(); ctx.restore();
  } else {
    particlePath(ctx, p, p.r); ctx.fillStyle = p.col; ctx.fill();
    if (p.kind === "gravel") { ctx.beginPath(); ctx.arc(-p.r * 0.3, -p.r * 0.3, p.r * 0.35, 0, 7); ctx.fillStyle = "rgb(255 245 225 / .16)"; ctx.fill(); }
  }
  ctx.restore();
}

function drawVial(ctx: CanvasRenderingContext2D, displayMg: number) {
  const x = VIAL.x, y = VIAL.y, w = 26, h = 92;
  const shown = Math.min(1, displayMg / 1000);
  ctx.fillStyle = "rgb(20 24 22 / .55)"; ctx.beginPath(); ctx.roundRect(x - w / 2 - 10, y - 10, w + 20, h + 40, 10); ctx.fill();
  ctx.fillStyle = "rgb(210 230 225 / .12)"; ctx.strokeStyle = "rgb(220 235 230 / .55)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y + 6, w, h - 6, [3, 3, 12, 12]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#6b4a2a"; ctx.fillRect(x - w / 2 - 2, y, w + 4, 9);
  if (shown > 0) {
    const fh = (h - 12) * Math.max(0.03, shown);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x - w / 2 + 2, y + 8, w - 4, h - 10, [2, 2, 10, 10]); ctx.clip();
    const g = ctx.createLinearGradient(0, y + h - fh, 0, y + h); g.addColorStop(0, "#f6d77a"); g.addColorStop(1, "#b98a1f");
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, y + h - fh, w, fh); ctx.restore();
  }
  ctx.fillStyle = "#ece6d6"; ctx.font = "500 11px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
  ctx.fillText(fmt(displayMg), x, y + h + 20);
}

// Scratch buffers reused every frame, so drawing ~600 particles does not churn the garbage collector.
const deep: Particle[] = [], top: Particle[] = [];
let grid = new Float32Array(GRID * GRID);
const byDepth = (a: Particle, b: Particle) => b.d - a.d;

/** Draw one frame. `now` is in seconds. */
export function drawFrame(s: Surface, pan: Pan | null, coach: boolean, reduce: boolean, fx: Fx, now: number) {
  const { ctx, scale, bed } = s;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(bed, 0, 0, W0, W0);
  // moving light on the stream
  if (!reduce) {
    ctx.strokeStyle = "rgb(200 230 220 / .06)"; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      for (let x = 0; x <= W0; x += 20) { const y = 40 + i * 66 + Math.sin(x * 0.02 + now * 0.9 + i) * 8 + ((now * 14) % 66); if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }
  const t = pan ? pan.tilt : 0, ox = pan ? pan.ox : 0;
  const sy = 1 - 0.3 * t, py = CY - 20 * t, dipS = 1 - 0.04 * fx.dipAnim;
  ctx.save();
  ctx.translate(CX + ox, py); ctx.scale(dipS, sy * dipS);
  // shadow
  ctx.fillStyle = "rgb(0 0 0 / .35)"; ctx.beginPath(); ctx.ellipse(10, 16, ROUT, ROUT, 0, 0, 7); ctx.fill();
  // rim and sloped wall: blackened iron
  let g = ctx.createRadialGradient(-60, -80, 40, 0, 0, ROUT);
  g.addColorStop(0, "#4a4744"); g.addColorStop(0.75, "#2b2928"); g.addColorStop(1, "#151413");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, ROUT, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgb(255 240 220 / .18)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, ROUT - 2, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  g = ctx.createRadialGradient(0, 0, RIN - 4, 0, 0, ROUT - 8);
  g.addColorStop(0, "#1e1d1b"); g.addColorStop(1, "#3a3734");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, ROUT - 8, 0, 7); ctx.fill();
  ctx.fillStyle = "#1f1d1b"; ctx.beginPath(); ctx.arc(0, 0, RIN, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgb(255 240 220 / .07)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, RIN, 0, 7); ctx.stroke();

  if (pan) {
    // Bottom of the pile: black sand and gold. Then the bulk of the sediment as a soft layer whose
    // thickness follows the light material left. Then the loose sand, gravel and stones on top.
    deep.length = 0; top.length = 0;
    for (const p of pan.particles) if (p.alive) (p.kind === "black" || p.kind === "gold" ? deep : top).push(p);
    deep.sort(byDepth); top.sort(byDepth);
    for (const p of deep) if (p.kind === "black") drawParticle(ctx, p, now, false);
    for (const p of deep) if (p.kind === "gold") drawParticle(ctx, p, now, p.exp);
    grid = sedimentGrid(pan, grid);
    const cell = (RIN * 2) / GRID, sz = cell * 1.55, SED = sed();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, RIN, 0, 7); ctx.clip();
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] <= 0) continue;
      ctx.globalAlpha = Math.min(0.9, grid[i] / 2.4);
      const x = -RIN + (i % GRID + 0.5) * cell, y = -RIN + (((i / GRID) | 0) + 0.5) * cell;
      ctx.drawImage(SED, x - sz, y - sz, sz * 2, sz * 2);
    }
    ctx.restore();
    for (const p of top) drawParticle(ctx, p, now, false);
    // Coach: see the gold through the pile
    if (coach) {
      ctx.lineWidth = 1.2;
      for (const p of deep) if (p.kind === "gold" && !p.exp) {
        ctx.strokeStyle = `rgb(246 215 122 / ${0.35 + 0.25 * Math.sin(now * 4 + p.phase)})`;
        ctx.beginPath(); ctx.arc(p.x * RIN, p.y * RIN, p.r + 3, 0, 7); ctx.stroke();
      }
    }
    // Water in the pan, pooling toward the lip as it tilts
    if (pan.W > 0.01) {
      const k = Math.min(1, t * 3);
      const wtop = (-1 + k * (2 - 2 * Math.min(1, pan.W))) * RIN;
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, RIN + 1, 0, 7); ctx.clip();
      ctx.beginPath(); ctx.moveTo(-RIN, RIN + 2);
      for (let x = -RIN; x <= RIN; x += 12) ctx.lineTo(x, wtop + Math.sin(x * 0.05 + now * 3) * 3 * k);
      ctx.lineTo(RIN, RIN + 2); ctx.closePath();
      ctx.fillStyle = `rgb(90 128 120 / ${0.12 + 0.2 * Math.min(1, pan.W) * (1 + k)})`; ctx.fill();
      if (k > 0.1) { ctx.strokeStyle = "rgb(220 240 235 / .25)"; ctx.lineWidth = 1.2; ctx.stroke(); }
      // ripples while shaking
      if (pan.E > 0.1) {
        ctx.strokeStyle = `rgb(220 240 235 / ${0.12 * pan.E})`; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, RIN * (0.3 + i * 0.25) + Math.sin(now * 12 + i) * 4, 0, 7); ctx.stroke(); }
      }
      ctx.restore();
    }
    // Water pouring over the front lip
    if (pan.flow > 0.03) {
      ctx.strokeStyle = `rgb(225 240 236 / ${Math.min(0.55, pan.flow * 0.8)})`; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = Math.PI * (0.3 + i * 0.035) + Math.sin(now * 5 + i) * 0.02, ph = (now * 2.2 + i * 0.37) % 1;
        const r1 = RIN - 6 + ph * 30, r2 = r1 + 14;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke();
      }
    }
  }
  ctx.restore();

  // stones being tossed, gold flying to the vial, floating words
  for (const f of fx.flyers) {
    ctx.save();
    if (f.kind === "stone") {
      ctx.globalAlpha = Math.max(0, 1 - f.t); ctx.translate(f.x, f.y); ctx.rotate(f.spin * f.t);
      particlePath(ctx, f.p, f.p.r); ctx.fillStyle = f.p.col; ctx.fill();
    } else {
      const e = f.t * f.t * (3 - 2 * f.t);
      const x = f.x + (VIAL.x - f.x) * e, y = f.y + (VIAL.y + 40 - f.y) * e - Math.sin(e * Math.PI) * 60;
      ctx.translate(x, y); particlePath(ctx, f.p, f.p.r * 1.2); ctx.fillStyle = "#f0c64a"; ctx.fill();
    }
    ctx.restore();
  }
  drawVial(ctx, fx.displayMg);
  for (const m of fx.floats) {
    ctx.globalAlpha = Math.max(0, 1 - m.t / 1.6);
    ctx.font = "600 15px Spectral, Georgia, serif"; ctx.textAlign = "center";
    ctx.fillStyle = m.col; ctx.fillText(m.text, m.x, m.y - m.t * 28);
    ctx.globalAlpha = 1;
  }
}
