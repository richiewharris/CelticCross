// "Cards & decks": the rules told through the cards. An annotated sample card, the icons, the six card types,
// how a blow's number is worked out, and a breakdown of each of the five decks.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Segmented } from "../../../kit/Segmented";
import { useStoredState } from "../../../kit/useStoredState";
import { ALL_DEFS, DECK_IDS, FACTIONS, type CardDef, type Faction, type FighterDef, type SupportDef } from "../engine/cards";
import { CardFace, Rich, Token } from "../components/Card";
import { Emblem, Icon } from "../components/Icons";
import { FACTION_TITLE } from "../text";
import { DECK_NOTES, TYPE_NOTES } from "./notes";

const SECTIONS = [
  { id: "cx-anatomy", label: "A card, piece by piece" },
  { id: "cx-icons", label: "Icons" },
  { id: "cx-types", label: "The six kinds of card" },
  { id: "cx-blow", label: "Reading a blow" },
  { id: "cx-decks", label: "The five decks" },
];

export function Codex({ setFocus }: { setFocus: (d: CardDef) => void }) {
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="codex">
      <nav className="cx-nav chips" aria-label="Sections">
        {SECTIONS.map((s) => <button key={s.id} type="button" onClick={() => go(s.id)}>{s.label}</button>)}
      </nav>
      <p className="cx-intro">Every rule in Roth Catha lives on a card. This guide reads the cards: what each mark means, what each kind of card does and when you play it, how a support's number grows at the ford, and how each of the five decks wants to win.</p>
      <Anatomy />
      <Icons />
      <Types setFocus={setFocus} />
      <Blow />
      <Decks setFocus={setFocus} />
    </div>
  );
}

// ------------------------------------------------------------------ anatomy

