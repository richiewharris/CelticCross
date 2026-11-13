// The words for the guided game. The game itself is script.json (made by sim/roth/walkgen.ts): the Ulster starter,
// first, against the Connacht starter, both seats played by the computer at Skilled, in duels to the death. A note is
// keyed by the move it follows (0 = the first move after the Muster). If the rules change and the game plays out
// differently, walkthrough.test.ts fails and these notes need rewriting against a fresh script.

export interface Chapter { at: number; short: string; title: string; body: string[] }

/** Shown before the move with the same index. */
export const CHAPTERS: Chapter[] = [
  {
    at: 0, short: "Marshalling", title: "Marshalling: raising the bands",
    body: [
      "The board is a wheel of twelve seats in four **bands**: your first and second bands, and the computer's. Each band is one **hero** and the **two supports** on its flanks, which it keeps beside it at the ford.",
      "Your first band fights theirs in the **first duel**; the second bands meet in the **second**. Every duel is to the death.",
      "Your placed supports are your hero's own. Most are **actions**, used on your turn and again at the price on the card. A **Reaction** card (a Block) waits for the enemy's blow; a **Passive** card gives **Armour** just by being there. Everything else waits in the shuffled **Reserve**, to be drawn in the duels.",
    ],
  },
  {
    at: 12, short: "The Winnow", title: "The Winnow: bending the fights",
    body: [
      "The wheel turns six more steps, and the enemy's bands come round to you one seat at a time. With a **hero** before you you may bind it with a **geis**; with a **support** you may **supplant** it with one of yours. At any step you may instead turn an **omen**, **swear an oath** on one of your own heroes, or **hold**.",
      "Geasa and oaths forbid things: a hero may still do a forbidden thing, but **breaking costs 2 Valour first**, and once broken the vow is gone for that duel.",
    ],
  },
  {
    at: 24, short: "Duel 1", title: "The Ford: duel 1, to the death",
    body: [
      "Every fighter enters the ford with its Valour **+3**. Conchobar: Valour 9, Shield 1 from Brigid's mantle, sworn to the **Blood-oath** (Strikes +2). Fergus mac Róich, an exile fighting for Connacht: Valour 8, Shield 1 from the ráth, and the hero's light (Strikes +1).",
      "On a turn: **draw** from your Reserve (play it, or put it aside and do something else); **use** a placed support; turn an omen or play a card from hand; call a **champion**; or **rest**. A rest **braces**: Shield 1, and your next Shield, Heal or Block is +1.",
      "When the enemy strikes, you may **Block** with a Reaction card beside your hero. There is no cap on healing; and after 20 turns a duel **wears both down**, 1 Valour a turn.",
    ],
  },
  {
    at: 67, short: "Duel 2", title: "The Ford: duel 2, against Connacht's own",
    body: [
      "Fergus has fallen: Connacht has lost a hero. Cú Chulainn (Valour 8, Initiative 5, Strikes +1) meets **Ferdiad**: Valour 7 (8, less 2 for the giant's portion, +1 for the Oath on the stone), Shield 2 (the ráth and the oath), and **Armour 1** from his horn-skin.",
      "Ferdiad is a hero of Connacht, and Connacht fights differently. Every blow of theirs that wounds makes the enemy **bleed**: its Heals −1 (stacking) until the end of its next turn. And every Connacht hero is **Swift** (a blow that wounds for 1 or less strikes again at once) or has a **Riposte**; Ferdiad's is a Riposte: when his **Shield** takes a blow, he strikes back free.",
      "So Cú's best answer is a blow that **ignores Shield**: Gáe Bolga and Thunder feat go straight past it, and no riposte comes back.",
    ],
  },
];

