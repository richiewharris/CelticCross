// Display-only words for the card faces: a short ability name, plain reminder text and, for cards with room,
// a line of lore. Nothing here changes a rule; each entry restates what engine/cards.ts and engine/engine.ts do.
// Markup: **word** is a keyword (bold), {name} is an inline icon from Icons.tsx.
import { HEROES, reuseOf, type Reuse, type AttendantDef, type HeroAb, type CardDef, type Effect, type GeisDef, type SupportDef } from "./engine/cards";

export interface Face {
  /** The ability's name, set as a small heading above the text. */
  ability?: string;
  /** What it does, in plain words. */
  text?: string;
  /** A line of lore, dropped first when the card is too small to hold it. */
  lore?: string;
}

const NEXT = "Your next Strike **+1**.";
const BIG = "a hero printed with Valour **5+**";
const invoke = (tag: string) => `If the enemy hero's geis is **${tag}**, it loses **2 Valour**.`;
const firstMinus = "In each duel, the first Strike against your hero is **−1**.";
const startShield = "Your heroes start each duel with {shield} **Shield 1**.";

export const FACE: Record<string, Face> = {
  // heroes
  cu: { ability: "Ríastrad", text: "**Strikes +1.** At 1 Valour or less, **+2 more**. Untouched by the Debility of the Ulstermen." },
  conall: { ability: "Cet's bane", text: `**Strikes +1** against ${BIG}. In the second duel, **+1 more** if your first hero fell.` },
  conchobar: { ability: "King's due", text: "Once per duel, he may use an unused support from your other hero's quadrant." },
  emer: { ability: "Six gifts", text: "When she rests, {heal} **Heal 2**." },
  medb: { ability: "Queen of Cruachan", text: "**Kinship** gives her **+2**, not +1, when she uses a support of her own people." },
  ferdiad: { ability: "Horn-skin", text: "{armour} **Armour 1**: every Strike against him is **1** less, all duel (what ignores Shield ignores it)." },
  fergus: { ability: "Old oath", text: "His Strikes are **−1** against a hero whose geis is **Hound**." },
  ailill: { ability: "Pillow-talk", text: "His Heals **+1**." },
  lugh: { ability: "Samildánach", text: "Every support counts as his **Focus**, so each one gets **+1**." },
  dagda: { ability: "The cauldron", text: "When he rests, {heal} **Heal 2**." },
  morrigan: { ability: "Battle-crow", text: "**Strikes +1.** Once per match, at the start of her duel, she may change her Focus to any element." },
  brigid: { ability: "Healer's well", text: "Her Heals **+1**." },
  balor: { ability: "Evil eye", text: "His first Strike in each duel **+1**." },
  bres: { ability: "Niggard king", text: "The enemy hero's Heals **−1**." },
  cethlenn: { ability: "Bloodied tooth", text: "**Strikes +1.** When her Strike wounds, {heal} **Heal 1**." },
  indech: { ability: "Sea-giant", text: "No Strike against him can be more than **4**." },
  manannan: { ability: "Cloak of mist", text: "The first Strike against him in each duel **misses**." },
  fand: { ability: "Sea-glamour", text: "**Strikes +1.**" },
  liban: { ability: "Salmon-shape", text: "When she rests, {shield} **Shield 2**." },
  coomara: { ability: "Soul cages", text: "When his Strike wounds, {heal} **Heal 1**." },
  // champions
  loegaire: { ability: "Victorious", text: "His first Strike after he steps in **+1**." },
  fiacha: { ability: "Shield-bearer", text: "Steps in with {shield} **Shield 1**." },
  loch: { ability: "Lóch's fury", text: "**Strikes +1.**" },
  nadcrantail: { ability: "Holly spears", text: "His first Strike after he steps in **+1**." },
  nuada: { ability: "Silver hand", text: "Steps in with {shield} **Shield 1**." },
  ogma: { ability: "Sun-face", text: "His first Strike after he steps in **+1**." },
  elatha: { ability: "Golden king", text: "No special quality: he is simply big." },
  tethra: { ability: "Sea-crow", text: "When his Strike wounds, {heal} **Heal 1**." },
  roane: { ability: "Seal-hide", text: "Steps in with {shield} **Shield 1**." },
  banshee: { ability: "The keen", text: "The enemy's {heal} **Heals −1**." },
  fear_doirich: { ability: "Lord of the host", text: "His first Strike after he steps in **+1**." },
  muirdris: { ability: "Sea-beast", text: "No Strike against it can be more than **3**." },

  // supports
  salmon: { lore: "The hero's leap, learned from Scáthach." },
  gae_bolga: { ability: "Cú's own spear", text: "**Strike 4** when Cú Chulainn uses it." },
  thunder: { lore: "A feat that splits shields like kindling." },
  warp: { ability: "The price", text: "Your hero loses **1 Valour**." },
  sling: { ability: "Opening shot", text: "**+1** if no support has been used yet this duel." },
  ochain: { lore: "Conchobar's shield roars when its bearer is in danger." },
  laeg: { ability: "Goad the horses", text: NEXT },
  brown_bull: { lore: "Donn Cúailnge, the prize the whole Táin was fought for." },
  cathbad: { ability: "Druid's leave", text: "Once this duel, your hero may ignore one geis or oath **without paying** Valour." },
  cet_spear: { lore: "Cet mac Mágach, boldest of the men of Connacht." },
  host: { lore: "The men of Ireland muster at Cruachan." },
  medb_chariot: { ability: "Ride them down", text: NEXT },
  fedelm: { ability: "“I see red”", text: NEXT },
  horn_shield: { lore: "Ferdiad met the Hound at the ford in a skin of horn." },
  finnbennach: { lore: "The white-horned bull of Ailill's herds." },
  caladbolg: { lore: "Fergus's sword, that sheared the tops off three hills." },
  barach: { ability: "Invoke Hospitality", text: invoke("Hospitality") },
  spear_assal: { lore: "Lugh's spear: it never misses its cast." },
  fragarach: { lore: "No armour holds against the Answerer." },
  tathlum: { ability: "Giant-slayer", text: `**+2** against ${BIG}.` },
  goibniu: { lore: "A spearhead from Goibniu's forge never fails to kill." },
  raven: { lore: "The Morrígan's cry over the field." },
  dian_cecht: { lore: "The well of Sláine, where the wounded were made whole." },
  uaithne: { ability: "The battle-strain", text: NEXT },
  fe_fiada: { lore: "The druid mist that hides the wearer from sight." },
  gaze: { ability: "Balor's own eye", text: "**Strike 3** when Balor uses it." },
  tower: { lore: "Conand's tower on Tory, where the Fomóire took their tribute." },
  sea_raid: { lore: "Out of the sea the Fomóire come for their due." },
  galley: { lore: "Fomorian ships darken the western sea." },
  club: { lore: "A giant's club, heavy as a felled oak." },
  tribute: { ability: "Invoke Plenty", text: invoke("Plenty") },
  octriallach: { ability: "Healing stones", text: "If its Strike wounds, {heal} **Heal 1**." },
  blight: { ability: "Invoke Forge", text: invoke("Forge") },
  cohuleen: { lore: "The merrow's red cap: without it she cannot go home to the sea." },
  cliodhna: { lore: "One of the three great waves of Ireland." },
  undertow: { lore: "The sea takes back what it gives." },
  riptide: { ability: "Pull under", text: NEXT },
  sealskin: { lore: "Hide the skin, and the seal-folk cannot leave." },
  pearl: { lore: "A gift from the halls beneath the waves." },
  soul_cage: { ability: "Drowned souls", text: "If its Strike wounds, {heal} **Heal 1**." },
  scuab: { lore: "Manannán's boat, that needs no sail or oar." },

  // the second half of each pool
  cruaidin: { lore: "Cú Chulainn's own sword, hard-hilted." },
  beheading: { lore: "At the feast a churl offered his neck, if a hero would bare his own the next night." },
  bricriu: { lore: "Bricriu's feast set the heroes of Ulster at each other's throats." },
  athirne: { lore: "No king dared refuse Athirne the satirist." },
  leborcham: { lore: "Leborcham, Conchobar's messenger, crossed Ireland in a day." },
  sencha: { lore: "Sencha could still a quarrel of heroes with a word." },
  grey_macha: { lore: "Cú Chulainn's horse wept tears of blood before his last fight." },
  scathach: { lore: "Scáthach taught him every feat she knew, in her fortress in Alba." },
  dubsainglend: { lore: "The second horse of Cú Chulainn's chariot." },
  tain: { lore: "The cattle-raid of Cúailnge, greatest of the tales." },
  fraech: { lore: "Fráech, Medb's champion, fell to the Hound in the ford." },
  cruachan_gold: { lore: "Medb and Ailill counted their treasures, and quarrelled." },
  mac_roth: { lore: "Mac Roth, Medb's herald, came to bargain with the Hound." },
  gamanrad: { lore: "The Gamanrad, the warrior-band of Connacht." },
  ferdiad_sword: { lore: "Medb's gifts brought Ferdiad to fight his foster-brother." },
  medb_druids: { lore: "Medb's druids chanted against the men of Ulster." },
  finnabair: { lore: "Medb promised her daughter to every champion who would face the Hound." },
  fergus_shield: { lore: "An exile's shield, carried among strangers." },
  cauldron: { lore: "No company ever left the Dagda's cauldron unsatisfied." },
  dagda_club: { lore: "One end of the club kills; the other brings the dead to life." },
  credne: { lore: "Credne the brazier made the rivets for the Tuatha Dé's spears." },
  failinis: { lore: "No beast could escape Lugh's hound." },
  ogham: { lore: "Ogma the strong devised the ogham letters." },
  airmed: { lore: "Airmed gathered the herbs that grew from her brother's grave." },
  morrigan_word: { lore: "Before the battle, the Morrígan foretold its end." },
  bodb: { lore: "Bodb Derg, the Dagda's son, and his war-band." },
  sword_light: { lore: "Nuada's sword: no one escaped it once it was drawn." },
  lochlann: { lore: "Out of Lochlann the Fomóire sailed with their host." },
  mound_song: { lore: "A song from the mounds can call a sailor into the hill." },
  unlidded: { lore: "It took four men to lift the lid of Balor's eye." },
  glare: { lore: "Where the eye falls, armies wither." },
  tethra_host: { lore: "Tethra, king of the Fomóire, ruled the host of the sea." },
  bres_tax: { lore: "Bres taxed the Tuatha Dé until their cows ran dry." },
  cethlenn_spear: { lore: "Cethlenn, Balor's wife, wounded the Dagda at Mag Tuired." },
  seawall: { lore: "Indech's host came against Ireland out of the sea." },
  bitter_well: { lore: "The Fomóire filled the healing well with stones." },
  sea_mist: { lore: "Mist rolls in from the northern sea." },
  domnann: { lore: "The spearmen of the Domnann, from the western shore." },
  tide_wrath: { lore: "The sea answers the merrow's call." },
  enbarr: { lore: "Manannán's horse runs on the waves as on dry land." },
  fand_tears: { lore: "Fand wept when Manannán shook his cloak between her and the Hound." },
  wave_break: { lore: "Each wave breaks, and the next is already rising." },
  net: { lore: "A fisherman's net can drown a fisherman." },
  kelp: { lore: "Wrack and weed hide the merrow's road home." },
  siren: { lore: "Sailors who hear it steer for the rocks." },
  crane_bag: { lore: "The crane-bag held every treasure of the sea." },
  roane_lament: { lore: "The seal-folk mourn on the strand at night." },

  // the Slúagh
  hunt: { lore: "The host rides the night wind, and woe to the traveller on the road." },
  prey: { lore: "Hunted itself, the host scatters like starlings and gathers again." },
  taboo: { lore: "Name it, and it comes: the host is a curse laid on a place." },
  dullahan: { lore: "He carries his head under his arm, and where he stops, a man dies." },
  puca: { lore: "Horse, goat or hare: the púca is never what it seems." },
  dearg_due: { lore: "She rises from her grave to drink from the living." },
  fear_dearg: { lore: "The red man asks to sit by your fire. Refuse him at your peril." },
  bean_nighe: { lore: "She washes the shirts of those about to die." },
  marbh: { lore: "The restless dead walk in their hundreds." },
  each_uisce: { lore: "Mount the water-horse, and it carries you into the lake." },
  fear_gorta: { lore: "The hungry man begs at the door in famine years." },
  bananach: { lore: "The bánánach shriek in the air over the battle." },
  cold_touch: { lore: "A hand on the shoulder, colder than the grave." },
  keening_dead: { lore: "They keen for the living who are about to join them." },
  grave_chill: { lore: "The cold of the grave seeps into the bones." },
  spine_whip: { lore: "The Dullahan's whip is a human spine." },
  corpse_candle: { lore: "A light over the bog that leads the unwary astray." },
  death_coach: { lore: "The silent coach comes for a soul, and will not leave empty." },
  bone_dust: { lore: "Ground bones, scattered at the threshold." },
  hungry_grass: { lore: "Step on the hungry grass and you'll never be full again." },
  hunt_horn: { lore: "The horn sounds and the host takes up the chase." },
  wail: { lore: "A cry that stops the heart." },
  grave_dirt: { lore: "A fistful of earth from a fresh grave." },
  harvest: { lore: "At Samhain the host gathers the souls of the year's dead." },
  black_mass: { lore: "Everything it touches withers." },
  famine: { lore: "The famine wind blows the crops black." },

  glamour: { lore: "A glamour of the Sídhe: what you see is not what is there." },
  fairy_music: { lore: "Men who hear the music of the mounds dance till they drop." },
  aengus_kiss: { lore: "Aengus's kisses became birds that sang love into every heart." },
  // attendants
  a_apprentice: { lore: "He works the bellows, and the blade comes out burning." },
  a_fordkeeper: { lore: "She tempers every edge in the river." },
  a_curse: { lore: "A poet's curse raises blotches on a king's face." },
  a_weather: { lore: "She whistles up a wet wind from the west." },
  a_poet: { lore: "He sings the stones hot." },
  a_bard: { lore: "His harp turns the tide to a breeze." },
  a_culann: { lore: "Culann made Conchobar's arms, and the hound that guarded his forge." },
  a_sualtam: { lore: "Cú Chulainn's father rode crying through Ulster to warn it." },
  a_handmaid: { lore: "She dries the queen's spears by the fire of Cruachan." },
  a_cailitin: { lore: "Calatín's children, schooled in sorcery to bring down the Hound." },
  a_goibniu: { lore: "Goibniu's apprentices forge a spearhead in three blows." },
  a_airmed: { lore: "Airmed sorts the herbs: what burns, she turns to breath." },
  a_scribe: { lore: "Ogma cut the letters, and every blade became a word." },
  a_changeling: { lore: "What the Sídhe leave in the cradle is never what they took." },
  a_benet: { lore: "Bé Néit's shriek over the host: a hundred men died of fright." },
  a_thrall: { lore: "Tethra's thralls draw the wind down into the sea." },
  a_eyebearers: { lore: "The four who lift Balor's lid choose what it falls on." },
  a_selkie: { lore: "A seal's daughter, born with the sea in her hands." },
  a_bell: { lore: "Under the waves a church bell rings, and fires go out." },

  // geasa: the first line (what it forbids) is built from the card's data; these add the rest
  g_door: { ability: "Invoke Hospitality", text: "A bound hero whose geis is **Hospitality** starts its duel **2 Valour** lower.", lore: "A guest's geis: never refuse a hearth's welcome." },
  g_hound: { ability: "Invoke Hound", text: "A bound hero whose geis is **Hound** starts its duel **2 Valour** lower.", lore: "Cú Chulainn's geis: never eat the flesh of a dog." },
  g_giant: { ability: "Fell the big ones", text: `If the bound hero is printed with Valour **5+**, it starts its duel **2 Valour** lower.` },
  g_slow: { ability: "Slow hand", text: "The bound hero's {init} **Initiative −3**." },

  // omens
  o_debility: { text: "Ulaid and Deorad heroes' Strikes **−1**. Cú Chulainn is spared.", lore: "Macha's curse: in their hour of need, the men of Ulster lie weak." },
  o_crow: { text: "Supports with a {heal} **Heal** are forbidden to every hero; breaking costs **2 Valour**. Resting heals no one.", lore: "She perches on the shoulder of the dying." },
  o_truce: { text: "No Strike can be more than **3**.", lore: "At Samhain the feast is kept, and no hand is raised." },
  o_darkness: { text: "In the first duel, the **lower** Initiative strikes first.", lore: "The Fomóire came out of the sea in darkness." },
  o_blight: { text: "Every Heal **−1**.", lore: "Under Bres the cows ran dry and the fields lay bare." },
  o_tide: { text: "Your Heals **+1**.", lore: "The tide brings back what it took." },
  o_mist: { text: "Your hero strikes **first** in the **first duel**. Two Mists cancel out.", lore: "A druid's mist hides the host from its foes." },
  o_herolight: { text: "The chosen hero's Strikes **+1**.", lore: "The hero's light rose from Cú Chulainn's brow." },
  o_keen: { text: "The chosen hero's Strikes **−1**.", lore: "The bean sídhe cries: someone here will die." },
  o_sleep: { text: "The chosen hero's {init} **Initiative −3**.", lore: "A druid's sleep falls like snow." },
  o_mantle: { text: "The chosen hero starts its duel with {shield} **Shield 1**.", lore: "Brigid's cloak spread over a whole plain." },
  o_lugh: { text: firstMinus, lore: "Lugh stood guard three days while his son slept." },
  o_fog: { text: firstMinus, lore: "Manannán shook his cloak between them." },
  o_emain: { text: "Your heroes **ignore every geis**, laid on one hero or on all.", lore: "Macha marked out Emain with the pin of her brooch." },
  o_culann: { text: firstMinus, lore: "Culann's hound kept his gate, until a boy took its place." },
  o_rath: { text: startShield, lore: "Cruachan's ráth, where the Otherworld opens." },
  o_tory: { text: startShield, lore: "Tory, the Fomóire's island stronghold." },
  o_boyhood: { text: "Your hero in the **first duel**: Strikes **+1**.", lore: "At seven years old, Sétanta took up arms." },
  o_portion: { text: "Your hero in the **second duel** starts with **+1 Valour**.", lore: "The best cut of the feast goes to the best of heroes." },
  o_tribute: { text: "Your hero in the **second duel**: Strikes **+1**.", lore: "Two-thirds of corn and milk, paid each Samhain." },
  o_wave: { text: "Your Shields **+1**.", lore: "Beyond the ninth wave lies the Otherworld." },
  o_redbranch: { text: "Your {Feat} **Feats +1**.", lore: "The heroes of the Red Branch gather at Emain." },
  o_brugh: { text: "Your {Word} **Words +1**.", lore: "The Brú, house of the Dagda and of Óengus." },
  o_ford: { text: "Your {Water} **Water** supports **+1**.", lore: "Every great fight of the Táin is fought at a ford." },
  o_cruachan: { text: "Your Heals **+1**.", lore: "Cruachan's tables are never bare." },
};

