// The ledger beside the box: turns (or moves) left, skill, and the lock tier. Shared by both versions.
import { useId } from "react";
import { rank, TIER_IDS, type Profile, type TierId } from "../engine/knot";

const TIER_NAMES: Record<TierId, string> = { 1: "Iron", 2: "Bronze", 3: "Silver", 4: "Gold", 5: "Ogham" };

/** Diamond pips, one per turn; over `meterOver` turns a bar instead. */
export function TurnsPanel(p: { label: string; left: number; budget: number; line: string; meterOver?: number }) {
  return (
    <div className="panel">
      <p className="label">{p.label}</p>
      <div className="pips" aria-hidden="true">
        {p.meterOver !== undefined && p.budget > p.meterOver
          ? <div className="meter" style={{ flex: 1 }}><i style={{ width: `${(100 * p.left / p.budget).toFixed(1)}%` }} /></div>
          : Array.from({ length: p.budget }, (_, k) => <span key={k} className={`pip${k < p.left ? " on" : ""}`} />)}
      </div>
      <p className="moves-line">{p.line}</p>
    </div>
  );
}

export function SkillPanel({ profile: P }: { profile: Profile }) {
  return (
    <div className="panel">
      <p className="label">Skill</p>
      <div className="big">{P.skill}<small>{rank(P.skill)}</small></div>
      <div className="meter" aria-hidden="true"><i style={{ width: P.skill + "%" }} /></div>
      <p className="stats">{`${P.opened} lock${P.opened === 1 ? "" : "s"} opened · ${P.attempts} attempt${P.attempts === 1 ? "" : "s"}`}</p>
    </div>
  );
}

/** The five lock tiers as a radio group, in the original's own markup so its styles apply. */
export function TierPanel(p: { tier: TierId; desc: string; onChange: (t: TierId) => void }) {
  const name = useId();
  return (
    <div className="panel">
      <p className="label">Lock</p>
      <div className="tiers" role="radiogroup" aria-label="Lock difficulty">
        {TIER_IDS.map(t => [
          <input key={`i${t}`} type="radio" name={name} id={`${name}-t${t}`} value={t} checked={p.tier === t} onChange={() => p.onChange(t)} />,
          <label key={`l${t}`} htmlFor={`${name}-t${t}`}>{TIER_NAMES[t]}</label>,
        ])}
      </div>
      <p className="tier-desc">{p.desc}</p>
    </div>
  );
}
