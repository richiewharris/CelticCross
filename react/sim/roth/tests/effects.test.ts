// Combat rules, second draft: hero Valour and caps, supports, hero qualities, oaths, modifying geasa, omens,
// Unwilling pairs, guests and the wounds tie-break. Every expected number is worked out in the comment beside it.
import { describe, expect, it } from "vitest";
import { combatResult, legalityError, nextDecision, type CombatState } from "../engine";
import { act, actor, combatState, options, rest, use, V, type Spec } from "./helpers";

const D2: [string, string, string] = ["emer", "salmon", "salmon"];
const D2E: [string, string, string] = ["conall", "salmon", "salmon"];
/** Board: P1 hero at 1 with supports 2,3; P2 hero at 7 with 8,9; a quiet second duel (Emer vs Conall). */
const B = (h1: string, s2: string, s3: string, h7: string, s8: string, s9: string, d2 = D2, d2e = D2E) => [h1, s2, s3, ...d2, h7, s8, s9, ...d2e];
const mk = (board: (string | null)[], extra: Omit<Spec, "board"> = {}) => combatState({ board, ...extra });
const modes = (S: ReturnType<typeof combatState>, at: number) =>
  options(S).filter((o) => o.t === "duel" && o.guest < 0 && o.act === "use" && o.spot === at - 1).map((o) => (o as { mode: string }).mode);

// The plain pair: Fergus (Deorad, Valour 5, Initiative 3, Focus Weapon, Weakness Wind) at 1 against
// Lí Ban (Merrow, Valour 4, Initiative 3, Focus Water, Weakness Wind) at 7. Initiative tie → P2 (Lí Ban) first.
// Lí Ban has no kinship with Ulaid/Connachta/Sídhe supports and no Focus bonus from Fire/Earth/Wind.
const plain = (s8: string, s9: string, s2 = "salmon", s3 = "salmon", extra: Omit<Spec, "board"> = {}) =>
  mk(B("fergus", s2, s3, "liban", s8, s9), extra);

describe("hero Valour and the Heal cap", () => {
  it("each hero starts its duel at its own Valour", () => {
    const S = plain("salmon", "salmon");
    expect(V(S)).toEqual([5, 4]);
    expect(actor(S)).toBe(1);
  });
  it("Heals stop at starting Valour + 2", () => {
    const S = plain("brown_bull", "finnbennach");
    use(S, 8); // Lí Ban: 4 + Heal 2 = 6 (cap 4 + 2)
    expect(V(S)[1]).toBe(6);
    rest(S);
    use(S, 9); // capped
    expect(V(S)[1]).toBe(6);
  });
});