const EFF_WORD: Record<Effect["type"], string> = { strike: "Strike", heal: "Heal", shield: "Shield" };
/** The support's effects as words, built from its numbers: "{strike} **Strike 2**, ignoring Shield". */
export function effectLine(d: SupportDef): string {
  if (d.use === "passive") return `{armour} **Armour ${d.armour ?? 0}**, passive: while it is placed beside your hero, every Strike against the hero is **${d.armour ?? 0}** less (what ignores Shield ignores it).`;
  if (d.use === "reaction") return `{block} **Block ${d.effects[0]?.n ?? 0}**, a reaction: when the enemy strikes, tap it to take **${d.effects[0]?.n ?? 0}** off that blow (+1 kinship, +1 Focus, +1 or +2 if your hero has just rested).`;
  const parts = d.effects.map((e) => `{${e.type}} **${EFF_WORD[e.type]} ${e.n}**`);
  if (d.element === "Spirit") return parts.join(" and ") + " of **Spirit**: it passes Shield (not Armour or Blocks) and steals {heal} **1** when it wounds (never more than 1 a Strike).";
  return parts.join(" and ") + (d.pierce ? ", **ignoring Shield**." : ".");
}
const KIND_PLURAL: Record<string, string> = { Weapon: "Weapons", Feat: "Feats", Ally: "Allies", Word: "Words" };
type Forbid = { element?: string; kind?: string; rest?: boolean; heal?: boolean };
/** The supports a geis or an oath forbids, from its data ("" if it forbids none). */
function forbiddenSupports(f: Forbid): string {
  const out: string[] = [];
  if (f.element) out.push(`{${f.element}} **${f.element}** supports`);
  if (f.kind) out.push(`{${f.kind}} **${KIND_PLURAL[f.kind]}**`);
  if (f.heal) out.push("supports with a {heal} **Heal**");
  return out.join(" or ");
}
/** A geis's prohibition: "Forbids {Water} **Water** supports." or "**No hero** may rest." */
export function forbidLine(f: Forbid, global: boolean): string {
  const sup = forbiddenSupports(f);
  if (global) return `**No hero** may ${[sup ? `use ${sup}` : "", f.rest ? "rest" : ""].filter(Boolean).join(" or ")}.`;
  return `Forbids ${[sup, f.rest ? "**resting**" : ""].filter(Boolean).join(" and ")}.`;
}
/** An oath's vow: "Never use {Word} **Words**." / "Never use ...; never **rest**." */
export function vowLine(f: Forbid): string {
  const sup = forbiddenSupports(f);
  if (!sup) return f.rest ? "Never **rest**." : "";
  return `Never use ${sup}${f.rest ? "; never **rest**" : ""}.`;
}
/** An oath's boon, from its data. */
export function boonLine(b: { strike?: number; shield?: number; valour?: number; init?: number; heal?: number; followUp?: boolean }): string {
  const now: string[] = [];
  if (b.followUp) now.push("a blow that wounds for **1 or less** strikes **again** at once");
  if (b.strike) now.push(`Strikes **+${b.strike}**`);
  if (b.init) now.push(`{init} **Initiative +${b.init}**`);
  if (b.heal) now.push(`Heals **+${b.heal}**`);
  const start: string[] = [];
  if (b.valour) start.push(`**+${b.valour} Valour**`);
  if (b.shield) start.push(`{shield} **Shield ${b.shield}**`);
  const parts = [...now];
  if (start.length) parts.push(`${now.length ? "s" : "S"}tarts its duel with ${start.join(" and ")}`);
  return parts.join("; ") + ".";
}
const BREAK = "To break it, pay **2 Valour**.";

