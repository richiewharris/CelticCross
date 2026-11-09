// The deck builder: choose one or two peoples, browse their pool, and build a 24-card deck. Decks are saved in
// this browser and can be taken straight to a match.
import { useMemo, useState } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { ALL_DEFS, FACTIONS, PEOPLE, inPool, type CardDef, type Faction, type SupportDef } from "./engine/cards";
import { buildDeck } from "./engine/builder";
import { Rng } from "./engine/rng";
import { CardFace, Token } from "./components/Card";
import { Emblem, Icon } from "./components/Icons";
import { Bars } from "./codex/Codex";
import { DECKS_KEY, RANGES, cannotAdd, deckProblems, defsOf, maxCopies, newDeckId, starterIds, useSavedDecks, type SavedDeck } from "./decks";
import { FACTION_TITLE } from "./text";
import { DEFAULT_SETUP, type Setup } from "./useMatch";

interface Draft { name: string; factions: Faction[]; ids: string[]; savedId: string | null }
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
  const deck = useMemo(() => defsOf(draft.ids).sort(sortDefs), [draft.ids]);
  const problems = deckProblems(deck);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const id of draft.ids) m.set(id, (m.get(id) ?? 0) + 1); return m; }, [draft.ids]);
  const pool = useMemo(() => Object.values(ALL_DEFS).filter((d) => draft.factions.some((f) => inPool(d, f))).sort(sortDefs), [draft.factions]);
  const shown = filter === "all" ? pool : pool.filter((d) => d.type === filter);
  const set = (p: Partial<Draft>) => { setNote(null); setDraft({ ...draft, ...p }); };

  const add = (d: CardDef) => {
    const why = cannotAdd(deck, d);
    if (why) { setNote(`${d.name}: ${why}`); return; }
    set({ ids: [...draft.ids, d.id] });
  };
  const remove = (id: string) => { const i = draft.ids.lastIndexOf(id); if (i >= 0) set({ ids: draft.ids.filter((_, j) => j !== i) }); };
  const togglePeople = (f: Faction) => {
    let fs = draft.factions.includes(f) ? draft.factions.filter((x) => x !== f) : [...draft.factions, f];
    if (fs.length > 2) fs = fs.slice(-2);
    if (!fs.length) return;
    // cards outside the new pools leave the deck
    const keep = draft.ids.filter((id) => fs.some((x) => inPool(ALL_DEFS[id], x)));
    const gone = draft.ids.length - keep.length;
    setDraft({ ...draft, factions: fs, ids: keep });
    setNote(gone ? `${gone} card${gone === 1 ? "" : "s"} outside the chosen peoples left the deck.` : null);
  };
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
      <section className="b-main" aria-label="The pool">
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
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="b-tools">
          {draft.factions.map((f) => <button key={f} type="button" className="btn" onClick={() => set({ ids: starterIds(f).filter((id) => draft.factions.some((x) => inPool(ALL_DEFS[id], x))) })}>Start from the {FACTION_TITLE[f]} starter</button>)}
          <button type="button" className="btn" onClick={fill} disabled={deck.length >= 24}>Fill the rest for me</button>
          <button type="button" className="btn" onClick={() => set({ ids: [] })} disabled={!deck.length}>Clear</button>
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
        <p className="b-status" role="status">
          <b>{deck.length}/24</b> · {problems.length ? `${problems.length} thing${problems.length === 1 ? "" : "s"} to fix` : "ready to play"}
          <button type="button" className="btn small" onClick={() => document.querySelector(".b-side")?.scrollIntoView({ behavior: "smooth" })}>See the deck</button>
        </p>
        <p className="b-hint">Click a card to add it; click the − on a card in your deck to take it out. Pools: {draft.factions.map((f) => FACTION_TITLE[f]).join(" and ")}, plus unaligned cards{draft.factions.some((f) => f === "ulster" || f === "connacht") ? ", exiles" : ""}, and the geasa, oaths and omens open to every people.</p>
        <div className="b-pool hand">
          {shown.map((d) => {
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