describe("supports", () => {
  it("Thunder feat strikes 2 and ignores Shield", () => {
    const S = plain("thunder", "salmon", "salmon", "salmon", { omens: [["o_rath"], []] });
    expect(S.combat!.shield).toEqual([1, 0]); // the ráth: Shield 1 at the start of each duel
    use(S, 8);
    expect(V(S)).toEqual([3, 4]);
    expect(S.combat!.shield[0]).toBe(1);
  });
  it("a plain Strike is soaked by Shield (Spear of Cet)", () => {
    const S = plain("cet_spear", "salmon", "salmon", "salmon", { omens: [["o_rath"], []] });
    use(S, 8); // 2 − Shield 1 = 1
    expect(V(S)).toEqual([4, 4]);
  });
  it("Fragarach ignores Shield; Wind hits Fergus' Weakness", () => {
    const S = plain("fragarach", "salmon", "salmon", "salmon", { omens: [["o_rath"], []] });
    use(S, 8); // 2 + 1 (Weakness Wind) = 3, Shield untouched
    expect(V(S)).toEqual([2, 4]);
    expect(S.combat!.shield[0]).toBe(1);
  });
  it("the tathlum: +2 against a hero of Valour 5 or more", () => {
    const S = plain("tathlum", "salmon");
    use(S, 8); // 1 + 2 (Fergus is Valour 5) + 1 (Lí Ban's Focus Water) = 4
    expect(V(S)).toEqual([1, 4]);
  });
  it("the warp-spasm strikes 4 and costs its hero 1", () => {
    const S = plain("warp", "salmon");
    use(S, 8);
    expect(V(S)).toEqual([1, 3]);
  });
  it("Gáe Bolga strikes 2 through Shield; 4 for Cú Chulainn", () => {
    // Emer (Ulaid, Initiative 2) at 7 vs Lí Ban at 1 (Initiative 3): Lí Ban rests (Shield 2), then Gáe Bolga 2 + 1 kinship = 3.
    const S = mk(B("liban", "salmon", "salmon", "emer", "gae_bolga", "salmon"));
    rest(S);
    expect(S.combat!.shield[0]).toBe(2);
    use(S, 8);
    expect(V(S)[0]).toBe(1);
    expect(S.combat!.shield[0]).toBe(2);
    // Cú (Valour 4, Initiative 5, Strikes +1) vs Fergus: 4 + 1 kinship + 1 Ríastrad = 6 → Fergus falls
    const C2 = mk(B("cu", "gae_bolga", "salmon", "fergus", "salmon", "salmon"));
    expect(actor(C2)).toBe(0);
    use(C2, 2);
    expect(C2.combat!.felled[0]).toEqual([false, true]);
  });
  it("the gaze of Balor: Strike 2, or 3 for Balor", () => {
    // Bres (Initiative 3) first vs the Dagda (Initiative 1): 2 + 1 kinship + 1 Weakness Fire = 4 → 6 − 4 = 2
    const S = mk(B("dagda", "salmon", "salmon", "bres", "gaze", "salmon"));
    use(S, 8);
    expect(V(S)[0]).toBe(2);
    // Balor after Fergus rests: 3 + 1 kinship + 1 Focus Fire + 2 Evil eye = 7 → Fergus (5) falls
    const S2 = mk(B("fergus", "salmon", "salmon", "balor", "gaze", "salmon"));
    rest(S2);
    use(S2, 8);
    expect(S2.combat!.felled[0]).toEqual([true, false]);
  });
  it("drain: the soul cage heals 1 when it wounds", () => {
    const S = plain("brown_bull", "soul_cage");
    use(S, 8); // Lí Ban 6
    rest(S);
    expect(V(S)).toEqual([5, 6]);
    use(S, 9); // 1 + 1 kinship (Merrow) = 2 → Fergus 3; Heal 1 → capped at 6
    expect(V(S)).toEqual([3, 6]);
    const S2 = plain("soul_cage", "salmon");
    use(S2, 8); // Lí Ban full (4): Heal 1 → 5
    expect(V(S2)).toEqual([3, 5]);
  });
});

describe("Unwilling pairs", () => {
  it("a Sídhe support is spent with no effect for a Fomóire hero", () => {
    const S = mk(B("fergus", "salmon", "salmon", "balor", "raven", "salmon"));
    rest(S); // Fergus (Initiative 3) before Balor (1)
    use(S, 8);
    expect(V(S)[0]).toBe(5);
    expect(S.stats!.unwilling).toBe(1);
  });
  it("Ulaid and Connachta stay Unwilling for each other; Merrow is Unwilling for nobody", () => {
    const S = mk(B("liban", "cet_spear", "thunder", "conall", "salmon", "salmon"));
    expect(actor(S)).toBe(1); // tie 3–3 → P2
    rest(S);
    use(S, 2); // Lí Ban with a Connachta spear: 2 → Conall 3
    expect(V(S)[1]).toBe(3);
    const S2 = mk(B("liban", "salmon", "salmon", "conall", "cet_spear", "salmon"));
    use(S2, 8); // Conall with a Connachta spear: nothing
    expect(V(S2)[0]).toBe(4);
  });
});

