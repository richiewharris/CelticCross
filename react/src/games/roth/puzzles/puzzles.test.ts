// Every puzzle's answer is proved: board puzzles by exact search, deck puzzles against the deck rules.
import { describe, expect, it } from "vitest";
import { ALL_DEFS, DECKS, DECK_IDS, deckErrors, defsFromIds, unwillingPair } from "../engine/cards";
import { applyDecision, newMatch, nextDecision } from "../engine/engine";
import { CasualPolicy } from "../engine/ai";
import { Rng } from "../engine/rng";
import { DECK_PUZZLES, PUZZLES, SETS, type BoardPuzzle } from "./data";
import { optionValues, unpackState } from "./position";

const swap = (ids: string[], from: string, to: string) => { const a = ids.slice(); const i = a.indexOf(from); if (i < 0) throw new Error(`no ${from}`); a[i] = to; return a; };
const idOf = (name: string) => Object.values(ALL_DEFS).find((d) => d.name === name)!.id;

describe("board puzzles", () => {
  const boards = PUZZLES.filter((p): p is BoardPuzzle => p.kind === "board");
  it("each set has puzzles at more than one level", () => {
    for (const s of SETS) {
      const ps = PUZZLES.filter((p) => p.set === s.id);
      expect(ps.length).toBeGreaterThanOrEqual(5);
      expect(new Set(ps.map((p) => p.level)).size).toBeGreaterThanOrEqual(2);
    }
  });
  for (const p of boards) {
    it(`${p.id}: the answer is the one best choice, by exact search`, () => {
      const { values } = optionValues(unpackState(p.state));
      const best = Math.max(...values.filter(Number.isFinite));
      expect(values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0)).toEqual(p.answer);
      const second = Math.max(...values.filter((v) => Number.isFinite(v) && v < best));
      expect(best - second).toBeGreaterThanOrEqual(10); // a different result, or another hero felled
    });
  }
});

describe("deck-building puzzles", () => {
  const P = Object.fromEntries(DECK_PUZZLES.map((p) => [p.id, p]));
  it("copies: only the common with one copy can be doubled", () => {
    const ok = P["k-copies"].choices.map((c) => deckErrors(defsFromIds(swap(DECK_IDS.ulster, "salmon", idOf(c)))).length === 0);
    expect(ok.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual(P["k-copies"].answer);
  });
  it("legends: only the rare card keeps the deck to two legendaries", () => {
    const ok = P["k-legends"].choices.map((c) => deckErrors(defsFromIds(swap(DECK_IDS.ulster, "salmon", idOf(c)))).length === 0);
    expect(ok.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual(P["k-legends"].answer);
  });
  it("allegiance: only the primary people (and an exile beside Ulster or Connacht) leads", () => {
    const base = swap(DECK_IDS.connacht, "fergus", "goibniu"); // three Connacht heroes; the Sídhe lend Goibniu's forge
    const ok = P["k-allegiance"].choices.map((c) => deckErrors(defsFromIds(swap(base, "cet_spear", idOf(c)))).length === 0);
    expect(ok.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual(P["k-allegiance"].answer);
  });
  it("old enemies: only the Sídhe support is Unwilling for a Fomóire hero", () => {
    const bad = P["k-unwilling"].choices.map((c) => { const d = ALL_DEFS[idOf(c)]; return d.type === "support" && unwillingPair("Fomoire", d.alignment); });
    expect(bad.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual(P["k-unwilling"].answer);
  });
  it("champions: keeping every card, a two-champion deck holds one after the Muster about 85% of the time", () => {
    const keepAll = new CasualPolicy();
    let have = 0;
    const N = 600;
    for (let s = 1; s <= N; s++) {
      const S = newMatch([DECKS.ulster, DECKS.connacht], {}, s, false);
      const rng = new Rng(s);
      for (;;) { const d = nextDecision(S)!; if (S.phase !== "muster") break; applyDecision(S, d, keepAll.choose(S, d, rng)); }
      if (S.players[0].hand.some((c) => c.def.type === "champion")) have++;
    }
    expect(have / N).toBeGreaterThan(0.8);
    expect(have / N).toBeLessThan(0.9);
    expect(P["k-champions"].answer).toEqual([2]);
  });
});
