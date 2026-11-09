// Display-only words for the card faces: a short ability name, plain reminder text and, for cards with room,
// a line of lore. Nothing here changes a rule; each entry restates what engine/cards.ts and engine/engine.ts do.
// Markup: **word** is a keyword (bold), {name} is an inline icon from Icons.tsx.
import type { CardDef, Effect, SupportDef } from "./engine/cards";

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
  ferdiad: { ability: "Horn-skin", text: "Starts each duel with {shield} **Shield 1**." },
  fergus: { ability: "Old oath", text: "His Strikes are **−1** against a hero whose geis is **Hound**." },
  ailill: { ability: "Pillow-talk", text: "His Heals **+1**." },
  lugh: { ability: "Samildánach", text: "Every support counts as his **Focus**, so each one gets **+1**." },
  dagda: { ability: "The cauldron", text: "When he rests, {heal} **Heal 2**." },
  morrigan: { ability: "Battle-crow", text: "**Strikes +1.** Once per match, at the start of her duel, she may change her Focus to any element." },
  brigid: { ability: "Healer's well", text: "Her Heals **+1**." },
  balor: { ability: "Evil eye", text: "His first Strike in each duel **+2**." },
  bres: { ability: "Niggard king", text: "The enemy hero's Heals **−1**." },
  cethlenn: { ability: "Bloodied tooth", text: "**Strikes +1.** When her Strike wounds, {heal} **Heal 1**." },
  indech: { ability: "Sea-giant", text: "No Strike against him can be more than **3**." },
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
  o_mist: { text: "Your hero strikes **first** in both duels. Two Mists cancel out.", lore: "A druid's mist hides the host from its foes." },
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
  const parts = d.effects.map((e) => `{${e.type}} **${EFF_WORD[e.type]} ${e.n}**`);
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
export function boonLine(b: { strike?: number; shield?: number; valour?: number; init?: number; heal?: number }): string {
  const now: string[] = [];
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

/** The lines a card face shows, in order. `kind` sets how each is drawn. */
export type FaceLine = { kind: "effect" | "ability" | "text" | "lore" | "rule" | "break"; text: string };
export function faceLines(d: CardDef): FaceLine[] {
  const f = FACE[d.id] ?? {};
  const out: FaceLine[] = [];
  const push = (kind: FaceLine["kind"], text?: string) => { if (text) out.push({ kind, text }); };
  switch (d.type) {
    case "hero": case "champion":
      push("ability", f.ability); push("text", f.text ?? d.quality); break;
    case "support":
      push("effect", effectLine(d)); push("ability", f.ability); push("text", f.text); push("lore", f.lore); break;
    case "geis":
      push("rule", forbidLine(d.forbids, d.scope === "global")); push("ability", f.ability); push("text", f.text); push("lore", f.lore); push("break", BREAK); break;
    case "oath":
      push("ability", "Boon"); push("text", boonLine(d.boon)); push("ability", "Vow"); push("text", vowLine(d.forbids)); push("break", BREAK); break;
    case "omen":
      push("text", f.text ?? d.text); push("lore", f.lore); break;
    default: break;
  }
  return out;
}
