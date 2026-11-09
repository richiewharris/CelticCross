// Combat rules: every support, hero quality, omen and geis; duel order; breaking; Invoke; guests; cap.
import { describe, expect, it } from "vitest";
import { combatResult, legalityError, nextDecision, type CombatState } from "../engine";
import { act, actor, combatState, options, rest, use, V } from "./helpers";

const D2: [string, string, string] = ["emer", "salmon", "salmon"];
const D2E: [string, string, string] = ["conall", "salmon", "salmon"];
/** Board: P1 hero at 1 with supports 2,3; P2 hero at 7 with 8,9; a quiet second duel (Emer vs Conall). */
const B = (h1: string, s2: string, s3: string, h7: string, s8: string, s9: string, d2 = D2, d2e = D2E) => [h1, s2, s3, ...d2, h7, s8, s9, ...d2e];
const skipFocus = (S: ReturnType<typeof combatState>) => act(S, { t: "focus", el: null });

describe("base effects (plain attacker: the Morrígan at 7 strikes first vs Fergus at 1)", () => {
  // Morrígan (Sídhe, Focus Wind) gets no kinship/focus from Fire/Earth non-Sídhe supports;
  // Fergus (Focus Weapon, Weakness Water) gives no strong/weakness bonus to Fire/Earth.
  const plain = (s8: string, s9: string, s2 = "salmon", s3 = "salmon", extra = {}) =>
    combatState({ board: B("fergus", s2, s3, "morrigan", s8, s9), ...extra });

  it("Strike N: Thunder feat strikes 2", () => {
    const S = plain("thunder", "salmon");
    skipFocus(S);
    expect(actor(S)).toBe(1); // tie on Initiative 3 → P2 first
    use(S, 8);
    expect(V(S)).toEqual([1, 3]);
  });
  it("Spear of Cet strikes 2 (test-only card)", () => {
    const S = plain("cet_spear", "salmon");
    skipFocus(S); use(S, 8);
    expect(V(S)).toEqual([1, 3]);
  });
  it("The warp-spasm strikes 3 and costs its hero 1", () => {
    const S = plain("warp", "salmon");
    skipFocus(S); use(S, 8);
    expect(S.combat!.felled[0]).toEqual([true, false]);
    expect(S.combat!.endValour[0]).toEqual([0, 2]);
    expect(S.combat!.duel).toBe(1); // the duel ended at once
  });
  it("Heal N with the Valour cap of 6", () => {
    const S = plain("brown_bull", "finnbennach");
    skipFocus(S); use(S, 8);
    expect(V(S)[1]).toBe(5);
    rest(S); use(S, 9);
    expect(V(S)[1]).toBe(6);
  });
  it("Shield soaks Strike damage first", () => {
    // Fergus' Caladbolg: 2 +1 kinship (Deorad) +1 Focus Weapon +1 Morrígan's Weakness Earth = 5; Shield 2 soaks 2.
    const S = plain("salmon", "salmon", "caladbolg");
    skipFocus(S); use(S, 8);
    expect(S.combat!.shield[1]).toBe(2);
    use(S, 2);
    expect(S.combat!.felled[0]).toEqual([false, true]);
    expect(S.combat!.endValour[0][1]).toBe(0);
  });
  it("Raven's war-cry: kinship for a Sídhe hero (2+1)", () => {
    const S = plain("raven", "salmon");
    skipFocus(S); use(S, 8);
    expect(S.combat!.felled[0]).toEqual([true, false]);
  });
  it("Láeg: Heal 1 (+1 Focus Wind) and the next Strike +1", () => {
    const S = plain("laeg", "thunder");
    skipFocus(S); use(S, 8);
    expect(V(S)).toEqual([3, 5]);
    rest(S); use(S, 9); // 2 + 1
    expect(S.combat!.felled[0]).toEqual([true, false]);
  });
  it("Medb's war-chariot: Heal 1 (+1 Focus Wind), next Strike +1", () => {
    const S = plain("medb_chariot", "cet_spear");
    skipFocus(S); use(S, 8);
    expect(V(S)).toEqual([3, 5]);
    rest(S); use(S, 9);
    expect(S.combat!.endValour[0][0]).toBe(0);
  });
  it("The host of Cruachan: Strike 1 + Heal 1", () => {
    const S = plain("host", "salmon");
    skipFocus(S); use(S, 8);
    expect(V(S)).toEqual([2, 4]);
  });
  it("Fedelm's prophecy: Shield 2 (+1 Focus Wind); Ferdiad's horn-shield: Shield 2", () => {
    const S = plain("fedelm", "horn_shield");
    skipFocus(S); use(S, 8);
    expect(S.combat!.shield[1]).toBe(3);
    rest(S); use(S, 9);
    expect(S.combat!.shield[1]).toBe(5);
  });
  it("Bárach's feast: Invoke Feast costs Fergus 2", () => {
    const S = plain("barach", "salmon");
    skipFocus(S); use(S, 8);
    expect(V(S)).toEqual([1, 3]);
    expect(S.stats!.invokes).toBe(1);
  });
  it("Cathbad: ignore one geis this duel without cost", () => {
    const S = plain("cathbad", "thunder", "salmon", "salmon", { geasa: [null, null, "g_hearth", null] });
    skipFocus(S); use(S, 8); rest(S);
    const modes = options(S).filter((o) => o.t === "duel" && o.spot === 8).map((o) => (o as { mode: string }).mode);
    expect(modes.sort()).toEqual(["break", "ignore"]);
    use(S, 9, "ignore");
    expect(V(S)).toEqual([1, 3]);
    expect(S.combat!.broken).toBe(0); // the geis still stands
  });
});