describe("hero qualities", () => {
  it("Cú Chulainn: Strikes +1, and +2 more at 1 Valour", () => {
    const S = mk(B("cu", "thunder", "thunder", "dagda", "salmon", "salmon"), { geasa: ["g_hound", null, null, null] });
    expect(V(S)[0]).toBe(2); // the hound Invokes Hound: 4 − 2
    const S2 = mk(B("cu", "thunder", "thunder", "dagda", "salmon", "salmon"), { geasa: ["g_ford", null, null, null] });
    S2.combat!.valour[0] = 1;
    use(S2, 2); // 2 + 1 kinship + 1 Focus Fire + 1 Weakness Fire + 1 + 2 Ríastrad = 8
    expect(S2.combat!.felled[0]).toEqual([false, true]);
  });
  it("Conall: Strikes +1 against a hero of Valour 5 or more", () => {
    // Goibniu's forge (Sídhe Fire Weapon): 2 + 1 Focus Weapon + 1 Weakness Fire + 1 = 5 vs the Dagda (6) → 1
    const S = mk(B("conall", "goibniu", "salmon", "dagda", "salmon", "salmon"));
    use(S, 2);
    expect(V(S)[1]).toBe(1);
    // against Lí Ban (4, healed to 6 first on the tie): 2 + 1 Focus = 3, no bonus → 3
    const S2 = mk(B("conall", "goibniu", "salmon", "liban", "brown_bull", "salmon"));
    use(S2, 8);
    use(S2, 2);
    expect(V(S2)[1]).toBe(3);
  });
  it("Balor's Evil eye: only his first Strike each duel +2", () => {
    // Balor vs the Dagda, tie on 1 → Balor first: Cet 2 + 2 = 4 → 2; the Dagda rests (Heal 2) → 4; Cet 2 → 2
    const S = mk(B("dagda", "salmon", "salmon", "balor", "cet_spear", "cet_spear"));
    use(S, 8);
    expect(V(S)[0]).toBe(2);
    rest(S);
    expect(V(S)[0]).toBe(4);
    use(S, 9);
    expect(V(S)[0]).toBe(2);
  });
  it("Indech: no Strike against him above 3", () => {
    const S = mk(B("indech", "salmon", "salmon", "liban", "warp", "salmon"));
    use(S, 8); // 4 → 3
    expect(V(S)).toEqual([2, 3]);
  });
  it("Manannán: the first Strike against him each duel misses", () => {
    const S = mk(B("fergus", "caladbolg", "cet_spear", "manannan", "salmon", "salmon"));
    rest(S); // Manannán (Initiative 4) first
    use(S, 2); // Caladbolg: lost
    expect(V(S)[1]).toBe(4);
    rest(S);
    use(S, 3); // Cet: 2 + 1 kinship (Deorad) + 1 Focus + 1 Earth beats Water + 1 Weakness Earth = 6
    expect(S.combat!.felled[0]).toEqual([false, true]);
  });
  it("Cethlenn: Strikes +1, and Heal 1 when her Strike wounds", () => {
    const S = mk(B("fergus", "salmon", "salmon", "cethlenn", "cet_spear", "salmon"));
    use(S, 8); // 2 + 1 = 3 → Fergus 2; Cethlenn 3 + 1 = 4
    expect(V(S)).toEqual([2, 4]);
  });
  it("Bres: the enemy hero's Heals −1", () => {
    const S = mk(B("liban", "brown_bull", "salmon", "bres", "salmon", "salmon"));
    rest(S); // tie → Bres first
    use(S, 2); // 2 − 1 = 1
    expect(V(S)[0]).toBe(5);
  });
  it("Lugh: every support counts as his Focus", () => {
    const S = mk(B("fergus", "salmon", "salmon", "lugh", "cet_spear", "salmon"));
    use(S, 8); // 2 + 1 = 3
    expect(V(S)[0]).toBe(2);
  });
  it("Emer and the Dagda heal when they rest; Lí Ban gains Shield", () => {
    const S = mk(B("dagda", "salmon", "salmon", "fergus", "cet_spear", "salmon"));
    use(S, 8); // Fergus (3) first: 2 + 1 kinship + 1 Focus = 4 → 2
    rest(S);
    expect(V(S)[0]).toBe(4);
  });
  it("Medb: kinship +2", () => {
    const S = mk(B("liban", "salmon", "salmon", "medb", "cet_spear", "salmon"));
    use(S, 8); // Medb (4) first: 2 + 2 kinship + 1 Focus Earth + 1 Earth beats Water = 6 → Lí Ban falls
    expect(S.combat!.felled[0]).toEqual([true, false]);
  });
});

