// Words for the "Cards & decks" guide. Markup as on the card faces: **keyword** is bold, {name} an inline icon.
// Every claim restates engine/cards.ts and engine/engine.ts; nothing here changes a rule.
import type { Faction } from "../engine/cards";

export interface DeckNote {
  people: string;
  motto: string;
  plan: string[];
  watch: string[];
  roles: Record<string, string>;
  groups: Partial<Record<"hero" | "champion" | "support" | "geis" | "oath" | "omen", string>>;
}

export const DECK_NOTES: Record<Faction, DeckNote> = {
  sluagh: {
    people: "The host of the unquiet dead, that rides the night wind from the west",
    motto: "A monster deck. No heroes: **hosts** of two or three monsters fight as one, and their blows are **Spirit**, which no Shield stops and which feeds the host.",
    plan: [
      "Place a **host** on a hero spot and join **2 or 3 monsters** from your hand to it. The host fights as one: its Valour is the monsters' added together, less one (a host of the dead is a ragged thing), its Initiative the host's plus theirs, and it is weak to the **host's own** element, plus any **monster weakness that two of them share** (a lone monster's weakness is covered by the rest).",
      "Two monsters make a quick, lean host; three make a big one with more Valour and more weaknesses. The **Hunt** opens hard, the **Prey** turns the first blow, the **Taboo** is a curse that spoils the enemy's Heals.",
      "Each host type has a weakness of its own: the Hunt fears **Fire** (torches), the Prey **Earth** (the cold grave), the Taboo **Water** (it cannot cross running water).",
      "{Spirit} **Spirit** supports ignore Shield and **steal 1** when they wound. Every host's Focus is Spirit, so they get **+1** too. But the dead cannot cross running water: a **Merrow** hero's Shield holds against Spirit, and Merrow {Water} Water Strikes against a host are **+1**.",
      "**The dead do not sleep**: omens can't lower a host's Initiative (Druid's sleep does nothing to it). A geis still can.",
      "The supports are weak, and turned against the enemy: the enemy's next Strike **−1**, the enemy **loses Valour** outright, Heals spoiled.",
      "Some monsters carry **hybrid** damage, the element opposite their weakness. Each Spirit blow is a choice: as **Spirit** it passes Shield and steals 1 (never more than 1 a Strike); as the **hybrid** element it gets the element wheel and weakness bonuses, but Shield soaks it and nothing is stolen. The Dullahan burns as {Fire} Fire, the Fear Dearg blows as {Wind} Wind (and makes a striker pay 1 Valour for wounding his host), the Bean Nighe strikes as {Earth} Earth, the Dearg-due runs as {Water} Water.",
      "A deck holds at most **6** of the 9 monsters. A host placed with fewer than two monsters in hand takes the rest from the Reserve.",
      "In a duel a host may **sacrifice** one of its monsters (once a duel): the monster's Valour comes back to the host, and its weakness and quality leave with it.",
      "Once a match a host may **summon** a monster from your other host: its Valour, weakness and quality join the one fighting now, and the other host fights without it.",
    ],
    watch: [
      "Big hosts carry many weaknesses: an enemy who brings the right element hits them for **+1** again and again.",
      "Hosts count as printed with their combined Valour: the tathlum, Scáthach's teaching and the Geis of the giant's portion all bite.",
      "The Aos Sídhe and the Slúagh are **Unwilling**: neither will use the other's supports.",
    ],
    roles: {},
    groups: {
      support: "Spirit blows that steal, and curses that weaken the enemy's next Strike or take Valour outright.",
    },
  },
  ulster: {
    people: "The Red Branch of Emain Macha",
    motto: "Fast, fiery and hard to stop. Ulster hits **through Shield** and tries to win each duel before the enemy settles.",
    plan: [
      "Put Cú Chulainn in front of his Fire feats. Thunder feat and the warp-spasm are {Fire} Fire and Ulaid, so each gets **+1 kinship** and **+1 Focus**: Thunder feat's printed Strike 3 lands as 5 before any matchup bonus, and Ríastrad adds **+1** more.",
      "Gáe Bolga is **Strike 4** in Cú Chulainn's hands and, like Thunder feat, **ignores Shield**. Shield-heavy decks (Merrow, the Fomóire's tower) pay for it.",
      "Conall Cernach is the avenger: **+1** against big heroes (printed Valour 5+), and **+1 more** in the second duel if your first hero fell. He belongs on a second-duel spot (4 or 10).",
      "Conchobar and Emer are slow Word heroes in a deck with no Words, so they fight on kinship. Conchobar's King's due lets him **borrow** an unused support from your other quadrant; Emer **heals 2** when she rests.",
      "The warp-spasm is **Strike 4** but costs your hero **1 Valour**. Save it for the blow that fells.",
      "**The Hound's cry**: in a duel to the death, once a duel, an Ulster blow that ignores Shield (Thunder feat, Gáe Bolga) may spend the **top card of your Reserve** to go through a giant's hide: the Fomóire take it in full instead of half. Save it for the biggest blow.",
    ],
    watch: [
      "Cú Chulainn and Conall are **weak to {Wind} Wind**: the Sídhe's Wind weapons and the Merrow's Riptide and Scuabtuinne hit them harder.",
      "Connacht's **Geis of the hound** forbids Feats and costs a hero whose geis is **Hound** (Cú Chulainn) **2 Valour** at the start of his duel. Gáe Bolga, a Weapon, still works.",
      "The **Truce of Samhain** (Connacht) caps every Strike at 3, which blunts Gáe Bolga and the warp-spasm.",
      "Connacht supports are **Unwilling** for Ulster heroes, and Ulster's for Connacht's: they do nothing at all.",
    ],
    roles: { cu: "Striker", conall: "Avenger", conchobar: "King: borrows supports", emer: "Healer on rest", loegaire: "Opening blow", fiacha: "Shielded stand-in" },
    groups: {
      hero: "Two quick strikers (Cú Chulainn, Conall) and two steady Word heroes.",
      champion: "Lóegaire opens with **+1** on his first Strike; Fiacha steps in behind **Shield 1** with Valour 5.",
      support: "Fire and Wind feats and weapons, three that **ignore Shield**, and a little healing (Láeg, the Brown Bull).",
      geis: "The hosting forbids rest to **every** hero (Emer too), the hearth strips Fire, and the giant's portion punishes big heroes.",
      oath: "Both oaths trade resting (and, for the Blood-oath, Heals) for **Strikes**. They suit Cú Chulainn, who wants the duel short anyway; the Blood-oath's vow clashes with Láeg and the Brown Bull.",
      omen: "Emain's ward makes your heroes **ignore every geis**; the Muster of the Red Branch gives your **Feats +1**.",
    },
  },
  connacht: {
    people: "Queen Medb's host from Cruachan",
    motto: "Earth weapons, healing and patience. Connacht **wears the enemy down** and keeps its own heroes standing.",
    plan: [
      "**Bleed**: in a duel to the death, every Connacht blow that wounds makes the enemy's Heals **−1** until the end of its next turn. It doesn't stack (two hits are still −1), but every hit renews it, so steady small blows keep a healer down.",
      "Every Connacht hero is **Swift** or has a **Riposte**, never both. **Swift** (Medb, Lóch, Nad Crantail): a blow that wounds for **1 or less** strikes **again** at once. **Riposte** (Ferdiad, Ailill): when their {shield} Shield takes a blow, a free **Strike 1** back, without spending a turn. Each hit that wounds bleeds.",
      "Medb's kinship is **+2**, not +1, and her Focus is {Earth} Earth: a Spear of Cet in her hands is Strike 2 **+2 +1 = 5**.",
      "Ferdiad and Fergus have **Focus Weapon**, so the spears, Caladbolg and the horn-shield all get +1. Fergus is an exile (Deorad): **Ulster and Connacht supports are both kin to him**. Caladbolg is Deorad too, so it is kin to every Connacht hero.",
      "Ferdiad starts each duel with **Shield 2**. Add the Oath of the shield-wall (Shield 2) and the ráth of Cruachan (Shield 1) and he opens behind **Shield 5**.",
      "Heals come from the host of Cruachan, Medb's war-chariot and Finnbennach, with Ailill's Pillow-talk and Cruachan's plenty each adding **+1**. A hero can't be healed more than **2 above** the Valour it started the duel with.",
      "Fedelm's prophecy and Medb's war-chariot make your **next Strike +1**: follow them with a spear.",
    ],
    watch: [
      "Medb and Ferdiad are **weak to {Water} Water**: the Merrow and the Sídhe's tathlum.",
      "The Fomóire's **Geis of Samhain night** and the **Morrígan's crow** (in the Sídhe's pool) shut off the Heals the deck leans on.",
      "Ulster supports are **Unwilling** for Connacht heroes (but not for Fergus).",
    ],
    roles: { medb: "Kin-queen", ferdiad: "Shield-wall", fergus: "Exile bruiser", ailill: "Healer", loch: "Striker", nadcrantail: "Opening blow" },
    groups: {
      hero: "Two Weapon fighters, a queen who makes kinship count double, and a healer.",
      champion: "Lóch's Strikes are **+1** all duel; Nad Crantail's first Strike is **+1**.",
      support: "Earth weapons and allies, three Heals, two next-Strike setups, and Caladbolg (**Strike 3**).",
      geis: "The hound strips Feats and costs a **Hound** hero 2 Valour; the slow hand forbids Wind and takes **3 Initiative**, so your slow heroes strike first. The hosting forbids rest to every hero.",
      oath: "Both are defensive: **Shield 2** (no Feats), or **+1 Valour and Shield 1** (no Fire). Connacht has no Feats and only one Fire card, so the vows cost little.",
      omen: "The hero's light gives one hero **Strikes +1**; the Truce of Samhain caps every Strike at **3**; Cruachan's plenty and the ráth make heals and Shield bigger.",
    },
  },
  sidhe: {
    people: "The Tuatha Dé Danann of the mounds",
    motto: "Many-skilled, quick and hard to pin down. **Wind weapons, Words and healing.**",
    plan: [
      "**The mound**: the Aos Sídhe fight from their mound. Like {armour} Armour it takes **1** off every Strike against a Sídhe fighter, until it has soaked **5** in all over the whole match. Nothing pierces it, not even blows that ignore Shield and Armour.",
      "**Veiled**: the first Strike against an Aos Sídhe fighter each duel is **−1**, but so is their own first Strike: they are hard to hit and hard to aim.",
      "**Charm** (Glamour, the music of the mounds, Aengus's kisses): a light blow that **goes through Shield**, takes the enemy's {shield} Shield for your own, and can dull the enemy's next Strike. Against a shield wall their turn is never wasted.",
      "Lugh has the **highest Initiative** in the game (6), and every support counts as his Focus: everything he uses gets **+1**.",
      "The Dagda is the tank: **Valour 6**, Initiative 1, and resting **heals him 2**. Dian Cécht's well and the druid's oath keep him topped up.",
      "The Morrígan hits hard: **Valour 4** and **Strikes +1**, and once per match she may change her Focus to any element at the start of her duel.",
      "Brigid's Heals are **+1**; her Focus is {Fire} Fire, so Goibniu's forge and Raven's war-cry suit her.",
      "Fragarach **ignores Shield**; the tathlum is **Strike 3** against any hero printed with Valour 5 or more (Balor, Ferdiad, Conchobar, the Coomara).",
    ],
    watch: [
      "Lugh and the Dagda are **weak to {Fire} Fire** (Ulster's feats, Balor's gaze); the Morrígan is weak to {Earth} Earth.",
      "The Fomóire's **Blight** invokes **Forge** (Brigid) and their **tribute** invokes **Plenty** (the Dagda): each costs that hero **2 Valour**.",
      "Your own **Geis of the hosting** forbids rest to every hero, the Dagda included. Lay it when it costs the enemy more.",
      "Fomóire supports are **Unwilling** for Sídhe heroes.",
    ],
    roles: { lugh: "Quick all-rounder", dagda: "Tank", morrigan: "Striker", brigid: "Healer", nuada: "Shielded stand-in", ogma: "Opening blow" },
    groups: {
      hero: "The quickest hero, the biggest, a battle-crow, and a healer.",
      champion: "Nuada steps in behind **Shield 1** with Valour 5; Ogma's first Strike is **+1**.",
      support: "Wind and Fire weapons and words, a legendary **Strike 3** spear, one that ignores Shield, and Heals.",
      geis: "The open door forbids rest and costs a **Hospitality** hero 2 Valour (Emer, Bres); the giant's portion forbids Allies and costs a big hero 2 Valour.",
      oath: "The druid's oath (**Heals +1, Shield 1**, no Weapons) suits the Dagda and Brigid; the champion's oath (**Strikes +1**, never rest) suits Lugh and the Morrígan.",
      omen: "Mist of the druids lets your hero **strike first** in the first duel; Druid's sleep takes **3 Initiative** from one hero; Keening takes **1** off one enemy hero's Strikes; Lugh's protection softens the first blow.",
    },
  },
  fomoire: {
    people: "The giants from under the sea",
    motto: "Huge, slow and blighting. Fomóire heroes **hit hard once** and starve the enemy of healing.",
    plan: [
      "**Giant-kin**: in a duel to the death the Fomóire take **half** the wounds of every Strike (rounded up), except one of their **weaknesses**, which lands in full (no +1). A geis or a Curse attendant can lay more weaknesses on them: that is how to bring a giant down.",
      "Balor's first Strike each duel is **+1**, and the gaze of Balor is **Strike 3** in his hands. With kinship and Focus {Fire} Fire, that opening blow is **3 +1 +1 +1 = 6**.",
      "Balor and Indech are slow (Initiative 1 and 2). The **Night of the Fomóire** turns that round: in the first duel, the lower Initiative strikes first. **Druid's sleep** takes 3 Initiative from one enemy hero.",
      "Indech the sea-giant can't be hit for **more than 4** at once; behind Conand's tower (**Shield 3**) he soaks blow after blow.",
      "Cethlenn, Tethra and the stones of Octriallach **drain**: when the Strike wounds, Heal 1.",
      "Bres makes the enemy's Heals **−1**, and the **Geis of Samhain night** forbids Heals for everyone. The Fomóire barely heal, so it costs you little.",
    ],
    watch: [
      "Balor is **weak to {Water} Water**; Bres and Indech are **weak to {Wind} Wind**.",
      "The Oath on the stone forbids **Fire**, which locks Balor out of his own gaze.",
      "Sídhe supports are **Unwilling** for Fomóire heroes.",
    ],
    roles: { balor: "Opening blow", bres: "Heal-breaker", cethlenn: "Glass cannon, drains", indech: "Tank", elatha: "Plain giant", tethra: "Drains" },
    groups: {
      hero: "A one-blow giant, a tank, a fragile drainer, and a king who spoils enemy Heals.",
      champion: "Elatha is simply big (**Valour 5**); Tethra heals 1 when his Strike wounds.",
      support: "Water feats, Earth weapons and allies, **Shield 3**, and two Words that invoke **Sídhe** geis tags.",
      geis: "The hearth strips Fire; Samhain night forbids Heals to **every** hero; the slow hand forbids Wind and takes **3 Initiative**.",
      oath: "The Blood-oath (**Strikes +2**; no Heals, never rest) costs Fomóire almost nothing; the Oath on the stone adds Valour and Shield but forbids Fire.",
      omen: "The Night of the Fomóire flips Initiative in the **first duel**; Samhain tribute gives your second-duel hero **Strikes +1**; Tory's tower gives **Shield 1**.",
    },
  },
  merrow: {
    people: "The sea-folk under the waves",
    motto: "Water, Shields and slippery defence. Merrow **outlasts** the enemy and strikes back with the tide.",
    plan: [
      "Manannán's first incoming Strike each duel **misses**. Lí Ban gains **Shield 2** when she rests. The Coomara is **Valour 6** and heals 1 when his Strike wounds.",
      "Fand is the glass cannon: **Valour 3**, Initiative 5, **Strikes +1**.",
      "Most supports are {Water} Water, Manannán's and Lí Ban's Focus, and the blessing of the ford gives **every Water support +1**. Water beats Fire, so Undertow and Clíodhna's wave punish Fire-Focus heroes (Cú Chulainn, Brigid, Balor).",
      "Merrow carries **no Weapons**, so the **Geis of the king's peace** (no hero may use Weapons) costs you nothing while it takes the spears from Ulster, Connacht and the Sídhe. The druid's oath (no Weapons) is free for the same reason.",
      "Sealskin (**Shield 3**), the cohuleen druith (**Shield 2 and Heal 1**) and the flood tide (**Heals +1**) keep heroes up through a long duel.",
    ],
    watch: [
      "Shield is no use against **Gáe Bolga, Thunder feat, Fragarach** and Clíodhna's own wave: they ignore it.",
      "Manannán is **weak to {Earth} Earth** (Connacht), Lí Ban to {Wind} Wind, and Fand and the Coomara to {Fire} Fire.",
      "The **Oath of the shield-wall** forbids Feats, and most of Merrow's Strikes are Feats. Swear it on a hero whose quadrant holds Words and Allies.",
    ],
    roles: { manannan: "Evasive", fand: "Glass cannon", liban: "Shield on rest", coomara: "Tank, drains", roane: "Shielded stand-in", muirdris: "Blow-capped tank" },
    groups: {
      hero: "An evasive legend, a fragile striker, a shield-maiden and a giant who drains.",
      champion: "The Roane steps in behind **Shield 1**; the Muirdris can't be hit for **more than 3**.",
      support: "Water feats and words, two big Shields, a Strike that **ignores Shield**, and a drain.",
      geis: "The king's peace forbids Weapons to **every** hero and costs you nothing; the open door and the giant's portion punish Hospitality and big heroes.",
      oath: "The druid's oath is free (no Weapons in the deck); the shield-wall's vow bites, since most of the deck's Strikes are Feats.",
      omen: "The blessing of the ford gives **Water +1**, the flood tide **Heals +1**, the fog softens the first blow, and Keening takes **1** off one enemy hero's Strikes.",
    },
  },
};

