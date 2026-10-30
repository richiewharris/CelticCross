// One player's three dice, as buttons, with the coach's odds under each when it's on.
import { DICE, bit, type Die } from "../engine/dice";
import { DieArt, HAND_FACE } from "./DieArt";

export function Hand(props: {
  side: "you" | "rival"; name: string; note: string;
  /** The hand as a bit set; a forced die shows as live even though it's spent. */
  hand: number; forced: number;
  /** A die showing a three not yet counted: it can be rerolled, or the three kept. -1 if none. */
  held?: number;
  keepOdds?: number | null;
  onKeep?: () => void;
  /** This hand's player may roll now. */
  active: boolean;
  /** Odds per die (null: none shown); undefined: this hand has no odds line at all (the computer's). */
  odds?: (number | null)[];
  onRoll: (d: Die) => void;
}) {
  const { hand, forced, active, odds } = props;
  let best = -1;
  if (odds) { let bv = -1; odds.forEach((o, d) => { if (o != null && o > bv) { bv = o; best = d; } }); }
  return (
    <div className={`hand ${props.side}`} id={props.side === "you" ? "youHand" : "rivalHand"}>
      <div className="hand-head"><span className={`who ${props.side}`}>{props.name}</span><span className="note">{props.note}</span></div>
      <div className="dice">
        {([0, 1, 2] as Die[]).map(d => {
          const held = props.held ?? -1;
          const has = !!(hand & bit(d)), forcedHere = active && forced === d, heldHere = active && held === d;
          const can = active && (held >= 0 ? heldHere : forced >= 0 ? forcedHere : has);
          const o = odds?.[d] ?? null;
          return (
            <button key={d} type="button" className={`die-btn${has || forcedHere || heldHere ? "" : " spent"}${heldHere ? " again" : ""}${best === d && can ? " best" : ""}`} disabled={!can}
              aria-label={`${DICE[d].name}, ${DICE[d].range}${heldHere ? ", reroll it to replace the three" : has ? "" : ", already rolled"}${o != null ? `, ${Math.round(o * 100)}% chance to take the round` : ""}`}
              onClick={() => props.onRoll(d)}>
              <svg viewBox="-72 -52 144 108" aria-hidden="true"><DieArt d={d} value={HAND_FACE[d]} /></svg>
              <span className="nm">{DICE[d].name}</span><span className="rg">{heldHere ? "reroll" : DICE[d].range}</span>
              {odds ? <span className="odds">{o != null ? `${Math.round(o * 100)}% to win` : ""}</span> : null}
            </button>
          );
        })}
      </div>
      {active && (props.held ?? -1) >= 0 && props.onKeep ? (
        <button type="button" className={`keep-btn${props.keepOdds != null && odds && props.keepOdds > (odds[props.held!] ?? -1) ? " best" : ""}`} onClick={props.onKeep}>
          <span className="kl">Keep the 3</span>{props.keepOdds != null ? <span className="odds">{Math.round(props.keepOdds * 100)}% to win</span> : null}
        </button>
      ) : null}
    </div>
  );
}
