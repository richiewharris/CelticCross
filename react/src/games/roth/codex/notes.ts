// Words for the "Cards & decks" guide. Markup as on the card faces: **keyword** is bold, {name} an inline icon.
// Every claim restates engine/cards.ts and engine/engine.ts; nothing here changes a rule.
import type { Faction } from "../engine/cards";

export interface DeckNote {
  people: string;
  /** Who they are and how they fight, as a story: no card-by-card advice (players find the pairings themselves). */
  story: string;
  /** Leanings against the other starter decks: 1 light, 2 middling, 3 strong. */
  leans: { attack: 1 | 2 | 3; healing: 1 | 2 | 3; defence: 1 | 2 | 3 };
  /** One line on each leaning, plain facts. */
  why: { attack: string; healing: string; defence: string };
  /** The people's own rules: what is true of them in a duel to the death. Rules only, no advice. */
  ways: string[];
}

export const DECK_NOTES: Record<Faction, DeckNote> = {
  ulster: {
    people: "The Red Branch of Emain Macha",
    story: "The Hound of Ulster and his companions ride out from Emain Macha with fire in their blood. Their feats burn through any shield, and they mean to finish a duel before the enemy settles in.",
    leans: { attack: 3, healing: 1, defence: 1 },
    why: { attack: "The most Strike in its supports, and three blows that ignore Shield.", healing: "A little: a hero who heals on rest and a few Heals.", defence: "Thin: one Block card and a champion with Shield 1." },
    ways: [
      "**The Samhain watch**: an Ulster hero's Strikes are **+1** against the dead (a fighter whose Focus is Spirit).",
      "**The Hound's cry**: once a duel, a blow that ignores Shield may spend the **top card of your Reserve** to land on a giant in full.",
    ],
  },
  connacht: {
    people: "Queen Medb's host from Cruachan",
    story: "Medb's host marches from Cruachan with spears of earth and a long memory. They come at the enemy again and again, and every wound they open is slow to close.",
    leans: { attack: 2, healing: 3, defence: 2 },
    why: { attack: "Steady Earth weapons rather than one great blow; quick follow-up strikes and returned blows.", healing: "The most Heals of any deck, and its blows make the enemy's Heals smaller.", defence: "A shield-wall hero and blows returned off Shield, but little Shield in the supports." },
    ways: [
      "**Bleed**: a Connacht blow that wounds makes the enemy's Heals **−1** until the end of its next turn. It doesn't stack; each hit renews it.",
      "**Swift** (Medb, Lóch, Nad Crantail): a blow that wounds for **1 or less** strikes **again** at once.",
      "**Riposte** (Ferdiad, Ailill): when their Shield takes a blow, a free **Strike 1** back.",
    ],
  },
  sidhe: {
    people: "The Tuatha Dé Danann of the mounds",
    story: "The people of the mounds are many-skilled and hard to pin down: quick, veiled, and never quite where the blow lands. They fight from the edge of the Otherworld, and the dead have no hold on them.",
    leans: { attack: 2, healing: 2, defence: 3 },
    why: { attack: "Wind weapons and Words, one blow that ignores Shield; the quickest hero in the game.", healing: "Heals spread across heroes and supports.", defence: "The mound, the veil and the Otherworld all take something off the blows against them." },
    ways: [
      "**Otherworldly**: every {Spirit} Spirit blow against a Sídhe fighter is **−2**.",
      "**Masters of geasa**: a Sídhe hero pays only **1 Valour** to break a geis.",
      "**The mound**: takes **1** off every Strike against a Sídhe fighter until it has soaked **5** over the match. Nothing pierces it.",
      "**Veiled**: the first Strike against a Sídhe fighter each duel is **−1**; so is their own first Strike.",
    ],
  },
  fomoire: {
    people: "The giants from under the sea",
    story: "The Fomóire rise from under the sea, huge and slow and hard to wound. Their blows fall seldom but heavily, and where they walk the land forgets how to heal.",
    leans: { attack: 3, healing: 1, defence: 3 },
    why: { attack: "Heavy blows, and the deck's big Strikes fall early.", healing: "Almost none of their own; they deny the enemy's instead.", defence: "Giant-kin halves the wounds of most blows, and the supports hold the most Shield after Merrow's." },
    ways: [
      "**Giant-kin**: a Fomóire fighter takes **half** the wounds of every Strike (rounded up), except a Strike of one of its **weaknesses**, which lands in full.",
    ],
  },
  merrow: {
    people: "The sea-folk under the waves",
    story: "The sea-folk slip beneath the blow and let the tide do the work. They outlast the enemy behind sealskin and spray, then strike back as the water turns.",
    leans: { attack: 1, healing: 2, defence: 3 },
    why: { attack: "The least Strike of the hero decks; mostly Water.", healing: "A few Heals and Shields that heal.", defence: "The most Shield in any deck, and heroes that evade or shield themselves." },
    ways: [
      "**Flowing water**: every {Spirit} Spirit blow against a Merrow fighter is **−1**, a Merrow's Shield holds against Spirit, and Merrow {Water} Water Strikes against the dead are **+1**.",
      "**Water can't be pierced**: a blow that ignores Shield still meets a Merrow's **Block**.",
    ],
  },
  sluagh: {
    people: "The host of the unquiet dead, that rides the night wind from the west",
    story: "The Slúagh have no heroes: hosts of the restless dead gather and fight as one. Their touch passes through shield and steel and takes a little life with it, and every time their enemy sleeps, they feed.",
    leans: { attack: 2, healing: 2, defence: 2 },
    why: { attack: "Light blows that pass Shield and Block, and supports that weaken the enemy rather than wound.", healing: "No Heals: they steal Valour with their blows and feed on the enemy's rests.", defence: "No Shield, but no great blow wounds dead flesh for long." },
    ways: [
      "**Hosts**: a host takes a hero's seat with **2 or 3 monsters** joined to it from your hand. Its Valour is the monsters' together, **less one**; its Initiative the host's plus theirs. It is weak to the host's own element and to any weakness **two of its monsters share**.",
      "{Spirit} **Spirit**: Spirit blows ignore Shield and Block and **steal 1** when they wound. A monster with a **hybrid** element may strike as that element instead (the element wheel and weakness count; Shield soaks it; nothing is stolen).",
      "**The dead-flesh aura**: no blow wounds a host for more than **half its full Valour**, but never less than **5**.",
      "**Dream-walking**: whenever the enemy **rests**, the host fighting it **heals 1** (not at the western crossing).",
      "**The dead do not sleep**: omens can't lower a host's Initiative.",
      "Once a duel a host may **sacrifice** a monster (its Valour returns to the host); once a match it may **summon** one from your other host, spending the top card of your Reserve.",
      "A deck holds at most **6** monsters.",
    ],
  },
};

