import { Dialog } from "../../../kit/Dialog";

export function ResultDialog(props: {
  tone: "win" | "lose" | "draw"; title: string; text: string; review: () => void; close: () => void;
  /** Omitted for someone watching an online game. */
  newGame?: () => void;
  /** "New game", or "Rematch" online. */
  newLabel?: string;
}) {
  return (
    <Dialog tone={props.tone} label="Result">
      <h2>{props.title}</h2>
      <p>{props.text}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn primary" type="button" onClick={props.review}>Review the game</button>
        {props.newGame ? <button className="btn" type="button" onClick={props.newGame}>{props.newLabel ?? "New game"}</button> : null}
        <button className="btn" type="button" onClick={props.close}>Close</button>
      </div>
    </Dialog>
  );
}