describe("bonuses and special supports", () => {
  it("Medb: kinship +2; Focus +1; Weakness +1; the Morrígan's shape-shift makes Earth strong", () => {
    const mk = () => combatState({ board: B("medb", "cet_spear", "salmon", "morrigan", "salmon", "salmon") });
    let S = mk();
    act(S, { t: "focus", el: null });
    expect(actor(S)).toBe(0); // Initiative 4 > 3
    use(S, 2); // 2 +2 +1 +1 = 6
    expect(S.combat!.endValour[0]).toEqual([3, 0]);
    expect(S.combat!.felled[0][1]).toBe(true);
    S = mk();
    act(S, { t: "focus", el: "Water" });
    expect(S.combat!.focus[1]).toBe("Water");
    use(S, 2); // + Earth beats Water = 7 → −4
    expect(S.combat!.felled[0][1]).toBe(true);
  });
  it("Gáe Bolga: Strike 3 for Cú Chulainn, Strike 1 otherwise", () => {
    let S = combatState({ board: B("cu", "gae_bolga", "salmon", "morrigan", "salmon", "salmon") });
    act(S, { t: "focus", el: null });
    use(S, 2); // 3 + 1 kinship = 4
    expect(S.combat!.felled[0][1]).toBe(true);
    S = combatState({ board: B("conall", "gae_bolga", "salmon", "morrigan", "salmon", "salmon") });
    act(S, { t: "focus", el: null });
    rest(S); use(S, 2); // 1 + kin + Focus Weapon = 3
    expect(S.combat!.endValour[0][1]).toBe(0);
  });
  it("Sling of Emain: Strike 2 only as the first support used in the duel", () => {
    let S = combatState({ board: B("conall", "sling", "salmon", "morrigan", "salmon", "salmon") });
    act(S, { t: "focus", el: null });
    rest(S); // resting is not using a support
    use(S, 2); // 2 + kin + Focus = 4
    expect(S.combat!.felled[0][1]).toBe(true);
    S = combatState({ board: B("conall", "sling", "salmon", "morrigan", "salmon", "salmon") });
    act(S, { t: "focus", el: null });
    use(S, 8); // Morrígan Shield 2
    use(S, 2); // 1 + 1 + 1 = 3, soak 2
    expect(V(S)).toEqual([3, 2]);
  });
  it("Furbaide's sling-stone: Strike 3 against Medb", () => {
    const S = combatState({ board: B("conall", "furbaide", "salmon", "medb", "salmon", "salmon") });
    rest(S); use(S, 2); // 3 +kin +Focus +Medb's Weakness Water = 6
    expect(S.combat!.endValour[0][1]).toBe(0);
    const S2 = combatState({ board: B("conall", "furbaide", "salmon", "emer", "salmon", "salmon") });
    use(S2, 2); // vs Emer: 1 + 1 + 1 = 3
    expect(S2.combat!.endValour[0]).toEqual([3, 0]);
  });
  it("Bricriu's satire: Invoke Satire against Ferdiad (Shield 1 soaks the Strike part)", () => {
    const S = combatState({ board: B("ferdiad", "salmon", "salmon", "morrigan", "bricriu", "salmon") });
    act(S, { t: "focus", el: null });
    expect(S.combat!.shield[0]).toBe(1); // Horn-skin
    rest(S); use(S, 8); // Strike 1 +1 Focus Wind = 2, shield soaks 1 → 1; Invoke 2
    expect(S.combat!.endValour[0][0]).toBe(0);
  });
});

