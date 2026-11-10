// Roth Catha: the wheel of battle. A match against the computer, or the puzzle sets.
import { useEffect, useState } from "react";
import { Segmented } from "../../kit/Segmented";
import { useStoredState } from "../../kit/useStoredState";
import type { CardDef } from "./engine/cards";
import { ActionPanel, NO_PICK, buildActs, type Pick } from "./components/ActionPanel";
import { PlaceView } from "./components/PlaceView";
import { CardFocusProvider } from "./components/CardFocus";
import { useNarrow } from "./components/DuelView";
import { Inspector, LogPanel, ResultDialog, RulesPanel, SetupPanel } from "./components/Panels";
import { Table, type Sel } from "./components/Table";
import { Puzzles } from "./Puzzles";
import { CardsGuide, DecksGuide } from "./codex/Codex";
import { DeckBuilder } from "./DeckBuilder";
import { Walkthrough } from "./walkthrough/Walkthrough";
import { FACTION_TITLE } from "./text";
import { useMatch } from "./useMatch";

type Tab = "play" | "build" | "guide";
type Guide = "walk" | "puzzles" | "cards" | "decks";
const OLD_GUIDE: Record<string, Guide> = { walk: "walk", puzzles: "puzzles", cards: "cards", decks: "decks" };

export function RothGame() {
  const [stored, setTab] = useStoredState<string>("roth-react-tab", "play");
  const [guideStored, setGuide] = useStoredState<Guide>("roth-react-guide", "walk");
  // saved from before the Game guide existed: an old guide tab opens the guide on that page
  const tab: Tab = stored in OLD_GUIDE ? "guide" : (stored as Tab);
  const guide: Guide = stored in OLD_GUIDE ? OLD_GUIDE[stored] : guideStored;
  const [focus, setFocus] = useState<CardDef | null>(null);
  const goGuide = (g: Guide) => { setGuide(g); setTab("guide"); };
  return (
    <div className="wrap">
      <header>
        <h1>Roth Catha</h1>
        <p className="lede">The wheel of battle. Draft heroes and their supports onto a round board, bind your rival's heroes with geasa, swear oaths, turn omens, then fight to the death at the ford. Six decks from the Ulster Cycle and beyond.</p>
        <p className="private-note">Private preview: only you can see this page.</p>
      </header>
      <nav className="roth-nav" aria-label="Roth Catha">
        <Segmented label="Section" value={tab} onChange={(t) => (t === "guide" ? goGuide(guide) : setTab(t))} className="tabs"
          options={[{ value: "play", label: "Play" }, { value: "build", label: "Build a deck" }, { value: "guide", label: "Game guide" }] as { value: Tab; label: string }[]} />
        {tab === "guide" ? (
          <Segmented label="Game guide" value={guide} onChange={goGuide} className="tabs sub"
            options={[{ value: "walk", label: "Guided game" }, { value: "puzzles", label: "Puzzles" }, { value: "cards", label: "Cards" }, { value: "decks", label: "Decks" }] as { value: Guide; label: string }[]} />
        ) : null}
      </nav>
      {tab === "play" ? <CardFocusProvider><Match focus={focus} setFocus={setFocus} /></CardFocusProvider>
        : tab === "build" ? <DeckBuilder setFocus={setFocus} onPlay={() => setTab("play")} />
        : guide === "walk" ? <CardFocusProvider><Walkthrough focus={focus} setFocus={setFocus} /></CardFocusProvider>
        : guide === "puzzles" ? <CardFocusProvider><Puzzles focus={focus} setFocus={setFocus} /></CardFocusProvider>
        : guide === "cards" ? <CardsGuide setFocus={setFocus} /> : <DecksGuide setFocus={setFocus} />}
    </div>
  );
}

