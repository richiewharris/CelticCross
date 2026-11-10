// The words for the guided game. The game itself is script.json (made by sim/roth/walkgen.ts): the Ulster starter,
// first, against the Connacht starter, both seats played by the computer at Skilled. A note is keyed by the move it
// follows (0 = the first move). If the rules change and the game plays out differently, walkthrough.test.ts fails and
// these notes need rewriting against a fresh script.

export interface Chapter { at: number; short: string; title: string; body: string[] }

/** Shown before the move with the same index. */
export const CHAPTERS: Chapter[] = [
  {
    at: 0, short: "Drafting", title: "Drafting: building two fights",
    body: [
      "The board is a wheel of twelve spots. Your two quadrants are spots 1–3 and 4–6; the computer's are 7–9 and 10–12. Each quadrant is one **hero** and the **two supports** it will fight with.",
      "Spot 1 fights spot 7 in the **first duel**; spot 4 fights spot 10 in the **second**. So every card you place is a decision about one particular fight.",
      "You place first at each step, and the computer answers. Going first means showing your hand: it will pick its hero knowing which of yours it faces.",
    ],
  },
  {
    at: 12, short: "Playing turn", title: "The Playing turn: bending the fights",
    body: [
      "The wheel turns six more steps. Each step you face one enemy spot. Facing a **hero** you may bind it with a **geis**; facing a **support** you may **supplant** it with one of yours. At any step you may instead turn an **omen**, **swear an oath** on one of your own heroes, or **hold**.",
      "Omens still face down when the Playing turn ends are lost. Geasa and oaths forbid things: a hero may still do a forbidden thing, but **breaking costs 2 Valour first**.",
    ],
  },
  {
    at: 24, short: "Duel 1", title: "The Ford: duel 1",
    body: [
      "Cú Chulainn: Valour 4, Shield 1 (Brigid's mantle), Initiative 5. Ferdiad: Valour 5, Shield 3 (horn-skin 1 + the shield-wall oath 2), Initiative 2. The higher Initiative strikes first.",
      "Each hero takes **two turns**: use one of its quadrant's supports, or rest. A duel ends after four turns, or the moment a hero falls.",
      "Every number on a support can grow: **+1 kinship** (a support of the hero's own people), **+1 Focus** (the support's element or kind matches the hero's Focus), **+1 the wheel** (its element beats the enemy's Focus), **+1 weakness**. Then the hero's own quality, oaths and omens. The steps below show every one.",
    ],
  },
  {
    at: 28, short: "Duel 2", title: "The Ford: duel 2",
    body: [
      "Conchobar: Valour 5, Initiative 2 (the slow hand would make it −1, but Emain's ward lets him ignore it). Medb: Valour 4, Initiative 4. Medb strikes first.",
      "Ferdiad has already fallen. Unless Conchobar falls too, Ulster has won: the match goes to the side that **fells more heroes**, and only a tie on that is settled by wounds.",
    ],
  },
];