/** An ability for a support with no hand-written words, from its data. */
function autoSupport(d: SupportDef): Face {
  if (d.stealShield || (d.pierce && d.foeNext)) {
    const bits = ["Goes through Shield."];
    if (d.stealShield) bits.push(`Take up to **${d.stealShield}** of the enemy's {shield} Shield for your own.`);
    if (d.foeNext) bits.push(`The enemy's next Strike **−${d.foeNext}**.`);
    return { ability: "Charm", text: bits.join(" ") };
  }
  if (d.forHero) { const h = HEROES[d.forHero.id]; const n = h ? h.name.replace(/,.*$/, "") : d.forHero.id; return { ability: `${n}'s own`, text: `**Strike ${d.forHero.n}** when ${n} uses it.` }; }
  if (d.invoke) return { ability: `Invoke ${d.invoke}`, text: invoke(d.invoke) };
  if (d.nextStrike) return { ability: "Follow-through", text: NEXT };
  if (d.foeNext) return { ability: "Wither", text: `The enemy's next Strike **−${d.foeNext}**.` };
  if (d.foeLoss) return { ability: "Drain", text: `The enemy loses **${d.foeLoss} Valour**; no Shield stops it.` };
  if (d.drain) return { ability: "Drink deep", text: "If its Strike wounds, {heal} **Heal 1**." };
  if (d.firstBonus) return { ability: "Opening blow", text: `**+${d.firstBonus}** if no support has been used yet this duel.` };
  if (d.vsBig) return { ability: "Giant-slayer", text: `**+${d.vsBig}** against ${BIG}.` };
  if (d.selfLoss) return { ability: "The price", text: `Your hero loses **${d.selfLoss} Valour**.` };
  return {};
}
/** The extra bite of a geis with no hand-written words, from its data. */
function autoGeis(d: GeisDef): Face {
  if (d.invoke) return { ability: `Invoke ${d.invoke}`, text: `A bound hero whose geis is **${d.invoke}** starts its duel **2 Valour** lower.` };
  if (d.bigLoss) return { ability: "Fell the big ones", text: `If the bound hero is printed with Valour **5+**, it starts its duel **${d.bigLoss} Valour** lower.` };
  if (d.initLoss) return { ability: "Slow hand", text: `The bound hero's {init} **Initiative −${d.initLoss}**.` };
  if (d.weak) return { ability: "A new weakness", text: `The bound hero is also **weak to {${d.weak}} ${d.weak}**. Against the Fomóire's giant-kin, that element lands in full.` };
  return {};
}