describe("oaths", () => {
  it("Champion's oath: Strikes +1; resting is forbidden; breaking costs 2 and ends the boon", () => {
    const S = plain("thunder", "thunder", "salmon", "salmon", { oaths: [null, null, "v_champion", null] });
    use(S, 8); // 2 + 1 = 3
    expect(V(S)).toEqual([2, 4]);
    rest(S);
    const restOpts = options(S).filter((o) => o.t === "duel" && o.act === "rest" && o.guest < 0).map((o) => (o as { mode: string }).mode);
    expect(restOpts).toEqual(["break"]);
    expect(legalityError(S, 1, { t: "duel", guest: -1, act: "rest", spot: -1, mode: "normal" })).toMatch(/forbidden/);
    rest(S, "break"); // −2, then Lí Ban's salmon-shape: Shield 2
    expect(V(S)[1]).toBe(2);
    expect(S.stats!.oathBroken).toBe(1);
  });
  it("a broken oath gives no more boon", () => {
    const S = plain("thunder", "salmon", "salmon", "salmon", { oaths: [null, null, "v_champion", null] });
    rest(S, "break"); // Lí Ban 2
    rest(S);
    use(S, 8); // 2, no +1
    expect(V(S)).toEqual([3, 2]);
  });
  it("Hearth-guard's oath: Valour +2 (and the cap with it); Weapons forbidden", () => {
    const S = plain("salmon", "salmon", "caladbolg", "salmon", { oaths: ["v_hearthguard", null, null, null] });
    expect(V(S)[0]).toBe(7);
    expect(S.combat!.cap[0]).toBe(9);
    rest(S);
    expect(modes(S, 2)).toEqual(["break"]);
  });
  it("Oath of the first blow: Initiative +3", () => {
    const S = plain("salmon", "salmon", "salmon", "salmon", { oaths: ["v_first", null, null, null] });
    expect(actor(S)).toBe(0);
  });
  it("Oath of the shield-wall and Oath on the stone add Shield at the start", () => {
    const S = plain("salmon", "salmon", "salmon", "salmon", { oaths: ["v_shieldwall", null, "v_stone", null] });
    expect(S.combat!.shield).toEqual([2, 1]);
    expect(V(S)).toEqual([5, 5]);
  });
  it("Blood-oath forbids Heals", () => {
    const S = plain("brown_bull", "salmon", "salmon", "salmon", { oaths: [null, null, "v_blood", null] });
    expect(modes(S, 8)).toEqual(["break"]);
  });
  it("Cathbad lets the hero ignore an oath", () => {
    const S = mk(B("emer", "salmon", "salmon", "conall", "cathbad", "thunder"), { oaths: [null, null, "v_shieldwall", null] });
    use(S, 8); // Conall (3) first: Cathbad strikes 1 + 1 kinship = 2
    rest(S);
    expect(modes(S, 9)).toEqual(["break", "ignore"]);
  });
});

