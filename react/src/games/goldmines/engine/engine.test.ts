import { describe, expect, it } from "vitest";
import { seeded, poisson } from "./rng";
import {
  RIN, coverOver, dip, exposed, goldSettled, lightLeft, makeParticle, scoop, sedimentGrid, step, stonesUp, GRID, type Pan,
} from "./pan";
import { PANS_PER_DAY, SPOTS, adviceFor, endDay, finishPan, fmt, newDay, scoopAt, statusFor } from "./day";
import { CX, CY, aim, drive, idleHands, tapAt, toScreen } from "./control";

const alive = (pan: Pan, kind: string) => pan.particles.filter(p => p.alive && p.kind === kind);

/** Shake hard under water for `secs` seconds at a given frame rate, the way the hold button does. */
function shake(pan: Pan, secs: number, rng = seeded(9), fps = 60) {
  const h = { ...idleHands(), holdShake: true };
  for (let t = 0; t < secs; t += 1 / fps) {
    if (pan.W < 0.5) dip(pan, rng);
    drive(pan, aim(h, t * 1000, false), 1 / fps, rng);
  }
}
/** Hold the pan at a tilt for `secs`, dipping whenever it runs dry. */
function wash(pan: Pan, tilt: number, secs: number, rng = seeded(10), fps = 60) {
  let lost = 0;
  for (let t = 0; t < secs; t += 1 / fps) {
    if (pan.W < 0.15) { dip(pan, rng); pan.tilt = 0; }
    lost += drive(pan, { ox: 0, tilt }, 1 / fps, rng).length;
  }
  return lost;
}
function tossStones(pan: Pan) { for (const p of stonesUp(pan)) p.alive = false; }

