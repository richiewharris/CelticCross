// Celtic Cross Lock, the cube: a knot wrapped round all six faces of a stone cube. Turn the stones in
// place as on the dial; turn the whole cube to see the other faces. Never more than three faces show.
import "./cube.css";
import { FACES, cubeGeom, cubeTransform, looseEnds, CUBE_TIERS } from "./engine";
import { CubeView, Example, Triskele } from "./CubeView";
import { VariantNav } from "../components/VariantNav";
import { SkillPanel, TierPanel, TurnsPanel } from "../components/Ledger";
import { shadeOf, useCube } from "./useCube";

export function CubeGame() {
  const L = useCube();
  const { s, cheat, view } = L;
  const T = CUBE_TIERS[s.tier], g = cubeGeom(T.N);
  const ends = looseEnds(g, s.cur);
  const reveal = FACES.map((_, f) => !T.obscured || f === view.front || cheat || s.open);
  const live = FACES.map((_, f) => !s.open && reveal[f] && view.vis.includes(f));
  const unseen = ends.filter(([k]) => !view.vis.includes(g.face[k])).length;
  const hint = !cheat || s.open ? ""
    : ends.length ? `Every face shows its knot. Badges show which way each stone needs turning. ${ends.length} loose end${ends.length === 1 ? "" : "s"} left${unseen ? `, ${unseen} round the back` : ""}.`
      : "No loose ends. Press the triskele.";
  const movesLine = s.open ? `Opened with ${s.turnsLeft} of ${s.budget} turns to spare`
    : s.turnsLeft === 0 ? `0 of ${s.budget} left. Press the triskele.` : `${s.turnsLeft} of ${s.budget} turns left`;

  return (
    <div className="wrap">
      <header>
        <h1>Celtic Cross Lock</h1>
        <p className="tag">The knot runs round every side of a stone cube. Turn the stones until it runs unbroken over all six faces. You can never see more than three at once, so turn the cube to check your work, then press the triskele to try the lock.</p>
        <VariantNav current="cube" />
      </header>

      <div className="game">
        <section className="box cube-box" aria-label="Puzzle cube" onKeyDown={L.onKeyDown}>
          <div className={`status ${s.msgKind}`} role="status" aria-live="polite">{s.msg}</div>
          <CubeView g={g} cur={s.cur} sol={s.sol} ends={ends} reveal={reveal} live={live} cheat={cheat} open={s.open} home={L.home}
            transform={cubeTransform(L.q.current)} shade={shadeOf(L.q.current)} domRef={L.dom} {...L.handlers} />
          <div className="cube-turns" role="group" aria-label="Turn the cube">
            <button className="btn icon" type="button" aria-label="Turn the cube left" title="Turn left (←)" onClick={() => L.turnBy("left")}>←</button>
            <button className="btn icon" type="button" aria-label="Turn the cube up" title="Turn up (↑)" onClick={() => L.turnBy("up")}>↑</button>
            <button className="btn icon" type="button" aria-label="Turn the cube down" title="Turn down (↓)" onClick={() => L.turnBy("down")}>↓</button>
            <button className="btn icon" type="button" aria-label="Turn the cube right" title="Turn right (→)" onClick={() => L.turnBy("right")}>→</button>
            <button className="btn icon" type="button" aria-label="Roll the cube anticlockwise" title="Roll anticlockwise (Q)" onClick={() => L.turnBy("unroll")}>⟲</button>
            <button className="btn icon" type="button" aria-label="Roll the cube clockwise" title="Roll clockwise (E)" onClick={() => L.turnBy("roll")}>⟳</button>
          </div>
          <div className="controls">
            <button className={`btn boss${s.open ? "" : " primary"}`} type="button" disabled={s.open} onClick={L.tryOpen}><Triskele />Try the lock</button>
            <button className={`btn${s.open ? " primary" : ""}`} type="button" onClick={L.newOrNext}>{s.open ? "Next lock" : "New lock"}</button>
            <button className="btn cheat" type="button" aria-pressed={cheat} onClick={L.toggleCheat}>{cheat ? "Cheat on" : "Cheat"}</button>
          </div>
          <p className="hintbox" aria-live="polite">{hint}</p>
        </section>

        <aside>
          <TurnsPanel label="Turns left" left={s.turnsLeft} budget={s.budget} line={movesLine} meterOver={30} />
          <SkillPanel profile={L.profile} />
          <TierPanel tier={s.tier} desc={T.desc} onChange={L.pickTier} />
          <div className="panel">
            <p className="label">How to pick it</p>
            <ul className="how">
              <li>Tap a stone on a face you can see to give it a quarter turn clockwise. Press and hold (or right-click) to turn it anticlockwise. Each quarter turn uses one turn.</li>
              <li>Drag the cube to turn it, and let go to settle it square. The arrow buttons and arrow keys turn it a quarter at a time; ⟲ ⟳ (or Q and E) roll it. Turning the cube is free.</li>
              <li>The knot runs over the edges from face to face. The lock is solved when it has no loose ends anywhere on the cube. A loose end shows as a round knob.</li>
              <li>Stones with corner rivets are crossings. They're fixed and can't turn.</li>
              <li>On Gold and Ogham locks only the face toward you shows its knot. The others are bare stone until you turn them to the front.</li>
              <li>Press the triskele to try the lock. If the knot is whole, the pins drop home and the cube spins free. If it's broken anywhere, the stones scramble and your turns refill.</li>
            </ul>
            <div className="examples">
              <figure><Example kind="good" /><figcaption>Joined over an edge</figcaption></figure>
              <figure><Example kind="bad" /><figcaption>Loose end</figcaption></figure>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
