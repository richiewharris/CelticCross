// Charm, the veiled Aos Sídhe, and the Slúagh hosts' sacrifice and summon.
import { describe, expect, it } from "vitest";
import { ALL_DEFS, composeHost, type HostDef, type MonsterDef } from "../cards";
import { applyDecision, asHybrid, fighter, hostActs, nextDecision, type Side, type State } from "../engine";
import { card, combatState } from "./helpers";

const host = (h: string, ...ms: string[]) => composeHost(ALL_DEFS[h] as HostDef, ms.map((m) => ALL_DEFS[m] as MonsterDef));
/** Put a joined host on spot `spot` for side `owner`. */
function withHost(S: State, spot: number, owner: Side, h: string, ...ms: string[]) {
  S.board[spot] = { uid: 90000 + spot, def: host(h, ...ms), owner };
  return S;
}
const pick = (S: State, pred: (o: { t: string; id?: string; act?: string; spot?: number }) => boolean) => {
  const d = nextDecision(S)!;
  const i = d.options.findIndex((o) => pred(o as never));
  expect(i).toBeGreaterThanOrEqual(0);
  applyDecision(S, d, i);
};

describe("Charm", () => {
  it("goes through Shield, takes the enemy's Shield, and dulls its next Strike", () => {
    // Lugh (P1, Initiative 6, strikes first) charms Ferdiad, who has Shield 2
    const S = combatState({ board: ["lugh", "glamour", "salmon", "emer", "salmon", "salmon", "ferdiad", "cet_spear", "cet_spear", "conall", "salmon", "salmon"], rules: { veiled: false } });
    const C = S.combat!;
    C.shield[1] = 2;
    pick(S, (o) => o.t === "duel" && o.act === "use" && o.spot === 1);
    expect(C.shield).toEqual([1, 1]); // 1 of Ferdiad's Shield is now Lugh's
    expect(C.nextStrike[1]).toBe(0);
    // Glamour: Strike 1 + Lugh's Focus (every support) + kinship = 3, through Shield: Ferdiad 5 → 2
    expect(C.valour[1]).toBe(2);
  });
});

describe("the veiled Aos Sídhe", () => {
  it("the first Strike against an Aos Sídhe fighter each duel is 1 less", () => {
    const board = ["emer", "thunder", "salmon", "conall", "salmon", "salmon", "dagda", "salmon", "salmon", "fergus", "salmon", "salmon"];
    const plain = combatState({ board, rules: { veiled: false, initTie: "p1" } });
    const veiled = combatState({ board, rules: { veiled: true, initTie: "p1" } });
    for (const S of [plain, veiled]) pick(S, (o) => o.t === "duel" && o.act === "use" && o.spot === 1);
    expect(veiled.combat!.valour[1] - plain.combat!.valour[1]).toBe(1);
  });
});

