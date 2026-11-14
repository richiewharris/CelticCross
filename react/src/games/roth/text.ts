// Words for cards, choices and the move log, from one seat's point of view.
import { ALL_DEFS, type CardDef, type Faction, type FighterDef } from "./engine/cards";
import { CROW_BIT, OATH_BIT, fighter, forbidMask, globalBit, isHeroSpot, ownerOfSpot, quadOf, restForbidMask, toDeath, unwilling, type Decision, type Option, type Side, type State } from "./engine/engine";
import type { Element, SupportDef } from "./engine/cards";
import { settingDef } from "./engine/settings";

/** The geasa and oaths a move would break, by name: "the Geis of the hosting and the Blood-oath". */
export function breaksWhat(S: State, p: Side, what: "rest" | SupportDef, as?: Element): string {
  const C = S.combat;
  if (!C) return "a geis or oath";
  const m = what === "rest" ? restForbidMask(S, C, p) : forbidMask(S, C, p, what, as);
  const q = quadOf(C.hs[p]);
  const names: string[] = [];
  if (m & (1 << q) && S.quadGeis[q]) names.push(S.quadGeis[q]!.def.name);
  S.globalGeis.forEach((g, i) => { if (m & globalBit(i, q)) names.push(g.def.name); });
  if (m & CROW_BIT) names.push("the Morrígan's crow");
  if (m & (OATH_BIT << q) && S.quadOath[q]) names.push(S.quadOath[q]!.def.name);
  if (!names.length) return "a geis or oath";
  const uniq = [...new Set(names)];
  return uniq.length === 1 ? uniq[0] : `${uniq.slice(0, -1).join(", ")} and ${uniq[uniq.length - 1]}`;
}

/** Global geasa, each named once with how many and whose: "Geis of the hosting ×2 (yours, theirs)". */
export function globalGeasa(S: State, me: Side): { key: string; name: string; text: string }[] {
  const by = new Map<string, { name: string; owners: Side[] }>();
  for (const g of S.globalGeis) {
    const e = by.get(g.def.id) ?? { name: g.def.name, owners: [] };
    e.owners.push(g.owner);
    by.set(g.def.id, e);
  }
  return [...by.entries()].map(([key, e]) => {
    const whose = [...new Set(e.owners)].map((o) => (o === me ? "yours" : "theirs")).join(", ");
    return { key, name: e.name, text: `${e.name}${e.owners.length > 1 ? ` ×${e.owners.length}` : ""} (${whose})` };
  });
}

export const ALIGN: Record<string, string> = {
  Ulaid: "Ulaid", Connachta: "Connachta", Sidhe: "Aos Sídhe", Fomoire: "Fomóire", Merrow: "Merrow", Deorad: "Deorad", Sluagh: "Slúagh", Unaligned: "Unaligned", None: "",
};
export const FACTION_NAME: Record<Faction, string> = {
  ulster: "Ulster", connacht: "Connacht", sidhe: "the Aos Sídhe", fomoire: "the Fomóire", merrow: "the Merrow", sluagh: "the Slúagh",
};
export const FACTION_TITLE: Record<Faction, string> = {
  ulster: "Ulster", connacht: "Connacht", sidhe: "Aos Sídhe", fomoire: "Fomóire", merrow: "Merrow", sluagh: "Slúagh",
};
const RAR: Record<string, string> = { common: "Common", rare: "Rare", legendary: "Legendary" };

/** Short type line for a card. */
export function typeLine(d: CardDef): string {
  switch (d.type) {
    case "hero": return `${ALIGN[d.alignment]} hero · ${RAR[d.rarity]}`;
    case "champion": return `${ALIGN[d.alignment]} champion · ${RAR[d.rarity]}`;
    case "support": return `${d.element} ${d.kind}${d.use === "passive" ? " · Passive" : d.use === "reaction" ? " · Reaction" : ""} · ${ALIGN[d.alignment]} · ${RAR[d.rarity]}`;
    case "geis": return `${d.scope === "global" ? "Global" : "Targeted"} geis · ${RAR[d.rarity]}`;
    case "oath": return `Oath · ${RAR[d.rarity]}`;
    case "omen": return `${d.scope === "global" ? "Global" : d.scope === "targeted" ? "Targeted" : "Your"} omen · ${RAR[d.rarity]}`;
    case "attendant": return `${d.scope === "global" ? "Global" : d.scope === "yours" ? "Your" : "Enemy"} attendant · ${RAR[d.rarity]}`;
    default: return "Hidden card";
  }
}
/** The rules text of a card. */
export function cardText(d: CardDef): string {
  switch (d.type) {
    case "hero": case "champion": return d.quality;
    case "support": case "geis": case "oath": case "omen": case "attendant": return d.text;
    default: return "";
  }
}
/** One-line numbers for a hero or champion. */
export function fighterStats(d: FighterDef): string {
  const parts = [`Valour ${d.valour}`];
  if (d.type === "hero") parts.push(`Initiative ${d.init}`);
  parts.push(`Focus ${d.focus}`, `Weak to ${d.weakness}`);
  if (d.tag) parts.push(`Tag ${d.tag}`);
  return parts.join(" · ");
}

