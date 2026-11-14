// The rules as numbers. Every people power, setting effect, trial and layer switch is one number here (0 = off), so
// a balance change is a change of value, never of code, and every simulated run can record exactly where in this
// space it was played (sim/roth/cube). A run sets values with rules.params, e.g. { "people.sluagh.dreams": 2 }.
//
// Each value resolves in this order: rules.params, then the older rule field it replaced (so saved games and older
// cube runs keep their meaning), then the default below. The shapes of the rules are frozen: to remove an effect, set
// its number to 0.
import type { Rules } from "./engine";
import { settingDef, type SettingDef } from "./settings";

export const PARAMS = {
  // ---- duels to the death
  /** Valour every fighter gets at the start of each duel (the ford's +3; a setting's own value, unless set here). */
  "duel.fordValour": 3,
  /** Weariness: from turn wearyAfter of a duel each fighter loses n a turn, and 2n from twice that (0 = off)... */
  "duel.weariness": 1,
  /** ...starting at this turn of the duel (both sides' turns counted). */
  "duel.wearyAfter": 20,
  /** A geis costs its break every time it is broken, instead of breaking once (1 = on in duels to the death). */
  "geis.eachTime": 1,

  // ---- what is seen when
  /** Supports go down face down in the Marshalling and turn up as the Winnow begins (1 = on). */
  "rule.supportsFaceDown": 1,

  // ---- the Reckoning
  /** After the Marshalling each side may swap two of its own cards of a kind, chosen in secret (1 = on). */
  "rule.reckoning": 1,

  // ---- the setting
  /** The second player chooses the setting (0 = everyone fights at the ford). */
  "setting.choose": 1,
  /** ...once the Marshalling is over, every hero on the wheel (1), or before the Muster (0). */
  "setting.afterMarshalling": 1,
  /** Settings change Heals (the crossing's −1, Cruachan's +1): 1 = as printed, 0 = not at all. */
  "setting.heals": 1,
  /** The western crossing's drain heals a Slúagh host it feeds (1) or not (0). */
  "setting.drainFeeds": 1,
  /** The drain falls only on a fighter whose foe is Slúagh (1) or on everyone but the Slúagh (0). */
  "setting.drainVsSluaghOnly": 1,
  // A setting's own numbers can be set too: "setting.<id>.<field>", e.g. "setting.crossing.drain": 0 (fields:
  // valour, shield, heal, restHeal, drain, mound, and el.<Element> / kind.<Kind> for the Strike bonuses).

  // ---- the people
  /** Aos Sídhe: the veil (first Strike against them each duel −n, and their own first Strike −n). */
  "people.sidhe.veil": 1,
  /** Aos Sídhe: the mound takes this off every blow... */
  "people.sidhe.moundAC": 1,
  /** ...until it has soaked this much over the match (a setting may change it: Brú na Bóinne 7). */
  "people.sidhe.moundValour": 5,
  /** Aos Sídhe: every Spirit blow against them −n (otherworldly). */
  "people.sidhe.spiritResist": 2,
  /** Aos Sídhe: masters of geasa, a geis of theirs costs this much to break. */
  "people.sidhe.geisCost": 1,
  /** Merrow: every Spirit blow against them −n (flowing water). */
  "people.merrow.spiritResist": 1,
  /** Merrow: water can't be pierced, a blow that ignores Shield still meets their Block (1 = on). */
  "people.merrow.waterUnpierced": 1,
  /** Merrow trial (off): a Water blow that wounds them heals n back. */
  "people.merrow.tide": 0,
  /** Merrow trial (off): ...or half the wound back (1 = on). */
  "people.merrow.tideHalf": 0,
  /** Merrow trial (off): when their enemy heals, they gain Shield n... */
  "people.merrow.ebb": 0,
  /** ...once a turn only (1). */
  "people.merrow.ebbOnce": 0,
  /** Slúagh: the dead-flesh aura, no blow wounds a host for more than a share of its full Valour (1 = on)... */
  "people.sluagh.aura": 1,
  /** ...this share... */
  "people.sluagh.auraFrac": 0.5,
  /** ...but never below this... */
  "people.sluagh.auraMin": 5,
  /** ...rounded up (1) or down (0). */
  "people.sluagh.auraRoundUp": 0,
  /** Slúagh: dream-walking, they heal n whenever their enemy rests (off since the November balance: 0). */
  "people.sluagh.dreams": 0,
  /** Slúagh: Spirit blows can't be Blocked (1 = on). */
  "people.sluagh.spiritUnblock": 1,
  /** Slúagh: a summon spends the top card of the Reserve (1 = on). */
  "people.sluagh.summonCost": 1,
  /** Ulster: the Hound's cry (1 = on). */
  "people.ulster.cry": 1,
  /** Ulster: the Samhain watch, Strikes +n against a Spirit Focus. */
  "people.ulster.samhainWatch": 1,
  /** Ulster trial (off): the hero's light, first Strike each duel +n. */
  "people.ulster.light": 0,
  /** Ulster: battle-fury, Strikes +n at half Valour or less. */
  "people.ulster.fury": 1,
  /** Ulster trial (off): a felled Ulster hero strikes once more, Strike n. */
  "people.ulster.stand": 0,
  /** Ulster trial (off): staggering blows, a blow over half the enemy's starting Valour staggers it (+n to wounds). */
  "people.ulster.stagger": 0,
  /** Connacht: bleed, a blow of theirs that wounds makes the enemy's Heals −1... (1 = on) */
  "people.connacht.bleed": 1,
  /** ...stacking up to this. */
  "people.connacht.bleedCap": 1,
  /** Connacht: Swift reads the blow before a giant's hide halves it (1), or after (0). */
  "people.connacht.swiftUnhalved": 0,
  /** Fomóire: giant-kin, half the wounds of any blow but their weakness (1 = on). */
  "people.fomoire.giantKin": 1,
  /** Fomóire: giant-kin rounds the halved wounds down (1) instead of up (0). */
  "people.fomoire.roundDown": 1,

  // ---- measurement (sims only; off in play)
  /** Every fighter, not just a target dummy, rises again when felled, so every duel runs its full turn limit. */
  "sim.undyingAll": 0,

  // ---- layers: which kinds of card are in the game at all (1 = in, 0 = taken out of both decks)
  "layer.champion": 1,
  "layer.geis": 1,
  "layer.oath": 1,
  "layer.omen": 1,
  "layer.attendant": 1,
};
export type ParamKey = keyof typeof PARAMS;
export type Params = Partial<Record<ParamKey | `setting.${string}`, number>>;

