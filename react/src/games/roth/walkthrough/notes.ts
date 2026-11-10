// The words for the guided game. The game itself is script.json (made by sim/roth/walkgen.ts): the Ulster starter,
// first, against the Connacht starter, both seats played by the computer at Skilled, in duels to the death. A note is
// keyed by the move it follows (0 = the first move after the Muster). If the rules change and the game plays out
// differently, walkthrough.test.ts fails and these notes need rewriting against a fresh script.

export interface Chapter { at: number; short: string; title: string; body: string[] }

/** Shown before the move with the same index. */
export const CHAPTERS: Chapter[] = [
  {
    at: 0, short: "Drafting", title: "Drafting: building the fights",
    body: [
      "The board is a wheel of twelve spots. Your two quadrants are spots 1–3 and 4–6; the computer's are 7–9 and 10–12. Each quadrant is one **hero** and the **two supports** it keeps beside it at the ford.",
      "Spot 1 fights spot 7 in the **first duel**; spot 4 fights spot 10 in the **second**. Every duel is to the death.",
      "Your placed supports are your hero's own. Most are **actions**, used on your turn and again at the price on the card. A **Reaction** card (a Block) waits for the enemy's blow; a **Passive** card gives **Armour** just by being there. Everything else waits in the shuffled **Reserve**, to be drawn in the duels.",
    ],
  },
  {
    at: 12, short: "Playing turn", title: "The Playing turn: bending the fights",
    body: [
      "The wheel turns six more steps. Each step you face one enemy spot. Facing a **hero** you may bind it with a **geis**; facing a **support** you may **supplant** it with one of yours. At any step you may instead turn an **omen**, **swear an oath** on one of your own heroes, or **hold**.",
      "Geasa and oaths forbid things: a hero may still do a forbidden thing, but **breaking costs 2 Valour first**, and once broken the vow is gone for that duel.",
    ],
  },
  {
    at: 24, short: "Duel 1", title: "The Ford: duel 1, to the death",
    body: [
      "Every fighter enters the ford with its Valour **+3**. Cú Chulainn: Valour 8, Initiative 5 (the hound geis would forbid his Feats, but Emain's ward lets your heroes ignore geasa). Ailill: Valour 8, Shield 1 from the ráth. Cú acts first, then they take turns until one falls.",
      "On a turn: **draw** from your Reserve (play it, or put it aside and do something else); **use** a placed support; turn an omen or play a card from hand; call a **champion**; or **rest**. A rest **braces**: Shield 1, and your next Shield, Heal or Block is +1.",
      "When the enemy strikes, you may **Block** with a Reaction card beside your hero. There is no cap on healing; and after 20 turns a duel **wears both down**, 1 Valour a turn.",
    ],
  },
  {
    at: 49, short: "Duel 2", title: "The Ford: duel 2",
    body: [
      "Ailill has fallen: Connacht has lost a hero. Conall Cernach (Valour 8, Shield 1 from Brigid's mantle, sworn to the **Blood-oath**: Strikes +2, but no Heals and never rest) meets Ferdiad.",
      "Ferdiad: Valour 6 (8, less 2 for the giant's portion), Shield 3 (the shield-wall oath 2 and the ráth 1), and **Armour 1** from his horn-skin: every Strike against him is 1 less, all duel. The Truce of Samhain still holds every blow to 3.",
    ],
  },
  {
    at: 95, short: "Final duel", title: "The final duel",
    body: [
      "One hero fallen each, so the **survivors** meet: Fiacha, still standing in for Cú Chulainn, with the 8 Valour he kept from the first duel, against Lóch Mór, standing in for Ferdiad, with 1. The supports beside each are the same as before.",
      "This duel decides the match.",
    ],
  },
];

