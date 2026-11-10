// The words for the guided game. The game itself is script.json (made by sim/roth/walkgen.ts): the Ulster starter,
// first, against the Connacht starter, both seats played by the computer at Skilled, in duels to the death. A note is
// keyed by the move it follows (0 = the first move). If the rules change and the game plays out differently,
// walkthrough.test.ts fails and these notes need rewriting against a fresh script.

export interface Chapter { at: number; short: string; title: string; body: string[] }

/** Shown before the move with the same index. */
export const CHAPTERS: Chapter[] = [
  {
    at: 0, short: "Drafting", title: "Drafting: building the fights",
    body: [
      "The board is a wheel of twelve spots. Your two quadrants are spots 1–3 and 4–6; the computer's are 7–9 and 10–12. Each quadrant is one **hero** and the **two supports** it keeps beside it at the ford.",
      "Spot 1 fights spot 7 in the **first duel**; spot 4 fights spot 10 in the **second**. Every duel is to the death.",
      "Your placed supports are your hero's own: always there, and usable again at the price on the card. Everything else in your deck waits in the shuffled **Reserve**, and any turn you may draw from it. So place the two cards you most want to rely on.",
    ],
  },
  {
    at: 12, short: "Playing turn", title: "The Playing turn: bending the fights",
    body: [
      "The wheel turns six more steps. Each step you face one enemy spot. Facing a **hero** you may bind it with a **geis**; facing a **support** you may **supplant** it with one of yours. At any step you may instead turn an **omen**, **swear an oath** on one of your own heroes, or **hold**.",
      "Omens you don't turn now can still be turned in the duels, as a turn's action. Geasa and oaths forbid things: a hero may still do a forbidden thing, but **breaking costs 2 Valour first**.",
    ],
  },
  {
    at: 24, short: "Duel 1", title: "The Ford: duel 1, to the death",
    body: [
      "Cú Chulainn: Valour 5, Initiative 5 (the slow hand would cut it by 3, but Emain's ward lets him ignore geasa). Ailill: Valour 5, Shield 3 (the ráth 1 + the shield-wall oath 2), Initiative 3. Cú acts first, then they take turns until one falls.",
      "On a turn: **draw** the top card of your Reserve and play it, or put it aside and do something else; **use** a placed support (the first time free, then at its price); turn an omen, lay a geis or swear an oath from hand; call a **champion**; or **rest**.",
      "Every number on a support can grow: **+1 kinship**, **+1 Focus**, **+1 the wheel**, **+1 weakness**, then the hero's quality, oaths and omens. The grey box under each move shows all of it.",
    ],
  },
  {
    at: 50, short: "Duel 2", title: "The Ford: duel 2",
    body: [
      "Lóegaire, standing in for Cú Chulainn, fell: Ulster has lost a hero. Conall Cernach (Valour 5, Shield 1 from Brigid's mantle) meets Medb (Valour 4, Shield 1 from the ráth). Medb has the higher Initiative and acts first.",
      "Conall is the **avenger**: in the second duel, with his first hero fallen, every Strike of his is +1.",
    ],
  },
  {
    at: 70, short: "Final duel", title: "The final duel",
    body: [
      "One hero fallen on each side, so the **survivors** meet: Conall Cernach, with the 5 Valour he kept, against Ailill with his 7. Wounds carry over; the supports beside each of them are the same as before, with what they have already been used for.",
      "This duel decides the match.",
    ],
  },
];