describe("rng", () => {
  it("is repeatable from a seed and stays in [0, 1)", () => {
    const a = seeded(42), b = seeded(42);
    for (let i = 0; i < 1000; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it("poisson has about the right mean", () => {
    const r = seeded(3); let s = 0;
    for (let i = 0; i < 4000; i++) s += poisson(r, 4.5);
    expect(s / 4000).toBeGreaterThan(4.2); expect(s / 4000).toBeLessThan(4.8);
  });
});

describe("scoop", () => {
  it("fills the pan with the original's mix", () => {
    const pan = scoop(2, 3, seeded(1));
    expect(alive(pan, "gravel")).toHaveLength(95);
    expect(alive(pan, "sand")).toHaveLength(420);
    expect(alive(pan, "black")).toHaveLength(120);
    expect(alive(pan, "stone").length).toBeGreaterThanOrEqual(3);
    expect(pan.startLight).toBe(515);
    expect(pan.W).toBe(0.6);
    expect(pan.goldTotal).toBeCloseTo(alive(pan, "gold").reduce((a, p) => a + p.mg, 0));
    for (const p of pan.particles) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(p.d).toBeGreaterThanOrEqual(0); expect(p.d).toBeLessThan(1);
    }
  });
  it("is deterministic for a seed", () => {
    const a = scoop(1.7, 3, seeded(77)), b = scoop(1.7, 3, seeded(77));
    expect(a.particles.map(p => [p.kind, p.x, p.d, p.col])).toEqual(b.particles.map(p => [p.kind, p.x, p.d, p.col]));
  });
  it("richer spots give more gold on average, and an empty spot gives none", () => {
    const r = seeded(5); let rich = 0, poor = 0;
    for (let i = 0; i < 200; i++) { rich += scoop(3, 2, r).goldTotal; poor += scoop(0.3, 2, r).goldTotal; }
    expect(rich).toBeGreaterThan(poor * 3);
    expect(scoop(0, 2, r).goldTotal).toBe(0);
  });
  it("flakes weigh 0.6 to ~13.5 mg and nuggets 90 to 650 mg", () => {
    const r = seeded(11);
    for (let i = 0; i < 300; i++) {
      const g = makeParticle("gold", r, { mg: Math.max(0.6, Math.exp(r() * 2.6)) });
      expect(g.mg).toBeGreaterThanOrEqual(0.6); expect(g.mg).toBeLessThan(13.6);
    }
    let found = 0;
    for (let i = 0; i < 2000 && !found; i++) for (const p of scoop(3, 2, r).particles) if (p.nugget) { found++; expect(p.mg).toBeGreaterThanOrEqual(90); expect(p.mg).toBeLessThanOrEqual(650); }
    expect(found).toBe(1);
  });
});

describe("physics", () => {
  it("shaking sinks the gold and brings the stones up", () => {
    const pan = scoop(2.4, 5, seeded(2));
    shake(pan, 6);
    expect(goldSettled(pan)).toBe(1);
    expect(stonesUp(pan).length).toBe(alive(pan, "stone").length);
    expect(pan.shakeTime).toBeGreaterThan(2.2);
    for (const p of pan.particles) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.93 + 1e-9);
  });
  it("shaking uses a little water; nothing moves when the pan is still", () => {
    const pan = scoop(1, 2, seeded(2));
    const before = pan.particles.map(p => [p.x, p.y, p.d]);
    for (let i = 0; i < 60; i++) step(pan, 1 / 60, seeded(1));
    expect(pan.particles.map(p => [p.x, p.y, p.d])).toEqual(before);
    shake(pan, 1);
    expect(pan.W).toBeLessThan(1);
  });
  it("a gentle wash after shaking takes the light stuff and keeps the gold", () => {
    const pan = scoop(2.4, 2, seeded(4));
    const gold = alive(pan, "gold").length;
    shake(pan, 6); tossStones(pan);
    const lost = wash(pan, 0.55, 40);
    expect(lightLeft(pan)).toBeLessThan(0.3);
    expect(lost).toBeLessThanOrEqual(Math.ceil(gold * 0.15));
  });
  it("washing steep straight after scooping loses gold over the lip", () => {
    let lostSteep = 0, lostGentle = 0;
    for (let s = 0; s < 6; s++) {
      const a = scoop(2.4, 2, seeded(100 + s)); lostSteep += wash(a, 1, 30);
      const b = scoop(2.4, 2, seeded(100 + s)); shake(b, 6); tossStones(b); lostGentle += wash(b, 0.55, 30);
    }
    expect(lostSteep).toBeGreaterThan(lostGentle * 2 + 3);
  });
  it("a dry pan does not wash", () => {
    const pan = scoop(1, 2, seeded(8)); pan.W = 0; pan.tilt = 0.9;
    const n = pan.particles.filter(p => p.alive).length;
    for (let i = 0; i < 120; i++) step(pan, 1 / 60, seeded(1));
    expect(pan.particles.filter(p => p.alive).length).toBe(n);
    expect(pan.flow).toBe(0);
  });
  it("only the front lip spills; the back of the pan holds", () => {
    const pan = scoop(1, 2, seeded(8)); pan.W = 1; pan.tilt = 1;
    for (let i = 0; i < 600; i++) { pan.W = 1; for (const p of step(pan, 1 / 60, seeded(i))) expect(p.y).toBeGreaterThan(0.2); }
    for (const p of pan.particles) if (!p.alive) expect(p.y).toBeGreaterThan(0.2);
    expect(pan.lostFlakes).toBe(pan.particles.filter(p => p.kind === "gold" && !p.alive).length);
  });
  it("dip refills the water", () => {
    const pan = scoop(1, 2, seeded(8)); pan.W = 0.1; dip(pan, seeded(1)); expect(pan.W).toBe(1);
  });
  it("is frame-rate independent", () => {
    const run = (fps: number) => {
      const pan = scoop(2, 2, seeded(21));
      shake(pan, 5, seeded(1), fps); tossStones(pan); wash(pan, 0.5, 15, seeded(2), fps);
      return { light: lightLeft(pan), W: pan.W, E: pan.E };
    };
    const a = run(30), b = run(144);
    expect(Math.abs(a.light - b.light)).toBeLessThan(0.08);
  });
});

describe("cover and exposure", () => {
  it("gold under a heap of sand is hidden; gold on bare floor is exposed", () => {
    const r = seeded(1);
    const g = makeParticle("gold", r, { mg: 5 }); g.x = 0; g.y = 0; g.d = 0.95;
    const pan: Pan = { ...scoop(0, 0, r), particles: [g] };
    expect(exposed(pan, g)).toBe(true);
    const s = makeParticle("sand", r); s.x = 0; s.y = 0; s.d = 0.5; pan.particles.push(s);
    expect(coverOver(pan, g)).toBeCloseTo(1); expect(exposed(pan, g)).toBe(true);
    const s2 = makeParticle("sand", r); s2.x = 2 / RIN; s2.y = 0; s2.d = 0.5; pan.particles.push(s2);
    expect(exposed(pan, g)).toBe(false);
    s2.d = 0.99; // below the gold: does not cover it
    expect(exposed(pan, g)).toBe(true);
  });
  it("the sediment grid weighs sand 1 and gravel 2.5 and leaves out stones and gold", () => {
    const pan = scoop(1, 3, seeded(3));
    const gr = sedimentGrid(pan);
    expect(gr.length).toBe(GRID * GRID);
    expect(gr.reduce((a, b) => a + b, 0)).toBeCloseTo(420 + 95 * 2.5, 2);
  });
});

describe("the day", () => {
  it("starts with eight pans and one pocket spot", () => {
    const d = newDay(seeded(5));
    expect(d.pansLeft).toBe(PANS_PER_DAY);
    expect(d.spots.map(s => s.id)).toEqual(SPOTS.map(s => s.id));
    const ratios = d.spots.map((s, i) => s.remaining / SPOTS[i].base);
    for (const x of ratios) { expect(x).toBeGreaterThanOrEqual(0.45); expect(x).toBeLessThan(1.5 * 1.8); }
    // Only a pocket can be richer than 1.5x its base, and over many days every spot gets one.
    const r = seeded(9), pockets = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const rich = newDay(r).spots.filter((s, k) => s.remaining / SPOTS[k].base >= 1.5);
      expect(rich.length).toBeLessThanOrEqual(1);
      for (const s of rich) pockets.add(s.id);
    }
    expect(pockets.size).toBe(SPOTS.length);
  });
  it("finishing collects the visible gold, counts the buried and works the spot down", () => {
    const d = newDay(seeded(5)), pan = scoopAt(d, "A", seeded(6))!;
    const gold = alive(pan, "gold");
    expect(gold.length).toBeGreaterThan(0);
    // Make half the gold bare (no sediment) and leave the rest buried under the pile.
    for (const p of pan.particles) if (p.kind === "sand" || p.kind === "gravel" || p.kind === "stone") p.d = 0;
    const bare = gold.filter((_, i) => i % 2 === 0);
    for (const p of pan.particles) if ((p.kind === "sand" || p.kind === "gravel" || p.kind === "stone") && p.x > 0) p.alive = false;
    for (const g of gold) { g.d = 1; g.x = bare.includes(g) ? 0.5 : -0.5; g.y = 0; }
    const { day, result } = finishPan(d, "A", pan);
    expect(result.keptFlakes).toBe(bare.length);
    expect(result.buriedN).toBe(gold.length - bare.length);
    expect(result.total).toBeCloseTo(bare.reduce((a, p) => a + p.mg, 0));
    expect(result.collected).toHaveLength(bare.length);
    expect(day.pansLeft).toBe(7); expect(day.mg).toBeCloseTo(result.total);
    const a = day.spots.find(s => s.id === "A")!;
    expect(a.pans).toBe(1); expect(a.lastMg).toBeCloseTo(result.total);
    expect(a.remaining).toBeCloseTo(d.spots[0].remaining * 0.72);
    expect(d.pansLeft).toBe(8); // the old day is untouched
    expect(result.advice).toMatch(/still under sand/);
  });
  it("no pans left, no scoop", () => {
    const d = { ...newDay(seeded(1)), pansLeft: 0 };
    expect(scoopAt(d, "A", seeded(1))).toBeNull();
  });
  it("advice follows the original's order", () => {
    const pan = scoop(0, 2, seeded(1));
    expect(adviceFor(pan, 0)).toMatch(/no gold/);
    pan.goldTotal = 5; expect(adviceFor(pan, 0)).toMatch(/clean pan/);
    pan.lostFlakes = 2; expect(adviceFor(pan, 2)).toMatch(/over the lip/);
    expect(adviceFor(pan, 3)).toMatch(/under sand/);
  });
  it("tracks the best day", () => {
    const d = { ...newDay(seeded(1)), mg: 40 };
    expect(endDay(d, 20)).toMatchObject({ best: 40, isBest: true });
    expect(endDay(d, 60)).toMatchObject({ best: 60, isBest: false });
    expect(endDay({ ...d, mg: 0 }, 0).isBest).toBe(false);
  });
  it("formats weights like the original", () => {
    expect(fmt(0)).toBe("0.0 mg"); expect(fmt(9.94)).toBe("9.9 mg"); expect(fmt(10.4)).toBe("10 mg");
    expect(fmt(999)).toBe("999 mg"); expect(fmt(1234)).toBe("1.23 g");
  });
  it("status walks through the steps", () => {
    const d = newDay(seeded(1));
    expect(statusFor("choose", d, null)).toMatchObject({ step: 0, text: expect.stringMatching(/first pan/) });
    expect(statusFor("choose", { ...d, pansLeft: 3 }, null).text).toMatch(/next pan/);
    const pan = scoop(1, 3, seeded(2)); pan.W = 1;
    expect(statusFor("pan", d, pan)).toMatchObject({ step: 1 });
    pan.shakeTime = 3; for (const p of pan.particles) if (p.kind === "stone") p.d = 0.1;
    expect(statusFor("pan", d, pan)).toMatchObject({ step: 2 });
    tossStones(pan);
    expect(statusFor("pan", d, pan)).toMatchObject({ step: 3, kind: "" });
    pan.tilt = 0.8; expect(statusFor("pan", d, pan)).toMatchObject({ step: 3, kind: "warn" });
    pan.tilt = 0; pan.W = 0.05; expect(statusFor("pan", d, pan).text).toMatch(/nearly dry/);
    pan.W = 1; for (const p of pan.particles) if (p.kind === "sand" || p.kind === "gravel") p.alive = false;
    expect(statusFor("pan", d, pan)).toMatchObject({ step: 4, kind: "good" });
    expect(statusFor("summary", d, null).step).toBe(4);
    expect(statusFor("dayEnd", d, null).step).toBe(-1);
  });
});

