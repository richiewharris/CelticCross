// Celtic Cross Lock, classic version: swap the stones of a ringed cross until the knotwork joins.
import { createPortal } from "react-dom";
import { CROSS_TIERS } from "./engine/cross";
import { CrossBoard, TileSvg } from "./components/CrossBoard";
import { SkillPanel, TierPanel, TurnsPanel } from "./components/Ledger";
import { useCross } from "./useCross";

/** The three strand kinds, as drawn in the key under the rules. */
export function StrandKey() {
  return (
    <div className="key" aria-label="Strand kinds">
      <span><svg viewBox="0 0 34 14"><line x1="2" y1="7" x2="32" y2="7" stroke="#120e0a" strokeWidth="12" /><line x1="2" y1="7" x2="32" y2="7" stroke="#d6a640" strokeWidth="7" /></svg>Gold</span>
      <span><svg viewBox="0 0 34 14"><line x1="2" y1="7" x2="32" y2="7" stroke="#120e0a" strokeWidth="12" /><line x1="2" y1="7" x2="32" y2="7" stroke="#4fa58c" strokeWidth="7" /><line x1="2" y1="7" x2="32" y2="7" stroke="#120e0a" strokeWidth="2" /></svg>Verdigris</span>
      <span><svg viewBox="0 0 34 14"><line x1="2" y1="7" x2="32" y2="7" stroke="#120e0a" strokeWidth="12" /><line x1="2" y1="7" x2="32" y2="7" stroke="#c1503f" strokeWidth="7" /><line x1="4" y1="7" x2="32" y2="7" stroke="#f0c6a8" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="0.1 7" /></svg>Garnet</span>
    </div>
  );
}

export function CrossGame() {
  const X = useCross();
  const { S, cheat } = X;
  const movesLine = S.open ? `Opened with ${S.movesLeft} of ${S.budget} moves to spare`
    : S.movesLeft === 0 ? `0 of ${S.budget} left. Try the lock.` : `${S.movesLeft} of ${S.budget} moves left`;

  return (
    <div className="wrap">
      <header>
        <h1>Celtic Cross Lock</h1>
        <p className="tag">Rejoin the knotwork on the ringed cross. When every strand meets its match, try the lock.</p>
      </header>

      <div className="game">
        <section className="box" aria-label="Puzzle box">
          <div className={`status ${S.msgKind}`} role="status" aria-live="polite">{S.msg}</div>
          <CrossBoard tiles={S.tiles} arr={S.arr} open={S.open} look={X.look} flash={X.flash} flashed={X.flashed} boardRef={X.boardEl} {...X.handlers} />
          <div className="actions">
            <button className={`btn${S.open ? "" : " primary"}`} type="button" disabled={S.open} onClick={X.tryLock}>Try the lock</button>
            <button className={`btn${S.open ? " primary" : ""}`} type="button" onClick={X.newLock}>{S.open ? "Next lock" : "New lock"}</button>
            <button className="btn cheat" type="button" aria-pressed={cheat} onClick={X.toggleCheat}>{cheat ? "Cheat on" : "Cheat"}</button>
          </div>
          <p className="hintbox" aria-live="polite">{X.hintText}</p>
        </section>

        <aside>
          <TurnsPanel label="Moves left" left={S.movesLeft} budget={S.budget} line={movesLine} />
          <SkillPanel profile={X.profile} />
          <TierPanel tier={S.tier} desc={CROSS_TIERS[S.tier].desc} onChange={X.pickTier} />
          <div className="panel">
            <p className="label">How to pick it</p>
            <ul className="how">
              <li>Drag a stone onto another to swap them. You can also tap one stone, then another. Each swap uses a move.</li>
              <li>The lock opens when every strand meets a strand of the same kind on the next stone, and no strand runs off the edge of the cross.</li>
              <li>Try the lock whenever you think it's done. If it isn't, the tumblers fall: the stones scramble again and your moves refill.</li>
              <li>Higher skill gives you more spare moves.</li>
              <li>Stuck? Turn on Cheat to see broken joins (red notches), stones out of place (red tint) and the next swap to make. A lock opened with Cheat on is practice and doesn't raise your skill.</li>
            </ul>
            <StrandKey />
          </div>
        </aside>
      </div>
      {X.ghost ? createPortal(<div className="ghost" ref={X.ghostEl}><TileSvg t={X.ghost.t} bad={X.ghost.bad} /></div>, document.body) : null}
    </div>
  );
}
