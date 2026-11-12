// Settings: where the duels are fought (duels to the death). The second player chooses one after the decks are
// chosen, before the Muster, in place of the flat +3 Valour of the ford.
import type { CardDef, SupportDef, SupportElement, Kind } from "./cards";

export interface SettingDef {
  id: string;
  name: string;
  /** Valour every fighter gets at the start of each duel (the ford's +3). */
  valour: number;
  /** Shield every fighter starts each duel with. */
  shield?: number;
  /** +n (or −n) to the first effect of a support of this element / kind. */
  el?: Partial<Record<SupportElement, number>>;
  kind?: Partial<Record<Kind, number>>;
  /** +n to every Heal. */
  heal?: number;
  /** A fighter that rests also heals this much. */
  restHeal?: number;
  /** The Aos Sídhe's mound soaks this much in all, instead of 5. */
  mound?: number;
  text: string;
}

export const SETTINGS: SettingDef[] = [
  { id: "ford", name: "The ford", valour: 3, text: "Valour +3." },
  { id: "tower", name: "Conand's tower", valour: 2, shield: 1, text: "Valour +2; every fighter starts each duel with Shield 1." },
  { id: "bog", name: "The Bog of Allen", valour: 3, el: { Earth: 1, Wind: -1 }, restHeal: 1, text: "Valour +3; Earth +1, Wind −1; a fighter that rests heals 1." },
  { id: "crossing", name: "The western crossing", valour: 3, el: { Spirit: 1 }, heal: -1, text: "Valour +3; Spirit +1; Heals −1." },
  { id: "brugh", name: "Brú na Bóinne", valour: 3, kind: { Word: 1 }, mound: 7, text: "Valour +3; Words +1; the mound soaks 7 in all." },
  { id: "loughs", name: "The loughs", valour: 3, el: { Water: 1, Fire: -1 }, text: "Valour +3; Water +1, Fire −1." },
  { id: "emain", name: "Emain Macha", valour: 3, kind: { Feat: 1 }, text: "Valour +3; Feats +1." },
  { id: "cruachan", name: "Cruachan", valour: 3, heal: 1, text: "Valour +3; Heals +1." },
];
export const settingDef = (id?: string) => SETTINGS.find((s) => s.id === id);

/** What a setting adds to a support's first effect. */
export function settingMod(set: SettingDef | undefined, s: SupportDef): number {
  if (!set) return 0;
  return (s.element ? set.el?.[s.element] ?? 0 : 0) + (s.kind ? set.kind?.[s.kind] ?? 0 : 0);
}

/** How well a setting suits a deck, roughly in Valour a match: its supports' bonuses, its Heals, its mound. */
function fit(set: SettingDef, deck: CardDef[]): number {
  let v = 0;
  for (const c of deck) {
    if (c.type === "support") {
      v += 1.2 * settingMod(set, c);
      if (set.heal && c.effects.some((e) => e.type === "heal")) v += 1.2 * set.heal;
    }
  }
  if (set.mound && deck.some((c) => c.type === "hero" && c.alignment === "Sidhe")) v += set.mound - 5;
  return v;
}

/** The second player's choice: the setting that suits its deck best against the first player's (the ford on a tie). */
export function chooseSetting(mine: CardDef[], theirs: CardDef[]): string {
  let best = "ford", bv = 0;
  for (const set of SETTINGS) {
    const v = fit(set, mine) - fit(set, theirs);
    if (v > bv + 1e-9) { bv = v; best = set.id; }
  }
  return best;
}