const has = (s: string | undefined, x: string) => (s ?? "").split("+").some((t) => t.startsWith(x));
const numIn = (s: string | undefined, re: RegExp, d: number) => { const m = re.exec(s ?? ""); return m ? (m[1] ? Number(m[1]) : d) : 0; };

/** The older rule fields, read as parameters (undefined: the field wasn't set). */
function legacy(R: Rules, k: ParamKey): number | undefined {
  const b = (x: boolean | undefined) => (x === undefined ? undefined : x ? 1 : 0);
  const mr = R.merrow, ul = R.ulster;
  switch (k) {
    case "duel.fordValour": return R.fordValour;
    case "geis.eachTime": return b(R.geisEachTime);
    case "setting.choose": return R.settingBy === undefined ? undefined : R.settingBy === "none" ? 0 : 1;
    case "setting.heals": return R.noSettingHeal ? 0 : undefined;
    case "setting.drainFeeds": return R.drainNoFeed ? 0 : undefined;
    case "setting.drainVsSluaghOnly": return R.drainVsSluagh ? 1 : undefined;
    case "people.sidhe.veil": return R.veiled ? 1 : 0; // a saved position without the field had no veil
    case "people.sidhe.moundAC": return R.moundAC;
    case "people.sidhe.moundValour": return R.moundValour;
    case "people.sidhe.spiritResist": return R.noSpiritResist ? 0 : R.resistSidhe;
    case "people.merrow.spiritResist": return R.noSpiritResist ? 0 : undefined;
    case "people.merrow.waterUnpierced": return mr === undefined ? undefined : has(mr, "water") ? 1 : 0;
    case "people.merrow.tide": return mr === undefined ? undefined : /tide(\d)?(?!h)/.test(mr) && !/tideh/.test(mr) ? numIn(mr, /tide(\d)?/, 1) : 0;
    case "people.merrow.tideHalf": return mr === undefined ? undefined : /tideh/.test(mr) ? 1 : 0;
    case "people.merrow.ebb": return mr === undefined ? undefined : has(mr, "ebb") ? 1 : 0;
    case "people.merrow.ebbOnce": return mr === undefined ? undefined : has(mr, "ebb1") ? 1 : 0;
    case "people.sluagh.aura": return R.noAura ? 0 : b(R.aura);
    case "people.sluagh.auraFrac": return R.auraFrac;
    case "people.sluagh.auraMin": return R.auraMin;
    case "people.sluagh.auraRoundUp": return b(R.auraUp);
    case "people.sluagh.dreams": return R.dreams;
    case "people.sluagh.spiritUnblock": return b(R.spiritUnblock);
    case "people.sluagh.summonCost": return b(R.summonCost);
    case "people.ulster.cry": return R.noCry ? 0 : undefined;
    case "people.ulster.samhainWatch": return R.ulaidVsSpirit;
    case "people.ulster.light": return ul === undefined ? undefined : numIn(ul, /light(\d)?/, 2);
    case "people.ulster.fury": return ul === undefined ? undefined : has(ul, "fury") ? 1 : 0;
    case "people.ulster.stand": return ul === undefined ? undefined : numIn(ul, /stand(\d)?/, 3);
    case "people.ulster.stagger": return ul === undefined ? undefined : has(ul, "stagger") ? 1 : 0;
    case "people.connacht.bleed": return R.noBleed ? 0 : undefined;
    case "people.connacht.bleedCap": return R.bleedCap;
    case "layer.champion": return R.champions === false ? 0 : undefined;
    default: return undefined;
  }
}

