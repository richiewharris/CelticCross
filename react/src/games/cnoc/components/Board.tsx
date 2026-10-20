import { NAMES, NN, TIER, sideName, sideOf, sqName, type Piece } from "../engine/rules";
import { CnocPiece } from "../glyphs";
import { Terrain } from "./Terrain";

export type Mark = "go" | "cap" | "win" | "place" | "merge";
export interface BoardProps {
  b: Piece[];
  marks?: Map<number, Mark>;
  selected?: number | null;
  last?: { from?: number; to: number } | null;
  best?: { from?: number; to: number } | null;
  hint?: number | null;
  flash?: { sqs: number[]; kind: "good" | "bad" } | null;
  locked?: boolean;
  animate?: boolean;
  onCell?: (i: number) => void;
}
const TIER_NAME = ["", "low ground", "slope", "summit"];

/** The 7x7 mound with its holes, pieces and move marks. */
export function Board(p: BoardProps) {
  return (
    <div className="boardbox">
      <div className="ranks" aria-hidden="true">{[7, 6, 5, 4, 3, 2, 1].map(n => <span key={n}>{n}</span>)}</div>
      <div className="mound">
        <Terrain />
        <div className={`board${p.locked ? " locked" : ""}`}>
          {Array.from({ length: NN }, (_, i) => {
            const piece = p.b[i], mark = p.marks?.get(i);
            const cls = ["sq"];
            if (piece) cls.push("has");
            if (p.selected === i) cls.push("sel");
            else if (p.flash?.sqs.includes(i)) cls.push(p.flash.kind);
            else if (p.last && (p.last.from === i || p.last.to === i)) cls.push("last");
            if (p.best?.from === i) cls.push("bestfrom"); else if (p.best?.to === i) cls.push("bestto");
            if (p.hint === i) cls.push("hintsq");
            const desc = piece ? `${sideName(sideOf(piece))} ${NAMES[piece]}` : "empty";
            const act = mark === "cap" ? ", take" : mark === "go" || mark === "win" ? ", move here" : mark === "place" ? ", set a piece here" : mark === "merge" ? ", merge the two Riders into a Chariot here" : "";
            return (
              <button key={i} type="button" className={cls.join(" ")} aria-label={`${sqName(i)}, ${TIER_NAME[TIER[i]]}, ${desc}${act}`} onClick={() => p.onCell?.(i)}>
                {piece ? <CnocPiece p={piece} pop={p.animate && p.last?.to === i} /> : null}
                {mark ? <span className={`mk ${mark}`} /> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="files" aria-hidden="true">{"abcdefg".split("").map(f => <span key={f}>{f}</span>)}</div>
    </div>
  );
}
