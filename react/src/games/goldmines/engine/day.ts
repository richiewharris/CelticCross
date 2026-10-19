// The river, its spots, and a day of eight pans.
import { STEEP, collect, exposed, lightLeft, scoop, type Pan, type Particle } from "./pan";
import { rand, type Rng } from "./rng";

export interface SpotDef { id: string; name: string; base: number; stones: number; x: number; y: number; tip: string }
export const SPOTS: SpotDef[] = [
  { id: "A", name: "Bedrock crack", base: 2.4, stones: 2, x: 74, y: 64, tip: "Gold wedges into cracks in the bedrock and stays there." },
  { id: "B", name: "Inside of the bend", base: 1.7, stones: 3, x: 132, y: 128, tip: "Slack water on the inside of a bend drops its gold." },
  { id: "C", name: "Behind the boulder", base: 2.0, stones: 7, x: 210, y: 92, tip: "The eddy behind a big rock traps gold, and plenty of stones." },
  { id: "D", name: "Riffle", base: 0.7, stones: 4, x: 252, y: 150, tip: "Fast, shallow water. Gold rarely gets the chance to settle." },
  { id: "E", name: "Outside of the bend", base: 0.3, stones: 3, x: 166, y: 162, tip: "The current scours the outside bank and carries gold away." },
];
export const PANS_PER_DAY = 8;

export interface SpotState { id: string; remaining: number; lastMg: number | null; pans: number }
export interface Day { pansLeft: number; mg: number; flakes: number; lost: number; spots: SpotState[] }
export type Phase = "choose" | "pan" | "summary" | "dayEnd";

/** A fresh day: every spot's richness is shuffled, and one spot holds a pocket worth 1.8x. */
export function newDay(rng: Rng): Day {
  const pocket = (rng() * SPOTS.length) | 0;
  return {
    pansLeft: PANS_PER_DAY, mg: 0, flakes: 0, lost: 0,
    spots: SPOTS.map((s, i) => ({ id: s.id, remaining: s.base * rand(rng, 0.45, 1.5) * (i === pocket ? 1.8 : 1), lastMg: null, pans: 0 })),
  };
}

export const spotDef = (id: string) => SPOTS.find(s => s.id === id)!;

/** Scoop a pan at a spot, or null when the day has no pans left. */
export function scoopAt(day: Day, id: string, rng: Rng): Pan | null {
  if (day.pansLeft <= 0) return null;
  const st = day.spots.find(s => s.id === id);
  if (!st) return null;
  return scoop(st.remaining, spotDef(id).stones, rng);
}

export interface PanResult {
  total: number; keptFlakes: number; lostFlakes: number; lostMg: number;
  buriedN: number; buriedMg: number; nugget: boolean; advice: string;
  /** gold collected on finishing (it flies to the vial) */
  collected: Particle[];
}

export function adviceFor(pan: Pan, buriedN: number) {
  if (pan.lostFlakes > 0 && pan.lostFlakes >= buriedN) return "Gold went over the lip. Shake longer before washing, and keep the tilt out of the red.";
  if (buriedN > 0) return "Some gold was still under sand. Wash the pan down further before you finish.";
  if (pan.goldTotal === 0) return "This scoop had no gold in it. Try a spot where the water slows.";
  return "A clean pan. Every flake you scooped is in the vial.";
}

/** Finish a pan: visible gold goes in the vial, buried gold is lost, the spot is worked down. */
export function finishPan(day: Day, spotId: string, pan: Pan): { day: Day; result: PanResult } {
  let buriedN = 0, buriedMg = 0;
  const collected: Particle[] = [];
  for (const p of pan.particles) {
    if (!p.alive || p.kind !== "gold") continue;
    if (exposed(pan, p)) collected.push(p);
    else { buriedN++; buriedMg += p.mg; }
  }
  for (const p of collected) collect(pan, p);
  const total = pan.keptMg;
  const next: Day = {
    pansLeft: day.pansLeft - 1, mg: day.mg + total, flakes: day.flakes + pan.keptFlakes, lost: day.lost + pan.lostFlakes,
    spots: day.spots.map(s => (s.id === spotId ? { ...s, remaining: s.remaining * 0.72, pans: s.pans + 1, lastMg: total } : s)),
  };
  const nugget = pan.particles.some(p => p.nugget && !p.alive && p.picked);
  return {
    day: next,
    result: { total, keptFlakes: pan.keptFlakes, lostFlakes: pan.lostFlakes, lostMg: pan.lostMg, buriedN, buriedMg, nugget, advice: adviceFor(pan, buriedN), collected },
  };
}

export interface DayResult { mg: number; flakes: number; lost: number; best: number; isBest: boolean }
export function endDay(day: Day, best: number): DayResult {
  return { mg: day.mg, flakes: day.flakes, lost: day.lost, best: Math.max(best, day.mg), isBest: day.mg > best && day.mg > 0 };
}

export const fmt = (mg: number) => (mg >= 1000 ? `${(mg / 1000).toFixed(2)} g` : `${mg < 10 ? mg.toFixed(1) : Math.round(mg)} mg`);

export interface Status { text: string; kind: "" | "warn" | "good"; step: number }
/** The status line and which "How to pan" step is current. */
export function statusFor(phase: Phase, day: Day, pan: Pan | null): Status {
  if (phase === "choose") {
    return { text: day.pansLeft === PANS_PER_DAY ? "Pick a spot on the river to scoop your first pan." : "Pick a spot for the next pan.", kind: "", step: 0 };
  }
  if (phase === "pan" && pan) {
    const stonesTop = pan.particles.some(p => p.alive && p.kind === "stone" && p.d < 0.3);
    if (pan.tilt > STEEP && pan.W > 0.05) return { text: "Too steep! The gold will wash out with the gravel.", kind: "warn", step: 3 };
    if (pan.W < 0.1) return { text: "The pan's nearly dry. Dip it in the stream.", kind: "", step: 3 };
    if (pan.shakeTime < 2.2) return { text: "Shake the pan side to side under the water.", kind: "", step: 1 };
    if (stonesTop) return { text: "The stones have come up. Tap them, or pick them out.", kind: "", step: 2 };
    if (lightLeft(pan) > 0.12) return { text: "Drag down to tilt and wash the top layer away. Shake again now and then.", kind: "", step: 3 };
    return { text: "You're down to the black sand. Tap the gold to pick it, then finish the pan.", kind: "good", step: 4 };
  }
  if (phase === "summary") return { text: "Pan finished.", kind: "", step: 4 };
  return { text: "The day is done.", kind: "", step: -1 };
}
