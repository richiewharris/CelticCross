// Roth Catha: the wheel of battle. A match against the computer, or the puzzle sets.
import { useEffect, useState } from "react";
import { Segmented } from "../../kit/Segmented";
import { useStoredState } from "../../kit/useStoredState";
import type { CardDef } from "./engine/cards";
import { Choices } from "./components/Choices";
import { Inspector, LogPanel, ResultDialog, RulesPanel, SetupPanel } from "./components/Panels";
import { optionAt, selFilter, Table, type Sel } from "./components/Table";
import { Puzzles } from "./Puzzles";
import { FACTION_TITLE } from "./text";
import { useMatch } from "./useMatch";

type Tab = "play" | "puzzles";

export function RothGame() {
  const [tab, setTab] = useStoredState<Tab>("roth-react-tab", "play");
  const [focus, setFocus] = useState<CardDef | null>(null);
  return (
    <div className="wrap">
      <header>
        <h1>Roth Catha</h1>
        <p className="lede">The wheel of battle. Draft heroes and their supports onto a round board, bind your rival's heroes with geasa, swear oaths, turn omens, then fight two duels at the ford. Five decks from the Ulster Cycle and beyond.</p>
        <p className="private-note">Private preview: only you can see this page.</p>
      </header>
      <Segmented label="Mode" value={tab} onChange={setTab} className="tabs"
        options={[{ value: "play", label: "Play the computer" }, { value: "puzzles", label: "Puzzles" }] as { value: Tab; label: string }[]} />
      {tab === "play" ? <Match focus={focus} setFocus={setFocus} /> : <Puzzles focus={focus} setFocus={setFocus} />}
    </div>
  );
}

function Match({ focus, setFocus }: { focus: CardDef | null; setFocus: (d: CardDef) => void }) {
  const m = useMatch();
  const [sel, setSel] = useState<Sel>(null);
  const [showResult, setShowResult] = useState(true);
  useEffect(() => { setSel(null); }, [m.d]);
  useEffect(() => { if (m.over) setShowResult(true); }, [m.over]);

  if (!m.S) {
    return (
      <div className="game">
        <section className="stage intro">
          <p>Pick your deck and the computer's level, then start. Each deck is 24 cards: 4 heroes, 2 champions, 9 supports, 3 geasa, 2 oaths and 4 omens.</p>
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
          onFocusCard={setFocus} names={["You", `The computer (${m.theirs ? FACTION_TITLE[m.theirs] : ""})`]} />
        {m.myTurn && d ? <Choices S={S} d={d} filter={selFilter(sel)} onPick={pick} onClear={() => setSel(null)} /> : null}
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
