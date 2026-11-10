// Roth Catha: the wheel of battle. A match against the computer, or the puzzle sets.
import { useEffect, useState } from "react";
import { Segmented } from "../../kit/Segmented";
import { useStoredState } from "../../kit/useStoredState";
import type { CardDef } from "./engine/cards";
import { Choices } from "./components/Choices";
import { PlaceView } from "./components/PlaceView";
import { Inspector, LogPanel, ResultDialog, RulesPanel, SetupPanel } from "./components/Panels";
import { optionAt, selFilter, Table, type Sel } from "./components/Table";
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
      {tab === "play" ? <Match focus={focus} setFocus={setFocus} />
        : tab === "build" ? <DeckBuilder setFocus={setFocus} onPlay={() => setTab("play")} />
        : guide === "walk" ? <Walkthrough focus={focus} setFocus={setFocus} />
        : guide === "puzzles" ? <Puzzles focus={focus} setFocus={setFocus} />
        : guide === "cards" ? <CardsGuide setFocus={setFocus} /> : <DecksGuide setFocus={setFocus} />}
    </div>
  );
}

function Match({ focus, setFocus }: { focus: CardDef | null; setFocus: (d: CardDef) => void }) {
  const m = useMatch();
  const [sel, setSel] = useState<Sel>(null);
  const [join, setJoin] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(true);
  useEffect(() => { setSel(null); setJoin(null); }, [m.d]);
  useEffect(() => { if (m.over) setShowResult(true); }, [m.over]);

  if (!m.S) {
    return (
      <div className="game">
        <section className="stage intro">
          <p>Pick your deck and the computer's level, then start. Play one of the five starter decks, or build your own from the pools under <b>Build a deck</b>. The computer builds its own deck too: the stronger the level, the better the deck.</p>
          <RulesPanel />
        </section>
        <aside><SetupPanel setup={m.setup} onChange={m.setSetup} onStart={m.start} inMatch={false} /></aside>
      </div>
    );
  }
  const S = m.S, d = m.d;
  const pick = (i: number) => { setSel(null); m.play(i); };
  const onCard = (uid: number) => {
    if (!d) return;
    if (d.kind === "place") { setSel(sel?.uid === uid ? null : { uid }); setJoin(null); return; } // pick it in the row, then confirm
    const opts = d.options.map((o, i) => ({ o, i })).filter(({ o }) => "uid" in o && (o as { uid: number }).uid === uid);
    if (opts.length === 1) pick(opts[0].i);
    else if (opts.length > 1) setSel({ uid });
  };
  const onSpot = (spot: number) => {
    if (!d) return;
    const j = optionAt(d, sel, spot);
    if (j >= 0) { pick(j); return; }
    const opts = d.options.map((o, i) => ({ o, i })).filter(({ o }) => o.t === "duel" && o.act === "use" && o.spot === spot);
    const plain = opts.filter(({ o }) => o.t === "duel" && o.guest < 0);
    if (opts.length === 1 || (plain.length === 1 && opts.length === plain.length)) pick(opts[0].i);
    else if (opts.length) setSel({ spot });
  };
  const status = m.over ? "The match is over." : m.myTurn ? "Your move." : m.thinking ? "The computer is thinking…" : "…";
  return (
    <div className="game">
      <section className="stage" aria-label="Roth Catha table">
        <div className="status" role="status" aria-live="polite">{status}</div>
        <Table S={S} me={m.me} d={d} sel={sel} onCard={m.myTurn ? onCard : undefined} onSpot={m.myTurn ? onSpot : undefined}
          onFocusCard={setFocus} names={["You", `The computer (${m.theirs ? FACTION_TITLE[m.theirs] : ""})`]} onPick={m.myTurn ? pick : undefined}
          afterWheel={m.myTurn && d && d.kind === "place" ? (
            <PlaceView S={S} d={d} sel={sel?.uid ?? null} join={join} onFocusCard={setFocus} onPick={pick}
              onSelect={(uid, j) => { setSel(uid === null ? null : { uid }); setJoin(j ?? null); }} />
          ) : null} />
        {m.myTurn && d && d.kind !== "muster" && d.kind !== "place" ? <Choices S={S} d={d} filter={selFilter(sel)} onPick={pick} onClear={() => setSel(null)} /> : null}
        {m.over && !showResult ? <button type="button" className="btn" onClick={() => setShowResult(true)}>Show the result</button> : null}
      </section>
      <aside>
        <Inspector def={focus} />
        <LogPanel log={m.log} />
        <SetupPanel setup={m.setup} onChange={m.setSetup} onStart={m.start} inMatch />
        <RulesPanel />
      </aside>
      {m.over && showResult && S.result ? <ResultDialog r={S.result} me={m.me} onAgain={() => m.start()} onClose={() => setShowResult(false)} /> : null}
    </div>
  );
}