describe("unwilling supports", () => {
  it("an Ulaid support is spent with no effect for a Connachta hero", () => {
    const S = combatState({ board: B("ferdiad", "thunder", "salmon", "emer", "salmon", "salmon"), geasa: ["g_hearth", null, null, null] });
    // Unwilling comes before the geis: no break prompt for the unwilling Thunder feat
    const modes = options(S).filter((o) => o.t === "duel" && o.spot === 1).map((o) => (o as { mode: string }).mode);
    expect(modes).toEqual(["normal"]);
    use(S, 2);
    expect(V(S)).toEqual([3, 3]);
    expect(S.stats!.unwilling).toBe(1);
    expect(S.combat!.used & (1 << 1)).toBeTruthy();
  });
  it("a Connachta support is unwilling for an Ulaid hero", () => {
    const S = combatState({ board: B("cu", "cet_spear", "salmon", "emer", "salmon", "salmon") });
    use(S, 2);
    expect(V(S)).toEqual([3, 3]);
  });
  it("a Deorad hero is never unwilling (and has kinship with Ulaid supports)", () => {
    const S = combatState({ board: B("fergus", "thunder", "salmon", "morrigan", "salmon", "salmon") });
    act(S, { t: "focus", el: null });
    rest(S); use(S, 2); // 2 + kin 1 + Fire beats Wind 1 = 4
    expect(S.combat!.felled[0][1]).toBe(true);
  });
});

