// The measurement layer: the per-blow trace adds up, the duel rows match the result, and none of it changes play.
import { describe, expect, it } from "vitest";
import { DECKS } from "../cards";
import { newMatch, playOut, TRACE } from "../engine";
import { DECISIONS, makePolicy } from "../ai";
import { Rng } from "../rng";

function play(a: string, b: string, on: boolean) {
  TRACE.on = on; DECISIONS.on = on; DECISIONS.log = [];
  try {
    const S = newMatch([DECKS[a], DECKS[b]], {}, 11);
    const r = playOut(S, [makePolicy("skilled"), makePolicy("skilled")], [new Rng(1), new Rng(2)], false);
    return { S, r, decisions: DECISIONS.log };
  } finally { TRACE.on = false; DECISIONS.on = false; }
}

describe("the measurement layer", () => {
  it("traces every blow step by step, and the steps add up to the wounds", () => {
    const { S } = play("ulster", "fomoire", true);
    const blows = S.stats!.blows!;
    expect(blows.length).toBeGreaterThan(5);
    for (const b of blows) {
      const up = b.printed + b.base + b.kin + b.focus + b.watch + b.wheel + b.weak + b.fx + b.setting + b.extra + b.atk + b.floor + b.cap;
      expect(up - b.ward - b.block - b.resist - b.armour - b.mound - b.shield - b.halved - b.aura + b.stagger).toBe(b.final);
    }
    expect(blows.some((b) => b.halved > 0)).toBe(true); // the Fomóire are giant-kin
  });
  it("records each duel, and the felled heroes agree with the result", () => {
    const { S, r } = play("sluagh", "sidhe", true);
    const d = S.stats!.duels!;
    for (const p of [0, 1]) expect(d.reduce((s, x) => s + x.felled[p], 0)).toBe(r.felled[p]);
  });
  it("logs the computer's decisions without changing a single move", () => {
    const on = play("connacht", "merrow", true), off = play("connacht", "merrow", false);
    expect(on.decisions.length).toBeGreaterThan(10);
    expect(on.decisions.every((x) => x.best >= x.second)).toBe(true);
    expect(JSON.stringify(on.S.stats!.ledger)).toBe(JSON.stringify(off.S.stats!.ledger));
    expect(on.r).toEqual(off.r);
  });
});
