import { GOLD, N, NAME, QUIET_LIMIT, WHITE, type Piece, type Side } from "../engine/rules";

/** Five pegs a side, the lost ones faded, and the count of moves since a capture. */
export function Tally({ pieces, quiet, over }: { pieces: Piece[]; quiet: number; over: boolean }) {
  const row = (side: Side, cls: string) => {
    const alive = pieces.filter(p => p.side === side && p.alive).length;
    return [
      <span key={`${side}a`}>{NAME[side]}</span>,
      <span key={`${side}b`} className="pegs">{Array.from({ length: N }, (_, k) => <span key={k} className={`peg ${cls}${k < alive ? "" : " lost"}`} />)}</span>,
      <span key={`${side}c`} className="n">{alive}</span>,
    ];
  };
  return <>
    <div className="tally">{row(GOLD, "g")}{row(WHITE, "w")}</div>
    <p className="quiet">{over ? "" : `Moves since a capture: ${quiet} of ${QUIET_LIMIT}`}</p>
  </>;
}
