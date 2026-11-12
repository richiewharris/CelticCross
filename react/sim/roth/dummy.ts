// Target dummies: neutral benchmark opponents with no strengths and no weaknesses, so a people can be scored on its
// own. Every number here is a parameter (the shape is fixed; change values, not code):
//
//   dummy_post   the practice post: average heroes that never strike, rest, heal or block. It measures pure offence:
//                how fast a people fells an average hero (turns, damage per turn), with nothing hitting back.
//   dummy_spar   the sparring partner: the field's average deck with every people's colour taken out: four heroes of
//                average Valour and Initiative, no Focus, no weakness, no people, no powers; plain Strikes, Heals and a
//                Block of the field's average size; no champions, geasa, oaths or omens. It measures a people against
//                an average opponent that does hit back.
//
// The averages come from the six starter decks (4 heroes, Valour 4.6 and Initiative 3 on average; 9 supports: about
// 6.5 Strikes of 1.8, 1.7 Heals of 1.5, 1 Block of 2.4). Register them with registerDummies() and play them like any
// deck (balance.ts --against dummy_post); the post is played by PostPolicy.
import { DECKS, type CardDef, type Effect, type HeroDef, type SupportDef } from "../../src/games/roth/engine/cards";
import type { Decision, Policy, State } from "../../src/games/roth/engine/engine";
import type { Rng } from "../../src/games/roth/engine/rng";

export const DUMMY = {
  /** Heroes' printed Valour (one hero each) and Initiative. */
  valour: [5, 5, 4, 4],
  init: 3,
  /** The sparring partner's supports: [effect, size, how many]. */
  spar: [["strike", 2, 4], ["strike", 1, 2], ["heal", 2, 1], ["heal", 1, 1], ["block", 2, 1]] as [string, number, number][],
  /** The post's supports: this many Strike 0 (it must have something to do on its turn other than rest). */
  postSupports: 9,
};

const hero = (id: string, valour: number, init: number): HeroDef => ({
  type: "hero", id, name: `Dummy ${id.slice(-1)}`, alignment: "None", rarity: "common", valour, init,
  focus: null, weakness: null, quality: "No strengths, no weaknesses", tag: null, ab: {},
});
const sup = (id: string, name: string, effects: Effect[], extra: Partial<SupportDef> = {}): SupportDef => ({
  type: "support", id, name, element: null, kind: null, alignment: "Unaligned", rarity: "common", effects, text: name, ...extra,
});

export function dummyDeck(which: "post" | "spar", D = DUMMY): CardDef[] {
  const deck: CardDef[] = D.valour.map((v, i) => hero(`dummy_${which}_${i + 1}`, v, D.init));
  if (which === "post") {
    for (let i = 0; i < D.postSupports; i++) deck.push(sup(`dummy_idle_${i}`, "Idle swing", [{ type: "strike", n: 0 }]));
    return deck;
  }
  let k = 0;
  for (const [t, n, count] of D.spar) for (let i = 0; i < count; i++) {
    k++;
    if (t === "block") deck.push(sup(`dummy_block${n}_${k}`, `Plain block ${n}`, [{ type: "shield", n }], { use: "reaction" }));
    else deck.push(sup(`dummy_${t}${n}_${k}`, `Plain ${t} ${n}`, [{ type: t as Effect["type"], n }]));
  }
  return deck;
}

/** The dummies' numbers for this process: DUMMY, with any values from the ROTH_DUMMY environment variable (JSON, e.g.
 *  {"valour":[6,6,5,5]}); balance.ts --dummy sets it for its workers and records it in the cube run. */
export function dummyParams(): typeof DUMMY {
  return { ...DUMMY, ...(process.env.ROTH_DUMMY ? JSON.parse(process.env.ROTH_DUMMY) : {}) };
}
export function registerDummies() {
  const D = dummyParams();
  DECKS.dummy_post = dummyDeck("post", D);
  DECKS.dummy_spar = dummyDeck("spar", D);
}
export const isDummy = (deck: string) => deck.startsWith("dummy_");

/** The post: plays its Muster and placement like Skilled (so the board forms normally), but in a duel it only ever
 *  swings its idle Strike 0, never rests, heals or blocks. */
export class PostPolicy implements Policy {
  name = "Post";
  constructor(private base: Policy) {}
  choose(V: State, d: Decision, rng: Rng): number {
    if (d.options.length === 1) return 0;
    const find = (p: (o: Record<string, unknown>) => boolean) => d.options.findIndex((o) => p(o as unknown as Record<string, unknown>));
    if (d.kind === "duel") {
      const i = find((o) => o.t === "duel" && o.act === "use" && !((o.guest as number) >= 0));
      if (i >= 0) return i;
      const j = find((o) => o.t === "draw");
      if (j >= 0) return j;
    }
    if (d.kind === "drawn") { const i = find((o) => o.how === "keep"); if (i >= 0) return i; }
    if (d.kind === "block") { const i = find((o) => (o.spot as number) < 0); if (i >= 0) return i; }
    return this.base.choose(V, d, rng);
  }
}
