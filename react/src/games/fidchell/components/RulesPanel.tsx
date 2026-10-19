export function RulesPanel() {
  return (
    <div className="panel">
      <p className="label">How to play</p>
      <ul className="rules">
        <li>Each side has five pieces. Gold moves first.</li>
        <li>On your turn, move one piece any distance in a straight line, along a row or column, through empty holes. No diagonals, no jumping.</li>
        <li>Capture by trapping an enemy piece between the piece you just moved and another of yours, in a line. One move can take up to three pieces this way.</li>
        <li>Moving into a gap between two enemy pieces is safe. You're only taken when they close on you.</li>
        <li>Win by cutting your rival down to one piece, or by leaving them with no move.</li>
        <li>After 30 moves in a row without a capture, the side with more pieces wins. Equal pieces is a draw.</li>
      </ul>
      <p className="note">Fidchell's rules are lost. Irish texts say its pieces were split into gold and white halves and taken by trapping between two. This version follows that on a compact 5×5 board, marked like the 7×7 Ballinderry board, with moves borrowed from the Roman game it's often compared with, ludus latrunculorum.</p>
    </div>
  );
}
