// Setup, muster, drafting and the playing turn.
import { describe, expect, it } from "vitest";
import { ALL_DEFS, CONNACHT, DECKS, DECK_IDS, deckErrors, defsFromIds, ULSTER } from "../cards";
import {
  applyDecision, facedSpot, isHeroSpot, legalityError, newMatch, nextDecision, observe, playOut,
  type Decision, type Side, type State,
} from "../engine";
import { NovicePolicy } from "../ai";
import { Rng } from "../rng";
import { card } from "./helpers";

const nov = new NovicePolicy();
/** Drive the match with random choices until `stop` says so. */
function runUntil(S: State, stop: (S: State, d: Decision) => boolean, seed = 1): Decision | null {
  const rng = new Rng(seed);
  for (;;) {
    const d = nextDecision(S);
    if (!d || stop(S, d)) return d;
    applyDecision(S, d, nov.choose(S, d, rng));
  }
}
const replace = (ids: string[], from: string, to: string) => { const a = ids.slice(); a[a.indexOf(from)] = to; return a; };

const ULSTER_IDS = DECK_IDS.ulster;
describe("deck building", () => {
  it("the five faction decks are legal 24-card decks", () => {
    for (const [k, d] of Object.entries(DECKS)) expect([k, deckErrors(d)]).toEqual([k, []]);
  });
  it("rejects wrong size, too many copies, and more than two hero alignments", () => {
    expect(deckErrors(ULSTER.slice(1))).toContain("deck has 23 cards, needs 24");
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "salmon", "thunder"))).join()).toMatch(/thunder x3/);
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "o_culann", "o_boyhood"))).join()).toMatch(/o_boyhood x2/);
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "emer", "cu"))).join()).toMatch(/cu x2/);
    const three = replace(replace(ULSTER_IDS, "emer", "medb"), "conall", "morrigan");
    expect(deckErrors(defsFromIds(three)).join()).toMatch(/alignments/);
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "o_culann", "g_hound"))).join()).toMatch(/omens 3/);
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "o_culann", "v_stone"))).join()).toMatch(/oaths 4|omens 3/);
  });
  it("rarity: commons ×2, rares and legendaries ×1, at most 2 legendaries", () => {
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "salmon", "warp"))).join()).toMatch(/warp x2 \(max 1\)/);
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "salmon", "spear_assal"))).join()).toMatch(/legendaries 3/);
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "sling", "salmon")))).toEqual([]);
  });
  it("a Deorad hero counts as one of your alignments", () => {
    expect(deckErrors(defsFromIds(replace(ULSTER_IDS, "emer", "fergus")))).toEqual([]);
    expect(deckErrors(defsFromIds(replace(replace(ULSTER_IDS, "emer", "fergus"), "conall", "ailill")))).toEqual([]);
  });
});