export function cardName(S: State, uid: number): string {
  for (const P of S.players) {
    for (const z of [P.hand, P.reserve, P.discard, P.deck, P.lost, P.musterQ]) for (const c of z) if (c.uid === uid) return c.def.name;
    for (const o of P.omens) if (o.card.uid === uid) return o.card.def.name;
  }
  if (S.pendingOmen?.uid === uid) return S.pendingOmen.def.name;
  for (const c of S.board) if (c?.uid === uid) return c.def.name;
  if (S.combat) for (const g of [...S.combat.guests, ...S.combat.champs]) for (const c of g) if (c.uid === uid) return c.def.name;
  return "a card";
}
// ---- Names on the wheel. Players never see a spot number: each place is a seat (the hero, its west flank, its east
// flank) in a band (a hero and the two who fight beside it). Each side raises a first band and a second band; first
// meets first in the first duel, second meets second. A band whose hero is placed is also called by its hero's name.
/** "your first band", "their second band", or "Emer's band" once a hero (or host) stands in it. */
export function bandName(S: State, spot: number, me: Side, byHero = true): string {
  const q = quadOf(spot), hero = S.board[q * 3];
  if (byHero && hero && (hero.def.type === "hero" || hero.def.type === "host")) return `${hero.def.name}'s band`;
  return `${ownerOfSpot(spot) === me ? "your" : "their"} ${q % 2 === 0 ? "first" : "second"} band`;
}
/** "the hero of your first band", "the west flank of Emer's band". */
export function seatName(S: State, spot: number, me: Side): string {
  const pos = spot % 3;
  return `the ${pos === 0 ? "hero" : pos === 1 ? "west flank" : "east flank"} of ${bandName(S, spot, me, pos !== 0)}`;
}
/** A seat as a short label: "Hero", "West flank", "East flank". */
export const seatShort = (spot: number) => (spot % 3 === 0 ? "Hero" : spot % 3 === 1 ? "West flank" : "East flank");
/** The card in a seat by name, or the seat itself when it is empty. */
const AT = (S: State, spot: number, me: Side) => S.board[spot]?.def.name ?? seatName(S, spot, me);
/** A hero named with its side and duel, for choices that aim at one hero (two may share a name in a mirror match). */
const AT_SPOT = (S: State, spot: number, me: Side) => (S.board[spot] ? `${S.board[spot]!.def.name} (${ownerOfSpot(spot) === me ? "yours" : "theirs"}, ${quadOf(spot) % 2 === 0 ? "first" : "second"} duel)` : seatName(S, spot, me));
const CRY_TEXT = " with the Hound's cry (spend the top card of your Reserve: no halving)";