/** What a strong player was thinking, after a move (not every move has a note). */
export const COACH: Record<number, string> = {
  0: "Cú Chulainn goes to the first duel. Initiative 5 means he nearly always acts first, and his ríastrad adds +1 to every Strike.",
  1: "Ailill: his Heals are +1. With no cap on healing, a healer is hard to wear down.",
  2: "Salmon leap is a **Reaction** card: you don't use it on your turn. When the enemy strikes, you tap it to **Block 2**, more after a rest.",
  4: "Thunder feat: Strike 3 that ignores Shield, and so Armour and Blocks too.",
  6: "Conall Cernach takes the second duel: +1 against big heroes.",
  8: "The Brown Bull: Heal 2. At the ford a Heal can lift a hero above where it started, and right after a rest it is +1.",
  12: "The **Blood-oath** on Conall: his Strikes +2, but the vow forbids Heals and rests, and he holds a Heal beside him. He'll have to choose when to break it.",
  13: "Geis of the hound on Cú: no Feats, and he loses 2 Valour (the hound is his tag).",
  14: "Emain's ward: your heroes ignore geasa. The hound geis is gone before it bites.",
  17: "The computer supplants Thunder feat with Finnbennach: a Connacht card, **unwilling** in an Ulster hand.",
  18: "Geis of the giant's portion on Ferdiad: no Allies, and a hero of Valour 5 or more starts his duel 2 lower.",
  21: "The hero's light: Ferdiad's Strikes +1.",
  23: "And the warp-spasm beside Conall becomes the host of Cruachan: another unwilling card.",
  24: "Cú casts out the unwilling bull: it goes back to Connacht's discards, and he draws in its place (Emer heals 1 first, as a **guest**).",
  25: "The Sling, from the Reserve: 2 +1 kinship +1 ríastrad, and the ráth's Shield soaks 1. Ailill 8 → 4.",
  29: "Ailill strikes with Fráech's spear, and you **Block** with Salmon leap: 2 off the blow. Cú takes 2, not 4. The spear's Shield 1 still goes to Ailill.",
  32: "Fiacha stands in for Cú at a fresh 8. Wounds already dealt still count, and if Fiacha falls, Cú has fallen.",
  35: "The **Truce of Samhain**: no Strike above 3, for everyone. From here every blow is small, and defence counts for more.",
  37: "Ochain off the Reserve: a **Passive** card. Played from the Reserve it puts on **Armour 1**, every Strike against Fiacha 1 less for the rest of the duel; placed beside a hero it would give that Armour from the start.",
  40: "Ailill heals first (Fergus as a guest, +1 his quality): 4 → 6.",
  41: "Then Fedelm's prophecy: 3, less 2 for the Block (Salmon leap is ready again: you have had a turn since), less 1 for the Armour. Nothing gets through.",
  43: "Gáe Bolga ignores Shield: Ailill 6 → 3.",
  46: "Ailill rests: Shield 1, and his next Shield or Heal +1. A brace, while he waits for a Heal.",
  48: "Thunder feat ignores Shield, Armour and Blocks: Ailill falls. Connacht has lost its first hero.",
  49: "Conall casts out the unwilling host, and puts the Láeg he draws aside for later.",
  51: "Conall breaks his Blood-oath (−2) to heal with the Bull: Conchobar heals 1 first as a guest, then 3. 8 → 10: above where he started.",
  55: "The vow is broken now, so Conall may rest freely: Shield 1, and the Bull's next Heal +1.",
  58: "The Bull again (its price: the top card of your Reserve), and +1 for the rest: Heal 4. 6 → 10.",
  60: "The rhythm of this duel: rest, then heal, while Ferdiad's spear and sword come in at 3 a blow.",
  65: "Ochain again, now Armour 1 for Conall.",
  68: "Thunder feat through Ferdiad's Shield and Armour: 7 → 4.",
  72: "Lóegaire stands in for Conall, who is down to 2.",
  81: "Past the 20th turn: **weariness**. Each turn now costs the side acting 1 Valour, Shield or no Shield.",
  84: "Lóch Mór stands in for Ferdiad.",
  94: "The Sling leaves Lóch on 1, but weariness takes Lóegaire's last Valour: Conall has fallen. One hero each: a **final duel**.",
  97: "Fiacha rests (Conchobar heals 1 first as a guest): Shield 2, and his next Heal +1.",
  101: "Láeg: Heal 1 +1 kinship +1 rested. 9 → 12.",
  106: "Thunder feat for the last blow. Connacht has lost two heroes, Ulster one.",
};

export const ENDING: string[] = [
  "Ulster wins: **two heroes felled to one**. Ailill fell in the first duel; Lóegaire (for Conall) to weariness in the second; and Lóch (for Ferdiad) in the final duel.",
  "What made the difference: Thunder feat and Gáe Bolga **ignore Shield**, and so Armour and Blocks, against Connacht's Shields; Salmon leap's **Block** and Ochain's **Armour** turned Ailill's blows to nothing; and the rest-then-heal rhythm with the Brown Bull held Ferdiad off for twenty turns.",
  "Things to try in your own games: put a Reaction card beside the hero you expect to be struck most; rest before you heal; and watch the turn count: after twenty, every turn costs Valour.",
];
