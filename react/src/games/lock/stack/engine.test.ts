import { describe, expect, it } from "vitest";
import { TIERS, TIER_IDS, WC, minTurns, signedSteps, solved, type TierId } from "../engine/knot";
import { geom, snapPhi } from "../engine/dial";
import { mulberry32 } from "../engine/testkit";
import {
  STACKS, current, dealStack, isLast, layerNeed, layerSolved, needFrom, press, resetStack, stackSkillGain, stackSpare,
  stranded, turnStone, type Stack,
} from "./engine";

/** Turn every stone of the top disc the short way back to its knot (as the Cheat badges say). */
function solveTop(st: Stack): Stack {
  const L = current(st);
  for (let k = 0; k < L.cur.length; k++) {
    let s = signedSteps(current(st).cur[k], L.sol[k]);
    while (s !== 0) { st = turnStone(st, k, s < 0); s = signedSteps(current(st).cur[k], L.sol[k]); }
  }
  return st;
}
/** A stone of the top disc that can turn (not a crossing). */
const turnable = (st: Stack) => current(st).cur.findIndex(m => m !== 15);

describe("the stacks", () => {
  it("have more discs the higher the tier, each a real dial", () => {
    expect(STACKS[1].layers).toHaveLength(2);
    expect(STACKS[2].layers).toHaveLength(2);
    expect(STACKS[3].layers).toHaveLength(3);
    expect(STACKS[4].layers).toHaveLength(3);
    expect(STACKS[5].layers).toHaveLength(4);
    for (const t of TIER_IDS) for (const l of STACKS[t].layers) expect(TIERS[l]).toBeDefined();
  });
  it("never put a smaller disc beneath a bigger one", () => {
    for (const t of TIER_IDS) {
      const ls = STACKS[t].layers;
      for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeGreaterThanOrEqual(ls[i - 1]);
    }
  });
});

describe("dealing a stack", () => {
  for (const t of TIER_IDS) {
    it(`${TIERS[t].name}: every stack is unsolved, and solvable within its purse`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        for (const skill of [0, 20, 60, 100]) {
          const rng = mulberry32(seed * 97 + t * 7 + skill);
          let st = dealStack(t, skill, rng);
          expect(st.layers.map(l => l.tier)).toEqual(STACKS[t].layers);
          expect(st.at).toBe(0);
          expect(st.left).toBe(st.purse);
          const need = needFrom(st);
          expect(st.purse - need).toBeGreaterThanOrEqual(st.layers.length);
          for (const l of st.layers) {
            const T = TIERS[l.tier];
            expect(l.cur).toHaveLength(T.rings * T.sectors);
            expect(solved(l.sol, T.rings, T.sectors)).toBe(true);
            expect(solved(l.cur, T.rings, T.sectors)).toBe(false);
            expect(snapPhi(geom(l.tier), l.phi)).toBeCloseTo(l.phi, 9);
            expect(l.phi).toBeLessThanOrEqual(WC);
          }
          // play every disc out the short way, pressing the center after each
          for (let i = 0; i < st.layers.length; i++) {
            expect(stranded(st)).toBe(false);
            st = solveTop(st);
            expect(layerSolved(current(st))).toBe(true);
            const r = press(st, rng);
            expect(r.kind).toBe(i === st.layers.length - 1 ? "box" : "next");
            st = r.st;
          }
          expect(st.open).toBe(true);
          expect(st.purse - st.left).toBe(need);
          expect(st.left).toBeGreaterThanOrEqual(st.layers.length);
        }
      }
    });
  }
  it("is deterministic for a seeded rng", () => {
    expect(dealStack(4, 30, mulberry32(3))).toEqual(dealStack(4, 30, mulberry32(3)));
  });
  it("spare turns grow with skill, shrink with tier, and never drop below one per disc", () => {
    const lo = () => 0, hi = () => .999;
    expect(stackSpare(20, 1, 2, lo)).toBe(Math.round(2 + 2 + 20 / 14 - .6));
    expect(stackSpare(0, 5, 4, lo)).toBe(4);
    expect(stackSpare(100, 5, 4, hi)).toBe(Math.round(2 + 4 + 100 / 14 - 3 + .999));
    expect(stackSpare(80, 3, 3, lo)).toBeGreaterThan(stackSpare(10, 3, 3, lo));
    for (const t of TIER_IDS) for (const s of [0, 50, 100]) expect(stackSpare(s, t, STACKS[t].layers.length, lo)).toBeGreaterThanOrEqual(STACKS[t].layers.length);
  });
});

describe("turning", () => {
  it("spends one turn from the purse and leaves crossings alone", () => {
    const st = dealStack(3, 20, mulberry32(5));
    const k = turnable(st);
    const a = turnStone(st, k, false);
    expect(a.left).toBe(st.left - 1);
    expect(current(a).cur[k]).not.toBe(current(st).cur[k]);
    expect(current(turnStone(a, k, true)).cur[k]).toBe(current(st).cur[k]);
    // the dealt stack is untouched
    expect(st.left).toBe(st.purse);
    const x = current(st).cur.indexOf(15);
    if (x >= 0) expect(turnStone(st, x, false)).toBe(st);
  });
  it("can't turn with an empty purse", () => {
    const st = { ...dealStack(1, 20, mulberry32(8)), left: 0 };
    expect(turnStone(st, turnable(st), false)).toBe(st);
  });
});

