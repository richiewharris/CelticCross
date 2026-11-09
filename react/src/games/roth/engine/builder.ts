// Deck building for the computer (and the "fill" button in the deck builder): picks a legal 24-card deck from one
// or two peoples' pools. Cards are scored for the heroes chosen: a support's printed worth, plus its kinship and
// Focus with those heroes, less its Unwilling share; a geis or oath by how little it costs your own supports.
// `noise` blurs the scores: 0 builds the same strong deck every time, large values build loose, varied decks.
import {
  ALL_DEFS, MAX_LEGENDARIES, RARITY_LIMIT, deckErrors, inPool, unwillingPair, type CardDef, type Faction, type FighterDef,
  type AttendantDef, type Forbids, type GeisDef, type HeroDef, type OathDef, type OmenDef, type SupportDef,
} from "./cards";
import { kin } from "./engine";
import type { Rng } from "./rng";

export interface BuildOptions { factions: Faction[]; noise: number; /** cards already chosen; the rest is filled round them */ start?: CardDef[] }
/** How many of each type a built deck holds (the starter decks' shape). */
export const SHAPE = { hero: 4, champion: 2, support: 8, geis: 3, oath: 2, omen: 4, attendant: 1 } as const;

const maxCopies = (d: CardDef) => (d.type === "hero" || d.type === "champion" || d.type === "omen" ? 1 : d.type === "unknown" ? 0 : RARITY_LIMIT[d.rarity]);

function forbidsSup(f: Forbids, s: SupportDef) {
  return (!!f.element && s.element === f.element) || (!!f.kind && s.kind === f.kind) || (!!f.heal && s.effects.some((e) => e.type === "heal"));
}

