// What just happened in the duel, where you can see it: a card fixed on screen (so on a phone nothing needs
// scrolling) with every move since your last one, what each changed, and where both fighters stand now.
// It stays until you act or close it; a small button brings it back.
import { useEffect, useState } from "react";
import { fighter, type Side, type State } from "../engine/engine";
import type { MoveEvent } from "../useMatch";

/** "Balor 5 → 2 · Shield 3 → 0" as parts, each with its change: −3 (a wound), +2 (a heal), Shield +1. */
function changes(fx: string): { text: string; delta: number | null; shield: boolean; felled: boolean }[] {
  return fx.split(" · ").map((b) => {
    const m = b.match(/^(.*?)(-?\d+) → (-?\d+)(, felled)?$/);
    if (!m) return { text: b, delta: null, shield: false, felled: false };
    const [, who, x, y, fell] = m;
    return { text: `${who}${x} → ${y}`, delta: Number(y) - Number(x), shield: /Shield/.test(who), felled: !!fell };
  });
}

export function DuelToast(props: { S: State; me: Side; last: MoveEvent[]; show: boolean }) {
  const { S, me, last } = props;
  // the moves since your last one (yours included, so you see what it did)
  let from = last.length - 1;
  while (from > 0 && !last[from].mine) from--;
  const shown = last.slice(Math.max(0, from));
  const key = shown.length ? shown[shown.length - 1].n : -1;
  const [closed, setClosed] = useState<number | null>(null);
  useEffect(() => { setClosed(null); }, [key]);
  const C = S.combat;
  if (!props.show || !shown.length || !C) return null;
  if (closed === key) {
    return <button type="button" className="toast-reopen btn small" onClick={() => setClosed(null)}>What happened ▸</button>;
  }
  const now = ([me, (1 - me) as Side] as Side[]).map((p) => {
    const done = C.stage === "done";
    const v = done ? C.endValour[C.duel][p] : Math.max(0, C.valour[p]);
    const sh = done ? 0 : C.shield[p];
    const fell = done ? C.felled[C.duel][p] : C.valour[p] <= 0;
    return { p, name: fighter(S, C, p).name, v, sh, fell };
  });
  return (
    <div className="duel-toast" role="status" aria-live="polite" aria-label="What just happened">
      <button type="button" className="toast-x" aria-label="Close" onClick={() => setClosed(key)}>✕</button>
      <ol>
        {shown.map((e) => (
          <li key={e.n} className={e.mine ? "mine" : "theirs"}>
            <span className="who">{e.mine ? "You" : "Computer"}</span>
            <span className="what">{e.text.replace(/^(You|The computer): /, "").replace(/^(You|The computer) (\w)/, (_m, _w, c: string) => c.toUpperCase())}</span>
            {e.fx && e.fx !== "no change" ? (
              <span className="fx">
                {changes(e.fx).map((c, i) => (
                  <span key={i} className={`chg${c.delta === null ? "" : c.shield ? " shield" : c.delta < 0 ? " hurt" : c.delta > 0 ? " heal" : ""}`}>
                    {c.text}{c.delta ? <b> {c.delta > 0 ? "+" : "−"}{Math.abs(c.delta)}{c.shield ? " Shield" : ""}</b> : null}{c.felled ? <b className="fell"> felled</b> : null}
                  </span>
                ))}
              </span>
            ) : e.fx === "no change" ? <span className="fx quiet">no change</span> : null}
          </li>
        ))}
      </ol>
      <p className="now">
        {now.map((f, i) => (
          <span key={f.p} className={f.p === me ? "mine" : "theirs"}>
            {i ? " · " : ""}{f.p === me ? "Your" : "Their"} {f.name}: {f.fell ? "felled" : <>Valour <b>{f.v}</b>{f.sh ? <>, Shield <b>{f.sh}</b></> : null}</>}
          </span>
        ))}
      </p>
    </div>
  );
}