function Match({ focus, setFocus }: { focus: CardDef | null; setFocus: (d: CardDef) => void }) {
  const m = useMatch();
  const [sel, setSel] = useState<Sel>(null);
  const [join, setJoin] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const narrow = useNarrow(1100);
  // while a match is on, the page header steps back
  useEffect(() => {
    document.body.classList.toggle("roth-in-match", !!m.S && !m.over);
    return () => document.body.classList.remove("roth-in-match");
  }, [m.S, m.over]);
  const [showResult, setShowResult] = useState(true);
  const [act, setAct] = useState<Pick>(NO_PICK);
  const [group, setGroup] = useState<string | null>(null);
  useEffect(() => { setSel(null); setJoin(null); setAct((a) => ({ ...NO_PICK, guest: a.guest })); }, [m.d]);
  useEffect(() => { if (m.over) setShowResult(true); }, [m.over]);

  if (!m.S) {
    return (
      <div className="game">
        <section className="stage intro">
          <p>Pick your deck and the computer's level, then start. Play one of the five starter decks, or build your own from the pools under <b>Build a deck</b>. The computer builds its own deck too: the stronger the level, the better the deck.</p>
          <RulesPanel />
        </section>
        <aside><SetupPanel setup={m.setup} onChange={m.setSetup} onStart={m.start} inMatch={false} record={m.record} /></aside>
      </div>
    );
  }
  const S = m.S, d = m.d;
  const pick = (i: number) => { setSel(null); setAct((a) => ({ ...NO_PICK, guest: a.guest })); m.play(i); };
  const acts = d && d.kind !== "muster" && d.kind !== "place" ? buildActs(S, d) : [];
  const actNow = acts.find((a) => a.key === act.key) ?? null;
  // tapping the table only picks: the panel's button (or a second tap) commits
  const onCard = (uid: number) => {
    if (!d) return;
    if (d.kind === "place") { setSel(sel?.uid === uid ? null : { uid }); setJoin(null); return; } // pick it in the row, then confirm
    const a = acts.find((x) => x.uid === uid);
    if (a) { setGroup(a.group); setAct({ key: a.key, target: new Set(a.variants.map((v) => v.target)).size === 1 ? a.variants[0].target ?? null : null, guest: act.guest }); }
  };
  const onSpot = (spot: number) => {
    if (!d) return;
    // a target for the picked card?
    if (actNow && actNow.variants.some((v) => v.target === spot)) { setAct({ ...act, target: spot }); return; }
    // the spot you face in the Playing turn: show what you can do to it
    if (d.kind === "action" && d.spot === spot) {
      const g = acts.some((a) => a.group === "Supplant") && S.board[spot]?.def.type === "support" ? "Supplant" : acts.some((a) => a.group === "Geis & oath") ? "Geis & oath" : null;
      if (g) { setGroup(g); setAct({ ...NO_PICK, guest: act.guest }); }
      return;
    }
    const a = acts.find((x) => x.spot === spot && x.key.includes(":normal:")) ?? acts.find((x) => x.spot === spot);
    if (a) { setGroup(a.group); setAct({ key: a.key, target: null, guest: act.guest }); }
  };
  const tableSel: Sel = d && d.kind === "place" ? sel : actNow ? (actNow.uid !== undefined ? { uid: actNow.uid } : actNow.spot !== undefined ? { spot: actNow.spot } : null) : null;
  const panel = m.myTurn && d && d.kind !== "muster" && d.kind !== "place"
    ? <ActionPanel S={S} d={d} pick={act} group={group} onPick={setAct} onGroup={setGroup} onCommit={pick} /> : null;
  const status = m.over ? "The match is over." : m.myTurn ? "Your move." : m.thinking ? "The computer is thinking…" : "…";
  return (
    <div className="game">
      <section className="stage" aria-label="Roth Catha table">
        <div className="status-bar">
          <div className="status" role="status" aria-live="polite">{status}</div>
          <div className="status-tools">
            <button type="button" className="btn small" disabled={!m.canUndo} onClick={() => { setEnding(false); m.undo(); }} title="Take back your last move (and the computer's reply)">↶ Take back</button>
            {m.over ? null : ending ? (
              <>
                <button type="button" className="btn small danger" onClick={() => { setEnding(false); m.quit(); }}>End it, no result</button>
                <button type="button" className="btn small" onClick={() => setEnding(false)}>Keep playing</button>
              </>
            ) : <button type="button" className="btn small" onClick={() => setEnding(true)}>End match</button>}
          </div>
        </div>
        <Table S={S} me={m.me} d={d} sel={tableSel} onCard={m.myTurn ? onCard : undefined} onSpot={m.myTurn ? onSpot : undefined}
          onFocusCard={setFocus} names={["You", `The computer (${m.theirs ? FACTION_TITLE[m.theirs] : ""})`]} onPick={m.myTurn ? pick : undefined} last={m.last}
          afterWheel={m.myTurn && d && d.kind === "place" ? (
            <PlaceView S={S} d={d} sel={sel?.uid ?? null} join={join} onFocusCard={setFocus} onPick={pick}
              onSelect={(uid, j) => { setSel(uid === null ? null : { uid }); setJoin(j ?? null); }} />
          ) : narrow ? panel : null} />
        {m.over && !showResult ? <button type="button" className="btn" onClick={() => setShowResult(true)}>Show the result</button> : null}
      </section>
      <aside>
        {narrow ? null : panel}
        <Inspector def={focus} />
        <LogPanel log={m.log} />
        <details className="panel-fold" open={m.over || undefined}>
          <summary>New match</summary>
          <SetupPanel setup={m.setup} onChange={m.setSetup} onStart={m.start} inMatch record={m.record} />
        </details>
        <RulesPanel />
      </aside>
      {m.over && showResult && S.result ? <ResultDialog r={S.result} me={m.me} onAgain={() => m.start()} onClose={() => setShowResult(false)} /> : null}
    </div>
  );
}
