// The deck builder: choose one or two peoples, browse their pool, and build a 24-card deck. Decks are saved in
// this browser and can be taken straight to a match.
import { useEffect, useMemo, useRef, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { ALL_DEFS, FACTIONS, PEOPLE, inPool, type CardDef, type Faction, type SupportDef } from "./engine/cards";
import { buildDeck } from "./engine/builder";
import { Rng } from "./engine/rng";
import { CardFace, Token } from "./components/Card";
import { Emblem, Icon } from "./components/Icons";
import { Bars } from "./codex/Codex";
import { DECKS_KEY, RANGES, cannotAdd, deckProblems, defsOf, maxCopies, newDeckId, starterIds, useSavedDecks, type SavedDeck } from "./decks";
/** The cards only the primary people may bring: those who lead its bands. */
const LEADS = new Set<string>(["hero", "host", "monster"]);
import { FACTION_TITLE } from "./text";
import { DEFAULT_SETUP, type Setup } from "./useMatch";

interface Draft { name: string; factions: Faction[]; ids: string[]; savedId: string | null }

type StepId = "peoples" | "heroes" | "monsters" | "champions" | "supports" | "geasa" | "rites" | "review";
interface Step { id: StepId; title: string; types: Exclude<CardDef["type"], "unknown">[]; blurb: string; tip: string }
/** The guided order. The Slúagh step for monsters shows only when the Slúagh are one of your peoples. */
const STEPS: Step[] = [
  { id: "peoples", title: "Peoples", types: [], blurb: "Choose one or two peoples. The first leads: every hero (or host) is of it. A second people lends the rest of its cards (supports, champions, geasa, oaths, omens, attendants), never heroes. The unaligned cards and the geasa, oaths and omens open to everyone are yours too.", tip: "Each people's supports get +1 kinship only with its own heroes." },
  { id: "heroes", title: "Heroes", types: ["hero", "host"], blurb: "Your fighters. Four of them go on the wheel and fight the duels; the others wait as guests who can heal 1, or in the Reserve.", tip: "Take 4 to 6. Valour keeps a hero standing; Initiative decides who strikes first. Mind their weaknesses." },
  { id: "monsters", title: "Monsters", types: ["monster"], blurb: "A Slúagh host rides with the monsters you join to it, adding their Valour, Initiative and qualities.", tip: "Take 4 to 6 monsters for your hosts." },
  { id: "champions", title: "Champions", types: ["champion"], blurb: "Called from your hand to stand in for a hero about to fall, at their own full Valour. If the champion falls, so does the hero.", tip: "0 to 2. Two champions means you'll usually hold one after the Muster." },
  { id: "supports", title: "Supports", types: ["support"], blurb: "The two cards beside each hero, and the cards you draw in duels: Strikes, Shields and Heals. Kinship (same people) and Focus (the hero's element or kind) add +1.", tip: "Take 8 to 12. Mix elements and kinds: a geis can forbid one of either." },
  { id: "geasa", title: "Geasa", types: ["geis"], blurb: "Taboos laid on an enemy hero (or on every hero) in the Winnow. Breaking one costs 2 Valour.", tip: "Take 2 to 6. Aim them at what the enemy relies on: an element, a kind, resting or healing." },
  { id: "rites", title: "Oaths, omens and attendants", types: ["oath", "omen", "attendant"], blurb: "Oaths are sworn on your own hero: a boon with a vow. Omens wait face down in your four Omen spots until you turn them. Attendants change how elements and kinds count.", tip: "Omens 4 to 6, oaths up to 4, attendants up to 2." },
  { id: "review", title: "Review", types: [], blurb: "Your whole deck. Fix anything flagged, name it, save it, and play.", tip: "" },
];
/** How many of each step's cards a legal deck holds. */
function stepRanges(id: StepId, deck: CardDef[]): { label: string; n: number; min: number; max: number }[] {
  const c = (t: string) => deck.filter((d) => d.type === t).length;
  const hosts = c("host");
  switch (id) {
    case "heroes": return [{ label: hosts ? "heroes and hosts" : "heroes", n: c("hero") + hosts, min: hosts ? 3 : 4, max: 6 }];
    case "monsters": return [{ label: "monsters", n: c("monster"), min: hosts ? 4 : 0, max: hosts ? 6 : 0 }];
    case "champions": return [{ label: "champions", n: c("champion"), min: 0, max: 2 }];
    case "supports": return [{ label: "supports", n: c("support"), min: 8, max: 12 }];
    case "geasa": return [{ label: "geasa", n: c("geis"), min: 2, max: 6 }];
    case "rites": return [{ label: "omens", n: c("omen"), min: 4, max: 6 }, { label: "oaths", n: c("oath"), min: 0, max: 4 }, { label: "attendants", n: c("attendant"), min: 0, max: 2 }];
    default: return [];
  }
}
type Filter = "all" | Exclude<CardDef["type"], "unknown">;
const ORDER: Record<string, number> = { hero: 0, champion: 1, support: 2, geis: 3, oath: 4, omen: 5 };
const RAR: Record<string, number> = { legendary: 0, rare: 1, common: 2 };
const sortDefs = (a: CardDef, b: CardDef) =>
  ORDER[a.type] - ORDER[b.type] || (a.type !== "unknown" && b.type !== "unknown" ? RAR[a.rarity] - RAR[b.rarity] : 0) || a.name.localeCompare(b.name);

export function DeckBuilder({ setFocus, onPlay }: { setFocus: (d: CardDef) => void; onPlay: () => void }) {
  const [saved, setSaved] = useSavedDecks();
  const [, setSetup] = useStoredState<Setup>("roth-react-setup", DEFAULT_SETUP);
  const [draft, setDraft] = useStoredState<Draft>("roth-builder-draft", { name: "My Ulster deck", factions: ["ulster"], ids: starterIds("ulster"), savedId: null });
  const [filter, setFilter] = useStoredState<Filter>("roth-builder-filter", "all");
  const [note, setNote] = useState<string | null>(null);
  const [stepId, setStepId] = useStoredState<StepId>("roth-builder-step", "peoples");
  const deck = useMemo(() => defsOf(draft.ids).sort(sortDefs), [draft.ids]);
  const problems = deckProblems(deck);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const id of draft.ids) m.set(id, (m.get(id) ?? 0) + 1); return m; }, [draft.ids]);
  // the primary people (the first) leads: heroes, hosts and monsters come from it alone; a second people lends the rest
  const pool = useMemo(() => Object.values(ALL_DEFS).filter((d) => (LEADS.has(d.type) ? inPool(d, draft.factions[0]) : draft.factions.some((f) => inPool(d, f)))).sort(sortDefs), [draft.factions]);
  const steps = STEPS.filter((x) => x.id !== "monsters" || draft.factions[0] === "sluagh");
  const step = steps.find((x) => x.id === stepId) ?? steps[0];
  const at = steps.indexOf(step);
  const go = (k: number) => { setStepId(steps[Math.max(0, Math.min(steps.length - 1, k))].id); setNote(null); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const shown = step.types.length ? pool.filter((d) => (step.types as string[]).includes(d.type)) : filter === "all" ? pool : pool.filter((d) => d.type === filter);
  const stepsRef = useRef<HTMLElement>(null);
  useEffect(() => { stepsRef.current?.querySelector<HTMLElement>(".b-step.cur")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [step.id]);
  const stepOk = (x: Step) => stepRanges(x.id, deck).every((r) => r.n >= r.min && r.n <= r.max);
  /** Fill just this step's cards from the builder, keeping everything else. */
  const suggest = () => {
    const others = draft.ids.filter((id) => !(step.types as string[]).includes(ALL_DEFS[id].type));
    const d = buildDeck({ factions: draft.factions, noise: 0.3, start: defsOf(others) }, new Rng(Date.now() >>> 0));
    set({ ids: [...others, ...d.filter((x) => (step.types as string[]).includes(x.type)).map((x) => x.id)] });
  };
  const clearStep = () => set({ ids: draft.ids.filter((id) => !(step.types as string[]).includes(ALL_DEFS[id].type)) });
  const set = (p: Partial<Draft>) => { setNote(null); setDraft({ ...draft, ...p }); };

  const add = (d: CardDef) => {
    const why = cannotAdd(deck, d);
    if (why) { setNote(`${d.name}: ${why}`); return; }
    set({ ids: [...draft.ids, d.id] });
  };
  const remove = (id: string) => { const i = draft.ids.lastIndexOf(id); if (i >= 0) set({ ids: draft.ids.filter((_, j) => j !== i) }); };
  const setPeoples = (fs: Faction[]) => {
    if (!fs.length) return;
    // cards outside the new pools leave the deck (and heroes not of the primary people)
    const keep = draft.ids.filter((id) => { const d = ALL_DEFS[id]; return LEADS.has(d.type) ? inPool(d, fs[0]) : fs.some((x) => inPool(d, x)); });
    const gone = draft.ids.length - keep.length;
    setDraft({ ...draft, factions: fs, ids: keep });
    setNote(gone ? `${gone} card${gone === 1 ? "" : "s"} outside the chosen peoples left the deck.` : null);
  };
  // a first choice leads; a second lends; choosing a third replaces the lender
  const togglePeople = (f: Faction) => setPeoples(draft.factions.includes(f) ? draft.factions.filter((x) => x !== f) : draft.factions.length >= 2 ? [draft.factions[0], f] : [...draft.factions, f]);
  const fill = () => {
    const d = buildDeck({ factions: draft.factions, noise: 0.3, start: defsOf(draft.ids) }, new Rng(Date.now() >>> 0));
    set({ ids: d.map((x) => x.id) });
  };
  const save = (asNew = false): SavedDeck => {
    const id = !asNew && draft.savedId && saved.some((s) => s.id === draft.savedId) ? draft.savedId : newDeckId();
    const rec: SavedDeck = { id, name: draft.name.trim() || "Unnamed deck", factions: draft.factions, ids: draft.ids };
    setSaved([...saved.filter((s) => s.id !== id), rec]);
    setDraft({ ...draft, savedId: id });
    setNote(`Saved “${rec.name}”.`);
    return rec;
  };
  const playIt = () => {
    const rec = save();
    // write through now: this page unmounts as the match tab opens, before its stored state would be written
    const decks = [...saved.filter((s) => s.id !== rec.id), rec];
    let setup: Setup = DEFAULT_SETUP;
    try { setup = { ...DEFAULT_SETUP, ...JSON.parse(localStorage.getItem("roth-react-setup") ?? "{}") }; } catch { /* default */ }
    try {
      localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
      localStorage.setItem("roth-react-setup", JSON.stringify({ ...setup, mine: `custom:${rec.id}` }));
      localStorage.setItem("roth-builder-draft", JSON.stringify({ ...draft, savedId: rec.id }));
    } catch { /* storage blocked: the setup below still carries it for this visit */ }
    setSetup({ ...setup, mine: `custom:${rec.id}` });
    onPlay();
  };
  const load = (s: SavedDeck) => { setDraft({ name: s.name, factions: s.factions, ids: s.ids.slice(), savedId: s.id }); setNote(`Loaded “${s.name}”.`); };
  const del = (s: SavedDeck) => { setSaved(saved.filter((x) => x.id !== s.id)); if (draft.savedId === s.id) setDraft({ ...draft, savedId: null }); };
  const sups = deck.filter((d): d is SupportDef => d.type === "support");
  const legends = deck.filter((d) => d.type !== "unknown" && d.rarity === "legendary").length;

  return (
    <div className="builder">
      <section className="b-main" aria-label="Build a deck, step by step">
        <nav className="b-steps" aria-label="Steps" ref={stepsRef}>
          {steps.map((x, i) => (
            <button key={x.id} type="button" className={`b-step${x === step ? " cur" : ""}${x.types.length && stepOk(x) ? " ok" : ""}`} aria-current={x === step ? "step" : undefined} onClick={() => go(i)}>
              <span className="b-step-n">{x.types.length && stepOk(x) ? "✓" : i + 1}</span>{x.title}
            </button>
          ))}
        </nav>
        <div className="b-stephead">
          <h2>{at + 1}. {step.title}</h2>
          <p>{step.blurb}</p>
          {step.tip ? <p className="b-tip">{step.tip}</p> : null}
          <div className="b-meters">
            {stepRanges(step.id, deck).map((r) => (
              <span key={r.label} className={`meter ${r.n >= r.min && r.n <= r.max ? "met" : "short"}`}><b>{r.n}</b> {r.label} <small>(needs {r.min === r.max ? r.min : `${r.min}–${r.max}`})</small></span>
            ))}
            <span className={`meter ${deck.length === 24 ? "met" : "quiet"}`}><b>{deck.length}</b>/24 in the deck</span>
          </div>
        </div>
        {step.id === "peoples" ? (
          <div className="b-head">
            <label className="field b-name">Deck name
              <input type="text" value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <div className="b-peoples">
              <span className="b-k">Peoples <small>(one or two)</small></span>
              <nav className="chips cx-tags" aria-label="Peoples">
                {FACTIONS.map((f) => (
                  <button key={f} type="button" className={`b-people al-${PEOPLE[f]}${draft.factions.includes(f) ? " cur" : ""}`} aria-pressed={draft.factions.includes(f)} onClick={() => togglePeople(f)}>
                    <svg viewBox="0 0 100 100" aria-hidden="true"><Emblem alignment={PEOPLE[f]} /></svg>{FACTION_TITLE[f]}
                    {draft.factions[0] === f ? <small className="b-role">leads</small> : draft.factions[1] === f ? <small className="b-role">lends</small> : null}
                  </button>
                ))}
              </nav>
            </div>
            {draft.factions.length === 2 ? <p className="b-hint">{FACTION_TITLE[draft.factions[0]]} leads; {FACTION_TITLE[draft.factions[1]]} lends. <button type="button" className="btn small" onClick={() => setPeoples([draft.factions[1], draft.factions[0]])}>Let {FACTION_TITLE[draft.factions[1]]} lead</button></p> : null}
            <div className="b-tools">
              <span className="b-k">Start from</span>
              <button type="button" className="btn" onClick={() => set({ ids: [] })}>An empty deck</button>
              <button type="button" className="btn" onClick={() => set({ ids: starterIds(draft.factions[0]) })}>The {FACTION_TITLE[draft.factions[0]]} starter</button>
              <button type="button" className="btn" onClick={fill} disabled={deck.length >= 24}>Fill the rest for me</button>
            </div>
          </div>
        ) : step.types.length ? (
          <div className="b-tools">
            <button type="button" className="btn" onClick={suggest}>Suggest {step.title.toLowerCase()} for me</button>
            <button type="button" className="btn" onClick={clearStep}>Clear this step</button>
            <span className="b-hint">Tap a card to add a copy; − takes one out.</span>
          </div>
        ) : (
          <>
            <div className="b-head">
              <label className="field b-name">Deck name
                <input type="text" value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
              </label>
            </div>
            <div className="b-tools">
              <button type="button" className="btn" onClick={() => save()}>{draft.savedId && saved.some((x) => x.id === draft.savedId) ? "Save" : "Save deck"}</button>
              <button type="button" className="btn" onClick={fill} disabled={deck.length >= 24}>Fill the rest for me</button>
              <button type="button" className="btn" onClick={() => set({ ids: [] })} disabled={!deck.length}>Clear the deck</button>
            </div>
            <nav className="chips cx-tags" aria-label="Show">
              {(["all", ...RANGES.map((r) => r.type)] as Filter[]).map((t) => {
                const r = RANGES.find((x) => x.type === t);
                const n = t === "all" ? deck.length : deck.filter((d) => d.type === t).length;
                return (
                  <button key={t} type="button" className={t === filter ? "cur" : ""} aria-pressed={t === filter} onClick={() => setFilter(t)}>
                    {t === "all" ? "All" : <><Icon name={t} /> {r!.title}</>} <span className="count">{t === "all" ? `${n}/24` : n}</span>
                  </button>
                );
              })}
            </nav>
            {problems.length ? <ul className="b-problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul> : <p className="b-ok">Ready to play.</p>}
          </>
        )}
        {note ? <p className="note" role="status">{note}</p> : null}
        {step.id === "peoples" ? null : <div className="b-pool hand">
          {(step.id === "review" ? shown.filter((d) => counts.has(d.id)) : shown).map((d) => {
            const n = counts.get(d.id) ?? 0;
            const max = maxCopies(d);
            const why = n < max ? cannotAdd(deck, d) : null;
            return (
              <div key={d.id} className={`b-slot${n ? " in" : ""}${n >= max || why ? " full" : ""}`}>
                <CardFace def={d} owner="mine" onFocusCard={setFocus} onClick={() => add(d)} selected={n > 0}
                  label={`${d.name}: ${n} of ${max} in the deck. ${n < max && !why ? "Add a copy." : why ?? "No more copies allowed."}`} />
                <div className="b-count" aria-hidden="true">{n}/{max}</div>
                {n ? <button type="button" className="b-minus" aria-label={`Take one ${d.name} out`} onClick={() => remove(d.id)}>−</button> : null}
              </div>
            );
          })}
        </div>}
        <div className="b-nav">
          <button type="button" className="btn" disabled={at === 0} onClick={() => go(at - 1)}>← {at > 0 ? steps[at - 1].title : "Back"}</button>
          <span className="b-nav-n">{deck.length}/24</span>
          {at < steps.length - 1
            ? <button type="button" className="btn primary" onClick={() => go(at + 1)}>{steps[at + 1].title} →</button>
            : <button type="button" className="btn primary" onClick={playIt} disabled={problems.length > 0}>Play with this deck</button>}
        </div>
      </section>

      <aside className="b-side">
        <div className="panel b-deck">
          <p className="label">{draft.name || "Your deck"} · {deck.length}/24</p>
          <div className="b-ranges">
            {RANGES.map((r) => {
              const n = deck.filter((d) => d.type === r.type).length;
              const ok = n >= r.min && n <= r.max;
              return <span key={r.type} className={`b-range${ok ? "" : " bad"}`} title={`${r.title}: ${r.min}–${r.max}`}><Icon name={r.type} />{n}<small>/{r.min === r.max ? r.min : `${r.min}–${r.max}`}</small></span>;
            })}
            <span className={`b-range${legends > 2 ? " bad" : ""}`} title="Legendary cards: at most 2"><span className="gem g-legendary" />{legends}<small>/2</small></span>
          </div>
          {problems.length ? <ul className="b-problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul> : <p className="b-ok">Ready to play.</p>}
          {note ? <p className="note" role="status">{note}</p> : null}
          <ul className="b-list">
            {[...new Set(deck.map((d) => d.id))].map((id) => {
              const d = ALL_DEFS[id];
              return (
                <li key={id} onMouseEnter={() => setFocus(d)}>
                  <Icon name={d.type === "support" ? (d.kind ?? "Weapon") : d.type} />
                  <span className="b-n">{d.name}</span>
                  <span className="b-toks">{d.type === "support" ? d.effects.map((e, i) => <Token key={i} kind={e.type} n={e.n} title={`${e.type} ${e.n}`} />) : d.type === "hero" || d.type === "champion" ? <Token kind="valour" n={d.valour} title={`Valour ${d.valour}`} /> : null}</span>
                  <span className="b-x">{counts.get(id)! > 1 ? `×${counts.get(id)}` : ""}</span>
                  <button type="button" className="b-rm" aria-label={`Take one ${d.name} out`} onClick={() => remove(id)}>−</button>
                </li>
              );
            })}
          </ul>
          {sups.length ? (
            <>
              <Bars label="Element" rows={(["Fire", "Wind", "Earth", "Water"] as const).map((e) => ({ key: e, icon: e, n: sups.filter((s) => s.element === e).length }))} total={sups.length} />
              <Bars label="Kind" rows={(["Weapon", "Feat", "Ally", "Word"] as const).map((k) => ({ key: k, icon: k, n: sups.filter((s) => s.kind === k).length }))} total={sups.length} />
            </>
          ) : null}
          <div className="b-actions">
            <button type="button" className="btn" onClick={() => save()}>{draft.savedId && saved.some((s) => s.id === draft.savedId) ? "Save" : "Save deck"}</button>
            {draft.savedId ? <button type="button" className="btn" onClick={() => save(true)}>Save as new</button> : null}
            <button type="button" className="btn primary" onClick={playIt} disabled={problems.length > 0}>Play with this deck</button>
          </div>
        </div>
        <div className="panel">
          <p className="label">Saved decks</p>
          {saved.length ? (
            <ul className="b-saved">
              {saved.map((s) => {
                const bad = deckProblems(defsOf(s.ids)).length > 0;
                return (
                  <li key={s.id} className={s.id === draft.savedId ? "cur" : ""}>
                    <span className="b-n">{s.name}<small>{s.factions.map((f) => FACTION_TITLE[f]).join(" + ")} · {s.ids.length} cards{bad ? " · unfinished" : ""}</small></span>
                    <button type="button" className="btn small" onClick={() => load(s)}>Open</button>
                    <button type="button" className="btn small" aria-label={`Delete ${s.name}`} onClick={() => del(s)}>Delete</button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="note">No saved decks yet. Build one and save it here; it stays in this browser.</p>}
        </div>
      </aside>
    </div>
  );
}
