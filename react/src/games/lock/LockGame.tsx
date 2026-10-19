// Celtic Cross Lock, current version: the dial under its shield, the controls and the ledger.
import { geom } from "./engine/dial";
import { TIERS, looseEnds } from "./engine/knot";
import { Dial, Example } from "./components/Dial";
import { VariantNav } from "./components/VariantNav";
import { SkillPanel, TierPanel, TurnsPanel } from "./components/Ledger";
import { useLock } from "./useLock";

export function LockGame() {
  const L = useLock();
  const { s, cheat } = L;
  const g = geom(s.tier);
  const ends = looseEnds(s.cur, g.R, g.C).length;
  const hint = !cheat || s.open ? ""
    : ends ? `Cover is see-through. Badges show which way each stone needs turning. ${ends} loose end${ends === 1 ? "" : "s"} left.` : "No loose ends. Press the center.";
  const movesLine = s.open ? `Opened with ${s.turnsLeft} of ${s.budget} turns to spare`
    : s.turnsLeft === 0 ? `0 of ${s.budget} left. Press the center.` : `${s.turnsLeft} of ${s.budget} turns left`;

  return (
    <div className="wrap">
      <header>
        <h1>Celtic Cross Lock</h1>
        <p className="tag">Turn the stones until the knot runs unbroken all the way round. You can only see a third of it at a time, so spin the disc to check your work, then press the center of the dial to try the lock.</p>
        <VariantNav current="v2" />
      </header>

      <div className="game">
        <section className="box" aria-label="Puzzle box">
          <div className={`status ${s.msgKind}`} role="status" aria-live="polite">{s.msg}</div>
          <Dial tier={s.tier} cur={s.cur} sol={s.sol} phi={L.drawnPhi} anim={L.anim} open={s.open} svgOpen={L.svgOpen} cheat={cheat}
            domRef={L.dom} {...L.handlers} />
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
          <TurnsPanel label="Turns left" left={s.turnsLeft} budget={s.budget} line={movesLine} meterOver={30} />
          <SkillPanel profile={L.profile} />
          <TierPanel tier={s.tier} desc={TIERS[s.tier].desc} onChange={L.pickTier} />
          <div className="panel">
            <p className="label">How to pick it</p>
            <ul className="how">
              <li>Tap a stone in the window to give it a quarter turn clockwise. Press and hold (or right-click) to turn it anticlockwise. Each quarter turn uses one turn.</li>
              <li>Drag the disc, or use ⟲ ⟳, to spin it. Spinning is free. You can also spin it by dragging the center.</li>
              <li>The lock is solved when the knot has no loose ends anywhere on the disc. A loose end shows as a round knob.</li>
              <li>Stones with corner rivets are crossings. They're fixed and can't turn.</li>
              <li>Press the center of the dial to try the lock. If the knot is whole, the shield slides away, the pins drop into their slots and the disc spins free. If it's broken anywhere, the stones scramble and your turns refill.</li>
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