/** A parameter's value under these rules. */
export function param(R: Rules, k: ParamKey): number {
  return R.params?.[k] ?? legacy(R, k) ?? PARAMS[k];
}
/** Every parameter's value under these rules (what a cube run records). */
export function resolveParams(R0: Rules): Record<string, number> {
  // a setting fixed up front brings its own Valour and mound (as newMatch applies it)
  const set = R0.setting ? settingOf(R0) : undefined;
  const R = set ? { ...R0, fordValour: R0.fordValour ?? set.valour, moundValour: set.mound !== undefined ? R0.moundValour ?? set.mound : R0.moundValour } : R0;
  const out: Record<string, number> = {};
  for (const k of Object.keys(PARAMS) as ParamKey[]) out[k] = param(R, k);
  for (const [k, v] of Object.entries(R.params ?? {})) if (k.startsWith("setting.") && !(k in PARAMS) && v !== undefined) out[k] = v;
  return out;
}

/** The setting in force under these rules, with any "setting.<id>.<field>" values applied. */
export function settingOf(R: Rules, id = R.setting): SettingDef | undefined {
  const base = settingDef(id);
  if (!base || !R.params) return base;
  const pre = `setting.${base.id}.`;
  let out: SettingDef | undefined;
  for (const [k, v] of Object.entries(R.params)) {
    if (!k.startsWith(pre) || v === undefined) continue;
    out ??= { ...base, el: { ...base.el }, kind: { ...base.kind } };
    const f = k.slice(pre.length);
    if (f.startsWith("el.")) (out.el as Record<string, number>)[f.slice(3)] = v;
    else if (f.startsWith("kind.")) (out.kind as Record<string, number>)[f.slice(5)] = v;
    else if (["valour", "shield", "heal", "restHeal", "drain", "mound"].includes(f)) (out as unknown as Record<string, number>)[f] = v;
    else throw new Error(`unknown setting parameter ${k}`);
  }
  return out ?? base;
}