/** The deck-building guide: how cards work together, with a worked example or two. Players find the rest. */
export const BUILDING = {
  intro: "A deck is 24 cards from one or two peoples. What makes it strong is less the size of its numbers than how its cards add to one another.",
  rules: [
    "**24 cards**: 4–6 heroes (or 3–6 hosts and 4–6 monsters), 8–12 supports, 2–6 geasa, 4–6 omens, up to 4 oaths, 2 champions and 2 attendants.",
    "Commons up to **two** copies, rares and legendaries **one**, and at most **two** legendaries. Heroes, champions and omens are one of each.",
    "At most **two peoples**: the first **leads** (every hero or host is of it) and a second may **lend** its supports, champions, geasa, oaths, omens and attendants, never heroes. Exiles lead beside Ulster or Connacht. The geasa, oaths and omens open to all go with anyone.",
  ],
  ways: [
    { title: "Kinship", text: "A support of the hero's own people is **+1** in its hands." },
    { title: "Focus", text: "A support of the hero's Focus, an element or a kind, is **+1** more." },
    { title: "The wheel", text: "{Fire} Fire beats {Wind} Wind beats {Earth} Earth beats {Water} Water beats {Fire} Fire: a blow whose element beats the enemy hero's Focus is **+1**." },
    { title: "Weakness", text: "A blow of the element the enemy is weak to is **+1**. Your own heroes' weaknesses are worth covering too." },
    { title: "Vows and taboos", text: "A geis or oath forbids something. One that forbids what your deck never uses costs you nothing." },
    { title: "Unwilling", text: "Ulaid and Connachta, Sídhe and Fomóire, Sídhe and Slúagh won't use each other's supports: such a card does nothing in their hands." },
  ],
  examples: [
    {
      title: "Bonuses that stack",
      cards: ["medb", "cet_spear"],
      text: "Medb's kinship counts double and her Focus is {Earth} Earth. The Spear of Cet is a Connacht Earth weapon, printed **Strike 2**: in her hands it is **2 +2 +1 = 5** before the enemy is even counted. The same card behind a hero of another people with another Focus is Strike 2.",
    },
    {
      title: "A taboo that only binds the enemy",
      cards: ["g_peace"],
      text: "A global geis binds every hero, yours too. The Geis of the king's peace forbids Weapons; a deck with no Weapons can lay it for nothing while the enemy's spears fall silent.",
    },
  ],
  close: "The rest is yours to find: which heroes want which supports, which omen answers which deck, which oath a band never needed.",
};

