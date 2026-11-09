// Roth Catha's components with fixed data: the table mid-duel, cards of every type, and a puzzle board.
import { useMemo, useState } from "react";
import "./roth.css";
import { GameScope } from "../../kit/GameScope";
import { ALL_DEFS, type CardDef } from "./engine/cards";
import { cloneState, nextDecision } from "./engine/engine";
import { CardFace } from "./components/Card";
import { Inspector } from "./components/Panels";
import { Table } from "./components/Table";
import { PUZZLES, type BoardPuzzle } from "./puzzles/data";
import { unpackState } from "./puzzles/position";

const SAMPLE = ["cu", "medb", "loegaire", "gae_bolga", "cohuleen", "g_peace", "g_giant", "v_blood", "o_keen", "o_crow", "o_lugh"];

export default function Playground() {
  const [focus, setFocus] = useState<CardDef | null>(null);
  const boards = PUZZLES.filter((p): p is BoardPuzzle => p.kind === "board");
  const views = useMemo(() => ["d-tathlum", "p-mantle", "c-cloak"].map((id) => {
    const S = cloneState(unpackState(boards.find((b) => b.id === id)!.state));
    const d = nextDecision(S)!;
    return { id, S, d };
  }), [boards]);
  return (
    <GameScope id="roth">
      <div className="pg-game">
        <section>
          <h2>Cards</h2>
          <div className="hand">{SAMPLE.map((id) => <CardFace key={id} def={ALL_DEFS[id]} owner="mine" onFocusCard={setFocus} />)}</div>
          <CardFace def={ALL_DEFS.manannan} full owner="theirs" />
          <Inspector def={focus} />
        </section>
        {views.map((v) => (
          <section key={v.id}>
            <h2>Table: {v.id}</h2>
            <Table S={v.S} me={v.d.player} d={v.d} sel={null} onFocusCard={setFocus} />
          </section>
        ))}
      </div>
    </GameScope>
  );
}