describe("muster", () => {
  it("every seed: hand 12 with ≥2 heroes and ≥4 supports, 4 omens in the Omen spots, no card lost", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const S = newMatch(seed % 2 ? [ULSTER, CONNACHT] : [CONNACHT, CONNACHT], {}, seed);
      runUntil(S, (s) => s.phase !== "muster", seed);
      for (const P of S.players) {
        expect(P.hand.length).toBe(12);
        expect(P.hand.some((c) => c.def.type === "omen")).toBe(false);
        expect(P.hand.filter((c) => c.def.type === "hero").length).toBeGreaterThanOrEqual(2);
        expect(P.hand.filter((c) => c.def.type === "support").length).toBeGreaterThanOrEqual(4);
        expect(P.omens.length).toBe(4);
        expect(P.omens.every((o) => o.card.def.type === "omen" && !o.faceUp)).toBe(true);
        expect(P.deck.length).toBe(0);
        expect(P.hand.length + P.reserve.length + P.omens.length).toBe(24);
      }
    }
  });
  it("3 Omen spots lever", () => {
    const S = newMatch([ULSTER, CONNACHT], { omenSpots: 3 }, 5);
    runUntil(S, (s) => s.phase !== "muster");
    expect(S.players.map((P) => P.omens.length)).toEqual([3, 3]);
  });
  it("a fifth Omen asks which to keep", () => {
    const deck = defsFromIds([...ULSTER_IDS.filter((x) => !x.startsWith("o_")), "o_boyhood", "o_lugh", "o_emain", "o_crow", "o_mist", "o_truce"]).slice(2);
    expect(deck.length).toBe(24);
    const S = newMatch([deck, CONNACHT], {}, 1);
    const omens = deck.filter((d) => d.type === "omen").map((def) => card(def.id, 0));
    const rest = S.players[0].deck.filter((c) => c.def.type !== "omen");
    S.players[0].deck = [...omens.slice(0, 4), omens[4], ...rest.slice(0, 3), omens[5], ...rest.slice(3)];
    const d = nextDecision(S)!;
    expect(d.kind).toBe("musterOmen");
    expect(d.options.length).toBe(5);
    const keepOut = omens[0].uid;
    applyDecision(S, d, d.options.findIndex((o) => (o as { uid: number }).uid === keepOut));
    expect(S.players[0].omens.map((o) => o.card.def.id)).toEqual(["o_mist", "o_lugh", "o_emain", "o_crow"]);
    expect(S.players[0].reserve.map((c) => c.def.id)).toContain("o_boyhood");
  });
  it("muster check fetches missing heroes and returns the same number (never a needed card)", () => {
    const S = newMatch([ULSTER, CONNACHT], {}, 1);
    const P = S.players[0];
    const nonHero = P.deck.filter((c) => c.def.type !== "hero");
    const heroes = P.deck.filter((c) => c.def.type === "hero");
    P.deck = [...nonHero, ...heroes]; // 20 non-heroes first: the hand fills with no hero
    const d = runUntil(S, (_s, d) => d.kind === "musterReturn")!;
    expect(P.hand.length).toBe(14);
    expect(P.hand.filter((c) => c.def.type === "hero").length).toBe(2);
    for (const o of d.options) expect(P.hand.find((c) => c.uid === (o as { uid: number }).uid)!.def.type).not.toBe("hero");
    expect(legalityError(S, 0, { t: "musterReturn", uid: P.hand.find((c) => c.def.type === "hero")!.uid })).toMatch(/guarantee/);
    applyDecision(S, d, 0);
    const d2 = nextDecision(S)!;
    expect(d2.kind).toBe("musterReturn");
    applyDecision(S, d2, 0);
    expect(P.hand.length).toBe(12);
  });
});

