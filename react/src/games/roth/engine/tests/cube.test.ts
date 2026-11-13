// The rules cube (engine/cube.ts): a reduced position must play every board action exactly as the real one does,
// and a position reached twice must be one entry.
import { describe, expect, it } from "vitest";
import { DECKS } from "../cards";
import { actorOf, applyDecision, cloneState, newMatch, nextDecision, type Policy, type State } from "../engine";
import { makePolicy } from "../ai";
import { clearCube, CUBE, cubeable, lineValue, lookup } from "../cube";
import { Rng } from "../rng";

function realDelta(S: State, i: number): number[] {
  const X = cloneState(S);
  const d = nextDecision(X)!;
  const C0 = X.combat!, a = actorOf(C0), o = 1 - a, duel0 = C0.duel;
  const v0 = [C0.valour[a], C0.valour[o]], s0 = [C0.shield[a], C0.shield[o]];
  applyDecision(X, d, i, false);
  let Y = X;
  const d2 = nextDecision(X);
  if (d2 && d2.kind === "block") {
    let bv = Infinity;
    for (let j = 0; j < d2.options.length; j++) {
      const Z = cloneState(X); applyDecision(Z, d2, j, false);
      const Cz = Z.combat!; const same = Cz.duel === duel0 && Cz.stage === "turns";
      const v = same ? Cz.valour[a] - Cz.valour[o] : Cz.endValour[duel0][a] - Cz.endValour[duel0][o];
      if (v < bv) { bv = v; Y = Z; }
    }
  }
  const C1 = Y.combat!;
  const same = C1.duel === duel0 && C1.stage === "turns";
  const v1 = same ? [C1.valour[a], C1.valour[o]] : [C1.endValour[duel0][a], C1.endValour[duel0][o]];
  const sh1 = same ? [C1.shield[a], C1.shield[o]] : s0;
  return [v1[0] - v0[0], v1[1] - v0[1], sh1[0] - s0[0], sh1[1] - s0[1]];
}

describe("the rules cube", () => {
  it("plays every board action of real duels exactly as the rules do", () => {
    clearCube();
    let n = 0;
    for (const [A, B] of [["ulster", "fomoire"], ["sluagh", "sidhe"], ["merrow", "connacht"]]) {
      const S = newMatch([DECKS[A], DECKS[B]], {}, 5);
      const P = [makePolicy("casual"), makePolicy("casual")] as [Policy, Policy];
      const R = [new Rng(1), new Rng(2)];
      for (let g = 0; g < 3000; g++) {
        const d = nextDecision(S);
        if (!d) break;
        if (d.kind === "duel" && S.combat && !S.combat.pending && !S.combat.drawn) {
          const L = lookup(S)!;
          d.options.forEach((o, i) => {
            if (!cubeable(o)) return;
            const x = L.entry.outs.find((y) => y.sig === L.sig(o))!;
            expect(x, `option ${L.sig(o)}`).toBeTruthy();
            expect([x.dSelf, x.dFoe, x.dSelfShield, x.dFoeShield]).toEqual(realDelta(S, i));
            n++;
          });
        }
        applyDecision(S, d, P[d.player].choose(S, d, R[d.player]));
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(CUBE.hits).toBeGreaterThan(0);
  });
  it("chains: a line's value reads entries it fills on the way", () => {
    clearCube();
    const S = newMatch([DECKS.ulster, DECKS.connacht], {}, 3);
    const P = [makePolicy("casual"), makePolicy("casual")] as [Policy, Policy];
    const R = [new Rng(1), new Rng(2)];
    for (let g = 0; g < 3000; g++) {
      const d = nextDecision(S)!;
      if (d.kind === "duel" && S.combat && !S.combat.pending && !S.combat.drawn) break;
      applyDecision(S, d, P[d.player].choose(S, d, R[d.player]));
    }
    const L = lookup(S)!;
    const before = CUBE.map.size;
    const v3 = lineValue(L.key, 3);
    expect(Number.isFinite(v3)).toBe(true);
    expect(CUBE.map.size).toBeGreaterThan(before);
    expect(lineValue(L.key, 1)).toBeGreaterThanOrEqual(Math.max(...L.entry.outs.map((x) => x.dSelf - x.dFoe)) - 21);
  });
});
