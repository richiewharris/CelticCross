// Fidchell online: the shared session, plus the selection, danger hints, move list and status line.
import { useEffect, useMemo, useState } from "react";
import { useOnlineId } from "../../online/route";
import { useOnlineGame } from "../../online/useOnlineGame";
import { START_CURSOR } from "./engine/game";
import { NAME, genMoves, initial, threatened } from "./engine/rules";
import { fidchellOnline, historyOf, sideOf } from "./online";

export function useFidchellOnline() {
  const session = useOnlineGame(fidchellOnline, useOnlineId("fidchell"), "Fidchell");
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState(START_CURSOR);
  const [hints, setHints] = useState(false);

  const s = session.s ?? initial();
  const mySide = sideOf(session.mySeat);
  const active = session.myTurn && !session.busy;
  const moves = session.doc?.moves;
  const history = useMemo(() => historyOf(moves ?? []), [moves]);
  const danger = useMemo(() => (hints && active ? threatened(s.b, s.turn) : null), [hints, active, s]);

  useEffect(() => { setSel(null); }, [session.id, moves?.length]);

  const clickCell = (i: number) => {
    if (!active) return;
    const me = s.turn;
    setCursor(i);
    if (sel !== null) {
      const legal = genMoves(s.b, me).find(m => m[0] === sel && m[1] === i);
      if (legal) { setSel(null); void session.play({ f: legal[0], t: legal[1] }); return; }
      if (i === sel) { setSel(null); return; }
    }
    setSel(s.b[i] === me && genMoves(s.b, me).some(m => m[0] === i) ? i : null);
  };

  // The status line above the board.
  let text = "", tone: "" | "win" | "lose" = "";
  const d = session.doc;
  if (session.phase === "connecting") text = "Connecting…";
  else if (session.phase === "missing" || session.phase === "error" || !d) text = "No game at this link.";
  else if (d.status === "open") text = mySide ? `You play ${NAME[mySide]}. Waiting for your friend to join.` : "Choose a side to join the game.";
  else if (d.status === "active") {
    text = session.illegalAt !== null ? "A move broke the rules, so the game has stopped."
      : session.myTurn ? `Your move (${NAME[s.turn]})`
      : mySide ? `Waiting for ${NAME[s.turn]} to move…`
      : `${NAME[s.turn]} to move`;
  } else {
    const r = d.result, w = sideOf(r?.winner);
    if (!r) text = "The game is over.";
    else if (r.resigned) text = `${NAME[sideOf(r.resigned) ?? 1]} resigned. ${w ? NAME[w] : "Nobody"} wins.`;
    else if (!w) text = `${r.text} A draw.`;
    else text = `${NAME[w]} wins: ${r.text.slice(NAME[w].length + 1)}`;
    if (mySide && w) tone = w === mySide ? "win" : "lose";
  }

  const hint = !active ? "" : sel !== null
    ? "Tap a dot to move there. A red ring means that move captures. Tap the piece again to cancel."
    : hints ? "Dashed red rings mark your pieces in danger." : "Tap one of your pieces to see where it can go.";

  return {
    session, s, history, sel, cursor, setCursor, active, danger, hints, clickCell, hint,
    status: { text, tone },
    deselect: () => setSel(null),
    toggleHints: () => setHints(h => !h),
  };
}
