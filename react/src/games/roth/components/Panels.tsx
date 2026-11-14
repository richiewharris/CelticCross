// Side panels: match setup, the card inspector, the move log, how to play, and the result dialog.
import { useEffect, useRef } from "react";
import { Dialog } from "../../../kit/Dialog";
import { Segmented } from "../../../kit/Segmented";
import { FACTIONS, type CardDef, type Faction } from "../engine/cards";
import type { Result, Side } from "../engine/engine";
import { DECIDED, FACTION_TITLE, cardText, fighterStats, typeLine } from "../text";
import { faceLines } from "../faceText";
import { Rich } from "./Card";
import { Icon } from "./Icons";
import type { Level, MatchRecord, Pace, Setup } from "../useMatch";
import { deckProblems, defsOf, useSavedDecks } from "../decks";

const LEVELS: { value: Level; label: string }[] = [
  { value: "novice", label: "Novice" }, { value: "casual", label: "Casual" }, { value: "skilled", label: "Skilled" }, { value: "expert", label: "Expert" },
];
export const LEVEL_NOTE: Record<Level, string> = {
  novice: "plays any legal move",
  casual: "plays by rules of thumb",
  skilled: "works out every duel exactly",
  expert: "also plays each choice out many times; can take a few seconds",
};

const BUILD_NOTE: Record<Level, string> = {
  novice: "Its deck is thrown together.",
  casual: "Its deck is built by feel.",
  skilled: "Its deck was tuned over thousands of games.",
  expert: "Its deck was tuned over thousands of games.",
};

function RecordLine({ record }: { record: MatchRecord }) {
  const rows = (["novice", "casual", "skilled", "expert"] as const).filter((l) => record[l]);
  if (!rows.length) return null;
  return (
    <p className="note record">Your record: {rows.map((l) => `${l[0].toUpperCase()}${l.slice(1)} ${record[l].w}–${record[l].l}${record[l].d ? `–${record[l].d}` : ""}`).join(" · ")}</p>
  );
}

export function SetupPanel(props: { setup: Setup; onStart: (s: Setup) => void; inMatch: boolean; onChange: (s: Setup) => void; record?: MatchRecord }) {
  const s = props.setup;
  const set = (p: Partial<Setup>) => props.onChange({ ...s, ...p });
  const [saved] = useSavedDecks();
  const ready = saved.filter((d) => !deckProblems(defsOf(d.ids)).length);
  const mineOk = (FACTIONS as readonly string[]).includes(s.mine) || ready.some((d) => `custom:${d.id}` === s.mine);
  return (
    <div className="panel">
      <p className="label">New match</p>
      <label className="field">Your deck
        <select value={mineOk ? s.mine : "ulster"} onChange={(e) => set({ mine: e.target.value })}>
          {ready.length ? <optgroup label="Your decks">{ready.map((d) => <option key={d.id} value={`custom:${d.id}`}>{d.name}</option>)}</optgroup> : null}
          <optgroup label="Starter decks">{FACTIONS.map((f) => <option key={f} value={f}>{FACTION_TITLE[f]} starter</option>)}</optgroup>
        </select>
      </label>
      <label className="field">The computer's deck
        <select value={s.theirs} onChange={(e) => set({ theirs: e.target.value as Faction | "random" })}>
          <option value="random">Random</option>
          {FACTIONS.map((f) => <option key={f} value={f}>{FACTION_TITLE[f]}</option>)}
        </select>
      </label>
      <Segmented label="The computer's deck" value={s.theirsDeck ?? "built"} onChange={(v) => set({ theirsDeck: v })}
        options={[{ value: "built", label: "Builds its own" }, { value: "starter", label: "Starter deck" }] as { value: "built" | "starter"; label: string }[]} />
      <Segmented label="Computer level" value={s.level} onChange={(v) => set({ level: v })} options={LEVELS} />
      <p className="note">{LEVELS.find((l) => l.value === s.level)!.label}: {LEVEL_NOTE[s.level]}.{(s.theirsDeck ?? "built") === "built" ? ` ${BUILD_NOTE[s.level]}` : ""}</p>
      <Segmented label="Your seat" value={s.seat} onChange={(v) => set({ seat: v })}
        options={[{ value: "first", label: "First" }, { value: "second", label: "Second" }, { value: "random", label: "Random" }] as { value: Setup["seat"]; label: string }[]} />
      <Segmented label="The computer's pace" value={s.pace ?? "normal"} onChange={(v) => set({ pace: v })}
        options={[{ value: "quick", label: "Quick" }, { value: "normal", label: "Normal" }, { value: "slow", label: "Slow" }] as { value: Pace; label: string }[]} />
      <button type="button" className="btn primary" onClick={() => props.onStart(s)}>{props.inMatch ? "Start a new match" : "Start the match"}</button>
      {props.record ? <RecordLine record={props.record} /> : null}
    </div>
  );
}