/** A support's worth to these heroes (about a point per Strike, Heal or Shield). */
export function supportScore(s: SupportDef, heroes: FighterDef[]): number {
  let v = s.effects.reduce((a, e) => a + e.n * (e.type === "strike" ? 1.05 : e.type === "heal" ? 0.9 : 0.8), 0);
  if (s.pierce) v += 0.5;
  if (s.nextStrike) v += 0.8 * s.nextStrike;
  if (s.drain) v += 0.5;
  if (s.invoke) v += 0.45;
  if (s.firstBonus) v += 0.5;
  if (s.vsBig) v += 0.7;
  if (s.selfLoss) v -= 0.8 * s.selfLoss;
  if (s.cathbad) v += 0.4;
  if (s.forHero) v += heroes.some((h) => h.id === s.forHero!.id) ? (s.forHero.n - s.effects[0].n) * 0.6 : 0;
  if (heroes.length) {
    let k = 0, f = 0, u = 0;
    for (const h of heroes) {
      if (kin(s.alignment, h.alignment)) k += h.ab.kinBonus ?? 1;
      if (h.ab.focusAny || h.focus === s.element || h.focus === s.kind) f += 1;
      if (unwillingPair(h.alignment, s.alignment)) u += 1;
    }
    v += (k + f) / heroes.length - (3 * u) / heroes.length;
  }
  return v;
}
function heroScore(h: HeroDef): number {
  const a = h.ab;
  return h.valour + h.init * 0.25 + (a.strikeAll ?? 0) * 1.5 + (a.firstStrike ?? 0) * 0.6 + (a.shieldStart ?? 0) + (a.healBonus ?? 0) * 0.6
    + (a.restHeal ?? 0) * 0.4 + (a.restShield ?? 0) * 0.4 + (a.drain ?? 0) * 0.8 + (a.capTaken ? 1.2 : 0) + (a.firstHitSoak ? 1.5 : 0)
    + (a.kinBonus ? 1 : 0) + (a.focusAny ? 1.4 : 0) + (a.vsBig ?? 0) * 0.5 + (a.foeHealMalus ?? 0) * 0.5 + (a.kingsDue ? 0.8 : 0) + (a.shapeShift ? 0.5 : 0) + (a.rally ? 0.6 : 0);
}
/** What fraction of your supports a prohibition would cost you. */
function ownCost(f: Forbids, sups: SupportDef[]): number {
  if (!sups.length) return 0;
  return sups.filter((s) => forbidsSup(f, s)).length / sups.length + (f.rest ? 0.12 : 0);
}
function geisScore(g: GeisDef, sups: SupportDef[]): number {
  const breadth = g.forbids.element ? 1 : g.forbids.kind ? 1 : g.forbids.heal ? 0.9 : g.forbids.rest ? 0.6 : 0.5;
  let v = 1 + 0.4 * breadth + (g.invoke ? 0.35 : 0) + (g.bigLoss ? 0.5 : 0) + (g.initLoss ? 0.4 : 0);
  if (g.scope === "global") v += 0.6 - 3 * ownCost(g.forbids, sups);
  return v;
}
function oathScore(o: OathDef, sups: SupportDef[]): number {
  const b = o.boon;
  const gain = (b.strike ?? 0) * 1.2 + (b.shield ?? 0) * 0.7 + (b.valour ?? 0) * 0.9 + (b.init ?? 0) * 0.2 + (b.heal ?? 0) * 0.5;
  return gain - 4 * ownCost(o.forbids, sups);
}
function omenScore(o: OmenDef, sups: SupportDef[], heroes: FighterDef[]): number {
  const fx = o.fx;
  // from the pool simulations: how much each kind of omen tends to be worth on its own
  let v = 1 + (fx.mist ? 1.6 : 0) + (fx.firstHitSoak ? 0.4 : 0) + (fx.initMod ? 0.3 : 0) - (fx.startValour ? 0.4 : 0);
  if (fx.element) v += 3 * sups.filter((s) => s.element === fx.element!.el).length / Math.max(1, sups.length);
  if (fx.kind) v += 3 * sups.filter((s) => s.kind === fx.kind!.kind).length / Math.max(1, sups.length);
  if (fx.heal) v += 2 * sups.filter((s) => s.effects.some((e) => e.type === "heal")).length / Math.max(1, sups.length);
  if (fx.shield) v += 2 * sups.filter((s) => s.effects.some((e) => e.type === "shield")).length / Math.max(1, sups.length);
  if (fx.noHeals || fx.healMod) v += 0.6 - 2 * sups.filter((s) => s.effects.some((e) => e.type === "heal")).length / Math.max(1, sups.length);
  if (fx.debility) v += heroes.some((h) => h.alignment === fx.debility || h.alignment === "Deorad") ? -2 : 0.4;
  if (fx.darkness) v += heroes.reduce((a, h) => a + (h.type === "hero" ? (3 - h.init) * 0.25 : 0), 0);
  if (fx.firstHitSoak || fx.shieldStart || fx.strikeMod || fx.initMod || fx.mist || fx.ignoreGeis || fx.strikeDuel || fx.startValour) v += 0.5;
  return v;
}

/** An attendant's worth to this deck: supports turned to its heroes' Focus, Channel's extra Strike, a Weapon slipped
 *  out of the "no Weapons" geasa; a curse or an enemy turn is worth a little whatever the enemy. */
function attendantScore(a: AttendantDef, sups: SupportDef[], heroes: FighterDef[]): number {
  if (a.scope === "enemy") return a.mode === "curse" ? 1.6 : 1.3;
  if (a.mode === "curse") return a.scope === "global" ? 0.6 : -1;
  const focus = (el: string | null, kind: string | null) => heroes.filter((h) => h.ab.focusAny || h.focus === el || h.focus === kind).length / Math.max(1, heroes.length);
  let v = 0.4;
  for (const s of sups) {
    const hit = a.mode === "enchant" || a.mode === "reforge" ? s.kind === a.kind : s.element === a.from;
    if (!hit) continue;
    const el = a.mode === "reforge" ? s.element : a.to ?? s.element;
    const kind = a.mode === "reforge" ? a.toKind ?? s.kind : s.kind;
    v += 1.2 * (focus(el, kind) - focus(s.element, s.kind));
    if (a.mode === "channel" && s.effects[0].type === "strike") v += 0.35;
    if (a.mode === "reforge" && s.kind === "Weapon") v += 0.25;
  }
  return a.scope === "global" ? 0.6 * v : v;
}

