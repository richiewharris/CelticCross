// Every component on one page, with fixed data, so they can be built and checked in isolation.
import { useMemo, useState } from "react";
import "./fidchell-cups.css";
import { GameScope } from "../../kit/GameScope";
import { Board, Cup, Defs, type Overlay } from "./components/Board";
import { Dice } from "./components/Dice";
import { GamePanel } from "./components/GamePanel";
import { Ledger } from "./components/Ledger";
import { RollLog } from "./components/RollLog";
import { RulesPanel } from "./components/RulesPanel";
import { bestPlan, bestToastTarget, threatened } from "./engine/ai";
import { DEFAULT_SETTINGS, endWait, land, newGame, playStep, playToast, type Game, type Settings } from "./engine/game";
import { MEAD, WINE, capturesFor, d6, legalNow, other, type Piece } from "./engine/rules";
import { seeded } from "./engine/testkit";

/** A seeded game between two Steady computers, stopped after `rolls` rolls. */
function sampleGame(rolls: number): Game {
  const rng = seeded(7);
  let g = newGame({ ...DEFAULT_SETTINGS, mode: "pvp" }, rng, 1);
  for (let k = 0; k < rolls && g.state.winner === null; k++) {
    g = land(g, [d6(rng), d6(rng)]);
    if (g.wait) { g = endWait(g); continue; }
    if (g.state.queenPending) { g = playToast(g, bestToastTarget(g.state, rng)); continue; }
    while (legalNow(g.state).length) {
      const plan = bestPlan(g.state, 2, rng);
      if (!plan) break;
      g = playStep(g, ...plan.steps[0]);
    }
  }
  return g;
}

const CUPS: Piece[] = [
  { id: 0, side: MEAD, pos: 24, alive: true },
  { id: 1, side: WINE, pos: 24, alive: true },
];

export default function Playground() {
  const mid = useMemo(() => sampleGame(14), []);
  const s = mid.state;
  const [sel, setSel] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hints, setHints] = useState(false);
  const [tumble, setTumble] = useState(0);
  const [faces, setFaces] = useState<[number, number]>([3, 5]);

  // A live roll of 2 and 3 on the sample position, for the player to move.
  const live = useMemo(() => ({ ...s, dice: [2, 3] as [number, number], used: [false, false] as [boolean, boolean], movedTo: -1, queenPending: false }), [s]);
  const legal = legalNow(live);
  const liveOverlay: Overlay = sel === null
    ? { from: [...new Set(legal.map(x => x[1]))] }
    : {
      sel, targets: legal.filter(x => x[1] === sel).map(([k, f, t]) => {
        const b = live.b.slice(); b[t] = live.turn; b[f] = 0;
        return { at: t, die: live.dice[k], cap: capturesFor(b, t, live.turn).length > 0 };
      }),
    };
  const plan = bestPlan(live, 3, seeded(1));
  const hintOverlay: Overlay = { arrow: plan ? { from: plan.steps[0][1], to: plan.steps[0][2] } : null, threats: [...threatened(live.b, live.turn)], cursor: 24 };
  const pickOverlay: Overlay = { pick: { squares: s.b.flatMap((v, i) => (v === other(s.turn) ? [i] : [])), treason: false } };
  const treasonOverlay: Overlay = { pick: { squares: s.b.flatMap((v, i) => (v === s.turn ? [i] : [])), treason: true } };

  return (
    <GameScope id="fidchell-cups"><div className="pg-game">
      <section>
        <h2>Cups <code>&lt;Cup&gt;</code></h2>
        <div className="specimens">
          {CUPS.map(p => (
            <figure key={p.id}>
              <svg viewBox="200 200 120 120" width="90" height="90" aria-hidden="true">
                <Defs />
                <g filter="url(#pegShadow)"><Cup p={p} /></g>
              </svg>
              <figcaption>{p.side === MEAD ? "Mead (bronze)" : "Wine (silver)"}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2>Board <code>&lt;Board&gt;</code></h2>
        <div className="boards">
          <figure>
            <Board pieces={s.pieces} overlay={liveOverlay} onCell={i => setSel(legal.some(x => x[1] === i) && i !== sel ? i : null)} />
            <figcaption>A sample game after 14 rolls, live with a roll of 2 and 3: tap a ringed cup to see where it can go.</figcaption>
          </figure>
          <figure>
            <Board pieces={s.pieces} overlay={hintOverlay} locked />
            <figcaption>Hints: the Strong computer's move as an arrow, cups in danger in red, and the keyboard cursor.</figcaption>
          </figure>
          <figure>
            <Board pieces={s.pieces} overlay={pickOverlay} />
            <figcaption>“To the Queen!”: every rival cup may be drunk.</figcaption>
          </figure>
          <figure>
            <Board pieces={s.pieces} overlay={treasonOverlay} />
            <figcaption>Treason between friends: the rival picks one of the roller's cups.</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>Dice <code>&lt;Dice&gt;</code></h2>
        <div className="dicebar">
          <Dice d={null} />
          <Dice d={[4, 2]} />
          <Dice d={[4, 2]} used={[true, false]} />
          <Dice d={[3, 3]} queen />
          <Dice d={faces} tumble={tumble} />
          <button className="btn primary big" type="button" onClick={() => { setTumble(t => t + 1); setFaces([d6(), d6()]); }}>Roll</button>
          <button className="btn queen big" type="button">To the Queen!</button>
        </div>
        <p className="roll-note queen">Blank, rolled, one die used, the Queen's number, and a throw that tumbles.</p>
        <p className="roll-note warn">Mead rolled 11, a pass number. The dice go to wine.</p>
      </section>

      <section>
        <h2>Ledger <code>&lt;Ledger&gt;</code></h2>
        <div style={{ maxWidth: 310 }}><Ledger s={s} /></div>
      </section>

      <section>
        <h2>Game panel <code>&lt;GamePanel&gt;</code></h2>
        <div style={{ maxWidth: 310 }}>
          <GamePanel settings={settings} change={p => setSettings(st => ({ ...st, ...p }))} newGame={() => setSettings(DEFAULT_SETTINGS)}
            hints={hints} toggleHints={() => setHints(h => !h)} />
        </div>
      </section>

      <section>
        <h2>Roll log <code>&lt;RollLog&gt;</code></h2>
        <div style={{ maxWidth: 310 }}><RollLog log={mid.log} /></div>
        <div style={{ maxWidth: 310 }}><RollLog log={[]} /></div>
      </section>

      <section>
        <h2>Rules <code>&lt;RulesPanel&gt;</code></h2>
        <div style={{ maxWidth: 360 }}><RulesPanel /></div>
      </section>
    </div></GameScope>
  );
}