describe("hands and taps", () => {
  it("drag sideways shakes, drag down tilts, both clamped", () => {
    const h = { ...idleHands(), dragging: true, sx: 300, sy: 300, x: 500, y: 600 };
    expect(aim(h, 0, false)).toEqual({ ox: 75, tilt: 1 });
    h.x = 280; h.y = 385; expect(aim(h, 0, false)).toEqual({ ox: -18, tilt: 0.5 });
    expect(aim(h, 0, true)).toEqual({ ox: 0, tilt: 0 });
  });
  it("keys and hold buttons", () => {
    const h = { ...idleHands(), keyOx: 46, keyOxT: 1000 };
    expect(aim(h, 1100, false).ox).toBe(46);
    expect(aim(h, 1200, false).ox).toBe(0);
    expect(aim({ ...idleHands(), keyTilt: 0.92 }, 0, false).tilt).toBe(0.92);
    expect(aim({ ...idleHands(), holdWash: true }, 0, false).tilt).toBe(0.55);
    expect(Math.abs(aim({ ...idleHands(), holdShake: true }, 100, false).ox)).toBeGreaterThan(40);
  });
  it("taps find top stones, deep stones, bare and buried gold", () => {
    const r = seeded(4);
    const st = makeParticle("stone", r); st.x = 0; st.y = 0; st.d = 0.1;
    const g = makeParticle("gold", r, { mg: 3, r: 3 }); g.x = 0.5; g.y = 0; g.d = 1;
    const pan: Pan = { ...scoop(0, 0, r), particles: [st, g] };
    expect(toScreen(pan, st)).toEqual([CX, CY]);
    expect(tapAt(pan, CX + 3, CY)).toEqual({ kind: "toss", p: st });
    st.d = 0.5; expect(tapAt(pan, CX, CY)).toEqual({ kind: "stoneDeep" });
    expect(tapAt(pan, CX + 0.5 * RIN + 5, CY)).toEqual({ kind: "gold", p: g });
    const s = makeParticle("sand", r); s.x = 0.5; s.y = 0; s.d = 0.5; pan.particles.push(s, { ...s }, { ...s });
    expect(tapAt(pan, CX + 0.5 * RIN, CY)).toEqual({ kind: "buried" });
    expect(tapAt(pan, 20, 20)).toBeNull();
  });
});

describe("a whole pan, played well and played badly", () => {
  it("good technique keeps nearly all the gold; finishing early leaves it buried", () => {
    let kept = 0, scooped = 0, buriedEarly = 0;
    for (let s = 0; s < 5; s++) {
      const d = newDay(seeded(s)), pan = scoopAt(d, "A", seeded(50 + s))!;
      scooped += pan.goldTotal;
      shake(pan, 6); tossStones(pan); wash(pan, 0.55, 40); shake(pan, 2); wash(pan, 0.55, 40);
      kept += finishPan(d, "A", pan).result.total;
      const lazy = scoopAt(d, "A", seeded(50 + s))!;
      buriedEarly += finishPan(d, "A", lazy).result.buriedN;
    }
    expect(kept).toBeGreaterThan(scooped * 0.6);
    expect(buriedEarly).toBeGreaterThan(5);
  });
});
