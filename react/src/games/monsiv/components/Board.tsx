import { NAMES, sqName } from "../engine/game";
import { MonsivPiece } from "./Piece";

export type Mark = "go" | "cap" | "swap";
export interface Flash { sqs: number[]; kind: "good" | "bad" | "last" }
export interface BoardProps {
  b: number[];
  marks?: Map<number, Mark>;
  selected?: number | null;
  /** Squares of the last move, lightly lit. */
  last?: number[];
  /** Squares whose pieces pop in; popKey changes on every move so the animation replays. */
  pop?: number[];
  popKey?: number;
  flash?: Flash | null;
  hint?: number | null;
  /** Show the board from Black's side. */
  flip?: boolean;
  locked?: boolean;
  onCell?: (i: number) => void;
}

/** The 5x5 board with rank and file labels, pieces and move marks. */
export function Board(p: BoardProps) {
  const order = Array.from({ length: 25 }, (_, d) => (p.flip ? 24 - d : d));
  return (
    <div className="boardbox">
      <div className="ranks" aria-hidden="true">{(p.flip ? "12345" : "54321").split("").map(x => <span key={x}>{x}</span>)}</div>
      <div className={`board${p.locked ? " locked" : ""}`}>
        {order.map(i => {
          const r = (i / 5) | 0, c = i % 5, piece = p.b[i], mark = p.marks?.get(i);
          const cls = ["sq"];
          if ((r + c) % 2 === 1) cls.push("dk");
          if (p.selected === i) cls.push("sel");
          else if (p.flash?.sqs.includes(i)) cls.push(p.flash.kind);
          else if (p.last?.includes(i)) cls.push("last");
          if (p.hint === i) cls.push("hintsq");
          const desc = piece ? `${piece & 8 ? "Black" : "White"} ${NAMES[piece & 7]}` : "empty";
          const act = mark === "go" ? ", move here" : mark === "cap" ? ", capture" : mark === "swap" ? ", swap" : "";
          const pops = !!p.pop?.includes(i);
          return (
            <button key={i} type="button" className={cls.join(" ")} aria-label={`${sqName(i)} ${desc}${act}`} onClick={() => p.onCell?.(i)}>
              {piece ? <MonsivPiece key={pops ? `pop${p.popKey}` : "still"} code={piece} pop={pops} /> : null}
              {mark === "go" ? <span className="mark go" /> : null}
              {mark === "cap" ? <span className="mark cap" /> : null}
              {mark === "swap" ? <span className="mark swap">⇄</span> : null}
            </button>
          );
        })}
      </div>
      <div className="files" aria-hidden="true">{(p.flip ? "edcba" : "abcde").split("").map(x => <span key={x}>{x}</span>)}</div>
    </div>
  );
}