describe("pressing the center", () => {
  it("on a broken knot scrambles that disc again but never refills the purse", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed);
      let st = dealStack(((seed % 5) + 1) as TierId, 30, rng);
      st = turnStone(st, turnable(st), false);
      st = turnStone(st, turnable(st), false);
      for (let i = 0; i < 3; i++) {
        if (layerSolved(current(st))) break;
        const before = st;
        const r = press(st, rng);
        expect(r.kind).toBe("broken");
        expect(r.st.left).toBe(before.left);
        expect(r.st.purse).toBe(before.purse);
        expect(r.st.at).toBe(before.at);
        expect(r.st.broken).toBe(before.broken + 1);
        expect(layerSolved(current(r.st))).toBe(false);
        expect(current(r.st).sol).toEqual(current(before).sol); // the same knot, scrambled anew
        // the discs beneath are untouched
        expect(r.st.layers.slice(1)).toEqual(before.layers.slice(1));
        st = r.st;
      }
    }
  });
  it("on a whole knot opens that disc and brings up the next, keeping the purse", () => {
    const rng = mulberry32(12);
    let st = dealStack(5, 40, rng);
    const needs = st.layers.map(layerNeed);
    st = solveTop(st);
    const left = st.left;
    expect(left).toBe(st.purse - needs[0]);
    const r = press(st, rng);
    expect(r.kind).toBe("next");
    expect(r.st.at).toBe(1);
    expect(r.st.left).toBe(left);
    expect(r.st.open).toBe(false);
    expect(isLast(r.st)).toBe(false);
    expect(minTurns(current(r.st).cur, current(r.st).sol)).toBe(needs[1]);
    st = r.st;
    st = press(solveTop(st), rng).st; expect(st.at).toBe(2);
    st = solveTop(st); expect(isLast(st)).toBe(false);
    st = press(st, rng).st; expect(st.at).toBe(3); expect(isLast(st)).toBe(true);
    const box = press(solveTop(st), rng);
    expect(box.kind).toBe("box");
    expect(box.st.open).toBe(true);
    expect(box.st.at).toBe(3);
    // nothing more happens once the box is open
    expect(press(box.st, rng).st).toBe(box.st);
    expect(turnStone(box.st, turnable(box.st), false)).toBe(box.st);
  });
});

describe("running out", () => {
  it("is stranded only with an empty purse and a broken knot", () => {
    const rng = mulberry32(21);
    const st = dealStack(2, 20, rng);
    expect(stranded(st)).toBe(false);
    expect(stranded({ ...st, left: 0 })).toBe(true);
    // spend exactly what the top disc needs from a one-disc purse: whole knot, not stranded
    const tight = solveTop({ ...st, left: layerNeed(current(st)) });
    expect(tight.left).toBe(0);
    expect(layerSolved(current(tight))).toBe(true);
    expect(stranded(tight)).toBe(false);
    // ...but opening it brings up an unsolved disc with nothing to turn it with
    const next = press(tight, rng);
    expect(next.kind).toBe("next");
    expect(stranded(next.st)).toBe(true);
  });
  it("wasting turns on the top disc can leave too few for the bottom", () => {
    const rng = mulberry32(4);
    let st = dealStack(1, 0, rng);
    const k = turnable(st);
    while (st.left > needFrom(st, 1)) st = turnStone(st, k, false); // spin one stone round and round
    // whatever the top disc still needs is now more than the purse holds for it
    expect(st.left).toBeLessThan(needFrom(st));
    while (!stranded(st) && st.left > 0) st = turnStone(st, k, false);
    expect(st.left).toBe(0);
  });
  it("resets to a fresh stack of the same tier with a fresh purse", () => {
    const rng = mulberry32(33);
    const st = { ...dealStack(4, 20, rng), left: 0, at: 1, broken: 2 };
    const r = resetStack(st, 20, rng);
    expect(r.tier).toBe(4);
    expect(r.at).toBe(0);
    expect(r.broken).toBe(0);
    expect(r.left).toBe(r.purse);
    expect(r.purse).toBeGreaterThanOrEqual(needFrom(r) + r.layers.length);
    expect(r.layers[0].sol).not.toEqual(st.layers[0].sol);
  });
});

describe("skill", () => {
  it("gains more for more discs and more turns left, nothing for a practice stack", () => {
    expect(stackSkillGain(20, 2, 2, 3, false)).toBe(Math.round(3 + 3 + 1.5 - 20 / 30));
    expect(stackSkillGain(20, 2, 2, 3, true)).toBe(0);
    expect(stackSkillGain(20, 5, 4, 3, false)).toBeGreaterThan(stackSkillGain(20, 5, 2, 3, false));
    expect(stackSkillGain(20, 3, 3, 8, false)).toBeGreaterThan(stackSkillGain(20, 3, 3, 0, false));
    expect(stackSkillGain(99, 5, 4, 10, false)).toBe(1);
    expect(stackSkillGain(100, 5, 4, 10, false)).toBe(0);
    expect(stackSkillGain(95, 1, 2, 0, false)).toBe(1);
  });
});