type Part = { sel: string; at: [number, number]; dx?: number; title: string; text: string };
const COMMON_TOP: Part[] = [
  { sel: ".cf-name", at: [0, 0.5], dx: -22, title: "Name", text: "A long name wraps; an epithet after a comma sits beneath it, smaller." },
  { sel: ".gem", at: [0.5, 0.5], title: "Rarity gem", text: "Silver for common (two copies allowed in a deck), gold for rare (one copy), a glowing ember for legendary (one copy, at most two legendaries a deck). Legendaries also get a gold knotwork frame." },
];
const PARTS: Record<string, { def: string; parts: Part[] }> = {
  hero: {
    def: "cu",
    parts: [
      ...COMMON_TOP,
      { sel: ".cf-stats", at: [0.5, 0.15], title: "Valour and Initiative", text: "The heart is Valour: the hero's life in its duel. The sun is Initiative: the higher strikes first." },
      { sel: ".cf-el", at: [0.5, 0.5], title: "Focus element", text: "A hero whose Focus is an element shows it here. Supports of the Focus get +1." },
      { sel: ".cf-pic", at: [0.6, 0.35], title: "Art", text: "The scene is the hero's element; the roundel holds the sigil of its people." },
      { sel: ".cf-ogham", at: [0.85, 0.5], title: "Ogham", text: "The card's name, spelt in the old Irish stroke alphabet." },
      { sel: ".cf-type", at: [0.95, 0.5], title: "Type line", text: "What the card is and whose it is: a hero of the Ulaid." },
      { sel: ".cf-chips", at: [0.97, 0.5], title: "Focus and weakness", text: "Focus: supports of this element or kind get +1. Weak to: enemy Strikes of this element get +1." },
      { sel: ".ln-ability", at: [0.97, 0.5], title: "Ability", text: "The hero's named quality, then what it does in plain words. Bold words are the numbers that matter." },
      { sel: ".cf-tag", at: [0.97, 0.5], title: "Geis tag", text: "The hero's own taboo. A card that invokes this tag costs the hero 2 Valour." },
    ],
  },
  support: {
    def: "gae_bolga",
    parts: [
      ...COMMON_TOP,
      { sel: ".cf-stats", at: [0.5, 0.15], title: "Effect tokens", text: "The diamond is Strike, the cross Heal, the shield Shield; the disc means it ignores Shield." },
      { sel: ".cf-el", at: [0.5, 0.5], title: "Element", text: "Fire, Wind, Earth or Water. It matters for Focus, for the element wheel, and for the enemy's weakness." },
      { sel: ".cf-pic", at: [0.6, 0.35], title: "Art", text: "The element's scene, with the kind of support at its heart." },
      { sel: ".cf-type", at: [0.95, 0.5], title: "Type line", text: "Element, kind (weapon, feat, ally or word) and people. Kinship with the hero's people adds +1; an Unwilling people makes it useless." },
      { sel: ".ln-effect", at: [0.97, 0.5], title: "Effect", text: "The printed numbers, before any bonus." },
      { sel: ".ln-ability", at: [0.97, 0.5], title: "Ability", text: "Anything special: a better number for one hero, a bonus on the first blow, a cost." },
    ],
  },
  geis: {
    def: "g_giant",
    parts: [
      ...COMMON_TOP,
      { sel: ".cf-stats", at: [0.5, 0.3], title: "Reach", text: "Crosshairs: laid on one hero. A globe: binds every hero. A ring-fort: your own heroes." },
      { sel: ".cf-pic", at: [0.6, 0.4], title: "Art", text: "A ring of chain, and what the geis forbids, struck through." },
      { sel: ".ln-rule", at: [0.97, 0.5], title: "What it forbids", text: "Supports of an element or kind, Heals, or resting." },
      { sel: ".ln-ability", at: [0.97, 0.5], title: "Extra bite", text: "Some geasa also cost Valour or Initiative at the start of the duel." },
      { sel: ".ln-break", at: [0.97, 0.5], title: "Breaking it", text: "A bound hero can still act against it by paying 2 Valour first." },
    ],
  },
  oath: {
    def: "v_stone",
    parts: [
      ...COMMON_TOP,
      { sel: ".cf-pic", at: [0.6, 0.4], title: "Art", text: "A holed standing stone, carved with the boon." },
      { sel: ".cf-type", at: [0.95, 0.5], title: "Type line", text: "Sworn on one of your own heroes." },
      { sel: ".ln-ability", at: [0.97, 0.5], title: "Boon, then vow", text: "What your hero gains for its duel, and what it promises never to do." },
      { sel: ".ln-break", at: [0.97, 0.5], title: "Breaking it", text: "Break the vow by paying 2 Valour." },
    ],
  },
  omen: {
    def: "o_crow",
    parts: [
      ...COMMON_TOP,
      { sel: ".cf-stats", at: [0.5, 0.3], title: "Reach", text: "Globe: the whole field, both sides. Ring-fort: your heroes. Crosshairs: one hero, chosen as it turns." },
      { sel: ".cf-pic", at: [0.6, 0.4], title: "Art", text: "A night sky, with the omen's sign: a crow, an eye, a mist, a shield." },
      { sel: ".cf-type", at: [0.95, 0.5], title: "Type line", text: "Who the omen touches." },
      { sel: ".ln-text", at: [0.97, 0.5], title: "Effect", text: "What holds from the moment it turns until the match ends." },
      { sel: ".ln-lore", at: [0.97, 0.5], title: "Lore", text: "A line from the old tales. Small cards drop it first." },
    ],
  },
};
type AnatKind = keyof typeof PARTS;