/** A fighter's qualities in plain words, from its numbers (used for the Slúagh's hosts and monsters). */
export function abLine(ab: HeroAb): string {
  const out: string[] = [];
  if (ab.strikeAll) out.push(`Strikes **+${ab.strikeAll}**.`);
  if (ab.firstStrike) out.push(`First Strike each duel **+${ab.firstStrike}**.`);
  if (ab.drain) out.push(`When its Strike wounds, {heal} **Heal ${ab.drain}**.`);
  if (ab.foeHealMalus) out.push(`The enemy's Heals **−${ab.foeHealMalus}**.`);
  if (ab.firstHitSoak) out.push(`The first Strike against it each duel **−${ab.firstHitSoak}**.`);
  if (ab.shieldStart) out.push(`Starts each duel with {shield} **Shield ${ab.shieldStart}**.`);
  if (ab.capTaken !== undefined) out.push(`No Strike against it above **${ab.capTaken}**.`);
  if (ab.reflect) out.push(`**Uninvited guest**: when a Strike wounds it, the striker loses **${ab.reflect} Valour**.`);
  return out.join(" ");
}
const KP: Record<string, string> = { Weapon: "Weapons", Feat: "Feats", Ally: "Allies", Word: "Words" };
/** An attendant's effect, from its data. */
export function attendantLine(d: AttendantDef): string {
  const whose = d.scope === "global" ? "Every hero's" : d.scope === "yours" ? "Your heroes'" : "The enemy's";
  switch (d.mode) {
    case "curse": return `${d.scope === "global" ? "Every hero is" : d.scope === "yours" ? "Your heroes are" : "The enemy's heroes are"} **also weak to** {${d.to}} **${d.to}**.`;
    case "enchant": return `${whose} {${d.kind}} **${KP[d.kind!]}** count as {${d.to}} **${d.to}**.`;
    case "reforge": return `${whose} {${d.kind}} **${KP[d.kind!]}** count as {${d.toKind}} **${KP[d.toKind!]}**.`;
    case "turn": return `${whose} {${d.from}} **${d.from}** supports count as {${d.to}} **${d.to}**.`;
    case "channel": return `${whose} {${d.from}} **${d.from}** supports count as {${d.to}} **${d.to}**, with Strike **+1**; the hero using one loses **1 Valour**.`;
  }
}

