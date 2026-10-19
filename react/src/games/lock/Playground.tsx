// Every component of both versions with fixed data. The two versions have their own looks
// (body.gm-lock and body.gm-lock-v1), so one is shown at a time.
import { useState } from "react";
import "./lock.css";
import "./lock-v1.css";
import { GameScope } from "../../kit/GameScope";
import { WC, TIERS, makeKnot, rotCW, type Profile } from "./engine/knot";
import { geom } from "./engine/dial";
import { CELLS, brokenEdges, makeLock, misplaced, nextSwap, type Tile } from "./engine/cross";
import { mulberry32 } from "./engine/testkit";
import { Dial, Example, restingAnim } from "./components/Dial";
import { CrossBoard, TileSvg } from "./components/CrossBoard";
import { SkillPanel, TierPanel, TurnsPanel } from "./components/Ledger";
import { StrandKey } from "./CrossGame";

const SOL = makeKnot(TIERS[4], mulberry32(11));
const CUR = SOL.map((m, k) => (m !== 15 && k % 5 === 1 ? rotCW(m) : m));
const PHI = WC - .5 * geom(4).da;
const PROFILE: Profile = { skill: 47, opened: 12, attempts: 19 };

const TILES = makeLock(4, mulberry32(5));
const ARR = CELLS.map((_, i) => i);
[ARR[2], ARR[9]] = [ARR[9], ARR[2]];
[ARR[5], ARR[13]] = [ARR[13], ARR[5]];
const SAMPLE_TILES: Tile[] = [
  { n: 1, e: 0, s: 1, w: 0 }, { n: 2, e: 2, s: 0, w: 0 }, { n: 3, e: 1, s: 2, w: 3 }, { n: 0, e: 0, s: 0, w: 1 },
];

function CurrentParts() {
  const [tier, setTier] = useState<1 | 2 | 3 | 4 | 5>(2);
  return (
    <GameScope id="lock"><div className="pg-game">
      <section>
        <h2>The dial <code>&lt;Dial&gt;</code></h2>
        <div className="boards">
          <figure style={{ maxWidth: 420 }}>
            <Dial tier={4} cur={CUR} sol={SOL} phi={PHI} anim={restingAnim(PHI)} open={false} svgOpen={false} cheat={false} />
            <figcaption>A gold lock, some stones turned. Only the window shows.</figcaption>
          </figure>
          <figure style={{ maxWidth: 420 }}>
            <Dial tier={4} cur={CUR} sol={SOL} phi={PHI} anim={restingAnim(PHI)} open={false} svgOpen={false} cheat />
            <figcaption>Cheat on: see-through cover, turn badges and ringed loose ends.</figcaption>
          </figure>
          <figure style={{ maxWidth: 420 }}>
            <Dial tier={4} cur={SOL} sol={SOL} phi={PHI} anim={{ ...restingAnim(PHI), raise: 0, cover: 430, pinPhi: PHI }} open svgOpen cheat={false} />
            <figcaption>Opened: shield away, pins home in their slots.</figcaption>
          </figure>
          <figure style={{ maxWidth: 420 }}>
            <Dial tier={4} cur={SOL} sol={SOL} phi={PHI} anim={{ ...restingAnim(PHI), raise: .45, cover: 430, hub: .88 }} open svgOpen={false} cheat={false} />
            <figcaption>Mid-drop: pins halfway into the stone face, hub pressed.</figcaption>
          </figure>
        </div>
      </section>
      <section>
        <h2>Examples <code>&lt;Example&gt;</code></h2>
        <div className="examples" style={{ maxWidth: 300 }}>
          <figure><Example kind="good" /><figcaption>Joined</figcaption></figure>
          <figure><Example kind="bad" /><figcaption>Loose end</figcaption></figure>
        </div>
      </section>
      <section>
        <h2>Ledger <code>&lt;TurnsPanel&gt;</code> <code>&lt;SkillPanel&gt;</code> <code>&lt;TierPanel&gt;</code></h2>
        <aside style={{ maxWidth: 300 }}>
          <TurnsPanel label="Turns left" left={5} budget={9} line="5 of 9 turns left" meterOver={30} />
          <TurnsPanel label="Turns left (over 30: a bar)" left={20} budget={34} line="20 of 34 turns left" meterOver={30} />
          <SkillPanel profile={PROFILE} />
          <TierPanel tier={tier} desc={TIERS[tier].desc} onChange={setTier} />
        </aside>
      </section>
      <section>
        <h2>Controls</h2>
        <div className="controls">
          <button className="btn icon" type="button" aria-label="Spin anticlockwise">⟲</button>
          <button className="btn icon" type="button" aria-label="Spin clockwise">⟳</button>
          <button className="btn primary" type="button">Try the lock</button>
          <button className="btn" type="button">New lock</button>
          <button className="btn cheat" type="button" aria-pressed="false">Cheat</button>
          <button className="btn cheat" type="button" aria-pressed="true">Cheat on</button>
        </div>
        <div className="status good">The box opens. Skill +5.</div>
        <div className="status bad">The knot was broken…</div>
      </section>
    </div></GameScope>
  );
}