/** What a strong player was thinking, after each move. */
export const COACH: Record<number, string> = {
  0: "Cú Chulainn goes to the first duel. Initiative 5 means he nearly always strikes first, and his ríastrad adds +1 to every Strike. A hero that strikes first and hard can fell its rival before it acts.",
  1: "The computer answers with Ferdiad, Cú's foster-brother: Valour 5, and his horn-skin gives him Shield 1 at the start of each duel. A big, armoured body to soak Cú's blows.",
  2: "Thunder feat: Strike 2 that **ignores Shield**, the answer to Ferdiad's horn-skin. It is Fire, and Cú's Focus is Fire, so +1; it is an Ulster card in an Ulster hand, so +1 kinship.",
  3: "Spear of Cet: an Earth Weapon. Ferdiad's Focus is Weapon, so +1, and +1 kinship.",
  4: "Sling of Emain: Strike 2, +1 if it is the first support used in its duel. A second blow for Cú, and one Conchobar can borrow later.",
  5: "Fedelm's prophecy: Strike 1, and the next Strike +1.",
  6: "Conchobar takes the second duel. Valour 5 but slow (Initiative 2). His quality, the **King's due**, lets him use an unused support from his other hero's quadrant once a duel: anything Cú leaves behind is his.",
  7: "Medb: Valour 4, Initiative 4, and **kinship gives her +2, not +1**. Every Connacht support hits harder in her hands.",
  8: "Láeg the charioteer: Heal 1, and the next Strike +1.",
  9: "The host of Cruachan: Strike 1 + Heal 1. With Medb's +2 kinship and her Earth Focus, that Strike 1 becomes 4.",
  10: "Ochain, the roaring shield: Shield 2 (3 with kinship). Medb will strike first, so Conchobar wants a wall ready.",
  11: "Fráech's spear: Strike 2 + Shield 1.",
  12: "**Blood-oath** on Conchobar: his Strikes +2. The vow is *no Heals, never rest*, so Láeg now costs 2 Valour to use. Worth it: +2 turns the Sling into a real blow, and the slow king needs one.",
  13: "**Truce of Samhain**: no Strike above 3, for everyone. It blunts Cú's big hits and Conchobar's oath, and it blunts Medb's too.",
  14: "**Culann's hound**: the first Strike against each of your heroes each duel is 1 less.",
  15: "Ferdiad swears the **shield-wall**: Shield 2 at the start of each duel (he will start with 3). The vow: no Feats. None of his supports is a Feat, so it looks free…",
  16: "…so **supplant** Fedelm's prophecy with your **Salmon leap**. Ferdiad loses a Strike, and the card left in his quadrant is a Feat he can use only by breaking his vow. A good supplant leaves the enemy a card that helps them least: here, one that hurts.",
  17: "The computer holds.",
  18: "**Geis of the hosting**, global: no hero may rest. Now look at Ferdiad's quadrant. After the spear, his only moves are the Salmon leap (breaks his vow) or rest (breaks this geis). Either costs 2 Valour. The trap is set.",
  19: "The computer binds Conchobar with the **slow hand**: no Wind, Initiative −3. The Sling and Láeg are both Wind.",
  20: "**Emain's ward**: your heroes ignore geasa. That frees Conchobar from the slow hand, and frees your heroes from your own Geis of the hosting. The global geis now binds only the enemy.",
  21: "The computer holds.",
  22: "**Brigid's mantle** on Cú Chulainn: he starts his duel with Shield 1.",
  23: "The computer holds. Its last face-down omens are lost.",
  24: "Thunder feat goes through Ferdiad's three Shield. The Truce cuts 5 down to 3, still enough to bring him to 2.",
  25: "The spear lands on Cú, but Culann's hound and the mantle take 2 of it.",
  26: "Resting with the Sling in hand looks odd, but Ferdiad has Shield 3, and the Truce caps any Strike at 3: the Sling would be soaked entirely. Resting keeps it unused, and **Conchobar can borrow it** in duel 2. Resting is forbidden by the Geis of the hosting, but Emain's ward lets Cú ignore it.",
  27: "Ferdiad's last turn, and both of his choices break something: the Salmon leap is a Feat (his oath), resting breaks the global geis. Breaking costs 2 Valour **first**, and he has 2. **Ferdiad falls by his own vow.** That one felled hero wins the match.",
  28: "Medb strikes first: the host of Cruachan with her +2 kinship and Earth Focus. The Truce caps it at 3, and Culann's hound takes 1 more. The host also heals her.",
  29: "Ochain: Shield 3, before Medb's spear comes. Conchobar can't be felled in one blow now.",
  30: "Fráech's spear is soaked entirely. It still gives Medb Shield 1.",
  31: "The last blow, the Sling borrowed from Cú's quadrant through the King's due. First, **Emer, a hero left in hand, comes as a guest**: once a duel a guest heals 1 before you act. Wind beats Medb's Earth Focus (+1 the wheel), the Blood-oath adds 2, and the Truce caps it at 3.",
};

export const ENDING: string[] = [
  "Ulster wins: **one hero felled to none**. Wounds don't matter when the felled count differs; they only break a tie (here Ulster also dealt more, 6 to 2).",
  "The winning move happened in the Playing turn, not the duels: an oath the enemy swore (no Feats), a Feat you planted in its quadrant, a global geis that took away resting, and a ward that kept that geis off your own heroes.",
  "Things to try in your own games: send your fastest striker to the duel you most need; watch which vows the enemy swears and supplant into them; and remember that breaking costs 2 Valour **before** the card acts, so a wounded hero may not survive it.",
];