describe("hero qualities", () => {
  it("Cú Chulainn's Ríastrad: Strikes +2 at 1 Valour (here after the hound geis Invokes Hound)", () => {
    const S = combatState({ board: B("cu", "gae_bolga", "salmon", "emer", "salmon", "salmon"), geasa: ["g_hound", null, null, null] });
    expect(V(S)).toEqual([1, 3]);
    use(S, 2); // 3 + 1 + 2
    expect(S.combat!.endValour[0][1]).toBe(0);
  });
  it("Conchobar's King's due: a support from the other quadrant, which counts as used there too", () => {
    const S = combatState({ board: B("conchobar", "salmon", "salmon", "emer", "salmon", "salmon", ["conall", "thunder", "sling"], D2E) });
    rest(S); // Emer (tie on 2 → P2 first)
    const spots = options(S).filter((o) => o.t === "duel" && o.act === "use").map((o) => (o as { spot: number }).spot);
    expect(spots).toEqual([1, 2, 4, 5]);
    use(S, 5); // Thunder feat from Conall's quadrant: 2 + kin + Emer's Weakness Fire = 4
    expect(S.combat!.felled[0][1]).toBe(true);
    rest(S); // second duel: P2's Conall first (tie on 3)
    const left = options(S).filter((o) => o.t === "duel" && o.act === "use").map((o) => (o as { spot: number }).spot);
    expect(left).toEqual([5]); // only the Sling remains for P1's Conall
  });
  it("King's due works once per duel", () => {
    const S = combatState({ board: B("conchobar", "salmon", "salmon", "emer", "salmon", "salmon", ["conall", "salmon", "salmon"], D2E) });
    rest(S);
    use(S, 5);
    rest(S);
    const spots = options(S).filter((o) => o.t === "duel" && o.act === "use").map((o) => (o as { spot: number }).spot);
    expect(spots).toEqual([1, 2]);
  });
  it("Conall's Avenger: Strikes +1 once your other hero has fallen", () => {
    // Duel 1: Emer (bound by open door: Invoke Hospitality → 1 Valour) falls to Cú.
    const S = combatState({ board: ["emer", "salmon", "salmon", "conall", "caladbolg", "salmon", "cu", "thunder", "salmon", "morrigan", "salmon", "salmon"], geasa: ["g_door", null, null, null] });
    expect(V(S)).toEqual([1, 3]);
    use(S, 8);
    expect(S.combat!.felled[0][0]).toBe(true);
    act(S, { t: "focus", el: null });
    rest(S); // Morrígan (tie 3 → P2 first)
    use(S, 5); // 2 + kin + Focus Weapon + Weakness Earth + Avenger = 6
    expect(S.combat!.endValour[1][1]).toBe(0);
    expect(S.result).toBeNull();
  });
  it("Emer's Six gifts: Heal 1 when she rests", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "conchobar", "thunder", "salmon") });
    use(S, 8); // Conchobar? no: tie 2-2 → P2 Conchobar first: Thunder 2 + kin = 3 + Emer Weakness Fire 1 = 4 → falls
    expect(S.combat!.felled[0][0]).toBe(true);
    const S2 = combatState({ board: B("emer", "salmon", "salmon", "conchobar", "salmon", "salmon") });
    rest(S2); rest(S2);
    expect(V(S2)).toEqual([4, 3]);
  });
  it("Fergus' Old oath: Strikes vs Cú Chulainn −1", () => {
    const S = combatState({ board: B("cu", "salmon", "salmon", "fergus", "caladbolg", "salmon") });
    rest(S); use(S, 8); // 2 + kin + Focus = 4, −1 = 3
    expect(S.combat!.endValour[0][0]).toBe(0);
    expect(S.combat!.felled[0][0]).toBe(true);
  });
  it("Ferdiad's Horn-skin: Shield 1 at the start of each duel", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "ferdiad", "salmon", "salmon") });
    expect(S.combat!.shield).toEqual([0, 1]);
  });
  it("The Morrígan may change Focus once (only element choices)", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "morrigan", "salmon", "salmon") });
    const d = nextDecision(S)!;
    expect(d.kind).toBe("focus");
    expect(d.options.map((o) => (o as { el: string | null }).el)).toEqual([null, "Fire", "Earth", "Water"]);
  });
});