export function Inspector({ def }: { def: CardDef | null }) {
  if (!def || def.type === "unknown") return <div className="panel inspector"><p className="label">Card</p><p className="note">Point at or focus a card to read it.</p></div>;
  return (
    <div className="panel inspector" aria-live="polite">
      <p className="label">Card</p>
      <p className="i-name">{def.name}</p>
      <p className="i-type">{typeLine(def)}</p>
      {def.type === "hero" || def.type === "champion" ? <p className="i-stats">{fighterStats(def)}</p> : null}
      <div className="i-face">
        {faceLines(def).map((l, i) => (l.kind === "ability" ? <p key={i} className="i-ability">{l.text}</p> : <p key={i} className={`i-ln i-${l.kind}`}><Rich text={l.text} /></p>))}
        {(def.type === "hero" || def.type === "champion") && def.tag ? <p className="i-ln">Geis: <b>{def.tag}</b>. A card that invokes {def.tag} costs this hero 2 Valour.</p> : null}
      </div>
      <p className="i-text"><span className="i-exact">Exact rule:</span> {cardText(def)}</p>
    </div>
  );
}

/** What every icon on the table means. */
const LEGEND: { title: string; rows: [string, string][] }[] = [
  { title: "Numbers", rows: [["strike", "Strike: wounds the enemy (Shield soaks it first)"], ["shield", "Shield: soaks wounds"], ["heal", "Heal: Valour back, up to 2 above the start"], ["valour", "Valour: what a fighter can lose before falling"], ["init", "Initiative: the higher acts first"], ["pierce", "Ignores Shield"]] },
  { title: "Elements and kinds", rows: [["Fire", "Fire"], ["Wind", "Wind"], ["Earth", "Earth"], ["Water", "Water"], ["Spirit", "Spirit (the Slúagh): passes Shield and, in a duel to the death, Blocks (not Armour), steals 1"], ["Weapon", "Weapon"], ["Feat", "Feat"], ["Ally", "Ally"], ["Word", "Word"]] },
  { title: "On a hero", rows: [["geis", "Geis: forbids something; every break costs 2 Valour"], ["global", "Global geis: on every hero"], ["oath", "Oath: a boon with a vow"], ["omen", "Omen, turned on this hero"], ["champion", "A champion standing in"]] },
  { title: "Defence", rows: [["armour", "Passive card: Armour, every blow less while it's placed"], ["block", "Reaction card: tap it when struck to block"], ["rest", "Rest: Shield 1, and the next Shield, Heal or Block +1 (+2 after two rests)"]] },
  { title: "Using a support again", rows: [["again", "Its price to use again:"], ["between", "not two turns running"], ["rest", "after a rest"], ["valour", "pay Valour"], ["card", "discard the top of your Reserve"]] },
];
export function Legend() {
  return (
    <div className="legend">
      {LEGEND.map((g) => (
        <div key={g.title} className="legend-group">
          <p className="legend-title">{g.title}</p>
          <ul>{g.rows.map(([icon, text]) => <li key={g.title + icon}><Icon name={icon} className={`ink-${icon}`} /> {text}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

export function LogPanel({ log }: { log: string[] }) {
  // follow the newest move
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [log.length]);
  return (
    <div className="panel">
      <p className="label">Moves</p>
      <ol className="log" aria-live="polite" ref={ref}>
        {log.slice(-60).map((l, i) => (l.startsWith("§ ") ? <li key={i} className="log-sec">{l.slice(2)}</li> : <li key={i}>{l}</li>))}
      </ol>
    </div>
  );
}

export function ResultDialog(props: { r: Result; me: Side; onAgain: () => void; onClose: () => void }) {
  const { r, me } = props;
  const tone = r.winner === -1 ? "draw" : r.winner === me ? "win" : "lose";
  const title = tone === "draw" ? "A draw" : tone === "win" ? "You win" : "The computer wins";
  return (
    <Dialog tone={tone} label={title}>
      <h2>{title}</h2>
      <p>{r.winner === -1 ? "Nothing separated you." : `Decided by ${DECIDED[r.decidedBy]}${r.tiebreak ? ", in the round run backwards" : ""}.`}</p>
      <p className="note">Heroes felled: you {r.felled[1 - me]}, the computer {r.felled[me]}. Wounds dealt: you {r.valour[me]}, the computer {r.valour[1 - me]}.</p>
      <div className="row">
        <button type="button" className="btn primary" onClick={props.onAgain}>Play again</button>
        <button type="button" className="btn" onClick={props.onClose}>Look at the board</button>
      </div>
    </Dialog>
  );
}

export function RulesPanel() {
  return (
    <details className="panel rules-panel">
      <summary className="label">How to play</summary>
      <Legend />
      <ul className="rules">
        <li><b>Decks.</b> 24 cards: 4–6 heroes, up to 2 champions, 8–12 supports, 2–6 geasa, up to 4 oaths, 4–6 omens, up to 2 attendants. Common cards up to 2 copies, rare and legendary 1, at most 2 legendaries. Cards from at most two peoples: the first leads (every hero or host is of it), and a second may lend its other cards but no heroes; exiles lead beside Ulster or Connacht; unaligned supports, every geis and oath, and the omens not tied to one people go with anyone. Build one under <i>Build a deck</i>, or play a starter.</li>
        <li><b>Muster.</b> Draw four cards at a time. Keep each in hand (up to 12) or set it aside for the Reserve; put omens face down in your four Omen spots. You can't finish short of 2 heroes and 4 supports.</li>
        <li><b>Marshalling.</b> Half a turn of the wheel, six steps. Each step, the first player then the second fills the seat before them: a hero, then its west and east flanks (two supports), twice. That raises each side's first band and second band. Heroes go down face up; supports go down face down, and every card on the wheel turns face up as the Winnow begins.</li>
        <li><b>The Reckoning.</b> After the setting is chosen, with both wheels whole (the enemy's supports still face down), each player may make one change to their own: swap their two heroes (each band's flanks stay where they are; a host keeps its monsters), or swap any two of their supports. Or keep the wheel as it is. Both choose in secret, and both changes are shown and made together before the Winnow.</li>
        <li><b>The Winnow.</b> The wheel turns on and the enemy's bands come round to you, one seat at a time. Each step choose one: turn an omen, bind the enemy hero with a geis, supplant an enemy support with one of yours (pick one that helps them least), swear an oath on one of your own heroes, call an attendant, or hold.</li>
        <li><b>Attendants.</b> Once called they stay for the match. Each changes what element (or kind) supports count as, for your heroes, the enemy's, or everyone, or curses the enemy with a new weakness. The new element counts for everything: Focus, the element wheel, weakness, omens, and the geasa and oaths that forbid it.</li>
        <li><b>The setting.</b> Once the Marshalling is over, with every hero on the wheel, the second player chooses where the duels are fought: the ford (Valour +3), Conand's tower (Valour +2, Shield 1 at the start of each duel), the Bog of Allen (Earth Strikes +1, Wind Strikes −1), the western crossing (Valour +3, Heals −1, and the dead drain those who fight them: at the end of each turn a fighter facing a Slúagh host that didn't rest loses 1 Valour while it is above half its starting Valour, and it feeds the host; no dream-walking there), Brú na Bóinne (Word Strikes +1, the mound soaks 7), the loughs (Water Strikes +1, Fire Strikes −1), Emain Macha (Feat Strikes +1) or Cruachan (Valour +2, Heals +1). Every other setting gives Valour +3. Element and kind bonuses go on a Strike that is a support's first effect, for both sides: the ground favours the blow, not the Heal.</li>
        <li><b>The Ford.</b> Duels to the death: first band against first band, then second against second (and a final duel if each side fells one). Higher Initiative strikes first (a tie goes to the first player), then turns alternate until a hero falls. On your turn: <b>draw</b> the top card of your Reserve and play it, or put it aside and do something else; <b>use</b> one of your band's supports (the first time free, then at the price on the card: a turn between, a rest, Valour, or a card off the Reserve); turn an omen, lay a geis or swear an oath from hand; call a champion; or <b>rest</b>.</li>
        <li><b>The Reserve.</b> Everything you set aside or didn't draw at the Muster, shuffled before the first duel. When it runs out, your discards are shuffled back in.</li>
        <li><b>Using a support.</b> Unwilling supports (Ulaid–Connachta, Sídhe–Fomóire) do nothing. A support forbidden by a geis or your oath needs breaking: 2 Valour first. In a duel to the death a geis never breaks for good: every use it forbids costs 2 Valour again (and a geis that lays a weakness keeps it). An oath still breaks once. +1 each for kinship, Focus, an element strong against the enemy's Focus, and the enemy's Weakness.</li>
        <li><b>The mound.</b> A deck with Aos Sídhe heroes fights from its mound. Like Armour, it takes 1 off every Strike against an Aos Sídhe fighter (even one that ignores Shield and Armour), until it has soaked 5 in all, across the whole match. Then it is spent.</li>
        <li><b>Connacht.</b> In a duel to the death, every Connacht hero is <b>Swift</b> (a blow that wounds for 1 or less strikes again at once) or has a <b>Riposte</b> (when its Shield takes a blow, a free Strike 1 back, without spending a turn). And every Connacht blow that wounds makes the enemy bleed: its Heals −1 (not stacking) until the end of its next turn.</li>
        <li><b>Resisting Spirit.</b> In a duel to the death every Spirit blow is −2 against the Aos Sídhe (otherworldly) and −1 against Merrow (flowing water), after Blocks and before Armour. The Aos Sídhe also pay only 1 Valour to break a geis.</li>
        <li><b>Water can't be pierced.</b> In a duel to the death, a blow that ignores Shield still meets a Merrow fighter's Block.</li>
        <li><b>The Slúagh.</b> In a duel to the death their Spirit blows can't be Blocked. A summon spends the top card of the Reserve. The dead-flesh aura: no blow wounds a host for more than half its full Valour, but never less than 5.</li>
        <li><b>Battle-fury.</b> In a duel to the death, an Ulster hero at half its starting Valour or less Strikes +1.</li>
        <li><b>The Samhain watch.</b> In a duel to the death, an Ulster hero's Strikes are +1 against a fighter whose Focus is Spirit (the Slúagh hosts).</li>
        <li><b>The Hound's cry.</b> Once a duel, when an Ulster hero uses a support that ignores Shield against giant-kin, it may spend the top card of its Reserve (to the discard) so the blow lands in full.</li>
        <li><b>Giant-kin.</b> In a duel to the death the Fomóire take <b>half</b> the wounds of every Strike (rounded down), except one of their weaknesses: that lands in full, with no +1. A geis or a Curse attendant can lay more weaknesses on them.</li>
        <li><b>At the ford.</b> Every fighter starts its duel with its Valour <b>+3</b>, and there is no cap on healing. A rest <b>braces</b>: Shield 1, and your next Shield, Heal or Block is +1 (+2 after two rests in a row). After 20 turns the duel wears both down: each turn costs the side acting 1 Valour (2 after 40).</li>
        <li><b>Defence.</b> <b>Shield</b> soaks wounds and is used up. <b>Passive</b> cards give <b>Armour</b> just by being placed beside the hero: every Strike against it is less, all duel. <b>Reaction</b> cards <b>Block</b>: when the enemy strikes, tap one to take its Block off that blow; it can block again after one of your own turns. What ignores Shield ignores Armour and Blocks too; a Spirit blow passes Shield but not Armour or Blocks.</li>
        <li><b>Winning.</b> Fell more enemy heroes. One each? The two survivors meet in a <b>final duel</b>, with the Valour they have left. A duel that runs 60 turns stops with both standing; then wounds decide.</li>
      </ul>
    </details>
  );
}
