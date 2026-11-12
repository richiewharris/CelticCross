// Words for cards, choices and the move log, from one seat's point of view.
import { ALL_DEFS, type CardDef, type Faction, type FighterDef } from "./engine/cards";
import { CROW_BIT, OATH_BIT, fighter, forbidMask, globalBit, quadOf, restForbidMask, toDeath, unwilling, type Decision, type Option, type Side, type State } from "./engine/engine";
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
const at = (S: State, spot: number) => S.board[spot]?.def.name ?? `spot ${spot + 1}`;
/** A hero named with its spot, for choices that aim at one hero (two may share a name in a mirror match). */
const atSpot = (S: State, spot: number) => `${at(S, spot)} (spot ${spot + 1})`;
const CRY_TEXT = " with the Hound's cry (spend the top card of your Reserve: no halving)";

/** A button label for one option of the pending decision, for the player who must choose. */
export function optionLabel(S: State, d: Decision, o: Option): string {
  switch (o.t) {
    case "muster": return o.how === "keep" ? `Keep ${cardName(S, o.uid)} in hand` : o.how === "aside" ? `Set ${cardName(S, o.uid)} aside for the Reserve`
      : o.swap !== undefined ? `Put ${cardName(S, o.uid)} in place of ${cardName(S, o.swap)} (to the Reserve)` : `Put ${cardName(S, o.uid)} in an Omen spot`;
    case "musterOmen": return `Send ${cardName(S, o.uid)} to the Reserve`;
    case "musterReturn": return `Return ${cardName(S, o.uid)} to the Reserve`;
    case "setting": { const x = settingDef(o.id); return `Fight at ${x?.name ?? o.id}: ${x?.text ?? ""}`; }
    case "place": return o.join ? `Place ${cardName(S, o.uid)} with ${o.join.length ? o.join.map((u) => cardName(S, u).replace(/^The /, "")).join(", ") : "no monsters"}` : `Place ${cardName(S, o.uid)}`;
    case "omen": case "late": return o.target !== undefined ? `Turn ${cardName(S, o.uid)} on ${atSpot(S, o.target)}` : `Turn ${cardName(S, o.uid)}`;
    case "lateDone": return "Done turning omens";
    case "bind": {
      const g = S.players[d.player].hand.find((c) => c.uid === o.uid)?.def;
      return g?.type === "geis" && g.scope === "global" ? `Lay ${g.name} (global)` : `Bind ${at(S, d.spot!)} with ${cardName(S, o.uid)}`;
    }
    case "supplant": return `Supplant ${at(S, d.spot!)} with ${cardName(S, o.uid)}`;
    case "swear": return `Swear ${cardName(S, o.uid)} on ${atSpot(S, o.spot)}`;
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
      const t = o.target !== undefined ? ` on ${at(S, o.target)}` : "";
      const verb = c?.type === "champion" ? "call" : c?.type === "monster" ? "join" : c?.type === "geis" ? "lay" : c?.type === "oath" ? "swear" : c?.type === "omen" ? "turn" : "play";
      const x = (mode + `${verb} ${n}${o.as ? ` as ${o.as}` : ""}${t}${o.cry ? CRY_TEXT : ""}`);
      return x[0].toUpperCase() + x.slice(1);
    }
    case "duelCard": {
      const n = cardName(S, o.uid);
      const om = S.players[d.player].omens.some((x) => x.card.uid === o.uid);
      const g = S.players[d.player].hand.find((c) => c.uid === o.uid)?.def;
      const verb = om ? "Turn" : g?.type === "geis" ? "Lay" : g?.type === "oath" ? "Swear" : "Call";
      return `${verb} ${n}${o.target !== undefined ? ` on ${at(S, o.target)}` : ""}`;
    }
    case "duel": {
      const guest = o.guest >= 0 ? ` (guest ${cardName(S, o.guest)} heals 1 first)` : "";
      const sup = o.act === "use" && S.board[o.spot]?.def.type === "support" ? (S.board[o.spot]!.def as SupportDef) : null;
      const mode = o.mode === "break" ? `Break ${breaksWhat(S, d.player, o.act === "rest" ? "rest" : sup ?? "rest", o.as)} (−2 each) and ` : o.mode === "ignore" ? "Ignore the geis (Cathbad) and " : "";
      const twin = o.act === "use" && d.options.some((x) => x.t === "duel" && x.act === "use" && x.spot !== o.spot && S.board[x.spot]?.def.name === S.board[o.spot]?.def.name);
      const out = o.act === "use" && toDeath(S) && S.combat && S.board[o.spot]?.def.type === "support" && unwilling(fighter(S, S.combat, d.player).alignment, (S.board[o.spot]!.def as { alignment: string }).alignment);
      const act = o.act === "rest" ? "rest" : out ? `cast out ${at(S, o.spot)} (it won't serve this hero) and draw in its place` : `use ${twin ? atSpot(S, o.spot) : at(S, o.spot)}${o.as ? ` as ${o.as}` : ""}`;
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
    case "place": return `${who} placed ${o.join ? optionLabel(S, d, o).replace(/^Place /, "") : cardName(S, o.uid)} at spot ${d.spot! + 1}.`;
    case "omen": case "late": return `${who} turned ${cardName(S, o.uid)}${o.target !== undefined ? ` on ${at(S, o.target)}` : ""}.`;
    case "lateDone": return `${who} turned no more omens.`;
    case "bind": return `${who} ${optionLabel(S, d, o).replace(/^Bind/, "bound").replace(/^Lay/, "laid")}.`;
    case "supplant": return `${who} supplanted ${at(S, d.spot!)} with ${cardName(S, o.uid)}.`;
    case "swear": return `${who} swore ${cardName(S, o.uid)} on ${at(S, o.spot)}.`;
    case "attend": return `${who} called ${cardName(S, o.uid)}.`;
    case "hold": return `${who} held at spot ${d.spot! + 1}.`;
    case "focus": return o.el ? `${who} shape-shifted: Focus ${o.el}.` : `${who} kept the Morrígan's Focus.`;
    case "champion": return `${who} called ${cardName(S, o.uid)} to stand in.`;
    case "sacrifice": return `${who} sacrificed ${ALL_DEFS[o.id]?.name ?? o.id} from the host.`;
    case "summon": return `${who} summoned ${ALL_DEFS[o.id]?.name ?? o.id} from the other host.`;
    case "duel": return `${who}: ${optionLabel(S, d, o)}.`;
    case "draw": return `${who} drew from the Reserve.`;
    case "block": return o.spot < 0 ? `${who} took the blow.` : `${who} blocked with ${S.board[o.spot]?.def.name ?? "a card"}.`;
    case "drawn": {
      const n = S.combat?.drawn?.def.name ?? "a card";
      if (o.how === "discard") return `${who} put ${mine || S.combat?.drawn?.def.type !== "support" ? n : n} aside.`;
      return `${who}: ${optionLabel(S, d, o)}.`;
    }
    case "duelCard": return `${who}: ${optionLabel(S, d, o)}.`;
  }
}

export const DECIDED: Record<string, string> = {
  felled: "more heroes felled", valour: "more wounds dealt", firstDuel: "the only hero standing from the first duel", draw: "a draw",
};