describe("omens", () => {
  it("Debility of the Ulstermen: Ulaid (and Deorad) Strikes −1, Cú spared, both players", () => {
    const S = combatState({ board: B("conall", "caladbolg", "salmon", "emer", "salmon", "salmon"), omens: [[], ["o_debility"]] });
    use(S, 2); // Conall vs Emer: 2 + kin + Focus − 1 = 3
    expect(S.combat!.endValour[0]).toEqual([3, 0]);
    const S2 = combatState({ board: B("cu", "gae_bolga", "salmon", "fergus", "caladbolg", "salmon"), omens: [["o_debility"], []] });
    use(S2, 2); // Cú: 3 + 1 = 4 (spared)… vs Fergus Weakness Water +1 = 5
    expect(S2.combat!.felled[0][1]).toBe(true);
    const S3 = combatState({ board: B("cu", "salmon", "salmon", "fergus", "caladbolg", "salmon"), omens: [["o_debility"], []] });
    rest(S3); use(S3, 8); // Fergus: 2+1+1 −1 Old oath −1 Debility = 2
    expect(V(S3)).toEqual([1, 3]);
  });
  it("The Morrígan's crow: Heals are forbidden (breakable), no guest or Six-gifts heals", () => {
    const S = combatState({ board: B("emer", "brown_bull", "salmon", "conchobar", "salmon", "salmon"), omens: [[], ["o_crow"]], hands: [["conall"], []] });
    rest(S); // Conchobar first
    const opts = options(S);
    expect(opts.some((o) => o.t === "duel" && o.guest >= 0)).toBe(false);
    expect(opts.filter((o) => o.t === "duel" && o.spot === 1).map((o) => (o as { mode: string }).mode)).toEqual(["break"]);
    rest(S); // Emer rests: no heal under the crow
    expect(V(S)).toEqual([3, 3]);
    rest(S);
    use(S, 2, "break"); // −2, then Heal 2 +1 kinship = 3 → 4
    expect(S.combat!.endValour[0][0]).toBe(4);
    expect(S.combat!.broken & 16).toBeTruthy();
  });
  it("Truce of Samhain: no Strike above 2", () => {
    const S = combatState({ board: B("cu", "gae_bolga", "salmon", "emer", "salmon", "salmon"), omens: [[], ["o_truce"]] });
    use(S, 2);
    expect(V(S)).toEqual([3, 1]);
  });
  it("Mist of the druids: P2's hero strikes first in both duels", () => {
    const S = combatState({ board: B("cu", "salmon", "salmon", "emer", "salmon", "salmon"), omens: [["o_mist"], []] });
    expect(actor(S)).toBe(1);
  });
  it("Lugh's protection: only the first Strike against each of your heroes each duel −1", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "morrigan", "thunder", "cet_spear"), omens: [["o_lugh"], []] });
    act(S, { t: "focus", el: null });
    use(S, 8); // 2 + Emer Weakness Fire 1 = 3, −1 = 2
    expect(V(S)).toEqual([1, 3]);
  });
  it("Lugh's protection: second Strike is full", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "morrigan", "cet_spear", "cet_spear"), omens: [["o_lugh"], []] });
    act(S, { t: "focus", el: null });
    use(S, 8); // 2 − 1 = 1
    expect(V(S)[0]).toBe(2);
    use(S, 2); // Emer: Salmon Shield 2
    use(S, 9); // 2 fully, soaked by Shield 2
    expect(V(S)[0]).toBe(2);
    expect(S.combat!.shield[0]).toBe(0);
  });
  it("Emain's ward: your heroes ignore the geis card laid on them (and its Invoke)", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "conchobar", "salmon", "salmon"), geasa: ["g_door", null, null, null], omens: [["o_emain"], []] });
    expect(V(S)).toEqual([3, 3]);
    rest(S);
    expect(options(S).some((o) => o.t === "duel" && o.act === "rest" && o.mode === "normal")).toBe(true);
  });
  it("Blessing of the ford: your Water supports +1 (not the enemy's)", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "conchobar", "salmon", "salmon"), omens: [[], ["o_ford"]] });
    use(S, 8);
    expect(S.combat!.shield[1]).toBe(3);
    use(S, 2);
    expect(S.combat!.shield[0]).toBe(2);
  });
  it("The boyhood deeds: your hero at spot 1 or 7 starts with 4 (not the second duel)", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "conchobar", "salmon", "salmon"), omens: [["o_boyhood"], ["o_boyhood"]] });
    expect(V(S)).toEqual([4, 4]);
    for (let i = 0; i < 4; i++) rest(S);
    expect(S.combat!.duel).toBe(1);
    expect(V(S)).toEqual([3, 3]);
  });
});