/** A button label for one option of the pending decision, for the player who must choose. */
export function optionLabel(S: State, d: Decision, o: Option, me: Side = d.player): string {
  switch (o.t) {
    case "muster": return o.how === "keep" ? `Keep ${cardName(S, o.uid)} in hand` : o.how === "aside" ? `Set ${cardName(S, o.uid)} aside for the Reserve`
      : o.swap !== undefined ? `Put ${cardName(S, o.uid)} in place of ${cardName(S, o.swap)} (to the Reserve)` : `Put ${cardName(S, o.uid)} in an Omen spot`;
    case "musterOmen": return `Send ${cardName(S, o.uid)} to the Reserve`;
    case "musterReturn": return `Return ${cardName(S, o.uid)} to the Reserve`;
    case "setting": { const x = settingDef(o.id); return `Fight at ${x?.name ?? o.id}: ${x?.text ?? ""}`; }
    case "swap": return o.a < 0 ? "Keep your wheel as it is"
      : isHeroSpot(o.a) ? `Swap your heroes: ${S.board[o.a]?.def.name} leads your ${quadOf(o.b) % 2 === 0 ? "first" : "second"} band, ${S.board[o.b]?.def.name} your ${quadOf(o.a) % 2 === 0 ? "first" : "second"}`
      : `Swap ${S.board[o.a]?.def.name} (${seatName(S, o.a, me)}) and ${S.board[o.b]?.def.name} (${seatName(S, o.b, me)})`;
    case "place": return o.join ? `Place ${cardName(S, o.uid)} with ${o.join.length ? o.join.map((u) => cardName(S, u).replace(/^The /, "")).join(", ") : "no monsters"}` : `Place ${cardName(S, o.uid)}`;
    case "omen": case "late": return o.target !== undefined ? `Turn ${cardName(S, o.uid)} on ${AT_SPOT(S, o.target, me)}` : `Turn ${cardName(S, o.uid)}`;
    case "lateDone": return "Done turning omens";
    case "bind": {
      const g = S.players[d.player].hand.find((c) => c.uid === o.uid)?.def;
      return g?.type === "geis" && g.scope === "global" ? `Lay ${g.name} (global)` : `Bind ${AT(S, d.spot!, me)} with ${cardName(S, o.uid)}`;
    }
    case "supplant": return `Supplant ${AT(S, d.spot!, me)} with ${cardName(S, o.uid)}`;
    case "swear": return `Swear ${cardName(S, o.uid)} on ${AT_SPOT(S, o.spot, me)}`;
    case "attend": return `Call ${cardName(S, o.uid)}`;
    case "hold": return "Hold";
    case "focus": return o.el ? `Shape-shift: Focus ${o.el}` : "Keep her Focus";
    case "champion": return `Call ${cardName(S, o.uid)} to stand in`;
    case "sacrifice": return `Sacrifice ${ALL_DEFS[o.id]?.name ?? o.id} (the host takes back its Valour)`;
    case "summon": return `Summon ${ALL_DEFS[o.id]?.name ?? o.id} from your other host`;
    case "draw": return "Draw from your Reserve";
    case "block": return o.spot < 0 ? "Take the blow" : `Block with ${S.board[o.spot]?.def.name ?? "it"}`;
    case "drawn": {
      const c = S.combat?.drawn?.def;
      const n = c?.name ?? "it";
      if (o.how === "discard") return `Put ${n} aside and do something else`;
      if (o.how === "keep") return c?.type === "hero" ? `Keep ${n} in hand as a guest (can heal 1 first)` : `Keep ${n} in hand to call on later`;
      const mode = o.mode === "break" ? `Break ${c?.type === "support" ? breaksWhat(S, d.player, c, o.as) : "the geis or oath"} (−2 each) and ` : o.mode === "ignore" ? "Ignore the geis (Cathbad) and " : "";
      const t = o.target !== undefined ? ` on ${AT(S, o.target, me)}` : "";
      const verb = c?.type === "champion" ? "call" : c?.type === "monster" ? "join" : c?.type === "geis" ? "lay" : c?.type === "oath" ? "swear" : c?.type === "omen" ? "turn" : "play";
      const x = (mode + `${verb} ${n}${o.as ? ` as ${o.as}` : ""}${t}${o.cry ? CRY_TEXT : ""}`);
      return x[0].toUpperCase() + x.slice(1);
    }
    case "duelCard": {
      const n = cardName(S, o.uid);
      const om = S.players[d.player].omens.some((x) => x.card.uid === o.uid);
      const g = S.players[d.player].hand.find((c) => c.uid === o.uid)?.def;
      const verb = om ? "Turn" : g?.type === "geis" ? "Lay" : g?.type === "oath" ? "Swear" : "Call";
      return `${verb} ${n}${o.target !== undefined ? ` on ${AT(S, o.target, me)}` : ""}`;
    }
    case "duel": {
      const guest = o.guest >= 0 ? ` (guest ${cardName(S, o.guest)} heals 1 first)` : "";
      const sup = o.act === "use" && S.board[o.spot]?.def.type === "support" ? (S.board[o.spot]!.def as SupportDef) : null;
      const mode = o.mode === "break" ? `Break ${breaksWhat(S, d.player, o.act === "rest" ? "rest" : sup ?? "rest", o.as)} (−2 each) and ` : o.mode === "ignore" ? "Ignore the geis (Cathbad) and " : "";
      const twin = o.act === "use" && d.options.some((x) => x.t === "duel" && x.act === "use" && x.spot !== o.spot && S.board[x.spot]?.def.name === S.board[o.spot]?.def.name);
      const out = o.act === "use" && toDeath(S) && S.combat && S.board[o.spot]?.def.type === "support" && unwilling(fighter(S, S.combat, d.player).alignment, (S.board[o.spot]!.def as { alignment: string }).alignment);
      const act = o.act === "rest" ? "rest" : out ? `cast out ${AT(S, o.spot, me)} (it won't serve this hero) and draw in its place` : `use ${twin ? AT_SPOT(S, o.spot, me) : AT(S, o.spot, me)}${o.as ? ` as ${o.as}` : ""}`;
      const s = mode + act + (o.cry ? CRY_TEXT : "");
      return s[0].toUpperCase() + s.slice(1) + guest;
    }
  }
}

