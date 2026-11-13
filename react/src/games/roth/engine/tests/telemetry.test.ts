// A match record (useMatch.ts sendRecord: the seed, both decks by id, every choice by index) replays to the same
// match (sim/roth/telemetry.ts), with the match statistics on or off.
import { describe, expect, it } from "vitest";
import { ALL_DEFS, DECKS, type CardDef } from "../cards";
import { applyDecision, newMatch, nextDecision, type Policy } from "../engine";
import { makePolicy } from "../ai";
import { Rng } from "../rng";

describe("match records", () => {
  it("replay to the same result", () => {
    for (const [a, b] of [["ulster", "sluagh"], ["merrow", "fomoire"]] as const) {
      const ids = [DECKS[a].map((c) => c.id), DECKS[b].map((c) => c.id)];
      const S = newMatch([DECKS[a], DECKS[b]], {}, 4242, false);
      const P = [makePolicy("casual"), makePolicy("casual")] as [Policy, Policy];
      const R = [new Rng(5), new Rng(6)];
      const moves: number[] = [];
      for (let d = nextDecision(S); d; d = nextDecision(S)) { const i = P[d.player].choose(S, d, R[d.player]); moves.push(i); applyDecision(S, d, i); }
      const T = newMatch([ids[0].map((id) => ALL_DEFS[id] as CardDef), ids[1].map((id) => ALL_DEFS[id] as CardDef)], {}, 4242, true);
      for (const i of moves) { const d = nextDecision(T)!; applyDecision(T, d, i, false); }
      expect(nextDecision(T)).toBeNull();
      expect(T.result).toEqual(S.result);
    }
  });
});
