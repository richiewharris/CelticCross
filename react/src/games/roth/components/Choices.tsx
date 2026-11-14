// The pending decision as a prompt and a list of buttons (filtered by the card or spot you picked).
import { useEffect } from "react";
import { toDeath, type Decision, type Option, type State } from "../engine/engine";
import { optionLabel, seatName } from "../text";

export function prompt(S: State, d: Decision): string {
  switch (d.kind) {
    case "muster": {
      const P = S.players[d.player];
      return `The Muster: you drew ${P.musterQ.map((c) => c.def.name).join(", ")}. Keep ${P.musterQ[0]?.def.name ?? "it"} in hand, or set it aside for the Reserve? (Hand ${P.hand.length} of ${S.rules.handSize}, omens ${P.omens.length} of ${S.rules.omenSpots}.)`;
    }
    case "setting": return S.phase === "muster" ? "You are the second player: choose where the duels are fought. Your choice holds for the whole match."
      : "Every hero is on the wheel (the supports are still face down). You are the second player: choose where the duels are fought. Your choice holds for the whole match.";
    case "musterOmen": return "Your Omen spots are full. Choose one omen to send to the Reserve.";
    case "musterReturn": return "Muster check: you took cards to make up 2 heroes and 4 supports. Return a card to the Reserve.";
    case "place": return `Marshalling, step ${S.step}: place a ${d.spot! % 3 === 0 ? (d.options.some((o) => o.t === "place" && o.join) ? "host with its monsters" : "hero") : "support"} as ${seatName(S, d.spot!, d.player)}.`;
    case "reckon": return "The Reckoning: both wheels are whole (the enemy's supports still face down). You may swap two of your own cards of a kind (your two heroes, or any two of your supports), or keep your wheel. The computer chooses at the same time, in secret; both changes are shown together.";
    case "action": return `${S.reversed ? "The round run backwards" : "The Winnow"}, step ${S.step}: before you, ${S.board[d.spot!]?.def.name ?? seatName(S, d.spot!, d.player)}. Choose one action.`;
    case "late": return "Turn any omens before combat.";
    case "focus": return "The Morrígan may change her Focus once.";
    case "duel": return toDeath(S)
      ? `${S.combat!.duel === 2 ? "The final duel" : `Duel ${S.combat!.duel + 1}`}, turn ${S.combat!.turn + 1}, to the death: draw from your Reserve, use a support (again, at its price), turn an omen, lay a geis, swear an oath, or rest.${S.combat!.drew ? " You have put a drawn card aside: choose something else." : ""}`
      : `Duel ${S.combat!.duel + 1}${S.reversed ? " (backwards round)" : ""}, turn ${S.combat!.turn + 1} of 4: use a support, rest, or call a champion.`;
    case "block": {
      const p = S.combat!.pending;
      const what = p?.t === "duel" && p.act === "use" ? S.board[p.spot]?.def.name : p?.t === "drawn" ? S.combat!.drawn?.def.name : null;
      return `The enemy strikes${what ? ` with ${what}` : ""}. Block it with a Reaction card, or take the blow?`;
    }
    case "drawn": {
      const c = S.combat!.drawn?.def;
      const keep = c?.type === "hero" || c?.type === "champion";
      return `You drew ${c?.name ?? "a card"}. ${keep ? "Keep it in hand" : "Play it now"}, or put it aside and choose something else.`;
    }
    default: return "Your choice.";
  }
}

/** The changes in a move's arithmetic, briefly: "Ailill 5 → 2 · Shield 3 → 0". Null if nothing changed hands. */
export function summarize(lines: string[]): string | null {
  const bits = lines.join(" ").split(/(?<=\.)\s+/).filter((x) => x.includes("→")).map((x) => x.replace(/\.$/, "").replace(/^\d+ wounds?: /, "").replace(/^0 wounds: /, ""));
  if (!bits.length) return null;
  // drop what doesn't change; a fighter brought to 0 or below is felled
  const tidy = bits.map((b) => {
    const m = b.match(/^(.*?)(-?\d+) → (-?\d+)$/);
    if (!m) return b;
    const [, who, x, y] = m;
    if (x === y) return null;
    return Number(y) <= 0 && /valour|^[A-ZÁÉÍÓÚ]/i.test(who) && !/Shield/.test(who) ? `${who}${x} → 0, felled` : b;
  }).filter((b): b is string => !!b);
  return tidy.length ? [...new Set(tidy)].join(" · ") : "no change";
}

export function Choices(props: { S: State; d: Decision; filter: ((o: Option) => boolean) | null; onPick: (i: number) => void; onClear: () => void }) {
  const { S, d } = props;
  const items = d.options.map((o, i) => ({ o, i })).filter(({ o }) => !props.filter || props.filter(o));
  // 1–9 pick the first nine choices shown
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 9 && items[k - 1]) { e.preventDefault(); props.onPick(items[k - 1].i); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });
  return (
    <div className="choices">
      <p className="prompt">{prompt(S, d)}</p>
      <div className="choice-list">
        {items.map(({ o, i }) => (
          <button key={i} type="button" className={`btn choice${o.t === "hold" ? " quiet" : ""}`} onClick={() => props.onPick(i)}>
            {items.indexOf(items.find((x) => x.i === i)!) < 9 ? <kbd className="choice-key" aria-hidden="true">{items.findIndex((x) => x.i === i) + 1}</kbd> : null}
            <span className="choice-txt">{optionLabel(S, d, o)}</span>
          </button>
        ))}
        {props.filter ? <button type="button" className="btn quiet" onClick={props.onClear}>Show every choice</button> : null}
      </div>
    </div>
  );
}
