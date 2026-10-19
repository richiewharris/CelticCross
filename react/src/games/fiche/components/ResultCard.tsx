// Round and match results: a modal over the whole page that has to be dismissed.
import { Dialog } from "../../../kit/Dialog";
import { nameOf, type Game, type Player } from "../engine/game";

export function ResultCard({ g, onNext, onAgain }: { g: Game; onNext: () => void; onAgain: () => void }) {
  const { M, R } = g;
  if (!R.over) return null;
  const winner = R.over.winner, text = R.over.text, champ = M.over;
  const tone = (w: 0 | Player) => (w === 0 ? "draw" : M.mode === "pvp" ? "win" : w === 1 ? "win" : "lose");
  const score = (
    <div className="score">
      <span className="y">{nameOf(M, 1)} {M.wins[1]}</span><span className="r">{nameOf(M, 2)} {M.wins[2]}</span>
      {M.draws ? <span>Drawn {M.draws}</span> : null}
    </div>
  );
  if (champ) {
    const title = M.mode === "cpu" ? (champ === 1 ? "You win the match!" : "The rival wins the match") : `Player ${champ} wins the match!`;
    return (
      <Dialog tone={tone(champ)} label={title}>
        <span className="badge">Match over</span>
        <h2>{title}</h2>
        <p>{text}</p>
        {score}
        <button className="btn primary" type="button" onClick={onAgain}>Play again</button>
      </Dialog>
    );
  }
  const title = winner ? (M.mode === "cpu" ? (winner === 1 ? "You take the round!" : "You lose the round") : `Player ${winner} takes the round!`) : "The round is drawn";
  const starts = nameOf(M, R.last).toLowerCase() === "you" ? "You start the next round." : `${nameOf(M, R.last)} starts the next round.`;
  return (
    <Dialog tone={tone(winner)} label={`Round ${M.round}: ${title}`}>
      <span className="badge">Round {M.round}</span>
      <h2>{title}</h2>
      <div className="big">{R.total}</div>
      <p>{text}</p>
      {score}
      <p className="sub">{starts}</p>
      <button className="btn primary" type="button" onClick={onNext}>Next round</button>
    </Dialog>
  );
}