/** What each type of card is, when it's played, and how it works with the rest. */
export const TYPE_NOTES: { type: "hero" | "champion" | "support" | "geis" | "oath" | "omen" | "attendant" | "host"; title: string; sample: string; what: string; when: string; how: string[] }[] = [
  {
    type: "hero", title: "Heroes", sample: "cu",
    what: "The fighters. Each band of the wheel is one hero and the two supports on its flanks, and the heroes fight their duels at the ford to the death.",
    when: "**Marshalling**, in a band's hero seat. First bands meet in the first duel, second bands in the second.",
    how: [
      "{valour} **Valour** is life: at 0 the hero falls. {init} **Initiative** decides who strikes first (a tie goes to the first player).",
      "**Focus**: supports of that element or kind get **+1**. **Weak to**: enemy Strikes of that element get **+1**.",
      "**Geis tag**: a card that invokes the tag costs this hero **2 Valour**.",
      "Heroes still in your hand can come to the ford as **guests**: once per duel, before acting, discard a hero of your fighter's people to **Heal 1**.",
    ],
  },
  {
    type: "champion", title: "Champions", sample: "fiacha",
    what: "Stand-ins kept in your hand. A champion takes your hero's place at the ford with its own Valour.",
    when: "**At the ford**, as your action for the turn (or straight off the Reserve when you draw one). The first player may call one in any duel, the second player from the second duel on; one per duel.",
    how: [
      "The champion fights with its own {valour} Valour and quality. Wounds already dealt still count, and if the champion falls, your hero has fallen.",
      "It keeps the benefit of your omens but is **not bound** by your hero's geasa or oath (and gets no oath boon).",
      "It's the first player's answer to the second player's edge, and a surprise: the enemy can't see whether you hold one.",
    ],
  },
  {
    type: "support", title: "Supports", sample: "gae_bolga",
    what: "Weapons, feats, allies and words: the two placed behind a hero are its own, ready at the ford; the rest of your deck waits in the Reserve.",
    when: "**Marshalling**, on the two flanks of each hero. **The Winnow**: supplant an enemy support with one of yours. **At the ford**: use a placed support (the first time free, then at its price), or play one you draw off the Reserve (used once, then discarded).",
    how: [
      "{strike} **Strike** wounds the enemy; {shield} **Shield** soaks it first unless the card ignores Shield. {heal} **Heal** restores Valour, up to 2 above the duel's start. {shield} **Shield** absorbs wounds until used up.",
      "The printed number grows with **kinship**, **Focus**, the **element** matchup and the enemy's **weakness** (see “Reading a blow”).",
      "**Using it again**: each card shows its price. A Weapon can't strike two turns running; a Feat needs a rest first; an Ally costs the top card of your Reserve; a Word costs **1 Valour**; anything that Heals also needs a rest.",
      "**Unwilling** (Ulaid with Connachta, Sídhe with Fomóire): the support does nothing at all. So when you supplant, an Unwilling card is the cleanest denial.",
    ],
  },
  {
    type: "geis", title: "Geasa", sample: "g_giant",
    what: "Taboos. A geis forbids supports of an element or kind, Heals, or resting.",
    when: "**The Winnow**: bind the enemy hero before you (targeted), or lay a global geis that binds **every** hero on the field, your own too.",
    how: [
      "A hero may still **break** a geis: pay **2 Valour**, then act. In a duel to the death a geis is never broken for good: **every** forbidden use costs 2 Valour again, so a well-laid geis taxes the enemy all duel. Cathbad the druid lets one break go free; Emain's ward ignores geasa entirely.",
      "Some geasa also bite at the start of the duel: they invoke a **tag** (−2 Valour), punish big heroes (−2 Valour), or take **3 Initiative**.",
      "Global geasa are best laid when the forbidden thing matters more to the enemy, as the king's peace does for the weapon-less Merrow.",
    ],
  },
  {
    type: "oath", title: "Oaths", sample: "v_blood",
    what: "A vow sworn on your own hero: a **boon** for that hero's duel, paid for by a **vow**.",
    when: "**The Winnow**, on one of your heroes.",
    how: [
      "The boon is Strikes, Shield, Valour, Initiative or Heals. The vow forbids some supports or resting, like a geis you chose.",
      "Breaking the vow costs **2 Valour**. A champion who steps in is free of it, and loses the boon.",
      "An oath whose vow the hero's band never needed costs little.",
    ],
  },
  {
    type: "omen", title: "Omens", sample: "o_crow",
    what: "Fate. Omens wait face down until you turn them, then hold for the rest of the match.",
    when: "**The Muster**: put up to four in your Omen spots, face down, as you draw them. **The Winnow**: turn one face up (a targeted omen picks its hero as it turns).",
    how: [
      "{global} **Over the whole field**: both sides feel it (the Truce, the crow, the Night of the Fomóire).",
      "{yours} **For your heroes**: wards that soften blows and reinforcements that add +1.",
      "{targeted} **On one hero**: Strikes ±1, Initiative −3, or Shield 1, on any hero, yours or theirs.",
      "In a tie-break's backwards round, geasa and omens reset.",
    ],
  },
  {
    type: "host", title: "Hosts and monsters", sample: "hunt",
    what: "The Slúagh have no heroes. A **host** (the Hunt, the Prey or the Taboo) gathers **2 or 3 monsters** and fights as one, in a hero's place.",
    when: "**Marshalling**, in a hero's seat: the host goes down with the monsters you join to it from your hand.",
    how: [
      "The host's {valour} **Valour** is its monsters' added together, **less one**; its {init} **Initiative** is the host's own plus each monster's (which can be negative).",
      "It is weak to **every** element its monsters and its host type bring, so a bigger host is tougher but easier to hit hard.",
      "The host type changes the nature of the monsters in it: the Hunt's **first Strike each duel +1**, the Prey turns the **first blow** against it, the Taboo is a **curse**: the enemy's Heals −1.",
      "Its Focus is {Spirit} **Spirit**: Slúagh supports of Spirit ignore Shield and steal 1 when they wound. Oaths, geasa, omens and attendants treat a host just like a hero, except that an omen can't lower its Initiative.",
    ],
  },
  {
    type: "attendant", title: "Attendants", sample: "a_scribe",
    what: "Smiths, druids, poets and thralls who change what a card **counts as**: its element, its kind, or what a hero is weak to.",
    when: "**The Winnow**, from your hand, like an oath. It stays for the rest of the match.",
    how: [
      "**Enchant**: your Weapons (or Feats) count as an element. **Turn**: supports of one element count as another. **Channel**: the same, with Strike **+1**, but the hero using it loses **1 Valour**. **Reforge**: supports of one kind count as another. **Curse**: heroes in reach are also weak to a new element.",
      "{yours} **Your heroes**, {enemy} **the enemy's**, or {global} **every hero**: printed on the card.",
      "The new element or kind counts for everything: **Focus**, the element wheel, **weakness**, omens, and the **geasa and oaths** that forbid it. So an attendant can slip a geis (a Weapon reforged as a Word is free of the king's peace) or walk the enemy's cards into one.",
      "The Sídhe, who lean on Fire and Weapons, have the most: Goibniu's apprentice, Airmed's attendant, Ogma's scribe, the changeling and Bé Néit's shriek.",
      "Up to **2** in a deck. In a tie-break's backwards round they go back to hand.",
    ],
  },
];
