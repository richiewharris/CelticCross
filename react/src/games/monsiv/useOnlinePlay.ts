// An online game by invite: the shared session (src/online) plus the board's selection and
// the pop-in of fresh moves. The position comes from replaying the session's moves.
import { useEffect, useRef, useState } from "react";
import { useOnlineId } from "../../online/route";
import { useOnlineGame } from "../../online/useOnlineGame";
import { col } from "./engine/core";
import { legalMoves } from "./engine/game";
import { fromEngine, monsivOnline } from "./online";
import { moveTo } from "./usePlayGame";

export function useOnlinePlay() {
  const id = useOnlineId("monsiv");
  const session = useOnlineGame(monsivOnline, id, "Monsiv");
  const g = session.s;
  const [sel, setSel] = useState<number | null>(null);
  /** History length after the last move that arrived while watching, so only fresh moves pop in. */
  const [anim, setAnim] = useState(-1);
  const len = g ? g.history.length : -1;
  const seen = useRef<{ id: string | null; len: number }>({ id: null, len: -1 });

  useEffect(() => {
    const p = seen.current;
    setAnim(p.id === id && p.len >= 0 && len === p.len + 1 ? len : -1);
    if (p.len !== len || p.id !== id) setSel(null);
    seen.current = { id, len };
  }, [id, len]);

  const clickCell = (i: number) => {
    if (!g || !session.myTurn || session.busy) return;
    if (sel !== null) {
      const m = moveTo(legalMoves(g), sel, i);
      if (m) { setSel(null); void session.play(fromEngine(m)); return; }
      if (i === sel) { setSel(null); return; }
    }
    const p = g.s.b[i];
    setSel(p && col(p) === g.s.turn ? i : null);
  };

  return { id, session, sel, clickCell, anim };
}
