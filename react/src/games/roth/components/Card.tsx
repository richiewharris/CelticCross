// A Roth Catha card. "full" is a framed playing card: name banner (wrapping, never cut short) with its rarity gem,
// an art panel with the card's numbers on its left edge and its name in ogham along the foot, a type line, and a
// text box with a named ability and plain reminder text. "compact" is a small tile for the whole-wheel view.
// Size comes from the font-size around it; when the text box would overflow, the card steps its text down.
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import type { CardDef, Effect, FighterDef } from "../engine/cards";
import { ALIGN, cardText, fighterStats, typeLine } from "../text";
import { faceLines } from "../faceText";
import { CardArt, Ogham } from "./Art";
import { Icon } from "./Icons";

const ELEMENTS = new Set(["Fire", "Wind", "Earth", "Water"]);
const kindIcon = (d: CardDef): string => {
  switch (d.type) {
    case "hero": return "hero";
    case "champion": return "champion";
    case "support": return d.kind ?? "Weapon";
    default: return d.type === "unknown" ? "omen" : d.type;
  }
};
const PEOPLE: Record<string, string> = {
  Ulaid: "of the Ulaid", Connachta: "of the Connachta", Sidhe: "of the Sídhe", Fomoire: "of the Fomóire", Merrow: "of the Merrow", Deorad: "of the Deorad (exiles)",
};
const KIND_WORD: Record<string, string> = { Weapon: "weapon", Feat: "feat", Ally: "ally", Word: "word" };
/** The type line in words: "Hero of the Ulaid", "Water weapon of the Sídhe", "Geis on every hero". */
export function subtype(d: CardDef): string {
  switch (d.type) {
    case "hero": return `Hero ${PEOPLE[d.alignment] ?? ""}`.trim();
    case "champion": return `Champion ${PEOPLE[d.alignment] ?? ""}`.trim();
    case "support": {
      const k = `${d.element ?? ""} ${KIND_WORD[d.kind ?? "Weapon"]}`.trim();
      return d.alignment === "Unaligned" ? `${k}, unaligned` : `${k} ${PEOPLE[d.alignment]}`;
    }
    case "geis": return d.scope === "global" ? "Geis on every hero" : "Geis laid on one hero";
    case "oath": return "Oath sworn on your hero";
    case "omen": return d.scope === "global" ? "Omen over the whole field" : d.scope === "targeted" ? "Omen on one hero" : "Omen for your heroes";
    default: return "";
  }
}

/** Splits "Uaithne, the Dagda's harp" into a name and an epithet set smaller beneath it. */
function splitName(name: string): [string, string | null] {
  const i = name.indexOf(", ");
  return i > 0 ? [name.slice(0, i), name.slice(i + 2)] : [name, null];
}
/** A size step for the name by its length, so long names start smaller and still wrap if they must. */
function nameSize(n: string): string {
  const L = n.length;
  return L <= 9 ? "n-xl" : L <= 15 ? "n-l" : L <= 21 ? "n-m" : "n-s";
}

/** Inline markup from faceText: **keyword** and {icon}. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\{[A-Za-z]+\})/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**")) return <b key={i}><Rich text={p.slice(2, -2)} /></b>;
        if (p.startsWith("{")) return <Icon key={i} name={p.slice(1, -1)} className={`ink-${p.slice(1, -1)}`} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

const EFF_TITLE: Record<Effect["type"], string> = { strike: "Strike", heal: "Heal", shield: "Shield" };
/** A stat token: its shape says what it is (heart Valour, sun Initiative, diamond Strike, cross Heal, shield Shield). */
export function Token({ kind, n, title }: { kind: "valour" | "init" | "strike" | "heal" | "shield"; n: number; title: string }) {
  return (
    <span className={`tok tok-${kind}`} title={title}>
      <svg viewBox="0 0 32 32" aria-hidden="true">{TOKEN_SHAPE[kind]}</svg>
      <b>{n}</b>
    </span>
  );
}
const TOKEN_SHAPE: Record<string, ReactNode> = {
  valour: <path d="M16 30C6 23 1.6 17 1.6 10.8A7 7 0 0 1 16 7a7 7 0 0 1 14.4 3.8C30.4 17 26 23 16 30z" />,
  init: <><path d="M16 .8l2.6 4.4 4.8-1.6.6 5 5 .6-1.6 4.8 4.4 2.6-4.4 2.6 1.6 4.8-5 .6-.6 5-4.8-1.6L16 31.2l-2.6-4.4-4.8 1.6-.6-5-5-.6 1.6-4.8L.8 16l4.4-2.6-1.6-4.8 5-.6.6-5 4.8 1.6z" /></>,
  strike: <path d="M16 1 31 16 16 31 1 16z" />,
  heal: <path d="M11.5 2h9v9.5H30v9h-9.5V30h-9v-9.5H2v-9h9.5z" />,
  shield: <path d="M16 1.5 29 6v9c0 8-5.6 13.6-13 16.5C8.6 28.6 3 23 3 15V6z" />,
};