/** The lines a card face shows, in order. `kind` sets how each is drawn. */
export type FaceLine = { kind: "effect" | "ability" | "text" | "lore" | "rule" | "break" | "reuse"; text: string };
/** The price of using a placed support again in a long duel, in words. */
export function reuseLine(r: Reuse): string {
  const bits: string[] = [];
  if (r.turns) bits.push(r.turns === 1 ? "not two turns running" : `${r.turns} other actions between`);
  if (r.rest) bits.push(r.rest === 1 ? "after a rest" : `after ${r.rest} rests`);
  if (r.valour) bits.push(`pay **${r.valour} Valour**`);
  if (r.draw) bits.push(`discard **${r.draw === 1 ? "the top card" : `${r.draw} cards`}** of your Reserve`);
  return bits.length ? `Again: ${bits.join("; ")}.` : "Again: any time.";
}
export function faceLines(d: CardDef): FaceLine[] {
  const hand = FACE[d.id] ?? {};
  const auto = d.type === "support" ? autoSupport(d) : d.type === "geis" ? autoGeis(d) : {};
  const f: Face = hand.ability || hand.text ? hand : { ...auto, lore: hand.lore };
  const out: FaceLine[] = [];
  const push = (kind: FaceLine["kind"], text?: string) => { if (text) out.push({ kind, text }); };
  switch (d.type) {
    case "hero": case "champion":
      if (d.type === "hero" && d.host) {
        push("ability", d.host.def.name);
        push("text", `${d.host.members.length ? d.host.members.map((m) => m.name.replace(/^The /, "")).join(", ") : "No monsters"}. ${abLine(d.ab)}${d.hybrids?.length ? ` Each {Spirit} Spirit blow may land as Spirit or as ${d.hybrids.map((h) => `{${h}} **${h}**`).join(" or ")}.` : ""}`);
        push("rule", "Once a duel, **sacrifice** a monster to win back its Valour; once a match, **summon** one from your other host.");
        break;
      }
      push("ability", f.ability); push("text", f.text ?? d.quality);
      if (d.alignment === "Sidhe") push("text", "**Veiled**: the first Strike against them each duel **−1**. **The mound**: every Strike against them **−1** (nothing pierces it), until it has soaked **5** in all over the match.");
      if (d.ab.followUp) push("text", "**Swift**: a blow of theirs that wounds for **1 or less** strikes **again** at once.");
      if (d.ab.riposte) push("text", `**Riposte**: when their {shield} Shield takes a blow, a free **Strike ${d.ab.riposte}** back (no action).`);
      if (d.alignment === "Connachta") push("text", "**Bleed**: every blow of theirs that wounds makes the enemy's Heals **−1** until the end of its next turn (it doesn't stack: two hits are still −1).");
      if (d.alignment === "Ulaid") push("text", "**The Hound's cry**: once a duel, a blow of theirs that ignores Shield may spend the top card of the Reserve to go through a giant's hide (no halving).");
      if (d.alignment === "Fomoire") push("text", `**Giant-kin**: takes **half** the wounds of every Strike, except of its weakness, {${d.weakness}} **${d.weakness}** (or one laid on it), which lands in full.`);
      break;
    case "host":
      push("ability", d.kind === "hunt" ? "The ride" : d.kind === "prey" ? "Scatter" : "The curse");
      push("text", `${abLine(d.ab)}${d.valourEach ? ` **+${d.valourEach} Valour** for each monster.` : ""} Weak to {${d.weakness}} **${d.weakness}**. The dead do not sleep: omens can't lower its Initiative. **Dream-walking**: when the enemy rests, the host heals **2**. Its {Spirit} Spirit blows can't be **Blocked**. Running water: a Merrow's Shield holds against its Spirit.`);
      push("rule", "Goes on a hero spot with **2 or 3 monsters** joined from your hand. They fight as one. In a duel it may **sacrifice** a monster (once a duel) or **summon** one from your other host (once a match).");
      push("lore", f.lore); break;
    case "monster":
      push("ability", d.quality.split(":")[0]);
      push("text", `${abLine(d.ab) || "No quality of its own."}${d.hybrid ? ` **Hybrid**: each of the host's {Spirit} Spirit blows may land as {${d.hybrid}} **${d.hybrid}** instead (element bonuses count; Shield soaks it; nothing stolen).` : ""} Weak to {${d.weakness}} **${d.weakness}**, but the host takes it on only if the host or another monster shares it.`);
      push("lore", f.lore); break;
    case "support":
      push("effect", effectLine(d)); push("ability", f.ability); push("text", f.text); push("lore", f.lore);
      // in a duel to the death: passive cards work by being placed; reactions are tapped against a blow
      push("reuse", d.use === "passive" ? "Passive: nothing to use, it works while placed beside its hero." : d.use === "reaction" ? "Reaction: tap it when struck. Again: after one of your own turns." : reuseLine(reuseOf(d))); break;
    case "geis":
      push("rule", forbidLine(d.forbids, d.scope === "global")); push("ability", f.ability); push("text", f.text); push("lore", f.lore); push("break", BREAK); break;
    case "oath":
      push("ability", "Boon"); push("text", boonLine(d.boon)); push("ability", "Vow"); push("text", vowLine(d.forbids)); push("break", BREAK); break;
    case "omen":
      push("text", f.text ?? d.text); push("lore", f.lore); break;
    case "attendant":
      push("text", attendantLine(d)); if (d.mode !== "curse" && d.scope !== "enemy") push("text", "Your cards it changes get **+1**."); push("lore", f.lore); push("break", "Called in the Playing turn; stays for the match."); break;
    default: break;
  }
  return out;
}
