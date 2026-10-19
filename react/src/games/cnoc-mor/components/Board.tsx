import { CENTRE, NAMES, NN, TIER, sideName, sideOf, sqName, type Piece } from "../engine/rules";
import { MorPiece } from "../glyphs";
import { Terrain } from "./Terrain";

export type Mark = "go" | "cap" | "win" | "place";
export interface BoardProps {
  b: Piece[];
  marks?: Map<number, Mark>;
  selected?: number | null;
  last?: { from?: number; to: number } | null;
  best?: { from?: number; to: number } | null;
  locked?: boolean;
  animate?: boolean;
  onCell?: (i: number) => void;
}
const TIER_NAME = ["", "outer ring", "lower slope", "upper slope", "summit"];
const RANKS = [9, 8, 7, 6, 5, 4, 3, 2, 1];

/** The 9x9 hill with its holes, pieces and move marks. */
export function Board(p: BoardProps) {
  return (
    <div className="boardbox">
      <div className="ranks" aria-hidden="true">{RANKS.map(n => <span key={n}>{n}</span>)}</div>
      <div className="mound">
        <Terrain />
        <div className={`board${p.locked ? " locked" : ""}`}>
          {Array.from({ length: NN }, (_, i) => {
            const piece = p.b[i], mark = p.marks?.get(i);
            const cls = ["sq"];
            if (piece) cls.push("has");
            if (i === CENTRE) cls.push("cairn");
            if (p.selected === i) cls.push("sel");
            else if (p.last && (p.last.from === i || p.last.to === i)) cls.push("last");
            if (p.best?.from === i) cls.push("bestfrom"); else if (p.best?.to === i) cls.push("bestto");
            const desc = piece ? `${sideName(sideOf(piece))} ${NAMES[piece]}` : "empty";
            const act = mark === "cap" ? ", take" : mark === "win" ? ", climb onto the cairn" : mark === "go" ? ", move here" : "";
            return (
              <button key={i} type="button" className={cls.join(" ")} aria-label={`${sqName(i)}, ${i === CENTRE ? "the cairn" : TIER_NAME[TIER[i]]}, ${desc}${act}`} onClick={() => p.onCell?.(i)}>
                {piece ? <MorPiece p={piece} pop={p.animate && p.last?.to === i} /> : null}
                {mark ? <span className={`mk ${mark}`} /> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="files" aria-hidden="true">{"abcdefghi".split("").map(f => <span key={f}>{f}</span>)}</div>
    </div>
  );
}