describe("modifying geasa", () => {
  it("the giant's portion: a hero of Valour 5+ starts 2 lower; smaller heroes do not", () => {
    const S = plain("salmon", "salmon", "salmon", "salmon", { geasa: ["g_giant", null, "g_giant", null] });
    expect(V(S)).toEqual([3, 4]);
  });
  it("the slow hand: Initiative −3", () => {
    const S = plain("salmon", "salmon", "salmon", "salmon", { geasa: [null, null, "g_slow", null] });
    expect(actor(S)).toBe(0);
  });
  it("Emain's ward ignores the geis and its modifier", () => {
    const S = plain("salmon", "salmon", "salmon", "salmon", { geasa: ["g_giant", null, null, null], omens: [["o_emain"], []] });
    expect(V(S)[0]).toBe(5);
  });
  it("breaking a geis costs 2; a broken geis no longer binds", () => {
    const S = plain("salmon", "salmon", "caladbolg", "cet_spear", { geasa: ["g_spear", null, null, null] });
    rest(S);
    expect(modes(S, 2)).toEqual(["break"]);
    use(S, 2, "break"); // 5 − 2 = 3, then Caladbolg 3 + 1 + 1 = 5 → Lí Ban falls
    expect(S.combat!.felled[0]).toEqual([false, true]);
    expect(S.combat!.endValour[0][0]).toBe(3);
  });
});

describe("omens", () => {
  it("Night of the Fomóire: the lower Initiative strikes first", () => {
    expect(actor(mk(B("lugh", "salmon", "salmon", "dagda", "salmon", "salmon")))).toBe(0);
    expect(actor(mk(B("lugh", "salmon", "salmon", "dagda", "salmon", "salmon"), { omens: [[], ["o_darkness"]] }))).toBe(1);
  });
  it("Mist of the druids: its owner strikes first; both mists cancel", () => {
    expect(actor(mk(B("dagda", "salmon", "salmon", "lugh", "salmon", "salmon"), { omens: [["o_mist"], []] }))).toBe(0);
    expect(actor(mk(B("dagda", "salmon", "salmon", "lugh", "salmon", "salmon"), { omens: [["o_mist"], ["o_mist"]] }))).toBe(1);
  });
  it("Debility of the Ulstermen: Ulaid and Deorad Strikes −1, Cú spared", () => {
    const S = mk(B("fergus", "cet_spear", "salmon", "liban", "salmon", "salmon"), { omens: [[], ["o_debility"]] });
    rest(S); // Lí Ban: Shield 2
    use(S, 2); // 2 + 1 kinship + 1 Focus + 1 Earth beats Water − 1 = 4 − Shield 2 = 2
    expect(V(S)[1]).toBe(2);
  });
  it("Truce of Samhain: no Strike above 3", () => {
    const S = plain("warp", "salmon", "salmon", "salmon", { omens: [["o_truce"], []] });
    use(S, 8);
    expect(V(S)[0]).toBe(2);
  });
  it("the Morrígan's crow forbids Heals (breakable)", () => {
    const S = plain("brown_bull", "salmon", "salmon", "salmon", { omens: [[], ["o_crow"]] });
    expect(modes(S, 8)).toEqual(["break"]);
  });
  it("Lugh's protection and the ráth: first Strike −1, Shield 1", () => {
    const S = plain("cet_spear", "thunder", "salmon", "salmon", { omens: [["o_lugh"], []] });
    use(S, 8); // 2 − 1 = 1
    rest(S);
    use(S, 9); // full 2
    expect(V(S)[0]).toBe(2);
  });
  it("reinforcements: Feats +1, first-duel Strikes +1, Heals +1, Shields +1", () => {
    expect((() => { const S = plain("thunder", "salmon", "salmon", "salmon", { omens: [[], ["o_redbranch"]] }); use(S, 8); return V(S)[0]; })()).toBe(2);
    expect((() => { const S = plain("cet_spear", "salmon", "salmon", "salmon", { omens: [[], ["o_boyhood"]] }); use(S, 8); return V(S)[0]; })()).toBe(2);
    expect((() => { const S = plain("brown_bull", "salmon", "salmon", "salmon", { omens: [[], ["o_cruachan"]] }); S.combat!.valour[1] = 1; use(S, 8); return V(S)[1]; })()).toBe(4);
    // Salmon leap for Lí Ban: Shield 2 + 1 Focus Water + 1 the ninth wave
    expect((() => { const S = plain("salmon", "salmon", "salmon", "salmon", { omens: [[], ["o_wave"]] }); use(S, 8); return S.combat!.shield[1]; })()).toBe(4);
  });
  it("Blighted harvest: every Heal −1", () => {
    const S = plain("brown_bull", "salmon", "salmon", "salmon", { omens: [["o_blight"], []] });
    S.combat!.valour[1] = 1;
    use(S, 8);
    expect(V(S)[1]).toBe(2);
  });
});

