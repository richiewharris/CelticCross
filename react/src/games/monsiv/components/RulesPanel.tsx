import { RuleGlyph } from "./Piece";

export function RulesPanel() {
  return (
    <div className="panel">
      <p className="label">How to play</p>
      <ul className="rules">
        <li><RuleGlyph t={1} /><span><b>Throne</b> steps one square in any direction. Lose it and you lose the game. It may never move or swap onto a square where an enemy piece could take it, so it can't capture a guarded piece.</span></li>
        <li><RuleGlyph t={2} /><span><b>Angel</b> steps one square diagonally.</span></li>
        <li><RuleGlyph t={3} /><span><b>Cross</b> steps one square straight: forward, back or sideways.</span></li>
        <li><span className="label" style={{ textAlign: "center", paddingTop: 2 }}>⇄</span><span><b>Swap</b> two of your own different pieces that touch, including diagonally. A swap is your whole turn, and you can't swap the same pair twice in a row.</span></li>
        <li><span className="label" style={{ textAlign: "center", paddingTop: 2 }}>✕</span><span><b>Capture</b> by stepping onto an enemy piece.</span></li>
        <li><span className="label" style={{ textAlign: "center", paddingTop: 2 }}>↺</span><span><b>No repeats.</b> You can't make a move that recreates a position already seen this game, unless it wins.</span></li>
        <li><span className="label" style={{ textAlign: "center", paddingTop: 2 }}>♛</span><span><b>Win</b> by capturing the enemy Throne or by landing any piece on the far row. A player with no legal move loses, so there are no draws.</span></li>
      </ul>
      <p className="note">Rebuilt from the original game's layout and player descriptions. The original site is offline, so details like the swap limits are best guesses. The Throne and no-repeat rules were added to balance the game: in deep computer testing they took it from 72% second-player wins to roughly even.</p>
    </div>
  );
}