describe("geasa", () => {
  const cases: [string, string, string][] = [
    ["g_ford", "salmon", "Water supports"], ["g_hearth", "thunder", "Fire"], ["g_spear", "caladbolg", "Weapons"],
    ["g_silence", "bricriu", "Words"], ["g_hound", "warp", "Feats"],
  ];
  for (const [g, s, what] of cases) {
    it(`${g} forbids ${what}: only 'break' is offered`, () => {
      const S = combatState({ board: B("fergus", s, "host", "morrigan", "salmon", "salmon"), geasa: [g, null, null, null] });
      act(S, { t: "focus", el: null }); rest(S);
      const modes = options(S).filter((o) => o.t === "duel" && o.spot === 1).map((o) => (o as { mode: string }).mode);
      expect(modes).toEqual(["break"]);
      const d = nextDecision(S)!;
      expect(legalityError(S, d.player, { t: "duel", guest: -1, act: "use", spot: 1, mode: "normal" })).toMatch(/forbidden/);
    });
  }
  it("the open door forbids resting (Invoke Hospitality hits Emer at once)", () => {
    const S = combatState({ board: B("conall", "salmon", "salmon", "emer", "salmon", "salmon"), geasa: [null, null, "g_door", null] });
    expect(V(S)).toEqual([3, 1]);
    rest(S); // Conall
    const rests = options(S).filter((o) => o.t === "duel" && o.act === "rest").map((o) => (o as { mode: string }).mode);
    expect(rests).toEqual(["break"]);
  });
  it("breaking costs 2 Valour; a broken geis no longer binds (rest of the match)", () => {
    const S = combatState({ board: B("fergus", "caladbolg", "caladbolg", "morrigan", "salmon", "salmon"), geasa: ["g_spear", null, null, null] });
    act(S, { t: "focus", el: null });
    rest(S);
    use(S, 2, "break"); // Fergus 3 − 2 = 1, then Strike 5
    expect(S.combat!.endValour[0][0]).toBe(1);
    expect(S.combat!.felled[0][1]).toBe(true);
    expect(S.stats!.geisBroken).toBe(1);
  });
  it("a broken geis stays broken for the hero's next support", () => {
    const S = combatState({ board: B("fergus", "salmon", "salmon", "morrigan", "thunder", "salmon"), geasa: ["g_ford", null, null, null] });
    act(S, { t: "focus", el: null });
    rest(S);
    use(S, 2, "break");
    rest(S);
    const modes = options(S).filter((o) => o.t === "duel" && o.spot === 2).map((o) => (o as { mode: string }).mode);
    expect(modes).toEqual(["normal"]);
  });
  it("if breaking fells the hero, the support does not resolve", () => {
    const S = combatState({ board: B("fergus", "caladbolg", "salmon", "morrigan", "cet_spear", "salmon"), geasa: ["g_spear", null, null, null] });
    act(S, { t: "focus", el: null });
    use(S, 8); // Fergus 3 → 1
    use(S, 2, "break"); // 1 − 2 → falls
    expect(S.combat!.felled[0]).toEqual([true, false]);
    expect(S.combat!.endValour[0][1]).toBe(3);
  });
  it("geis break cost lever (1 and 3)", () => {
    for (const [cost, left] of [[1, 2], [3, 0]] as const) {
      const S = combatState({ board: B("fergus", "salmon", "salmon", "morrigan", "salmon", "salmon"), geasa: ["g_ford", null, null, null], rules: { geisBreakCost: cost } });
      act(S, { t: "focus", el: null }); rest(S);
      use(S, 2, "break");
      expect(Math.max(0, S.combat!.duel === 0 ? V(S)[0] : S.combat!.endValour[0][0])).toBe(left);
    }
  });
  it("hound Invokes Hound on Cú Chulainn when laid", () => {
    const S = combatState({ board: B("cu", "salmon", "salmon", "emer", "salmon", "salmon"), geasa: ["g_hound", null, null, null] });
    expect(V(S)[0]).toBe(1);
    expect(S.stats!.invokes).toBe(1);
  });
  it("with no support left, a hero under the open door may rest", () => {
    const S = combatState({ board: ["emer", null, null, ...D2, "conall", "salmon", "salmon", ...D2E], geasa: ["g_door", null, null, null] });
    rest(S); // Conall (3 > 2)
    const rests = options(S).filter((o) => o.t === "duel" && o.act === "rest").map((o) => (o as { mode: string }).mode);
    expect(rests).toEqual(["normal"]);
  });
});

describe("duel order and length", () => {
  it("higher Initiative strikes first; a tie goes to P2; the lever can flip it", () => {
    expect(actor(combatState({ board: B("cu", "salmon", "salmon", "emer", "salmon", "salmon") }))).toBe(0);
    expect(actor(combatState({ board: B("emer", "salmon", "salmon", "cu", "salmon", "salmon") }))).toBe(1);
    expect(actor(combatState({ board: B("emer", "salmon", "salmon", "conchobar", "salmon", "salmon") }))).toBe(1);
    expect(actor(combatState({ board: B("emer", "salmon", "salmon", "conchobar", "salmon", "salmon"), rules: { initTie: "p1" } }))).toBe(0);
  });
  it("each hero gets exactly two turns, alternating", () => {
    const S = combatState({ board: B("cu", "salmon", "salmon", "emer", "salmon", "salmon") });
    const order: number[] = [];
    for (let i = 0; i < 4; i++) { order.push(actor(S)!); rest(S); }
    expect(order).toEqual([0, 1, 0, 1]);
    expect(S.combat!.duel).toBe(1);
    expect(S.stats!.exchanges).toEqual([4]);
  });
  it("a used support cannot be used again", () => {
    const S = combatState({ board: B("cu", "salmon", "thunder", "emer", "salmon", "salmon") });
    use(S, 2); rest(S);
    const spots = options(S).filter((o) => o.t === "duel" && o.act === "use").map((o) => (o as { spot: number }).spot);
    expect(spots).toEqual([2]);
  });
});