describe("Slúagh hosts in combat", () => {
  const board = ["conall", "salmon", "salmon", "emer", "salmon", "salmon", null, "salmon", "salmon", null, "salmon", "salmon"];
  const mk = () => {
    const S = combatState({ board: board.map((x) => x ?? "emer"), rules: { initTie: "p2", veiled: false } });
    withHost(S, 6, 1, "hunt", "dullahan", "puca", "marbh");
    withHost(S, 9, 1, "prey", "bean_nighe", "fear_dearg");
    // restart the combat so the hosts are in it
    S.combat = null; S.phase = "combat";
    return S;
  };
  it("a host fights with its monsters' Valour added up, and only shared weaknesses", () => {
    const h = host("hunt", "dullahan", "puca", "marbh");
    expect(h.valour).toBe((ALL_DEFS.dullahan as MonsterDef).valour + (ALL_DEFS.puca as MonsterDef).valour + (ALL_DEFS.marbh as MonsterDef).valour - 3); // a ragged host: one less a monster
    expect(h.weaknesses).toEqual(["Fire"]); // the Hunt's own; the Marbh shares it; Dullahan's Water and Púca's Earth stand alone
    expect(host("prey", "puca", "fear_dearg", "dullahan").weaknesses).toEqual(["Earth"]); // Earth thrice; Water once
    expect(host("taboo", "puca", "fear_dearg").weaknesses).toEqual(["Water", "Earth"]); // two Earth monsters share it
    expect(h.ab.strikeAll).toBe(1); // the Dullahan
    expect(h.ab.firstStrike).toBe(2); // the Hunt +1, the Púca +1
    expect(h.hybrids).toEqual(["Fire"]); // the Dullahan's
  });
  it("sacrifice: the monster leaves with its weakness, and its Valour comes back (up to the cap)", async () => {
    const { newCombat } = await import("../engine");
    const S = mk();
    S.combat = newCombat(S);
    const C = S.combat;
    C.valour[1] -= 4; // wounded
    C.first = 1; C.turn = 0; // the host acts
    const before = C.valour[1];
    const acts = hostActs(S, C, 1);
    expect(acts.some((o) => o.t === "sacrifice" && o.id === "puca")).toBe(true);
    pick(S, (o) => o.t === "sacrifice" && o.id === "puca");
    const h = fighter(S, C, 1);
    expect(h.type === "hero" && h.host!.members.map((m) => m.id)).toEqual(["dullahan", "marbh"]);
    expect(h.type === "hero" && h.weaknesses).toEqual(["Fire"]);
    expect(C.valour[1]).toBe(before + (ALL_DEFS.puca as MonsterDef).valour);
    expect(hostActs(S, C, 1).some((o) => o.t === "sacrifice")).toBe(false); // once a duel
  });
  it("summon spends the top card of the Reserve where it costs (a duel to the death), and needs one", async () => {
    const { newCombat } = await import("../engine");
    const S = mk();
    S.rules = { ...S.rules, summonCost: true };
    S.combat = newCombat(S);
    const C = S.combat;
    C.first = 1; C.turn = 0;
    const P = S.players[1];
    P.reserve = [card("cold_touch", 1), card("grave_dirt", 1)];
    const top = P.reserve[0], n0 = P.reserve.length, d0 = P.discard.length;
    expect(top).toBeTruthy();
    pick(S, (o) => o.t === "summon" && o.id === "fear_dearg");
    expect(P.reserve.length).toBe(n0 - 1);
    expect(P.discard.length).toBe(d0 + 1);
    expect(P.discard[P.discard.length - 1]).toBe(top);
    // with nothing left to spend, no summon is offered
    const S2 = mk();
    S2.rules = { ...S2.rules, summonCost: true };
    S2.combat = newCombat(S2);
    S2.players[1].reserve = []; S2.players[1].discard = [];
    expect(hostActs(S2, S2.combat, 1).some((o) => o.t === "summon")).toBe(false);
  });
  it("summon: a monster comes from the other host, once a match", async () => {
    const { newCombat } = await import("../engine");
    const S = mk();
    S.combat = newCombat(S);
    const C = S.combat;
    C.first = 1; C.turn = 0;
    const v0 = C.valour[1], cap0 = C.cap[1];
    pick(S, (o) => o.t === "summon" && o.id === "fear_dearg");
    const h = fighter(S, C, 1);
    expect(h.type === "hero" && h.host!.members.map((m) => m.id)).toContain("fear_dearg");
    const bonus = (ALL_DEFS.fear_dearg as MonsterDef).valour; // the Hunt adds no Valour a monster
    expect(C.valour[1]).toBe(v0 + bonus);
    expect(C.cap[1]).toBe(cap0 + bonus);
    expect(hostActs(S, C, 1).some((o) => o.t === "summon")).toBe(false);
    // the other host is one monster short when it fights
    const { hostAt } = await import("../engine");
    const other = hostAt(S, C, 9);
    expect(other.host!.members.map((m) => m.id)).toEqual(["bean_nighe"]);
    void card;
  });
});

describe("hybrid damage is a choice, not both", () => {
  it("a Spirit blow lands as Spirit (pierce, steal) or as the hybrid element (no pierce, no steal)", () => {
    const s = ALL_DEFS.cold_touch as Extract<(typeof ALL_DEFS)[string], { type: "support" }>;
    expect(asHybrid(s)).toBe(s);
    const f = asHybrid(s, "Fire");
    expect(f.element).toBe("Fire");
    expect(f.spiritAs).toBe(true);
    expect(s.element).toBe("Spirit"); // the card itself is untouched
  });
});
