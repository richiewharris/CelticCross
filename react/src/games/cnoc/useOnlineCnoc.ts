// A Cnoc game played online: the session from src/online, plus the board's own click state
// (selected piece, tray pick, Phalanx choice). Every action goes through session.play.
import { useEffect, useState } from "react";
import { useOnlineGame } from "../../online/useOnlineGame";
import { useOnlineId } from "../../online/route";
import { currentSlot, defaultPiece, phalanxOffer } from "./engine/game";
import { sideOf, type Piece } from "./engine/rules";
import { slotZone } from "./engine/setup";
import { cnocOnline, sideOfSeat } from "./online";
import { legalFrom } from "./usePlayGame";

export function useOnlineCnoc() {
  const session = useOnlineGame(cnocOnline, useOnlineId("cnoc"), "Cnoc");
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState<Piece | null>(null);
  const [phx, setPhx] = useState(false);
  const og = session.s;
  const n = session.doc?.moves.length ?? 0;
  useEffect(() => { setSel(null); setPhx(false); }, [n, session.id]);
  useEffect(() => { setPick(null); }, [session.id]);

  const canAct = session.myTurn && !session.busy && !!og && og.winner === null;

  const clickCell = (i: number) => {
    if (!og || !canAct) return;
    if (og.phase === "place") {
      const slot = currentSlot(og);
      if (og.s.b[i] || !slotZone(slot, i)) return;
      const k = defaultPiece(og, pick);
      void session.play(phx && og.swap && phalanxOffer(og) ? { at: i, k, ph: 1 } : { at: i, k });
      return;
    }
    if (sel !== null) {
      const m = legalFrom(og, sel).find(x => (x & 63) === i);
      if (m !== undefined) { setSel(null); void session.play({ f: sel, t: i }); return; }
      if (i === sel) { setSel(null); return; }
    }
    const p = og.s.b[i];
    setSel(p && sideOf(p) === og.s.turn ? i : null);
  };

  return { session, og, sel, pick, setPick, phx, setPhx, clickCell, canAct, mySide: sideOfSeat(session.mySeat) };
}
