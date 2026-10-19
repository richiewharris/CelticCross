// What the board marks and the hint line say about a selected piece or reserve.
import { CENTRE, DROP, LO, SP, SUMMIT, TIER, from, gen, presence, to, type State } from "./engine/rules";
import type { Mark } from "./components/Board";

export function moveMarks(s: State, sel: number | null): Map<number, Mark> {
  const marks = new Map<number, Mark>();
  if (sel === null) return marks;
  for (const m of gen(s)) {
    if (from(m) !== sel) continue;
    const t = to(m);
    marks.set(t, s.b[t] ? "cap" : sel !== DROP && s.b[sel] === LO && t === CENTRE ? "win" : "go");
  }
  return marks;
}

export function selHint(s: State, sel: number) {
  if (sel === DROP) return s.turn === 0 ? "Bring a spearman in on any empty hole of the outer ring." : "Bring the Rider in on any empty hole of the upper slope or summit.";
  const p = s.b[sel];
  if (p === LO && TIER[sel] === 1) return "On the outer ring the Lord is safe from Riders, but not from the Chariot.";
  if (p === SP) return "Spearmen step any way, but climb only straight.";
  if (p >= 3 && !SUMMIT[sel] && !presence(s.b, 0)) return "Sí pieces can also jump back to any empty summit hole.";
  return "Tap a dot to move, a red ring to take. Tap the piece again to let go.";
}
