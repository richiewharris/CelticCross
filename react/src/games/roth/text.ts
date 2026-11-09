// Words for cards, choices and the move log, from one seat's point of view.
import type { CardDef, Faction, FighterDef } from "./engine/cards";
import type { Decision, Option, Side, State } from "./engine/engine";

export const ALIGN: Record<string, string> = {
  Ulaid: "Ulaid", Connachta: "Connachta", Sidhe: "Sídhe", Fomoire: "Fomóire", Merrow: "Merrow", Deorad: "Deorad", Unaligned: "Unaligned", None: "",
};
export const FACTION_NAME: Record<Faction, string> = {
  ulster: "Ulster", connacht: "Connacht", sidhe: "the Sídhe", fomoire: "the Fomóire", merrow: "the Merrow",
};
export const FACTION_TITLE: Record<Faction, string> = {
  ulster: "Ulster", connacht: "Connacht", sidhe: "Sídhe", fomoire: "Fomóire", merrow: "Merrow",
};
const RAR: Record<string, string> = { common: "Common", rare: "Rare", legendary: "Legendary" };

/** Short type line for a card. */
export function typeLine(d: CardDef): string {
  switch (d.type) {
    case "hero": return `${ALIGN[d.alignment]} hero · ${RAR[d.rarity]}`;
    case "champion": return `${ALIGN[d.alignment]} champion · ${RAR[d.rarity]}`;
    case "support": return `${d.element} ${d.kind} · ${ALIGN[d.alignment]} · ${RAR[d.rarity]}`;
    case "geis": return `${d.scope === "global" ? "Global" : "Targeted"} geis · ${RAR[d.rarity]}`;
    case "oath": return `Oath · ${RAR[d.rarity]}`;
    case "omen": return `${d.scope === "global" ? "Global" : d.scope === "targeted" ? "Targeted" : "Your"} omen · ${RAR[d.rarity]}`;
    default: return "Hidden card";
  }
}
/** The rules text of a card. */
export function cardText(d: CardDef): string {
  switch (d.type) {
    case "hero": case "champion": return d.quality;
    case "support": case "geis": case "oath": case "omen": return d.text;
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

/** A button label for one option of the pending decision, for the player who must choose. */
export function optionLabel(S: State, d: Decision, o: Option): string {
  switch (o.t) {
    case "musterOmen": return `Send ${cardName(S, o.uid)} to the Reserve`;
    case "musterReturn": return `Return ${cardName(S, o.uid)} to the Reserve`;
    case "place": return `Place ${cardName(S, o.uid)}`;
    case "omen": case "late": return o.target !== undefined ? `Turn ${cardName(S, o.uid)} on ${atSpot(S, o.target)}` : `Turn ${cardName(S, o.uid)}`;
    case "lateDone": return "Done turning omens";
    case "bind": {
      const g = S.players[d.player].hand.find((c) => c.uid === o.uid)?.def;
      return g?.type === "geis" && g.scope === "global" ? `Lay ${g.name} (global)` : `Bind ${at(S, d.spot!)} with ${cardName(S, o.uid)}`;
    }
    case "supplant": return `Supplant ${at(S, d.spot!)} with ${cardName(S, o.uid)}`;
    case "swear": return `Swear ${cardName(S, o.uid)} on ${atSpot(S, o.spot)}`;
    case "hold": return "Hold";
    case "focus": return o.el ? `Shape-shift: Focus ${o.el}` : "Keep her Focus";
    case "champion": return `Call ${cardName(S, o.uid)} to stand in`;
    case "duel": {
      const guest = o.guest >= 0 ? ` (guest ${cardName(S, o.guest)} heals 1 first)` : "";
      const mode = o.mode === "break" ? "Break the geis or oath and " : o.mode === "ignore" ? "Ignore the geis (Cathbad) and " : "";
      const twin = o.act === "use" && d.options.some((x) => x.t === "duel" && x.act === "use" && x.spot !== o.spot && S.board[x.spot]?.def.name === S.board[o.spot]?.def.name);
      const act = o.act === "rest" ? "rest" : `use ${twin ? atSpot(S, o.spot) : at(S, o.spot)}`;
      const s = mode + act;
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
    case "musterOmen": return `${who} sent ${hidden(cardName(S, o.uid))} to the Reserve.`;
    case "musterReturn": return `${who} returned ${hidden(cardName(S, o.uid))} to the Reserve.`;
    case "place": return `${who} placed ${cardName(S, o.uid)} at spot ${d.spot! + 1}.`;
    case "omen": case "late": return `${who} turned ${cardName(S, o.uid)}${o.target !== undefined ? ` on ${at(S, o.target)}` : ""}.`;
    case "lateDone": return `${who} turned no more omens.`;
    case "bind": return `${who} ${optionLabel(S, d, o).replace(/^Bind/, "bound").replace(/^Lay/, "laid")}.`;
    case "supplant": return `${who} supplanted ${at(S, d.spot!)} with ${cardName(S, o.uid)}.`;
    case "swear": return `${who} swore ${cardName(S, o.uid)} on ${at(S, o.spot)}.`;
    case "hold": return `${who} held at spot ${d.spot! + 1}.`;
    case "focus": return o.el ? `${who} shape-shifted: Focus ${o.el}.` : `${who} kept the Morrígan's Focus.`;
    case "champion": return `${who} called ${cardName(S, o.uid)} to stand in.`;
    case "duel": return `${who}: ${optionLabel(S, d, o)}.`;
  }
}

export const DECIDED: Record<string, string> = {
  felled: "more heroes felled", valour: "more wounds dealt", firstDuel: "the only hero standing from the first duel", draw: "a draw",
};