/** What a strong player was thinking, after a move (not every move has a note). */
export const COACH: Record<number, string> = {
  0: "Cú Chulainn goes to the first duel. Initiative 5 means he nearly always acts first, and his ríastrad adds +1 to every Strike.",
  1: "Ailill: Valour 5, and his Heals are +1. In a long duel a healer is hard to wear down.",
  2: "The Brown Bull: a big Heal for Cú. In a duel to the death you want something to come back with, not just blows.",
  4: "Thunder feat: Strike 3 that ignores Shield, Fire like Cú's Focus. A Feat can be used again after a rest.",
  6: "Conall Cernach takes the second duel: Valour 5, +1 against big heroes, and +1 more if his first hero has fallen.",
  7: "Medb: kinship gives her +2, not +1. Every Connacht card hits harder (and heals more) in her hands.",
  8: "Gáe Bolga for Conall: Strike 2, ignores Shield. A Weapon: it can be used again any time, just not two turns running.",
  10: "Láeg: Heal 1, and the next Strike +1.",
  12: "Brigid's mantle on Conall: Shield 1 at the start of his duel.",
  13: "The slow hand on Cú: no Wind, Initiative −3. That would let Ailill act first.",
  14: "Emain's ward: your heroes ignore geasa. The slow hand is gone before it ever bites.",
  16: "Supplant Fráech's spear (Strike 2 + Shield 1) with your Salmon leap. Ailill loses a good card and gets a Feat in its place.",
  17: "The computer answers in kind: Medb's war-chariot replaces Thunder feat in Cú's quadrant. It's a Connacht card: **unwilling** in an Ulster hand.",
  19: "Ailill swears the **shield-wall**: Shield 2 at the start of each duel, but no Feats. Your Salmon leap in his quadrant is now a Feat he can use only by breaking his vow.",
  20: "Champion's oath on Conall: Strikes +1. The vow: never rest. Conall plans to hit every turn anyway.",
  21: "The hero's light on Medb: her Strikes +1.",
  24: "Cú opens by healing to 7, the most he can have (Emer, a hero still in hand, heals 1 as a **guest** first). Ailill sits behind 3 Shield: better to be sturdy than to strike into it.",
  27: "Ailill draws a Spear and puts it aside: he would rather turn the **Truce of Samhain**, an omen still face down. No Strike above 3, for everyone: a wall against Cú's big blows.",
  29: "Cú puts the warp-spasm aside (with the Truce it would be just 3, soaked by the Shield)…",
  30: "…and **casts out** the unwilling war-chariot. In a duel to the death a support that won't serve you goes back to its owner, and you draw in its place.",
  31: "The Sling, off the Reserve, takes all 3 of Ailill's Shield. Drawn cards are used once and then go to the discards.",
  34: "Caladbolg: Strike 3, +1 kinship (an exile's sword is kin to Connacht), capped at 3 by the Truce. Cú is down to 4.",
  36: "Lóegaire Búadach, a champion, comes off the Reserve. Kept in hand, he can be called next turn.",
  37: "Lóegaire stands in for Cú at full Valour 4. Wounds already dealt still count, and if he falls, Cú has fallen.",
  40: "Ailill breaks his oath (−2 Valour) to raise Shield with your Salmon leap: Fergus heals him first as a guest, and his quality makes it 2.",
  45: "The host of Cruachan off the Reserve: a Strike (Culann's hound takes 1 off the first) and a Heal. Ailill climbs to 7.",
  48: "A rest: it readies the Brown Bull again (a Heal needs a rest before it can be used again).",
  49: "Caladbolg again (a Weapon, not used last turn), and Lóegaire falls. Ulster has lost its first hero.",
  50: "Medb breaks the giant's portion (no Allies) to use Finnbennach: Heal 2, +2 kinship, +1 Focus. 4 − 2 + 5, capped at 6.",
  53: "Gáe Bolga goes through her Shield. Weakness, Focus, kinship, the avenger and the oath would make it 7; the Truce makes it 3.",
  57: "Ochain off the Reserve: Shield 4. Conall can take a blow now.",
  59: "Medb swears the Oath on the stone mid-duel: Valour +1 and Shield 1 at once.",
  61: "Thunder feat, drawn: through Shield, Medb to 1.",
  64: "Medb is about to fall, so Lóch Mór stands in for her. A fresh 4 Valour, but whoever falls now, Medb has fallen.",
  67: "Lóch's spear is soaked by the Shield Ochain gave.",
  69: "The Sling fells Lóch. One hero each: a **final duel**.",
  72: "Láeg heals Conall to 7, and his next Strike will be +1.",
  73: "Ailill rests. With his Heals +1, a rest can be worth it to a healer, but here it gives Conall a free turn.",
  75: "The warp-spasm: Strike 4, and Ailill is weak to Fire. The Truce holds it to 3; the Shield takes 1.",
  78: "Ferdiad heals Ailill as a guest, then Caladbolg strikes.",
  80: "Conall puts the Blood-oath aside: he already has an oath, and a hero can hold only one.",
  81: "Gáe Bolga again: a Weapon, last used in the second duel. Ailill to 4.",
  84: "Nad Crantail stands in for Ailill: a fresh 4 Valour and a first Strike +1.",
  86: "Thunder feat through Nad Crantail's guard: he's on 1.",
  87: "Caladbolg answers: Conall to 3.",
  88: "Gáe Bolga for the last blow. Connacht has lost two heroes, Ulster one.",
};

export const ENDING: string[] = [
  "Ulster wins: **two heroes felled to one**. Lóegaire (for Cú) fell in the first duel; Lóch (for Medb) in the second; and Nad Crantail (for Ailill) in the final duel.",
  "What made the difference: Conall's Gáe Bolga and Thunder feat **ignore Shield**, against Connacht's Shields (the ráth, the shield-wall). And the Champion's oath gave him +1 on every blow, in a fight long enough for that to add up.",
  "Things to try in your own games: place the two supports you'll want again and again; treat the Reserve as a second hand (it holds your champions and guests too); and watch the enemy's vows: a supplanted card can make it break one.",
];