function Anatomy() {
  const [kind, setKind] = useStoredState<AnatKind>("roth-codex-anatomy", "hero");
  const [hi, setHi] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const spec = PARTS[kind] ?? PARTS.hero;
  const [pins, setPins] = useState<({ x: number; y: number } | null)[]>([]);
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const place = () => {
      const r0 = root.getBoundingClientRect();
      setPins(spec.parts.map((p) => {
        const el = root.querySelector(`.card ${p.sel}`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left - r0.left + r.width * p.at[0] + (p.dx ?? 0), y: r.top - r0.top + r.height * p.at[1] };
      }));
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(root);
    document.fonts?.ready.then(place).catch(() => undefined);
    const t = window.setTimeout(place, 300); // after the card fits its text
    return () => { ro?.disconnect(); window.clearTimeout(t); };
  }, [kind, spec]);
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    root.querySelectorAll(".cx-lit").forEach((e) => e.classList.remove("cx-lit"));
    if (hi !== null) root.querySelector(`.card ${spec.parts[hi]?.sel}`)?.classList.add("cx-lit");
  }, [hi, spec, kind]);
  return (
    <section id="cx-anatomy" className="cx-section">
      <h2>A card, piece by piece</h2>
      <Segmented label="Sample card" value={kind} onChange={(v) => { setKind(v); setHi(null); }} className="cx-seg"
        options={[{ value: "hero", label: "Hero" }, { value: "support", label: "Support" }, { value: "geis", label: "Geis" }, { value: "oath", label: "Oath" }, { value: "omen", label: "Omen" }] as { value: AnatKind; label: string }[]} />
      <div className="cx-anatomy">
        <div className="cx-anat-card" ref={box}>
          <CardFace def={ALL_DEFS[spec.def]} owner="mine" />
          {pins.slice(0, spec.parts.length).map((p, i) => p ? (
            <button key={i} type="button" className={`cx-pin${hi === i ? " on" : ""}`} style={{ left: p.x, top: p.y }}
              aria-label={`${i + 1}: ${spec.parts[i].title}`} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onFocus={() => setHi(i)} onBlur={() => setHi(null)}
              onClick={() => document.getElementById(`cx-part-${i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })}>{i + 1}</button>
          ) : null)}
        </div>
        <ol className="cx-parts">
          {spec.parts.map((p, i) => (
            <li key={i} id={`cx-part-${i}`} className={hi === i ? "on" : ""} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
              <span className="cx-num" aria-hidden="true">{i + 1}</span>
              <span><b>{p.title}.</b> {p.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ icons

function Legend({ items }: { items: { mark: ReactNode; name: string; text: string }[] }) {
  return (
    <dl className="cx-legend">
      {items.map((it) => (
        <div key={it.name} className="cx-leg">
          <dt><span className="cx-mark">{it.mark}</span>{it.name}</dt>
          <dd>{it.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Icons() {
  return (
    <section id="cx-icons" className="cx-section">
      <h2>Icons</h2>
      <div className="cx-icon-grid">
        <div className="cx-panel cx-tokens">
          <h3>Numbers</h3>
          <Legend items={[
            { mark: <Token kind="valour" n={4} title="Valour" />, name: "Valour", text: "Life. At 0 the hero falls. Heals can lift it at most 2 above the duel's start." },
            { mark: <Token kind="init" n={5} title="Initiative" />, name: "Initiative", text: "Higher strikes first. A tie goes to the first player." },
            { mark: <Token kind="strike" n={2} title="Strike" />, name: "Strike", text: "Wounds the enemy fighter." },
            { mark: <Token kind="heal" n={2} title="Heal" />, name: "Heal", text: "Restores your fighter's Valour." },
            { mark: <Token kind="shield" n={2} title="Shield" />, name: "Shield", text: "Soaks wounds before Valour does." },
            { mark: <span className="tok tok-pierce"><Icon name="pierce" /></span>, name: "Ignores Shield", text: "This Strike goes straight through Shield." },
          ]} />
        </div>
        <div className="cx-panel">
          <h3>The element wheel</h3>
          <ElementWheel />
          <p className="cx-small">A Strike whose element beats the enemy's Focus gets <b>+1</b>; a Strike of the enemy's weakness gets another <b>+1</b>.</p>
        </div>
        <div className="cx-panel">
          <h3>Kinds of support</h3>
          <Legend items={[
            { mark: <Icon name="Weapon" />, name: "Weapon", text: "Spears, swords, slings and shields." },
            { mark: <Icon name="Feat" />, name: "Feat", text: "Deeds of skill and fury." },
            { mark: <Icon name="Ally" />, name: "Ally", text: "Charioteers, hosts, beasts and healers." },
            { mark: <Icon name="Word" />, name: "Word", text: "Satire, prophecy, spells and songs." },
          ]} />
          <p className="cx-small">A hero whose Focus is a kind (say, Weapon) gets +1 from every support of that kind.</p>
        </div>
        <div className="cx-panel">
          <h3>Kinds of card</h3>
          <Legend items={[
            { mark: <Icon name="hero" />, name: "Hero", text: "Fights a duel." },
            { mark: <Icon name="champion" />, name: "Champion", text: "Stands in for a hero." },
            { mark: <Icon name="geis" />, name: "Geis", text: "A taboo on a hero." },
            { mark: <Icon name="oath" />, name: "Oath", text: "A vow on your hero." },
            { mark: <Icon name="omen" />, name: "Omen", text: "Fate, turned face up." },
          ]} />
        </div>
        <div className="cx-panel">
          <h3>Reach of geasa and omens</h3>
          <Legend items={[
            { mark: <span className="tok tok-scope"><Icon name="targeted" /></span>, name: "One hero", text: "Aimed at a single hero." },
            { mark: <span className="tok tok-scope"><Icon name="global" /></span>, name: "Every hero", text: "The whole field, both sides." },
            { mark: <span className="tok tok-scope"><Icon name="yours" /></span>, name: "Your heroes", text: "Only your side." },
          ]} />
        </div>
        <div className="cx-panel">
          <h3>Rarity</h3>
          <Legend items={[
            { mark: <span className="cx-gem"><span className="gem g-common" /></span>, name: "Common", text: "Up to two copies in a deck." },
            { mark: <span className="cx-gem"><span className="gem g-rare" /></span>, name: "Rare", text: "One copy." },
            { mark: <span className="cx-gem"><span className="gem g-legendary" /></span>, name: "Legendary", text: "One copy, two legendaries at most. Gold frame." },
          ]} />
          <p className="cx-small">Heroes, champions and omens are always one copy each.</p>
        </div>
      </div>
    </section>
  );
}

const EL_POS: { el: string; x: number; y: number }[] = [
  { el: "Fire", x: 50, y: 12 }, { el: "Wind", x: 88, y: 50 }, { el: "Earth", x: 50, y: 88 }, { el: "Water", x: 12, y: 50 },
];
function ElementWheel() {
  return (
    <div className="cx-wheel" role="img" aria-label="Fire beats Wind, Wind beats Earth, Earth beats Water, Water beats Fire">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <marker id="cx-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="currentColor" />
          </marker>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const a0 = (-90 + 90 * i + 24) * (Math.PI / 180), a1 = (-90 + 90 * (i + 1) - 24) * (Math.PI / 180);
          const r = 38;
          return <path key={i} d={`M${50 + r * Math.cos(a0)} ${50 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${50 + r * Math.cos(a1)} ${50 + r * Math.sin(a1)}`} className="cx-arc" markerEnd="url(#cx-arrow)" />;
        })}
        <text x="50" y="49" textAnchor="middle" className="cx-beats">beats</text>
        <text x="50" y="57" textAnchor="middle" className="cx-beats">clockwise</text>
      </svg>
      {EL_POS.map((p) => (
        <span key={p.el} className={`cx-el el-${p.el}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}><Icon name={p.el} /><b>{p.el}</b></span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ the six kinds

function Types({ setFocus }: { setFocus: (d: CardDef) => void }) {
  return (
    <section id="cx-types" className="cx-section">
      <h2>The six kinds of card</h2>
      <p className="cx-small">Every deck is 24 cards. The five here each hold 4 heroes, 2 champions, 9 supports, 3 geasa, 2 oaths and 4 omens.</p>
      <div className="cx-types">
        {TYPE_NOTES.map((t) => (
          <article key={t.type} className="cx-type">
            <div className="cx-type-card hand"><CardFace def={ALL_DEFS[t.sample]} owner="mine" onFocusCard={setFocus} /></div>
            <div className="cx-type-text">
              <h3><Icon name={t.type} /> {t.title}</h3>
              <p><Rich text={t.what} /></p>
              <p className="cx-when"><span className="cx-k">When</span> <Rich text={t.when} /></p>
              <ul>{t.how.map((h, i) => <li key={i}><Rich text={h} /></li>)}</ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ reading a blow

function Blow() {
  const steps: { n: string; title: string; text: string }[] = [
    { n: "1", title: "The printed number", text: "Some cards change it for one hero or one target: Gáe Bolga is Strike 4 for Cú Chulainn, the tathlum +2 against a big hero." },
    { n: "+1", title: "Kinship", text: "The support is of your fighter's own people (Medb gets +2). Exiles (Deorad) are kin to both Ulaid and Connachta; Unaligned cards are kin to no one." },
    { n: "+1", title: "Focus", text: "The support's element or kind is your fighter's Focus (Lugh: always)." },
    { n: "+1", title: "The element wheel", text: "Strikes only: the support's element beats the enemy's Focus." },
    { n: "+1", title: "Weakness", text: "Strikes only: the support's element is the enemy's weakness." },
    { n: "±", title: "Your fighter and your omens", text: "Strikes +1 qualities, first-blow bonuses, an oath's boon, a next-Strike set up by the last support, reinforcement omens, targeted omens." },
    { n: "−", title: "The defence", text: "The Debility, the Truce (no more than 3), the sea-giant's cap, wards that soften the first blow, then Shield, unless the Strike ignores it." },
  ];
  return (
    <section id="cx-blow" className="cx-section">
      <h2>Reading a blow</h2>
      <p>At the ford each fighter takes two turns, alternating, starting with the higher Initiative. On a turn: use a support from your quadrant, rest, or call a champion. A support's number is worked out like this:</p>
      <ol className="cx-steps">{steps.map((s) => <li key={s.title}><span className="cx-step-n">{s.n}</span><span><b>{s.title}.</b> {s.text}</span></li>)}</ol>
      <div className="cx-panel cx-example">
        <h3>Example: Cú Chulainn uses Thunder feat against Lugh</h3>
        <div className="cx-ex-cards hand">
          {["cu", "thunder", "lugh"].map((id) => <CardFace key={id} def={ALL_DEFS[id]} owner={id === "lugh" ? "theirs" : "mine"} />)}
        </div>
        <div className="cx-sum" aria-label="2 printed, plus 1 kinship, plus 1 Focus, plus 1 Fire beats Wind, plus 1 weakness, plus 1 Ríastrad, equals Strike 7, ignoring Shield">
          <span className="cx-term"><Token kind="strike" n={2} title="Printed" /><small>printed</small></span>
          <span className="cx-op">+1</span><span className="cx-term"><small>kinship<br />Ulaid</small></span>
          <span className="cx-op">+1</span><span className="cx-term"><small>Focus<br /><Icon name="Fire" /> Fire</small></span>
          <span className="cx-op">+1</span><span className="cx-term"><small><Icon name="Fire" /> beats<br /><Icon name="Wind" /> Wind</small></span>
          <span className="cx-op">+1</span><span className="cx-term"><small>Lugh weak<br />to Fire</small></span>
          <span className="cx-op">+1</span><span className="cx-term"><small>Ríastrad</small></span>
          <span className="cx-op">=</span><span className="cx-term"><Token kind="strike" n={7} title="Strike 7" /><small>through Shield</small></span>
        </div>
        <p className="cx-small">Lugh starts with Valour 4: the blow fells him outright. That is why where you place a hero, and whom it meets across the ford, matters as much as the cards themselves. Lugh's answer is to strike first: his Initiative 6 beats Cú Chulainn's 5.</p>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ decks

const PEOPLE_OF: Record<Faction, string> = { ulster: "Ulaid", connacht: "Connachta", sidhe: "Sidhe", fomoire: "Fomoire", merrow: "Merrow" };
const GROUPS: { type: CardDef["type"]; title: string }[] = [
  { type: "hero", title: "Heroes" }, { type: "champion", title: "Champions" }, { type: "support", title: "Supports" },
  { type: "geis", title: "Geasa" }, { type: "oath", title: "Oaths" }, { type: "omen", title: "Omens" },
];
const ELS = ["Fire", "Wind", "Earth", "Water"] as const;
const KINDS = ["Weapon", "Feat", "Ally", "Word"] as const;

function Decks({ setFocus }: { setFocus: (d: CardDef) => void }) {
  const [f, setF] = useStoredState<Faction>("roth-codex-deck", "ulster");
  const faction = (FACTIONS as readonly string[]).includes(f) ? f : "ulster";
  const note = DECK_NOTES[faction];
  const ids = DECK_IDS[faction];
  const copies = new Map<string, number>();
  for (const id of ids) copies.set(id, (copies.get(id) ?? 0) + 1);
  const unique = [...copies.keys()].map((id) => ALL_DEFS[id]);
  const sups = ids.map((id) => ALL_DEFS[id]).filter((d): d is SupportDef => d.type === "support");
  const fighters = unique.filter((d): d is FighterDef => d.type === "hero" || d.type === "champion");
  return (
    <section id="cx-decks" className="cx-section">
      <h2>The five decks</h2>
      <Segmented label="Deck" value={faction} onChange={setF} className="cx-seg"
        options={FACTIONS.map((x) => ({ value: x, label: FACTION_TITLE[x] }))} />
      <article className={`cx-deck al-${PEOPLE_OF[faction]}`}>
        <header className="cx-deck-head">
          <svg viewBox="0 0 100 100" className="cx-sigil" aria-hidden="true"><Emblem alignment={PEOPLE_OF[faction]} /></svg>
          <div>
            <h3>{FACTION_TITLE[faction]}</h3>
            <p className="cx-people">{note.people}</p>
            <p className="cx-motto"><Rich text={note.motto} /></p>
          </div>
        </header>

        <div className="cx-deck-grid">
          <div className="cx-panel">
            <h4>How it plays</h4>
            <ul>{note.plan.map((p, i) => <li key={i}><Rich text={p} /></li>)}</ul>
          </div>
          <div className="cx-panel">
            <h4>Watch for</h4>
            <ul>{note.watch.map((p, i) => <li key={i}><Rich text={p} /></li>)}</ul>
            <h4>The supports</h4>
            <Bars label="Element" rows={ELS.map((e) => ({ key: e, icon: e, n: sups.filter((s) => s.element === e).length }))} total={sups.length} />
            <Bars label="Kind" rows={KINDS.map((k) => ({ key: k, icon: k, n: sups.filter((s) => s.kind === k).length }))} total={sups.length} />
            <p className="cx-small">{sums(sups)}</p>
          </div>
        </div>

        <div className="cx-table-wrap">
          <table className="cx-table">
            <caption>Fighters</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Valour</th><th scope="col">Init.</th><th scope="col">Focus</th><th scope="col">Weak to</th><th scope="col">Geis</th><th scope="col">Role</th></tr></thead>
            <tbody>
              {fighters.map((h) => (
                <tr key={h.id} tabIndex={0} onFocus={() => setFocus(h)} onMouseEnter={() => setFocus(h)}>
                  <th scope="row">{h.name}{h.type === "champion" ? <span className="cx-chip">champion</span> : null}</th>
                  <td><Token kind="valour" n={h.valour} title={`Valour ${h.valour}`} /></td>
                  <td>{h.type === "hero" ? <Token kind="init" n={h.init} title={`Initiative ${h.init}`} /> : <span className="cx-dash">—</span>}</td>
                  <td><span className="cx-fw"><Icon name={h.focus ?? ""} />{h.focus}</span></td>
                  <td><span className="cx-fw"><Icon name={h.weakness ?? ""} />{h.weakness}</span></td>
                  <td>{h.tag ?? <span className="cx-dash">—</span>}</td>
                  <td>{note.roles[h.id] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {GROUPS.map((g) => {
          const cards = unique.filter((d) => d.type === g.type);
          if (!cards.length) return null;
          const n = ids.filter((id) => ALL_DEFS[id].type === g.type).length;
          return (
            <div key={g.type} className="cx-group">
              <h4><Icon name={g.type} /> {g.title} <span className="cx-count">{n}</span></h4>
              {note.groups[g.type as keyof typeof note.groups] ? <p><Rich text={note.groups[g.type as keyof typeof note.groups]!} /></p> : null}
              <div className="hand">
                {cards.map((d) => <CardFace key={d.id} def={d} owner="mine" onFocusCard={setFocus} badge={(copies.get(d.id) ?? 1) > 1 ? `×${copies.get(d.id)}` : undefined} />)}
              </div>
            </div>
          );
        })}
      </article>
    </section>
  );
}

function sums(sups: SupportDef[]): string {
  const t = { strike: 0, heal: 0, shield: 0 };
  for (const s of sups) for (const e of s.effects) t[e.type] += e.n;
  const pierce = sups.filter((s) => s.pierce).length;
  return `Printed totals: Strike ${t.strike}, Heal ${t.heal}, Shield ${t.shield}${pierce ? `; ${pierce} ${pierce === 1 ? "card ignores" : "cards ignore"} Shield` : ""}.`;
}

function Bars({ label, rows, total }: { label: string; rows: { key: string; icon: string; n: number }[]; total: number }) {
  return (
    <div className="cx-bars" role="img" aria-label={`${label}: ${rows.filter((r) => r.n).map((r) => `${r.key} ${r.n}`).join(", ")}`}>
      <span className="cx-bars-label">{label}</span>
      <div className="cx-bar">
        {rows.filter((r) => r.n).map((r) => (
          <span key={r.key} className={`cx-seg-${r.key}`} style={{ flexGrow: r.n / total }} title={`${r.key} ${r.n}`}>
            <Icon name={r.icon} /><b>{r.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