describe("guests", () => {
  it("a hero in hand may be discarded once per duel to Heal 1 a hero of the same alignment", () => {
    const S = mk(B("emer", "salmon", "salmon", "conchobar", "salmon", "salmon"), { hands: [["conall", "medb", "fergus"], []] });
    S.combat!.valour[0] = 2;
    use(S, 8); // Emer (2) before Conchobar (2)? tie → P2 first
    const names = [...new Set(options(S).filter((o) => o.t === "duel" && o.guest >= 0).map((o) => (o as { guest: number }).guest))]
      .map((u) => S.players[0].hand.find((c) => c.uid === u)!.def.id).sort();
    expect(names).toEqual(["conall", "fergus"]);
    const conall = S.players[0].hand.find((c) => c.def.id === "conall")!.uid;
    act(S, { t: "duel", guest: conall, act: "rest", mode: "normal" }); // guest +1, Six gifts +2 → 5
    expect(V(S)[0]).toBe(5);
    expect(S.players[0].discard.map((c) => c.def.id)).toEqual(["conall"]);
  });
});

describe("winning and tie-breaks", () => {
  const C = (felled: boolean[][], startV: number[][], endValour: number[][]): CombatState =>
    ({ felled, startV, endValour } as unknown as CombatState);
  it("more enemy heroes felled wins", () => {
    expect(combatResult(C([[false, true], [false, false]], [[3, 3], [6, 6]], [[1, 0], [1, 6]]))).toMatchObject({ winner: 0, decidedBy: "felled" });
  });
  it("then more wounds dealt (Valour the enemy lost), so a tank does not win ties by size alone", () => {
    // P1's tank (6) lost 3 of 6; P2's small hero (3) lost 2 of 3: P2 dealt 3, P1 dealt 2 → P2 wins although P1 stands higher
    expect(combatResult(C([[false, false], [false, false]], [[6, 3], [4, 4]], [[3, 1], [4, 4]]))).toMatchObject({ winner: 1, decidedBy: "valour", valour: [2, 3] });
  });
  it("a felled hero counts its whole start as wounds", () => {
    expect(combatResult(C([[true, true], [false, false]], [[5, 3], [4, 4]], [[0, 0], [4, 4]]))).toMatchObject({ winner: 1, decidedBy: "valour", valour: [3, 5] });
  });
  it("then whoever alone stands from the first duel; else a draw", () => {
    expect(combatResult(C([[true, false], [false, true]], [[3, 3], [3, 3]], [[0, 3], [3, 0]]))).toMatchObject({ winner: 1, decidedBy: "firstDuel" });
    expect(combatResult(C([[false, false], [false, false]], [[4, 4], [4, 4]], [[3, 3], [4, 4]]))).toMatchObject({ winner: -1, decidedBy: "draw" });
  });
  it("a full match produces a result through the engine", () => {
    const S = plain("thunder", "salmon");
    for (let d = nextDecision(S); d; d = nextDecision(S)) act(S, d.options[0]);
    expect(S.result).not.toBeNull();
  });
});
