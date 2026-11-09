// Side panels: match setup, the card inspector, the move log, how to play, and the result dialog.
import { Dialog } from "../../../kit/Dialog";
import { Segmented } from "../../../kit/Segmented";
import { FACTIONS, type CardDef, type Faction } from "../engine/cards";
import type { Result, Side } from "../engine/engine";
import { DECIDED, FACTION_TITLE, cardText, fighterStats, typeLine } from "../text";
import type { Level, Setup } from "../useMatch";

const LEVELS: { value: Level; label: string }[] = [
  { value: "novice", label: "Novice" }, { value: "casual", label: "Casual" }, { value: "skilled", label: "Skilled" }, { value: "expert", label: "Expert" },
];
export const LEVEL_NOTE: Record<Level, string> = {
  novice: "plays any legal move",
  casual: "plays by rules of thumb",
  skilled: "works out every duel exactly",
  expert: "also plays each choice out many times; can take a few seconds",
};

export function SetupPanel(props: { setup: Setup; onStart: (s: Setup) => void; inMatch: boolean; onChange: (s: Setup) => void }) {
  const s = props.setup;
  const set = (p: Partial<Setup>) => props.onChange({ ...s, ...p });
  return (
    <div className="panel">
      <p className="label">New match</p>
      <label className="field">Your deck
        <select value={s.mine} onChange={(e) => set({ mine: e.target.value as Faction })}>
          {FACTIONS.map((f) => <option key={f} value={f}>{FACTION_TITLE[f]}</option>)}
        </select>
      </label>
      <label className="field">The computer's deck
        <select value={s.theirs} onChange={(e) => set({ theirs: e.target.value as Faction | "random" })}>
          <option value="random">Random</option>
          {FACTIONS.map((f) => <option key={f} value={f}>{FACTION_TITLE[f]}</option>)}
        </select>
      </label>
      <Segmented label="Computer level" value={s.level} onChange={(v) => set({ level: v })} options={LEVELS} />
      <p className="note">{LEVELS.find((l) => l.value === s.level)!.label}: {LEVEL_NOTE[s.level]}.</p>
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
      <p className="i-text">{cardText(def)}</p>
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
        <li><b>Muster.</b> Draw to 12 cards in hand and fill four Omen spots, face down. You always hold at least 2 heroes and 4 supports.</li>
        <li><b>Drafting turn.</b> Six steps round the wheel. Each step, the first player then the second places a card in the spot in front of them: a hero, then two supports to fight with it, twice.</li>
        <li><b>Playing turn.</b> The wheel turns again and you face the enemy's spots. Each step choose one: turn an omen, bind the enemy hero with a geis, supplant an enemy support with one of yours (pick one that helps them least), swear an oath on one of your own heroes, or hold.</li>
        <li><b>The Ford.</b> Two duels: spots 1 and 7, then 4 and 10. Higher Initiative strikes first (a tie goes to the first player). Each hero takes two turns: use one of its quadrant's supports, or rest. You may call a champion from hand to stand in for your hero (the first player in either duel, the second player only in the second).</li>
        <li><b>Using a support.</b> Unwilling supports (Ulaid–Connachta, Sídhe–Fomóire) do nothing. A support forbidden by a geis or your oath needs breaking: 2 Valour first. +1 each for kinship, Focus, an element strong against the enemy's Focus, and the enemy's Weakness.</li>
        <li><b>Winning.</b> Fell more enemy heroes. Level? Deal more wounds. Still level? The round runs backwards: geasa, oaths and omens reset, the wheel turns counter-clockwise, and the duels are fought again.</li>
      </ul>
    </details>
  );
}
