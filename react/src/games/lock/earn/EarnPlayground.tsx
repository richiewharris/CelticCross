// Playground section for "Earned turns": a dial with joins just made glowing, and the purse.
import "./earn.css";
import { geom } from "../engine/dial";
import { TIERS, WC, makeKnot, signedSteps } from "../engine/knot";
import { mulberry32 } from "../engine/testkit";
import { Dial, restingAnim } from "../components/Dial";
import { TurnsPanel } from "../components/Ledger";
import { earnDeal, knotJoins, plan, startState, turnStone, type EarnState } from "./engine";
import { JoinGlow, Purse } from "./EarnParts";

// A silver lock played two stones into its good order; the second stone's joins have just paid.
const TIER = 3, T = TIERS[TIER];
const rng = mulberry32(21);
const SOL = makeKnot(T, rng), JOINS = knotJoins(SOL, T.rings, T.sectors);
const DEAL = earnDeal(TIER, SOL, rng);
let ST: EarnState = startState(DEAL.cur, SOL, JOINS, DEAL.start);
const ORDER = plan({ cur: DEAL.cur, sol: SOL, joins: JOINS, pool: DEAL.start, paid: ST.paid })!;
let MADE: number[] = [], GAIN = 0;
for (const k of ORDER.slice(0, 2)) {
  const s = signedSteps(ST.cur[k], SOL[k]);
  for (let i = 0; i < Math.abs(s); i++) { const r = turnStone(ST, SOL, JOINS, k, s < 0)!; ST = r.state; MADE = r.made; GAIN = r.gain; }
}
const K = ORDER[1], g = geom(TIER);
// Spin so the stone just set right sits in the middle of the window.
const PHI = WC - ((K % g.C) + .5) * g.da;

export function EarnPlayground() {
  return (
    <section className="earn-still">
      <h2>Earned turns <code>&lt;JoinGlow&gt;</code> <code>&lt;Purse&gt;</code></h2>
      <div className="boards" style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "start" }}>
        <figure style={{ maxWidth: 420, margin: 0, flex: "1 1 300px" }}>
          <Dial tier={TIER} cur={ST.cur} sol={SOL} phi={PHI} anim={restingAnim(PHI)} open={false} svgOpen={false} cheat={false}
            overlay={<JoinGlow tier={TIER} sol={SOL} joins={JOINS} made={MADE} k={K} gain={GAIN} phi={PHI} flashKey={1} />} />
          <figcaption>A join just made: the strand lights up across both stones, and the turned stone shows what it paid.</figcaption>
        </figure>
        <aside style={{ maxWidth: 300, flex: "1 1 260px" }}>
          <Purse pool={ST.pool} gain={GAIN} flashKey={1} />
          <Purse pool={0} gain={0} flashKey={null} />
          <Purse pool={19} gain={0} flashKey={null} />
          <TurnsPanel label="Turns in hand" left={ST.pool} budget={Math.max(ST.pool, ST.start)} line={`Started with ${ST.start} · earned ${ST.earned} · used ${ST.used}`} />
          <p className="stats">The purse under the dial: just paid, empty, and past sixteen (a count only).</p>
        </aside>
      </div>
    </section>
  );
}
