import { JUG, MEAD, NAME, QUIET_LIMIT, WINE, type Side, type State } from "../engine/rules";

function SideRow({ s, sd }: { s: State; sd: Side }) {
  const cls = sd === MEAD ? "mead" : "wine";
  return (
    <div className="side">
      <span className="name">{NAME[sd]}</span>
      <span className="jugs" aria-label={`${s.jug[sd]} refills left`}>
        {Array.from({ length: JUG }, (_, k) => <span key={k} className={`jug ${cls}${k < s.jug[sd] ? "" : " empty"}`}><i /></span>)}
      </span>
      <span className="sub">{s.jug[sd]} refill{s.jug[sd] === 1 ? "" : "s"} left · drunk {s.drinks[sd]}</span>
    </div>
  );
}

/** The Queen's number, each side's jug and drinks, and the quiet-move count. */
export function Ledger({ s }: { s: State }) {
  return (
    <div className="panel">
      <p className="queenline">The Queen's number <b>{s.queen}</b></p>
      <div className="sides"><SideRow s={s} sd={MEAD} /><SideRow s={s} sd={WINE} /></div>
      <p className="quiet">{s.winner !== null ? "" : `Moves since a cup was drunk: ${s.quiet} of ${QUIET_LIMIT}`}</p>
    </div>
  );
}