/** What each type of card is, when it's played, and how it works with the rest. */
export const TYPE_NOTES: { type: "hero" | "champion" | "support" | "geis" | "oath" | "omen" | "attendant" | "host"; title: string; sample: string; what: string; when: string; how: string[] }[] = [
  {
    type: "hero", title: "Heroes", sample: "cu",
    what: "The fighters. Each quadrant of the wheel is one hero and the two supports behind it, and the heroes fight their duels at the ford to the death.",
    when: "**Drafting turn**, on a hero spot (1, 4, 7 or 10). Spots 1 and 7 meet in the first duel, 4 and 10 in the second.",
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
    when: "**Drafting turn**, two behind each hero. **Playing turn**: supplant an enemy support with one of yours. **At the ford**: use a placed support (the first time free, then at its price), or play one you draw off the Reserve (used once, then discarded).",
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
    when: "**Playing turn**: bind the enemy hero you face (targeted), or lay a global geis that binds **every** hero on the field, your own too.",
    how: [
      "A hero may still **break** a geis: pay **2 Valour**, then act. Cathbad the druid lets one break go free; Emain's ward ignores geasa entirely.",
      "Some geasa also bite at the start of the duel: they invoke a **tag** (−2 Valour), punish big heroes (−2 Valour), or take **3 Initiative**.",
      "Global geasa are best laid when the forbidden thing matters more to the enemy, as the king's peace does for the weapon-less Merrow.",
    ],
  },
  {
    type: "oath", title: "Oaths", sample: "v_blood",
    what: "A vow sworn on your own hero: a **boon** for that hero's duel, paid for by a **vow**.",
    when: "**Playing turn**, on one of your heroes.",
    how: [
      "The boon is Strikes, Shield, Valour, Initiative or Heals. The vow forbids some supports or resting, like a geis you chose.",
      "Breaking the vow costs **2 Valour**. A champion who steps in is free of it, and loses the boon.",
      "Pick the oath whose vow your hero's quadrant never needed anyway.",
    ],
  },
  {
    type: "omen", title: "Omens", sample: "o_crow",
    what: "Fate. Omens wait face down until you turn them, then hold for the rest of the match.",
    when: "**The Muster**: put up to four in your Omen spots, face down, as you draw them. **Playing turn**: turn one face up (a targeted omen picks its hero as it turns).",
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
    when: "**Drafting turn**, on a hero spot: the host goes down with the monsters you join to it from your hand.",
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
    when: "**Playing turn**, from your hand, like an oath. It stays for the rest of the match.",
    how: [
      "**Enchant**: your Weapons (or Feats) count as an element. **Turn**: supports of one element count as another. **Channel**: the same, with Strike **+1**, but the hero using it loses **1 Valour**. **Reforge**: supports of one kind count as another. **Curse**: heroes in reach are also weak to a new element.",
      "{yours} **Your heroes**, {enemy} **the enemy's**, or {global} **every hero**: printed on the card.",
      "The new element or kind counts for everything: **Focus**, the element wheel, **weakness**, omens, and the **geasa and oaths** that forbid it. So an attendant can slip a geis (a Weapon reforged as a Word is free of the king's peace) or walk the enemy's cards into one.",
      "The Sídhe, who lean on Fire and Weapons, have the most: Goibniu's apprentice, Airmed's attendant, Ogma's scribe, the changeling and Bé Néit's shriek.",
      "Up to **2** in a deck. In a tie-break's backwards round they go back to hand.",
    ],
  },
];
