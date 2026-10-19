// Celtic Cross Lock, "Earned turns": the same dial, but you start with three to five turns and earn
// one more for every join of the knot you make, so the order you fix the stones in matters.
import "./earn.css";
import { geom } from "../engine/dial";
import { looseEnds } from "../engine/knot";
import { Dial, Example } from "../components/Dial";
import { VariantNav } from "../components/VariantNav";
import { SkillPanel, TierPanel, TurnsPanel } from "../components/Ledger";
import { EARN_DESC } from "./engine";
import { JoinGlow, Purse } from "./EarnParts";
import { useEarn } from "./useEarn";

const turns = (n: number) => `${n} turn${n === 1 ? "" : "s"}`;

export function EarnGame() {
  const L = useEarn();
  const { s, cheat, flash } = L, st = s.st;
  const g = geom(s.tier);
  const ends = looseEnds(st.cur, g.R, g.C).length;
  const hint = !cheat || s.open ? ""
    : ends ? `Cover is see-through. Badges show which way each stone needs turning. ${ends} loose end${ends === 1 ? "" : "s"} left.` : "No loose ends. Press the center.";
  const line = s.open ? `Opened with ${turns(st.pool)} to spare`
    : `Started with ${st.start} · earned ${st.earned} · used ${st.used}`;

  return (
    <div className="wrap">
      <header>
        <h1>Celtic Cross Lock</h1>
        <p className="tag">You start with only a few turns. Every join of the knot you make earns another, so choose your order well: set stones right beside ones that are already right, and the lock pays its own way.</p>
        <VariantNav current="earn" />
      </header>

      <div className="game">
        <section className="box" aria-label="Puzzle box">
          <div className={`status ${s.msgKind}`} role="status" aria-live="polite">{s.msg}</div>
          <Dial tier={s.tier} cur={st.cur} sol={s.sol} phi={L.drawnPhi} anim={L.anim} open={s.open} svgOpen={L.svgOpen} cheat={cheat}
            domRef={L.dom} {...L.handlers}
            overlay={flash && !s.open
              ? <JoinGlow key={flash.key} tier={s.tier} sol={s.sol} joins={s.joins} made={flash.joins} k={flash.k} gain={flash.gain} phi={L.drawnPhi} flashKey={flash.key} />
              : null} />
          <Purse pool={st.pool} gain={flash?.gain ?? 0} flashKey={flash?.key ?? null} />
          <div className="controls">
            <button className="btn icon" type="button" aria-label="Spin anticlockwise" onClick={() => L.spinBy(-1)}>⟲</button>
            <button className="btn icon" type="button" aria-label="Spin clockwise" onClick={() => L.spinBy(1)}>⟳</button>
            <button className={`btn${s.open ? "" : " primary"}`} type="button" disabled={s.open} onClick={L.tryOpen}>Try the lock</button>
            <button className={`btn${s.open ? " primary" : ""}`} type="button" onClick={L.newOrNext}>{s.open ? "Next lock" : "New lock"}</button>
            <button className="btn cheat" type="button" aria-pressed={cheat} onClick={L.toggleCheat}>{cheat ? "Cheat on" : "Cheat"}</button>
          </div>
          <p className="hintbox" aria-live="polite">{hint}</p>
        </section>

        <aside>
          <TurnsPanel label="Turns in hand" left={st.pool} budget={Math.max(st.pool, st.start)} line={line} meterOver={30} />
          <SkillPanel profile={L.profile} />
          <TierPanel tier={s.tier} desc={EARN_DESC[s.tier]} onChange={L.pickTier} />
          <div className="panel">
            <p className="label">How to pick it</p>
            <ul className="how">
              <li>Tap a stone in the window to give it a quarter turn clockwise. Press and hold (or right-click) to turn it anticlockwise. Each quarter turn uses one turn. Spinning the disc is free.</li>
              <li>You start with three to five turns. A join is where the strand passes from one stone to the next. Once both its stones are right, the join is made and earns you one more turn.</li>
              <li>Each join pays once. Joins already whole when the lock is dealt pay nothing, and breaking a join and making it again pays nothing more.</li>
              <li>So order matters. Set a stone right next to one that is already right and it pays at once. Set one right between two wrong stones and it pays nothing until they're fixed too.</li>
              <li>No join ever needs more than three turns. There's always an order that gets you through, but a careless one can run you dry.</li>
              <li>Press the center to try the lock. If the knot is whole, the box opens, and turns left over add to your skill. If it's broken, the stones scramble and you get a fresh start of three to five turns.</li>
            </ul>
            <div className="examples">
              <figure><Example kind="good" /><figcaption>Joined</figcaption></figure>
              <figure><Example kind="bad" /><figcaption>Loose end</figcaption></figure>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
