// A Roth Catha card. "full" is a framed playing card (name bar and rarity gem, art panel, type line, text box,
// stat badges); "compact" is a small tile for the whole-wheel view. Size comes from the font-size around it.
import type { ReactNode } from "react";
import type { CardDef, Effect } from "../engine/cards";
import { ALIGN, cardText, typeLine } from "../text";
import { Emblem, Icon } from "./Icons";

const ART_ELEMENT: Record<string, string> = { Fire: "Fire", Wind: "Wind", Earth: "Earth", Water: "Water" };
const kindIcon = (d: CardDef): string => {
  switch (d.type) {
    case "hero": return "hero";
    case "champion": return "champion";
    case "support": return d.kind ?? "Weapon";
    default: return d.type === "unknown" ? "omen" : d.type;
  }
};
/** The art panel's colour: the support's element, the hero's Focus element, or the card type. */
const artKey = (d: CardDef): string => {
  if (d.type === "support" && d.element) return d.element;
  if ((d.type === "hero" || d.type === "champion") && d.focus && ART_ELEMENT[d.focus]) return d.focus;
  return d.type;
};
const subtype = (d: CardDef): string => {
  switch (d.type) {
    case "hero": return `Hero — ${ALIGN[d.alignment]}`;
    case "champion": return `Champion — ${ALIGN[d.alignment]}`;
    case "support": return `${d.kind} — ${d.element}${d.alignment !== "Unaligned" ? ` · ${ALIGN[d.alignment]}` : ""}`;
    case "geis": return `Geis — ${d.scope === "global" ? "Global" : "Targeted"}`;
    case "oath": return "Oath — on your hero";
    case "omen": return `Omen — ${d.scope === "global" ? "Global" : d.scope === "targeted" ? "Targeted" : "Yours"}`;
    default: return "";
  }
};
const effectIcon = (e: Effect) => (e.type === "strike" ? "strike" : e.type === "heal" ? "heal" : "shield");
const effectWord = (e: Effect) => (e.type === "strike" ? "Strike" : e.type === "heal" ? "Heal" : "Shield");

function Badges({ d }: { d: CardDef }) {
  switch (d.type) {
    case "hero":
      return (
        <>
          <span className="badge init" title={`Initiative ${d.init}`}><Icon name="init" />{d.init}</span>
          <span className="badge valour" title={`Valour ${d.valour}`}><Icon name="valour" />{d.valour}</span>
        </>
      );
    case "champion":
      return <span className="badge valour" title={`Valour ${d.valour}`}><Icon name="valour" />{d.valour}</span>;
    case "support":
      return (
        <>
          {d.pierce ? <span className="badge pierce" title="Ignores Shield"><Icon name="pierce" /></span> : null}
          {d.effects.map((e, i) => (
            <span key={i} className={`badge eff-${e.type}`} title={`${effectWord(e)} ${e.n}`}><Icon name={effectIcon(e)} />{e.n}</span>
          ))}
        </>
      );
    case "geis": case "omen":
      return <span className="badge scope" title={d.scope}><Icon name={d.scope} /></span>;
    case "oath":
      return <span className="badge scope" title="Sworn on your own hero"><Icon name="yours" /></span>;
    default:
      return null;
  }
}

function FullBody({ d }: { d: CardDef }) {
  if (d.type === "unknown") return <div className="cf-back"><svg viewBox="0 0 100 100" aria-hidden="true"><Emblem alignment="None" /></svg></div>;
  const al = "alignment" in d ? d.alignment : "None";
  const fighter = d.type === "hero" || d.type === "champion" ? d : null;
  return (
    <>
      <div className="cf-title"><span className="cf-name">{d.name}</span><span className={`gem g-${"rarity" in d ? d.rarity : "common"}`} aria-hidden="true" /></div>
      <div className={`cf-art art-${artKey(d)}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="cf-emblem" aria-hidden="true"><Emblem alignment={al} /></svg>
        <span className="cf-kind"><Icon name={kindIcon(d)} /></span>
        {d.type === "support" && d.element ? <span className="cf-el"><Icon name={d.element} /></span> : null}
      </div>
      <div className="cf-type"><Icon name={d.type === "support" ? (d.kind ?? "Weapon") : d.type} /><span>{subtype(d)}</span></div>
      <div className="cf-text">
        {fighter ? (
          <span className="cf-focus">
            <span title={`Focus: ${fighter.focus}`}>{fighter.focus && ART_ELEMENT[fighter.focus] ? <Icon name={fighter.focus} /> : <Icon name={fighter.focus ?? ""} />}{fighter.focus}</span>
            <span className="weak" title={`Weakness: ${fighter.weakness}`}>weak <Icon name={fighter.weakness ?? ""} />{fighter.weakness}</span>
          </span>
        ) : null}
        <span className="cf-rules">{cardText(d)}</span>
        {fighter?.tag ? <span className="cf-tag">Geis: {fighter.tag}</span> : null}
      </div>
      <div className="cf-stats"><Badges d={d} /></div>
    </>
  );
}

function CompactBody({ d }: { d: CardDef }) {
  if (d.type === "unknown") return <span className="back" aria-hidden="true">᚛᚜</span>;
  return (
    <>
      <span className="c-name"><Icon name={kindIcon(d)} className="glyph" />{d.name}</span>
      <span className="c-short"><Badges d={d} /></span>
    </>
  );
}

export function CardFace(props: {
  def: CardDef; owner?: "mine" | "theirs"; faceDown?: boolean; selected?: boolean; playable?: boolean;
  variant?: "full" | "compact"; onClick?: () => void; onFocusCard?: (d: CardDef) => void; label?: string; badge?: string;
  dim?: boolean; children?: ReactNode;
}) {
  const { def, faceDown } = props;
  const variant = props.variant ?? "full";
  const al = "alignment" in def ? def.alignment : "None";
  const cls = ["card", variant, `t-${def.type}`, `al-${al}`, props.owner ?? "", faceDown ? "down" : "", props.selected ? "sel" : "",
    props.playable ? "playable" : "", props.dim ? "dim" : "", "rarity" in def ? `r-${def.rarity}` : ""].filter(Boolean).join(" ");
  const body = (
    <>
      {variant === "full" ? <FullBody d={def} /> : <CompactBody d={def} />}
      {props.badge ? <span className="c-badge">{props.badge}</span> : null}
      {faceDown ? <span className="c-down">face down</span> : null}
      {props.children}
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
