import { CH, LO, PH, RI, SP } from "../engine/rules";
import { CnocPiece } from "../glyphs";

export function RulesPanel({ holdN, combine = false }: { holdN: number; combine?: boolean }) {
  return (
    <div className="panel">
      <p className="label">How to play</p>
      <ul className="rules">
        <li><CnocPiece p={LO} className="rulepiece" /><span><b>The Lord</b> (Host) moves one or two holes in a straight line, any direction. Put him on the summit to win, but only once no Sí piece stands there. Lose him and you lose.</span></li>
        <li><CnocPiece p={SP} className="rulepiece" /><span><b>Spearmen</b> (Host, 7) step one hole forward, back or sideways.</span></li>
        <li><CnocPiece p={CH} className="rulepiece" /><span><b>The Chariot</b> (Sí) runs any distance along a row or column.</span></li>
        <li><CnocPiece p={RI} className="rulepiece" /><span><b>Riders</b> (Sí, 4) step one hole diagonally.{combine ? " While the Sí have no Chariot, a Rider on the summit may step onto a neighbouring Rider also on the summit (any of the 8 directions): the two merge into a Chariot there. That is the Sí's move." : ""}</span></li>
        {combine ? <li><CnocPiece p={PH} className="rulepiece" /><span><b>The Phalanx</b> (Host, optional) steps one hole in any of the 8 directions and takes by moving onto a piece. In setup the Host may take it in place of 3 Spearmen; it counts as 3 pieces for the repetition rule.</span></li> : null}
        <li><svg viewBox="0 0 100 100"><path d="M10 80 H30 V60 H50 V40 H90" fill="none" stroke="currentColor" strokeWidth="6" /></svg><span><b>The climb.</b> A move that steps up a tier stops there. Downhill is free. Take a piece by moving onto it.</span></li>
        <li><svg viewBox="0 0 100 100"><rect x="38" y="20" width="24" height="64" rx="10" fill="var(--silver)" stroke="var(--silver-ink)" strokeWidth="3" /></svg><span><b>The hold.</b> The Sí win if, after {holdN} of their turns in a row, they have a piece on the summit and the Host have none. Any Host piece on the summit resets the count.</span></li>
      </ul>
      <p className="note">Setup: the Host set their pieces on the outer ring, the Sí anywhere higher, one at a time, Host first. With “Set your rival's”, the Host set their Lord and the Sí set their Chariot on the summit; then each side sets the other side's pieces in turn, and the hold is two turns shorter.{combine ? " Combining pieces: in your own setup the Host may take the Phalanx on any of their turns while 3 Spearmen are left to set; in the rival's setup the Host decide when setting their Lord, and the Sí then set the Phalanx with the Host's other pieces." : ""} The Host move first. Taking every Sí piece also wins for the Host; a player with no move loses; a position seen a third time goes to the side with fewer pieces.</p>
    </div>
  );
}