/** A log line for a move, from `me`'s point of view. */
export function logLine(S: State, d: Decision, o: Option, me: Side): string {
  const who = d.player === me ? "You" : "The computer";
  const mine = d.player === me;
  const hidden = (n: string) => (mine ? n : "a card");
  switch (o.t) {
    case "muster": return o.how === "keep" ? `${who} kept ${hidden(cardName(S, o.uid))}.` : o.how === "aside" ? `${who} set ${hidden(cardName(S, o.uid))} aside for the Reserve.`
      : `${who} put ${hidden(cardName(S, o.uid))} in an Omen spot${o.swap !== undefined ? ` in place of ${hidden(cardName(S, o.swap))}` : ""}.`;
    case "musterOmen": return `${who} sent ${hidden(cardName(S, o.uid))} to the Reserve.`;
    case "musterReturn": return `${who} returned ${hidden(cardName(S, o.uid))} to the Reserve.`;
    case "setting": return `${who} chose to fight at ${settingDef(o.id)?.name ?? o.id}.`;
    case "swap": return mine ? (o.a < 0 ? "You chose to keep your wheel." : `You chose: ${optionLabel(S, d, o, me).replace(/^Swap/, "swap")}.`) : "The computer chose its change, in secret.";
    case "place": return `${who} placed ${o.join ? optionLabel(S, d, o, me).replace(/^Place /, "") : cardName(S, o.uid)} as ${seatName(S, d.spot!, me)}.`;
    case "omen": case "late": return `${who} turned ${cardName(S, o.uid)}${o.target !== undefined ? ` on ${AT(S, o.target, me)}` : ""}.`;
    case "lateDone": return `${who} turned no more omens.`;
    case "bind": return `${who} ${optionLabel(S, d, o, me).replace(/^Bind/, "bound").replace(/^Lay/, "laid")}.`;
    case "supplant": return `${who} supplanted ${AT(S, d.spot!, me)} with ${cardName(S, o.uid)}.`;
    case "swear": return `${who} swore ${cardName(S, o.uid)} on ${AT(S, o.spot, me)}.`;
    case "attend": return `${who} called ${cardName(S, o.uid)}.`;
    case "hold": return `${who} held before ${AT(S, d.spot!, me)}.`;
    case "focus": return o.el ? `${who} shape-shifted: Focus ${o.el}.` : `${who} kept the Morrígan's Focus.`;
    case "champion": return `${who} called ${cardName(S, o.uid)} to stand in.`;
    case "sacrifice": return `${who} sacrificed ${ALL_DEFS[o.id]?.name ?? o.id} from the host.`;
    case "summon": return `${who} summoned ${ALL_DEFS[o.id]?.name ?? o.id} from the other host.`;
    case "duel": return `${who}: ${optionLabel(S, d, o, me)}.`;
    case "draw": return `${who} drew from the Reserve.`;
    case "block": return o.spot < 0 ? `${who} took the blow.` : `${who} blocked with ${S.board[o.spot]?.def.name ?? "a card"}.`;
    case "drawn": {
      const n = S.combat?.drawn?.def.name ?? "a card";
      if (o.how === "discard") return `${who} put ${mine || S.combat?.drawn?.def.type !== "support" ? n : n} aside.`;
      return `${who}: ${optionLabel(S, d, o, me)}.`;
    }
    case "duelCard": return `${who}: ${optionLabel(S, d, o, me)}.`;
  }
}

export const DECIDED: Record<string, string> = {
  felled: "more heroes felled", valour: "more wounds dealt", firstDuel: "the only hero standing from the first duel", draw: "a draw",
};

/** After the Reckoning: what side p changed, in words (the board already shows it). */
export function reckonedLine(S: State, p: Side, me: Side): string {
  const o = S.reckoned?.[p];
  const who = p === me ? "You" : "The computer";
  if (!o || o.a < 0) return `${who} kept ${p === me ? "your" : "its"} wheel as it was.`;
  const x = S.board[o.a]?.def.name, y = S.board[o.b]?.def.name;
  return isHeroSpot(o.a)
    ? `${who} swapped ${p === me ? "your" : "its"} heroes: ${x} now leads ${p === me ? "your" : "its"} ${quadOf(o.a) % 2 === 0 ? "first" : "second"} band, ${y} the ${quadOf(o.b) % 2 === 0 ? "first" : "second"}.`
    : `${who} swapped ${y} and ${x}: ${x} is now ${seatName(S, o.a, me)}, ${y} ${seatName(S, o.b, me)}.`;
}