describe("drafting", () => {
  it("6 steps, P1 then P2; hero spots take heroes only, others supports only", () => {
    const S = newMatch([ULSTER, CONNACHT], {}, 3);
    const seen: [Side, number][] = [];
    runUntil(S, (s, d) => {
      if (s.phase !== "draft") return s.phase === "play";
      seen.push([d.player, d.spot!]);
      const P = s.players[d.player];
      for (const o of d.options) {
        const c = P.hand.find((x) => x.uid === (o as { uid: number }).uid)!;
        expect(c.def.type).toBe(isHeroSpot(d.spot!) ? "hero" : "support");
      }
      const wrong = P.hand.find((c) => c.def.type === (isHeroSpot(d.spot!) ? "support" : "hero"))!;
      if (wrong) expect(legalityError(s, d.player, { t: "place", uid: wrong.uid })).toMatch(/wrong card type/);
      return false;
    });
    expect(seen).toEqual([[0, 0], [1, 6], [0, 1], [1, 7], [0, 2], [1, 8], [0, 3], [1, 9], [0, 4], [1, 10], [0, 5], [1, 11]]);
    S.board.forEach((c, i) => expect(c!.def.type).toBe(isHeroSpot(i) ? "hero" : "support"));
    S.board.forEach((c, i) => expect(c!.owner).toBe(i < 6 ? 0 : 1));
  });
  it("wheel cards are public: P2 sees P1's step-1 hero before choosing", () => {
    const S = newMatch([ULSTER, CONNACHT], {}, 4);
    const d = runUntil(S, (s) => s.phase === "draft" && s.sub === 1)!;
    expect(d.spot).toBe(6);
    expect(observe(S, 1).board[0]!.def.type).toBe("hero");
    expect(observe(S, 1).players[0].hand.every((c) => c.def.type === "unknown")).toBe(true);
  });
  it("blind-heroes lever: P2 cannot see P1's step-1 and step-4 heroes until both are placed", () => {
    const S = newMatch([ULSTER, CONNACHT], { blindHeroes: true }, 4);
    runUntil(S, (s) => s.phase === "draft" && s.sub === 1);
    expect(observe(S, 1).board[0]!.def.type).toBe("unknown");
    runUntil(S, (s) => s.phase === "draft" && s.step === 2);
    expect(observe(S, 1).board[0]!.def.type).toBe("hero");
    runUntil(S, (s) => s.phase === "draft" && s.step === 4 && s.sub === 1);
    expect(observe(S, 1).board[3]!.def.type).toBe("unknown");
    expect(observe(S, 0).board[3]!.def.type).toBe("hero");
  });
});