describe("guests", () => {
  it("a hero in hand may be discarded once per duel to Heal 1 a hero of the same alignment", () => {
    const S = combatState({ board: B("emer", "salmon", "salmon", "cu", "thunder", "salmon"), hands: [["conall", "medb", "fergus"], []] });
    use(S, 8); // Cú: 2+1+1(Focus Fire)+1(Weakness Fire) = 5 → Emer falls... use Salmon instead
    expect(S.combat!.felled[0][0]).toBe(true);
    const S2 = combatState({ board: B("emer", "salmon", "salmon", "cu", "salmon", "salmon"), hands: [["conall", "medb", "fergus"], []] });
    rest(S2);
    const guests = new Set(options(S2).filter((o) => o.t === "duel" && o.guest >= 0).map((o) => (o as { guest: number }).guest));
    const names = [...guests].map((u) => S2.players[0].hand.find((c) => c.uid === u)!.def.id).sort();
    expect(names).toEqual(["conall", "fergus"]); // Medb (Connachta) is not of Emer's alignment; Fergus (Deorad) is
    const conall = S2.players[0].hand.find((c) => c.def.id === "conall")!.uid;
    act(S2, { t: "duel", guest: conall, act: "rest", mode: "normal" }); // guest +1, Emer rests +1 → 5
    expect(V(S2)[0]).toBe(5);
    expect(S2.players[0].hand.map((c) => c.def.id)).toEqual(["medb", "fergus"]);
    expect(S2.players[0].discard.map((c) => c.def.id)).toEqual(["conall"]);
    expect(S2.stats!.guests).toBe(1);
    rest(S2);
    expect(options(S2).some((o) => o.t === "duel" && o.guest >= 0)).toBe(false); // once per duel
  });
  it("Valour never exceeds 6", () => {
    const S = combatState({ board: B("emer", "brown_bull", "brown_bull", "conchobar", "salmon", "salmon"), hands: [["conall"], []] });
    rest(S);
    use(S, 2); // 3 + 2 + 1 = 6
    rest(S);
    const g = S.players[0].hand[0].uid;
    act(S, { t: "duel", guest: g, act: "use", spot: 2, mode: "normal" });
    expect(S.combat!.endValour[0][0]).toBe(6);
  });
});

describe("winning and tie-breaks", () => {
  const C = (felled: boolean[][], endValour: number[][]): CombatState => ({ felled, endValour } as unknown as CombatState);
  it("more enemy heroes felled wins", () => {
    expect(combatResult(C([[false, true], [false, false]], [[1, 0], [1, 6]]))).toMatchObject({ winner: 0, decidedBy: "felled" });
  });
  it("then more total Valour on standing heroes", () => {
    expect(combatResult(C([[true, true], [false, false]], [[0, 0], [3, 2]]))).toMatchObject({ winner: 0, decidedBy: "valour", valour: [3, 2] });
    expect(combatResult(C([[false, false], [false, false]], [[1, 2], [3, 3]]))).toMatchObject({ winner: 1, decidedBy: "valour" });
  });
  it("then whoever alone stands from the first duel", () => {
    expect(combatResult(C([[true, false], [false, true]], [[0, 2], [2, 0]]))).toMatchObject({ winner: 1, decidedBy: "firstDuel" });
  });
  it("else a draw", () => {
    expect(combatResult(C([[false, false], [false, false]], [[2, 3], [3, 2]]))).toMatchObject({ winner: -1, decidedBy: "draw" });
    expect(combatResult(C([[true, true], [true, true]], [[0, 0], [0, 0]]))).toMatchObject({ winner: -1, decidedBy: "draw" });
  });
  it("a full match produces a result through the engine", () => {
    const S = combatState({ board: B("cu", "gae_bolga", "salmon", "emer", "salmon", "salmon") });
    use(S, 2); // Cú 4 → Emer −1... 3+1 = 4
    for (let i = 0; i < 4; i++) rest(S);
    expect(nextDecision(S)).toBeNull();
    expect(S.result).toMatchObject({ winner: 0, decidedBy: "felled", felled: [0, 1] });
  });
});