function Tokens({ d }: { d: CardDef }) {
  switch (d.type) {
    case "hero":
      return <><Token kind="valour" n={d.valour} title={`Valour ${d.valour}`} /><Token kind="init" n={d.init} title={`Initiative ${d.init}`} /></>;
    case "champion":
      return <Token kind="valour" n={d.valour} title={`Valour ${d.valour}`} />;
    case "support":
      return (
        <>
          {d.effects.map((e, i) => <Token key={i} kind={e.type} n={e.n} title={`${EFF_TITLE[e.type]} ${e.n}`} />)}
          {d.pierce ? <span className="tok tok-pierce" title="Ignores Shield"><Icon name="pierce" /></span> : null}
        </>
      );
    case "geis": case "omen":
      return <span className="tok tok-scope" title={d.scope === "global" ? "Every hero" : d.scope === "targeted" ? "One hero" : "Your heroes"}><Icon name={d.scope} /></span>;
    case "oath":
      return <span className="tok tok-scope" title="Sworn on your own hero"><Icon name="yours" /></span>;
    default:
      return null;
  }
}

function FighterChips({ f }: { f: FighterDef }) {
  return (
    <span className="cf-chips">
      {f.focus ? <span className="chip focus" title={`Focus: ${f.focus}. Supports of this element or kind get +1.`}>Focus <Icon name={f.focus} className={`ink-${f.focus}`} /><b>{f.focus}</b></span> : null}
      {f.weakness ? <span className="chip weak" title={`Weak to ${f.weakness}: enemy ${f.weakness} Strikes get +1.`}>Weak to <Icon name={f.weakness} className={`ink-${f.weakness}`} /><b>{f.weakness}</b></span> : null}
    </span>
  );
}

function FullBody({ d }: { d: CardDef }) {
  if (d.type === "unknown") {
    return (
      <div className="cf-back" aria-hidden="true">
        <svg viewBox="0 0 100 140">
          <rect x="6" y="6" width="88" height="128" rx="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <rect x="11" y="11" width="78" height="118" rx="4" fill="none" stroke="currentColor" strokeWidth=".6" strokeDasharray="2 2" />
          <g transform="translate(50 70)" fill="none" stroke="currentColor" strokeWidth="2.2">
            {[0, 120, 240].map((a) => <path key={a} transform={`rotate(${a})`} d="M0 4A13 13 0 0 1 0 -24A13 13 0 0 1 0 4" />)}
            <circle r="12" />
          </g>
        </svg>
      </div>
    );
  }
  const fighter = d.type === "hero" || d.type === "champion" ? d : null;
  const [name, epithet] = splitName(d.name);
  const lines = faceLines(d);
  const corner = d.type === "support" ? d.element : fighter && fighter.focus && ELEMENTS.has(fighter.focus) ? fighter.focus : null;
  return (
    <>
      <div className="cf-title">
        <span className={`cf-name ${nameSize(name)}`}>
          <span className="cf-n">{name}</span>
          {epithet ? <span className="cf-epi">{epithet}</span> : null}
        </span>
        <span className={`gem g-${"rarity" in d ? d.rarity : "common"}`} aria-hidden="true" />
      </div>
      <div className="cf-art">
        <CardArt d={d} />
        <div className="cf-stats"><Tokens d={d} /></div>
        {corner ? <span className={`cf-el el-${corner}`} title={fighter ? `Focus: ${corner}` : corner}><Icon name={corner} /></span> : null}
        <Ogham text={name} />
      </div>
      <div className="cf-type"><Icon name={kindIcon(d)} /><span>{subtype(d)}</span></div>
      <div className="cf-text">
        {fighter ? <FighterChips f={fighter} /> : null}
        {lines.map((l, i) => (
          <span key={i} className={`ln ln-${l.kind}`}>{l.kind === "ability" ? l.text : <Rich text={l.text} />}</span>
        ))}
        {fighter?.tag ? <span className="cf-tag" title={`A card that invokes ${fighter.tag} costs this hero 2 Valour.`}><Icon name="geis" />Geis: <b>{fighter.tag}</b></span> : null}
        {d.type === "champion" ? <span className="cf-tag champ">Called from your hand to stand in at the ford.</span> : null}
      </div>
    </>
  );
}