/** What a strong player was thinking, after a move (not every move has a note). */
export const COACH: Record<number, string> = {
  0: "Conchobar goes to the first duel: Valour 6, and he'll carry the Blood-oath.",
  1: "Fergus mac Róich: an exile (Deorad), fighting for Connacht. He isn't Connacht himself, so none of Connacht's own ways (bleed, swift, riposte) are his.",
  4: "Thunder feat: Strike 3 that ignores Shield, and so Armour and Blocks too.",
  6: "Cú Chulainn takes the second duel: Initiative 5, and his ríastrad adds +1 to every Strike.",
  7: "Ferdiad: Armour 1 from his horn-skin, and a **Riposte**: every blow his Shield takes, he answers with a free Strike.",
  8: "Salmon leap is a **Reaction** card: you don't use it on your turn. When the enemy strikes, you tap it to **Block 2**, more after a rest.",
  11: "Finnbennach: Heal 2. But it's an **Ally**, and that matters in a moment.",
  12: "The **Blood-oath** on Conchobar: his Strikes +2, but the vow forbids Heals and rests.",
  14: "Muster of the Red Branch: your Feats +1. Thunder feat and the warp-spasm both grow.",
  15: "The computer supplants the warp-spasm with Medb's war-chariot: a Connacht card, **unwilling** in an Ulster hand.",
  17: "And Thunder feat beside Conchobar becomes Bárach's feast: another unwilling card. Conchobar will have to fight from the Reserve.",
  18: "Geis of the giant's portion on Ferdiad: no **Allies** (Finnbennach is one), and a hero of Valour 5 or more starts his duel 2 lower.",
  21: "The Oath on the stone on Ferdiad: Valour +1 and Shield 1. Vow: no Fire.",
  24: "The **Truce of Samhain**: no Strike above 3, for everyone. Big blows are cut down; the Blood-oath's +2 will rarely show.",
  25: "Conchobar casts out the unwilling chariot and draws in its place (Emer heals 1 first, as a **guest**).",
  29: "Gáe Bolga ignores Shield: Fergus 8 → 5.",
  31: "Fráech's spear: 3 against Conchobar's Shield 1, so 2 wounds, and Fergus raises a Shield of his own.",
  33: "Ochain off the Reserve: a **Passive** card. Played, it puts on **Armour 1**: every Strike against Conchobar 1 less for the rest of the duel.",
  36: "Fedelm's prophecy: 3 with the hero's light, less 1 for the Armour.",
  38: "The Sling is Wind, Fergus's **weakness**: +1. The Truce holds it to 3, and Fergus's Shield soaks 2.",
  41: "Fergus rests and **braces**: Shield 1, and his next Shield or Heal +1.",
  44: "Conchobar rests, though his Blood-oath forbids it: with both his supports cast out he has nothing else to do, and a vow can't demand the impossible.",
  47: "Fedelm again: a Word's price is 1 Valour.",
  49: "Thunder feat ignores Shield: Fergus 4 → 1.",
  55: "Fiacha stands in for Conchobar at a fresh 8. If Fiacha falls, Conchobar has fallen.",
  58: "A second rest in a row: Shield 3, and the next Heal **+2**.",
  61: "Geis of the hosting, laid mid-duel: now nobody may rest. Fergus's bracing stops here.",
  64: "Caladbolg is Earth, Fiacha's weakness: 6, held to 3 by the Truce.",
  66: "Thunder feat through Fergus's Shield: he falls. Connacht has lost its first hero.",
  69: "Gáe Bolga: 4 against Ferdiad (Cú is its hero) and Water, his weakness. It **ignores Shield**, so Ferdiad has no riposte: 7 → 4.",
  72: "Ferdiad strikes with the Spear of Cet...",
  73: "... and you **Block** with Salmon leap: 1 wound, not 3. But it wounds, so Cú **bleeds**: his Heals −1 until the end of his next turn.",
  76: "Cú rests instead of healing into the bleed: Shield 1, and the next Heal +1. The bleeding stops at the end of this turn.",
  79: "Ferdiad breaks the giant's portion (−2) to use Finnbennach, an Ally: Heal 3. 3 → 6.",
  81: "The Brown Bull, +1 for the rest: Heal 4, and no bleed left to spoil it. 8 → 12.",
  85: "Thunder feat ignores Shield and Armour: 8 → 5.",
  89: "Gáe Bolga again: Ferdiad 5 → 2.",
  92: "Lóch Mór stands in for Ferdiad. Lóch is **Swift**: a blow of his that wounds for 1 or less strikes again at once.",
  99: "Salmon leap blocks the spear to nothing, and so Lóch is **swift**: a second blow, straight after. Cú's Shield soaks 2 of it; 1 wound, and he bleeds.",
  100: "Gáe Bolga: Lóch 7 → 4.",
  103: "Salmon leap isn't ready (you need a turn of your own between Blocks), so Cú takes Fráech's spear in full: 3 wounds, and he bleeds.",
  109: "The same again: a Block to nothing, then the swift second blow. Against Connacht, a Block only buys half a turn.",
  110: "Gáe Bolga: Lóch 4 → 1.",
  113: "The warp-spasm for the last blow. Connacht has lost two heroes, Ulster none.",
};

export const ENDING: string[] = [
  "Ulster wins: **two heroes felled to none**. Fergus fell to Fiacha in the first duel; Lóch, standing in for Ferdiad, fell to Cú Chulainn in the second.",
  "What made the difference: Gáe Bolga and Thunder feat **ignore Shield**, so Fergus's and Ferdiad's Shields, and Ferdiad's **Riposte**, never came into it; Ochain's Armour and Salmon leap's Blocks blunted Connacht's spears; and Cú rested before he healed, so the Brown Bull landed after the **bleed** had stopped.",
  "Things to try in your own games: against a Riposte, strike with what ignores Shield; against a Swift hero, a Block that leaves 1 or nothing invites a second blow, so keep a Shield up too; and when you bleed, rest first and heal next turn.",
];