function ClassicParts() {
  const [sel, setSel] = useState<number | null>(null);
  const hint = nextSwap(TILES, ARR), wrong = new Set(misplaced(TILES, ARR));
  return (
    <GameScope id="lock-v1"><div className="pg-game">
      <section>
        <h2>Stones <code>&lt;TileSvg&gt;</code></h2>
        <div className="specimens" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {SAMPLE_TILES.map((t, i) => <div key={i} className="cell" style={{ width: 66, height: 66 }}><TileSvg t={t} bad={i === 3 ? ["w", "n"] : null} /></div>)}
        </div>
        <StrandKey />
      </section>
      <section>
        <h2>The cross <code>&lt;CrossBoard&gt;</code></h2>
        <div className="boards" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <figure>
            <CrossBoard tiles={TILES} arr={ARR} open={false} look={i => ({ sel: sel === i })}
              onPointerUp={e => { const c = (e.target as Element).closest<HTMLElement>(".cell"); if (c) setSel(+c.dataset.i! === sel ? null : +c.dataset.i!); }} />
            <figcaption>Live: tap a stone to select it.</figcaption>
          </figure>
          <figure>
            <CrossBoard tiles={TILES} arr={ARR} open={false}
              look={i => ({ wrong: wrong.has(i), hint: !!hint?.includes(i), bad: brokenEdges(TILES, ARR, i) })} />
            <figcaption>Cheat on: broken joins, stones out of place, the next swap.</figcaption>
          </figure>
          <figure style={{ overflow: "hidden" }}>
            <CrossBoard tiles={TILES} arr={CELLS.map((_, i) => i)} open look={() => ({})} />
            <figcaption>Opened: the ring turns and the stones glow.</figcaption>
          </figure>
        </div>
      </section>
      <section>
        <h2>Ledger</h2>
        <aside style={{ maxWidth: 300 }}>
          <TurnsPanel label="Moves left" left={3} budget={7} line="3 of 7 moves left" />
          <SkillPanel profile={PROFILE} />
        </aside>
      </section>
    </div></GameScope>
  );
}

export default function Playground() {
  const [v, setV] = useState<"v2" | "v1">("v2");
  return (
    <>
      <div className="row" role="group" aria-label="Version">
        <button type="button" className={`btn${v === "v2" ? " primary" : ""}`} aria-pressed={v === "v2"} onClick={() => setV("v2")}>Current</button>
        <button type="button" className={`btn${v === "v1" ? " primary" : ""}`} aria-pressed={v === "v1"} onClick={() => setV("v1")}>Classic</button>
      </div>
      {v === "v2" ? <CurrentParts /> : <ClassicParts />}
    </>
  );
}
