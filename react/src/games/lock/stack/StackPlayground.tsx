// Playground section for the stacked discs: the pile with rims beneath, and the stack ledger, on fixed data.
import "./stack.css";
import { mulberry32 } from "../engine/testkit";
import { Dial, restingAnim } from "../components/Dial";
import { current, dealStack, type Stack } from "./engine";
import { Pile, StackPanel } from "./StackParts";

const DEALT = dealStack(5, 40, mulberry32(17));
const MID: Stack = { ...DEALT, at: 1, left: DEALT.purse - 7 };
const TOP = current(MID);

export function StackPlayground() {
  return (
    <section>
      <h2>Stacked discs <code>&lt;Pile&gt;</code> <code>&lt;StackPanel&gt;</code></h2>
      <div className="boards" style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "start" }}>
        <figure style={{ maxWidth: 420, margin: 0, flex: "1 1 300px" }}>
          <Pile st={MID} liftKey={null} reduce lifting={null}>
            <Dial tier={TOP.tier} cur={TOP.cur} sol={TOP.sol} phi={TOP.phi} anim={restingAnim(TOP.phi)} open={false} svgOpen={false} cheat={false} />
          </Pile>
          <figcaption>An ogham stack, second disc on top: the rims of the two discs beneath step down below it.</figcaption>
        </figure>
        <aside style={{ maxWidth: 300, flex: "1 1 260px" }}>
          <StackPanel st={MID} cheat={false} />
          <StackPanel st={MID} cheat />
          <p className="stats">With Cheat on, each disc still to open shows the turns it needs.</p>
        </aside>
      </div>
    </section>
  );
}
