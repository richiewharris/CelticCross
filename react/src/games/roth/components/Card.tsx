// A card face (or back). Small on the wheel and in hand; the inspector shows the full text.
import type { CardDef } from "../engine/cards";
import { ALIGN, cardText, typeLine } from "../text";

const GLYPH: Record<string, string> = { hero: "⚔", champion: "⚜", support: "✦", geis: "⊘", oath: "✠", omen: "☽", unknown: "?" };
const short = (d: CardDef): string => {
  switch (d.type) {
    case "hero": return `V${d.valour} · I${d.init}`;
    case "champion": return `V${d.valour}`;
    case "support": return `${d.element} ${d.kind}`;
    case "geis": return d.scope === "global" ? "Global geis" : "Geis";
    case "oath": return "Oath";
    case "omen": return d.scope === "global" ? "Global omen" : d.scope === "targeted" ? "Targeted omen" : "Omen";
    default: return "";
  }
};

export function CardFace(props: {
  def: CardDef; owner?: "mine" | "theirs"; faceDown?: boolean; selected?: boolean; playable?: boolean;
  full?: boolean; onClick?: () => void; onFocusCard?: (d: CardDef) => void; label?: string; badge?: string;
}) {
  const { def, faceDown } = props;
  const al = "alignment" in def ? def.alignment : "None";
  const cls = ["card", `t-${def.type}`, `al-${al}`, props.owner ?? "", faceDown ? "down" : "", props.selected ? "sel" : "",
    props.playable ? "playable" : "", props.full ? "full" : "", "rarity" in def ? `r-${def.rarity}` : ""].filter(Boolean).join(" ");
  const body = def.type === "unknown" ? (
    <span className="back" aria-hidden="true">᚛᚜</span>
  ) : (
    <>
      <span className="c-name"><span className="glyph" aria-hidden="true">{GLYPH[def.type]}</span>{def.name}</span>
      <span className="c-short">{short(def)}</span>
      {props.full ? <span className="c-type">{typeLine(def)}</span> : null}
      {props.full ? <span className="c-text">{cardText(def)}</span> : null}
      {props.badge ? <span className="c-badge">{props.badge}</span> : null}
      {faceDown ? <span className="c-down">face down</span> : null}
    </>
  );
  const aria = props.label ?? (def.type === "unknown" ? "Hidden card" : `${def.name}, ${typeLine(def)}. ${cardText(def)}`);
  if (props.onClick) {
    return (
      <button type="button" className={cls} aria-label={aria} aria-pressed={props.selected || undefined}
        onClick={props.onClick} onFocus={() => props.onFocusCard?.(def)} onMouseEnter={() => props.onFocusCard?.(def)}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} role="img" aria-label={aria} tabIndex={props.onFocusCard ? 0 : undefined}
      onFocus={() => props.onFocusCard?.(def)} onMouseEnter={() => props.onFocusCard?.(def)}>
      {body}
    </div>
  );
}
export { ALIGN };