describe("playing turn", () => {
  const toPlay = (seed = 7, rules = {}) => { const S = newMatch([ULSTER, CONNACHT], rules, seed); runUntil(S, (s) => s.phase === "play", seed); return S; };
  it("P1 faces 7–12 in order, P2 faces 1–6", () => {
    const S = toPlay();
    const faced: number[][] = [[], []];
    const rng = new Rng(1);
    while (S.phase === "play") {
      const d = nextDecision(S)!;
      faced[d.player].push(d.spot!);
      expect(d.spot).toBe(facedSpot(S.step, d.player));
      const hold = d.options.findIndex((o) => o.t === "hold");
      applyDecision(S, d, rng.next() < 0.5 ? hold : 0);
    }
    expect(faced).toEqual([[6, 7, 8, 9, 10, 11], [0, 1, 2, 3, 4, 5]]);
  });
  it("hero spots offer Omen / Bind / Hold; support spots offer Omen / Supplant / Hold", () => {
    const S = toPlay();
    for (let k = 0; k < 12; k++) {
      const d = nextDecision(S)!;
      const kinds = new Set(d.options.map((o) => o.t));
      if (isHeroSpot(d.spot!)) expect(kinds.has("supplant")).toBe(false);
      else expect(kinds.has("bind")).toBe(false);
      expect(kinds.has("hold")).toBe(true);
      const P = S.players[d.player];
      const g = P.hand.find((c) => c.def.type === "geis");
      const s = P.hand.find((c) => c.def.type === "support");
      if (isHeroSpot(d.spot!) && s) expect(legalityError(S, d.player, { t: "supplant", uid: s.uid })).toMatch(/support spot/);
      if (!isHeroSpot(d.spot!) && g) expect(legalityError(S, d.player, { t: "bind", uid: g.uid })).toMatch(/hero spot/);
      if (!isHeroSpot(d.spot!) && g) expect(legalityError(S, d.player, { t: "supplant", uid: g.uid })).toMatch(/needs a support/);
      applyDecision(S, d, d.options.length - 1);
    }
  });
  it("Bind lays a geis on the hero's quadrant; Supplant swaps and discards", () => {
    const S = toPlay(11);
    let d = nextDecision(S)!; // P1 faces 7
    const b = d.options.findIndex((o) => o.t === "bind");
    expect(b).toBeGreaterThanOrEqual(0);
    const g = (d.options[b] as { uid: number }).uid;
    applyDecision(S, d, b);
    expect(S.quadGeis[2]!.uid).toBe(g);
    expect(S.players[0].hand.some((c) => c.uid === g)).toBe(false);
    d = nextDecision(S)!; applyDecision(S, d, d.options.length - 1); // P2 holds
    d = nextDecision(S)!; // P1 faces 8
    const sI = d.options.findIndex((o) => o.t === "supplant");
    const mine = (d.options[sI] as { uid: number }).uid;
    const theirs = S.board[7]!;
    applyDecision(S, d, sI);
    expect(S.board[7]!.uid).toBe(mine);
    expect(S.board[7]!.owner).toBe(0);
    expect(S.players[1].discard).toContain(theirs);
  });
  it("Turn an Omen flips it face up; omens still face down after step 6 are lost", () => {
    const S = toPlay(12);
    const d = nextDecision(S)!;
    const o = d.options.findIndex((x) => x.t === "omen");
    applyDecision(S, d, o);
    expect(S.players[0].omens.filter((x) => x.faceUp).length).toBe(1);
    expect(legalityError(S, 1, { t: "omen", uid: S.players[0].omens[0].card.uid })).toMatch(/no such/);
    while (S.phase === "play") { const e = nextDecision(S)!; applyDecision(S, e, e.options.length - 1); }
    expect(S.phase).toBe("combat");
    expect(S.players[0].omens.length).toBe(1);
    expect(S.players[0].lost.length).toBe(3);
    expect(S.players[1].omens.length).toBe(0);
  });
  it("keep-omens lever: unturned omens may be turned before combat", () => {
    const S = toPlay(12, { keepOmensUntilCombat: true });
    while (S.phase === "play") { const e = nextDecision(S)!; applyDecision(S, e, e.options.length - 1); }
    const d = nextDecision(S)!;
    expect(d.kind).toBe("late");
    expect(d.options.length).toBe(5);
    applyDecision(S, d, 0);
    applyDecision(S, nextDecision(S)!, 3); // lateDone for P1
    const d2 = nextDecision(S)!;
    expect(d2.player).toBe(1);
    applyDecision(S, d2, 4);
    expect(S.phase).toBe("combat");
    expect(S.players.map((P) => P.omens.length)).toEqual([1, 0]);
  });
  it("Swear lays an oath from hand on one of your own unsworn heroes, at any step", () => {
    const S = toPlay(11);
    const d = nextDecision(S)!; // P1 faces 7
    const sw = d.options.filter((o) => o.t === "swear") as { t: "swear"; uid: number; spot: number }[];
    expect(sw.length).toBeGreaterThan(0);
    expect(new Set(sw.map((o) => o.spot))).toEqual(new Set([0, 3]));
    expect(legalityError(S, 0, { t: "swear", uid: sw[0].uid, spot: 6 })).toMatch(/own hero/);
    const g = S.players[0].hand.find((c) => c.def.type === "geis");
    if (g) expect(legalityError(S, 0, { t: "swear", uid: g.uid, spot: 0 })).toMatch(/oath in hand/);
    applyDecision(S, d, d.options.indexOf(sw[0]));
    expect(S.quadOath[0]?.uid ?? S.quadOath[1]?.uid).toBe(sw[0].uid);
    const e = nextDecision(S)!; applyDecision(S, e, e.options.length - 1); // P2 holds
    const f = nextDecision(S)!;
    const again = f.options.filter((o) => o.t === "swear") as { spot: number }[];
    expect(again.every((o) => o.spot !== sw[0].spot)).toBe(true); // one oath per hero
  });
  it("whole random matches finish with a result, and the engine is deterministic per seed", () => {
    const r1 = playOut(newMatch([ULSTER, CONNACHT], {}, 99), [nov, nov], [new Rng(1), new Rng(2)]);
    const r2 = playOut(newMatch([ULSTER, CONNACHT], {}, 99), [nov, nov], [new Rng(1), new Rng(2)]);
    expect(r1).toEqual(r2);
    expect(ALL_DEFS.cu.type).toBe("hero");
  });
});
