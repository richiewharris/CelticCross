// Every AI makes only legal moves (strict legality check on every applied option), plus solver/determinization checks.
import { describe, expect, it } from "vitest";
import { CONNACHT, ULSTER } from "../cards";
import { applyDecision, newMatch, nextDecision, observe, playOut, type Policy, type Rules } from "../engine";
import { CasualPolicy, determinize, ExpertPolicy, makePolicy, NovicePolicy, SkilledPolicy } from "../ai";
import { solveChoice } from "../solver";
import { Rng } from "../rng";
import { combatState } from "./helpers";

function many(a: () => Policy, b: () => Policy, n: number, rules: Partial<Rules> = {}) {
  let done = 0;
  for (let i = 0; i < n; i++) {
    const decks: [typeof ULSTER, typeof ULSTER] = i % 3 === 0 ? [ULSTER, CONNACHT] : i % 3 === 1 ? [CONNACHT, ULSTER] : [ULSTER, ULSTER];
    const S = newMatch(decks, rules, 1000 + i);
    const r = playOut(S, [a(), b()], [new Rng(i * 2 + 1), new Rng(i * 2 + 2)], true); // check = true: throws on any illegal move
    expect([-1, 0, 1]).toContain(r.winner);
    done++;
  }
  return done;
}

describe("AIs make only legal moves", () => {
  it("Novice vs Novice, 400 matches (incl. levers)", () => {
    expect(many(() => new NovicePolicy(), () => new NovicePolicy(), 200)).toBe(200);
    expect(many(() => new NovicePolicy(), () => new NovicePolicy(), 100, { blindHeroes: true, keepOmensUntilCombat: true, omenSpots: 3 })).toBe(100);
    expect(many(() => new NovicePolicy(), () => new NovicePolicy(), 100, { valourBonus: 1, geisBreakCost: 1, initTie: "random" })).toBe(100);
  });
  it("Casual vs Novice / Casual, 300 matches", () => {
    expect(many(() => new CasualPolicy(), () => new NovicePolicy(), 150)).toBe(150);
    expect(many(() => new NovicePolicy(), () => new CasualPolicy(), 75, { keepOmensUntilCombat: true })).toBe(75);
    expect(many(() => new CasualPolicy(), () => new CasualPolicy(), 75)).toBe(75);
  });
  it("Skilled vs Casual / Novice / Skilled, 60 matches (incl. levers)", () => {
    expect(many(() => new SkilledPolicy(), () => new CasualPolicy(), 20)).toBe(20);
    expect(many(() => new NovicePolicy(), () => new SkilledPolicy(), 20, { blindHeroes: true, keepOmensUntilCombat: true })).toBe(20);
    expect(many(() => new SkilledPolicy(true), () => new SkilledPolicy(), 20, { omenSpots: 3, geisBreakCost: 3 })).toBe(20);
  });
  it("Expert (small N) vs Novice and Skilled, 4 matches", () => {
    expect(many(() => new ExpertPolicy(3, 2), () => new NovicePolicy(), 2)).toBe(2);
    expect(many(() => new SkilledPolicy(), () => new ExpertPolicy(3, 2), 2, { blindHeroes: true, keepOmensUntilCombat: true })).toBe(2);
  });
  it("makePolicy knows the four levels", () => {
    expect(["novice", "casual", "skilled", "expert"].map((l) => makePolicy(l).name)).toEqual(["Novice", "Casual", "Skilled", "Expert"]);
  });
});

describe("Skilled duel solver", () => {
  it("finds the felling Strike (Gáe Bolga for Cú Chulainn) over a Shield", () => {
    // Cú (4) first: Gáe Bolga 4 + 1 kinship + 1 Ríastrad = 6 fells Conchobar (5) now; Láeg instead lets Conchobar's
    // warp-spasm (4 + 1) wound Cú before he finishes, so felling at once is strictly better.
    const S = combatState({ board: ["cu", "laeg", "gae_bolga", "emer", "salmon", "salmon", "conchobar", "warp", "salmon", "conall", "salmon", "salmon"] });
    const d = nextDecision(S)!;
    const r = solveChoice(S, S.combat!, 0, true);
    expect(d.options[r.best]).toMatchObject({ act: "use", spot: 2 });
  });
  it("does not break a geis when breaking would fell its own hero", () => {
    const S = combatState({ board: ["fergus", "caladbolg", "salmon", "emer", "salmon", "salmon", "emer", "cet_spear", "salmon", "conall", "salmon", "salmon"], geasa: ["g_spear", null, null, null] });
    S.combat!.valour[0] = 2; // breaking (−2) would fell Fergus before Caladbolg resolves
    const d = nextDecision(S)!;
    expect(d.player).toBe(0);
    const i = new SkilledPolicy().choose(observe(S, 0), d, new Rng(1));
    expect(d.options[i]).not.toMatchObject({ mode: "break" });
  });
});

describe("determinization", () => {
  it("fills the opponent's hidden hand and omens consistently with what has been seen", () => {
    const S = newMatch([ULSTER, CONNACHT], {}, 21);
    const nov = new NovicePolicy();
    const rng = new Rng(3);
    for (;;) { const d = nextDecision(S)!; if (S.phase === "play") break; playOutStep(S, d, nov, rng); }
    const V = observe(S, 0);
    expect(V.players[1].hand.every((c) => c.def.type === "unknown")).toBe(true);
    for (let k = 0; k < 20; k++) {
      const D = determinize(V, 0, new Rng(k));
      const O = D.players[1];
      expect(O.hand.length).toBe(S.players[1].hand.length);
      expect(O.hand.some((c) => c.def.type === "omen" || c.def.type === "unknown")).toBe(false);
      expect(O.omens.length).toBe(S.players[1].omens.length);
      expect(O.omens.every((o) => o.card.def.type === "omen")).toBe(true);
      // never more copies than the deck list holds, counting the visible board
      const all = [...O.hand, ...O.reserve, ...O.omens.map((o) => o.card), ...D.board.filter((c) => c && c.owner === 1)];
      const cnt: Record<string, number> = {};
      for (const c of all) cnt[c!.def.id] = (cnt[c!.def.id] ?? 0) + 1;
      const lim: Record<string, number> = {};
      for (const d of CONNACHT) lim[d.id] = (lim[d.id] ?? 0) + 1;
      for (const [id, n] of Object.entries(cnt)) expect(n).toBeLessThanOrEqual(lim[id]);
      expect(all.length).toBe(24);
      expect(D.players[0].hand).toEqual(S.players[0].hand); // own cards untouched
    }
  });
});

function playOutStep(S: ReturnType<typeof newMatch>, d: NonNullable<ReturnType<typeof nextDecision>>, p: Policy, rng: Rng) {
  applyDecision(S, d, p.choose(observe(S, d.player), d, rng));
}
