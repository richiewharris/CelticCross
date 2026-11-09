// The pending decision as a prompt and a list of buttons (filtered by the card or spot you picked).
import type { Decision, Option, State } from "../engine/engine";
import { optionLabel } from "../text";

export function prompt(S: State, d: Decision): string {
  switch (d.kind) {
    case "musterOmen": return "Your Omen spots are full. Choose one omen to send to the Reserve.";
    case "musterReturn": return "Muster check: you took cards to make up 2 heroes and 4 supports. Return a card to the Reserve.";
    case "place": return `Drafting, step ${S.step}: place a ${d.spot! % 3 === 0 ? "hero" : "support"} at spot ${d.spot! + 1}.`;
    case "action": return `${S.reversed ? "The round run backwards" : "Playing turn"}, step ${S.step}: you face spot ${d.spot! + 1}. Choose one action.`;
    case "late": return "Turn any omens before combat.";
    case "focus": return "The Morrígan may change her Focus once.";
    case "duel": return `Duel ${S.combat!.duel + 1}${S.reversed ? " (backwards round)" : ""}, turn ${S.combat!.turn + 1} of 4: use a support, rest, or call a champion.`;
    default: return "Your choice.";
  }
}

export function Choices(props: { S: State; d: Decision; filter: ((o: Option) => boolean) | null; onPick: (i: number) => void; onClear: () => void }) {
  const { S, d } = props;
  const items = d.options.map((o, i) => ({ o, i })).filter(({ o }) => !props.filter || props.filter(o));
  return (
    <div className="choices">
      <p className="prompt">{prompt(S, d)}</p>
      <div className="choice-list">
        {items.map(({ o, i }) => (
          <button key={i} type="button" className={`btn choice${o.t === "hold" ? " quiet" : ""}`} onClick={() => props.onPick(i)}>{optionLabel(S, d, o)}</button>
        ))}
        {props.filter ? <button type="button" className="btn quiet" onClick={props.onClear}>Show every choice</button> : null}
      </div>
    </div>
  );
}
