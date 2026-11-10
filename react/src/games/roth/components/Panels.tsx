// Side panels: match setup, the card inspector, the move log, how to play, and the result dialog.
import { Dialog } from "../../../kit/Dialog";
import { Segmented } from "../../../kit/Segmented";
import { FACTIONS, type CardDef, type Faction } from "../engine/cards";
import type { Result, Side } from "../engine/engine";
import { DECIDED, FACTION_TITLE, cardText, fighterStats, typeLine } from "../text";
import { faceLines } from "../faceText";
import { Rich } from "./Card";
import type { Level, Setup } from "../useMatch";
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

export function SetupPanel(props: { setup: Setup; onStart: (s: Setup) => void; inMatch: boolean; onChange: (s: Setup) => void }) {
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
      <button type="button" className="btn primary" onClick={() => props.onStart(s)}>{props.inMatch ? "Start a new match" : "Start the match"}</button>
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

export function LogPanel({ log }: { log: string[] }) {
  return (
    <div className="panel">
      <p className="label">Moves</p>
      <ol className="log" aria-live="polite">{log.slice(-40).map((l, i) => <li key={i}>{l}</li>)}</ol>
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
      <ul className="rules">
        <li><b>Decks.</b> 24 cards: 4–6 heroes, up to 2 champions, 8–12 supports, 2–6 geasa, up to 4 oaths, 4–6 omens, up to 2 attendants. Common cards up to 2 copies, rare and legendary 1, at most 2 legendaries. Cards from at most two peoples; exiles go with Ulster or Connacht; unaligned supports, every geis and oath, and the omens not tied to one people go with anyone. Build one under <i>Build a deck</i>, or play a starter.</li>
        <li><b>Muster.</b> Draw four cards at a time. Keep each in hand (up to 12) or set it aside for the Reserve; put omens face down in your four Omen spots. You can't finish short of 2 heroes and 4 supports.</li>
        <li><b>Drafting turn.</b> Six steps round the wheel. Each step, the first player then the second places a card in the spot in front of them: a hero, then two supports to fight with it, twice.</li>
        <li><b>Playing turn.</b> The wheel turns again and you face the enemy's spots. Each step choose one: turn an omen, bind the enemy hero with a geis, supplant an enemy support with one of yours (pick one that helps them least), swear an oath on one of your own heroes, call an attendant, or hold.</li>
        <li><b>Attendants.</b> Once called they stay for the match. Each changes what element (or kind) supports count as, for your heroes, the enemy's, or everyone, or curses the enemy with a new weakness. The new element counts for everything: Focus, the element wheel, weakness, omens, and the geasa and oaths that forbid it.</li>
        <li><b>The Ford.</b> Duels to the death: spots 1 and 7, then 4 and 10. Higher Initiative strikes first (a tie goes to the first player), then turns alternate until a hero falls. On your turn: <b>draw</b> the top card of your Reserve and play it, or put it aside and do something else; <b>use</b> one of your quadrant's supports (the first time free, then at the price on the card: a turn between, a rest, Valour, or a card off the Reserve); turn an omen, lay a geis or swear an oath from hand; call a champion; or <b>rest</b>.</li>
        <li><b>The Reserve.</b> Everything you set aside or didn't draw at the Muster, shuffled before the first duel. When it runs out, your discards are shuffled back in.</li>
        <li><b>Using a support.</b> Unwilling supports (Ulaid–Connachta, Sídhe–Fomóire) do nothing. A support forbidden by a geis or your oath needs breaking: 2 Valour first. +1 each for kinship, Focus, an element strong against the enemy's Focus, and the enemy's Weakness.</li>
        <li><b>Winning.</b> Fell more enemy heroes. One each? The two survivors meet in a <b>final duel</b>, with the Valour they have left. A duel that runs 60 turns stops with both standing; then wounds decide.</li>
      </ul>
    </details>
  );
}
