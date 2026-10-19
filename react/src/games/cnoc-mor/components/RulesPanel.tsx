import { CH, LO, RI, SP } from "../engine/rules";
import { RuleIcon } from "../glyphs";

export function RulesPanel() {
  return (
    <div className="panel">
      <p className="label">How to play</p>
      <ul className="rules">
        <li><RuleIcon p={LO} /><span><b>The Lord</b> (Host) steps one hole any way. Stand him on the cairn at the centre to win. On the outer ring he is safe from Riders. Lose him and you lose.</span></li>
        <li><RuleIcon p={SP} /><span><b>Spearmen</b> (Host, 4 + 3 in reserve) step one hole any way, but climb only straight.</span></li>
        <li><RuleIcon p={CH} /><span><b>The Chariot</b> (Sí) runs any distance along a row or column.</span></li>
        <li><RuleIcon p={RI} /><span><b>Riders</b> (Sí, 4 + 1 in reserve) run any distance diagonally.</span></li>
        <li><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M8 84 H26 V66 H44 V48 H62 V30 H92" fill="none" stroke="currentColor" strokeWidth="6" /></svg><span><b>The climb.</b> Four tiers. A move that steps up a tier stops there; downhill is free. Take a piece by moving onto it.</span></li>
        <li><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 14 L80 76 H20 Z" fill="var(--silver)" stroke="var(--silver-ink)" strokeWidth="3" /></svg><span><b>Back to the hill.</b> Instead of moving, a Sí piece may jump to any empty summit hole while no Host piece stands on the summit.</span></li>
        <li><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="12 8" /></svg><span><b>Reserves.</b> Bring one in as your move: Host spearmen onto the outer ring, the Sí Rider onto the upper slope or summit.</span></li>
      </ul>
      <p className="note">Setup: the Host set their Lord and 4 spearmen on the outer ring, the Sí their Chariot and 4 Riders on the upper slope or summit, one at a time, Host first. Then the Host move first. The Host also win by taking every Sí piece. The Lord can't take a piece standing on the cairn. A player with no move loses; a position seen a third time goes to the side with fewer pieces; 150 moves each is a draw. Balanced over thousands of computer games: the Host won 47–55% at every search depth tested.</p>
    </div>
  );
}
