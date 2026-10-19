// Celtic Cross Lock, stacked discs: dial after dial, one purse of turns for the whole stack.
import "./stack.css";
import { geom } from "../engine/dial";
import { looseEnds } from "../engine/knot";
import { Dial, Example } from "../components/Dial";
import { VariantNav } from "../components/VariantNav";
import { SkillPanel, TierPanel, TurnsPanel } from "../components/Ledger";
import { METAL, ROMAN, STACKS, current } from "./engine";
import { LiftingDisc, Pile, StackPanel } from "./StackParts";
import { useStack } from "./useStack";

export function StackGame() {
  const L = useStack();
  const { s, cheat } = L, st = s.st;
  const layer = current(st), g = geom(layer.tier), total = st.layers.length;
  const ends = looseEnds(layer.cur, g.R, g.C).length;
  const hint = !cheat || st.open ? ""
    : ends ? `Cover is see-through. Badges show which way each stone needs turning. ${ends} loose end${ends === 1 ? "" : "s"} left.` : "No loose ends. Press the center.";
  const togo = total - st.at;
  const movesLine = st.open ? `Opened with ${st.left} of ${st.purse} turns to spare`
    : `${st.left} of ${st.purse} turns left · ${togo} disc${togo === 1 ? "" : "s"} to open`;

  return (
    <div className="wrap">
      <header>
        <h1>Celtic Cross Lock</h1>
        <p className="tag">The box is locked by a stack of discs. Open the top one and it lifts away to show the next. You get one purse of turns for the whole stack, so don't spend them all at the top.</p>
        <VariantNav current="stack" />
      </header>

      <div className="game">
        <section className="box" aria-label="Puzzle box">
          <div className={`status ${s.msgKind}`} role="status" aria-live="polite">{s.msg}</div>
          <p className="stk-plaque">
            {st.open ? <>The box is open · all {total} discs</> : <>Disc <b>{ROMAN[st.at]}</b> of {ROMAN[total - 1]} · {METAL[layer.tier]}</>}
          </p>
          <Pile st={st} liftKey={L.lift?.key ?? null} reduce={L.reduce}
            lifting={L.lift && <LiftingDisc key={L.lift.key} layer={L.lift.layer} anim={L.lift.anim} />}>
            <Dial tier={layer.tier} cur={layer.cur} sol={layer.sol} phi={L.drawnPhi} anim={L.anim} open={st.open} svgOpen={L.svgOpen} cheat={cheat}
              domRef={L.dom} {...L.handlers} />
          </Pile>
          <div className="controls">
            <button className="btn icon" type="button" aria-label="Spin anticlockwise" onClick={() => L.spinBy(-1)}>⟲</button>
            <button className="btn icon" type="button" aria-label="Spin clockwise" onClick={() => L.spinBy(1)}>⟳</button>
            <button className={`btn${st.open ? "" : " primary"}`} type="button" disabled={st.open} onClick={L.tryOpen}>Try the disc</button>
            <button className={`btn${st.open ? " primary" : ""}`} type="button" onClick={L.newOrNext}>{st.open ? "Next stack" : "New stack"}</button>
            <button className="btn cheat" type="button" aria-pressed={cheat} onClick={L.toggleCheat}>{cheat ? "Cheat on" : "Cheat"}</button>
          </div>
          <p className="hintbox" aria-live="polite">{hint}</p>
        </section>

        <aside>
          <TurnsPanel label="Purse" left={st.left} budget={st.purse} line={movesLine} meterOver={30} />
          <StackPanel st={st} cheat={cheat} />
          <SkillPanel profile={L.profile} />
          <TierPanel tier={st.tier} desc={STACKS[st.tier].desc} onChange={L.pickTier} />
          <div className="panel">
            <p className="label">How to pick it</p>
            <ul className="how">
              <li>You work only the top disc. Tap a stone in the window to give it a quarter turn clockwise; press and hold (or right-click) to turn it anticlockwise. Drag the disc, or use ⟲ ⟳, to spin it. Spinning is free.</li>
              <li>When the top disc's knot has no loose ends, press the center. The disc opens and lifts away, and the one beneath comes up. Open the bottom disc to open the box.</li>
              <li>Every quarter turn comes out of one purse for the whole stack, and it never refills. It holds what all the discs need plus a few spare, so a turn wasted at the top may be the one you're short at the bottom.</li>
              <li>The rims under the box show how many discs are left. The ledger gives each one's size, but not exactly how many turns it will take.</li>
              <li>Press the center on a broken knot and that disc's stones scramble again. Your turns don't come back.</li>
              <li>Run out of turns with a knot still broken and the stack resets: fresh discs and a fresh purse.</li>
              <li>Stones with corner rivets are crossings. They're fixed and can't turn.</li>
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