function CompactBody({ d }: { d: CardDef }) {
  if (d.type === "unknown") return <span className="back" aria-hidden="true">᚛᚜</span>;
  return (
    <>
      <span className="c-name"><Icon name={kindIcon(d)} className="glyph" /><span>{d.name}</span></span>
      <span className="c-short"><Tokens d={d} /></span>
    </>
  );
}

/** Steps the full card's text down (drop the lore line, then smaller type) until nothing overflows. */
function useFit(ref: RefObject<HTMLElement>, key: string, on: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !on) return;
    const fit = () => {
      const box = el.querySelector<HTMLElement>(".cf-text");
      if (!box) return;
      let level = 0;
      el.dataset.fit = "0";
      while (level < 4 && box.scrollHeight > box.clientHeight + 1) { level++; el.dataset.fit = String(level); }
    };
    fit();
    let w = el.offsetWidth;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (el.offsetWidth !== w) { w = el.offsetWidth; fit(); } }) : null;
    ro?.observe(el);
    document.fonts?.ready.then(fit).catch(() => undefined);
    return () => ro?.disconnect();
  }, [ref, key, on]);
}

/** The words a screen reader hears for a card: name, type and rarity, numbers, and the exact rule. */
export function cardLabel(def: CardDef): string {
  if (def.type === "unknown") return "Hidden card";
  const stats = def.type === "hero" || def.type === "champion" ? ` ${fighterStats(def)}.` : "";
  return `${def.name}, ${typeLine(def)}.${stats} ${cardText(def)}`;
}

export function CardFace(props: {
  def: CardDef; owner?: "mine" | "theirs"; faceDown?: boolean; selected?: boolean; playable?: boolean;
  variant?: "full" | "compact"; onClick?: () => void; onFocusCard?: (d: CardDef) => void; label?: string; badge?: string;
  dim?: boolean; children?: ReactNode;
}) {
  const { def, faceDown } = props;
  const variant = props.variant ?? "full";
  const ref = useRef<HTMLElement>(null);
  useFit(ref, def.id, variant === "full" && def.type !== "unknown");
  const al = "alignment" in def ? def.alignment : "None";
  const art = def.type === "support" && def.element ? `x-${def.element}` : "";
  const cls = ["card", variant, `t-${def.type}`, `al-${al}`, art, props.owner ?? "", faceDown ? "down" : "", props.selected ? "sel" : "",
    props.playable ? "playable" : "", props.dim ? "dim" : "", "rarity" in def ? `r-${def.rarity}` : ""].filter(Boolean).join(" ");
  const body = (
    <>
      {variant === "full" ? <FullBody d={def} /> : <CompactBody d={def} />}
      {props.badge ? <span className="c-badge">{props.badge}</span> : null}
      {faceDown ? <span className="c-down">face down</span> : null}
      {props.children}
    </>
  );
  const aria = props.label ?? cardLabel(def);
  if (props.onClick) {
    return (
      <button ref={ref as RefObject<HTMLButtonElement>} type="button" className={cls} aria-label={aria} aria-pressed={props.selected || undefined}
        onClick={props.onClick} onFocus={() => props.onFocusCard?.(def)} onMouseEnter={() => props.onFocusCard?.(def)}>
        {body}
      </button>
    );
  }
  return (
    <div ref={ref as RefObject<HTMLDivElement>} className={cls} role="img" aria-label={aria} tabIndex={props.onFocusCard ? 0 : undefined}
      onFocus={() => props.onFocusCard?.(def)} onMouseEnter={() => props.onFocusCard?.(def)}>
      {body}
    </div>
  );
}
export { ALIGN };
