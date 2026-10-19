/** How to play, as on the original page. */
export function RulesPanel() {
  return (
    <div className="panel">
      <p className="label">How to play</p>
      <ul className="rules">
        <li>Each side has seven cups on its back row and a jug holding four refills. Mead goes first.</li>
        <li>Roll both dice. Each die moves a different cup exactly that many holes, in a straight line along a row or column, through empty holes. You choose the cups and the directions.</li>
        <li>If a move fits a die, you must make it. If neither die fits, your turn ends.</li>
        <li>A total of 7, 11 or 12 is a pass: your turn ends. Otherwise, keep rolling until you roll a pass or can't move.</li>
        <li>Trap a rival cup between the cup you moved and another of yours, in a line, and drink it. Moving into a gap between two rival cups is safe.</li>
        <li>A drunk cup goes back to its owner's back row, refilled from their jug. A player who must refill an empty jug loses.</li>
        <li><b>The Queen's number</b> is rolled before play. Roll it and you toast the Queen: drink any rival cup instead of moving, then roll again. Roll again without toasting and that's treason. Your rival drinks one of your cups.</li>
        <li>If 60 moves pass with no cup drunk, whoever has drunk more wins.</li>
      </ul>
      <p className="note">Built from Fidchell's capture-by-trapping and Tablero's board, dice, pass numbers, Queen's toast and refills. A win where your jug was never touched is a skunk.</p>
    </div>
  );
}