/** Builds a legal deck. Throws only if the pool can't make one (it always can for the five factions). */
export function buildDeck(opts: BuildOptions, rng: Rng): CardDef[] {
  const pools = Object.values(ALL_DEFS).filter((d) => opts.factions.some((f) => inPool(d, f)));
  const blur = (v: number) => v + (opts.noise ? (rng.next() * 2 - 1) * opts.noise : 0);
  const deck: CardDef[] = [];
  let legends = 0;
  const count = (d: CardDef) => deck.filter((x) => x.id === d.id).length;
  const have = (t: CardDef["type"]) => deck.filter((x) => x.type === t).length;
  const canAdd = (d: CardDef) => count(d) < maxCopies(d) && (d.type === "unknown" || d.rarity !== "legendary" || legends < MAX_LEGENDARIES);
  const add = (d: CardDef) => { deck.push(d); if (d.type !== "unknown" && d.rarity === "legendary") legends++; };
  for (const d of opts.start ?? []) add(d);
  const pick = <T extends CardDef>(cands: T[], n: number, score: (d: T) => number) => {
    const t = cands[0]?.type;
    const room = t && t in SHAPE ? Math.max(0, SHAPE[t as keyof typeof SHAPE] - have(t)) : n;
    for (let k = 0; k < Math.min(n, room); k++) {
      const ok = cands.filter(canAdd);
      if (!ok.length) return;
      // a second copy is worth a little less than the first
      const best = ok.map((d) => ({ d, v: blur(score(d)) - 0.25 * count(d) })).sort((a, b) => b.v - a.v)[0];
      add(best.d);
    }
  };
  // heroes from at most two peoples (exiles go with Ulster and Connacht)
  const heroes = pools.filter((d): d is HeroDef => d.type === "hero");
  pick(heroes, 4, heroScore);
  const hs = deck.filter((d): d is HeroDef => d.type === "hero");
  pick(pools.filter((d): d is FighterDef => d.type === "champion"), 2, (c) => heroScore(c as unknown as HeroDef) - 1);
  const fighters = deck.filter((d): d is FighterDef => d.type === "hero" || d.type === "champion");
  pick(pools.filter((d): d is SupportDef => d.type === "support"), 9, (s) => supportScore(s, hs));
  const sups = deck.filter((d): d is SupportDef => d.type === "support");
  pick(pools.filter((d): d is GeisDef => d.type === "geis"), 3, (g) => geisScore(g, sups));
  pick(pools.filter((d): d is OathDef => d.type === "oath"), 2, (o) => oathScore(o, sups));
  pick(pools.filter((d): d is AttendantDef => d.type === "attendant"), 1, (a) => attendantScore(a, sups, fighters));
  const omens = pools.filter((d): d is OmenDef => d.type === "omen");
  if (!deck.some((d) => d.type === "omen" && d.scope === "targeted")) pick(omens.filter((o) => o.scope === "targeted"), 1, (o) => omenScore(o, sups, fighters));
  pick(omens, 4, (o) => omenScore(o, sups, fighters));
  const errs = deckErrors(deck);
  if (errs.length && !opts.start) throw new Error(`built an illegal deck: ${errs.join("; ")}`);
  return deck;
}

/** How much the computer blurs its deck building at each level. */
export const BUILD_NOISE: Record<string, number> = { novice: 2.5, casual: 1.2, skilled: 0.35, expert: 0.15 };
