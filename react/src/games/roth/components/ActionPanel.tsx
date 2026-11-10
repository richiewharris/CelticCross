// Your choices, grouped by what they do. Tap a row (or the card or spot on the table) to pick it and see what it
// would do; a target is a second step; a guest's heal is one switch, not a second copy of every row. Only the named
// button (or a second tap on the same row, or Enter) commits.
import { useEffect, useMemo } from "react";
import { useStoredState } from "../../../kit/useStoredState";
import { cardName, optionLabel } from "../text";
import type { Decision, Option, State } from "../engine/engine";
import { previewOf, prompt } from "./Choices";

export interface Pick { key: string | null; target: number | null; guest: number }
export const NO_PICK: Pick = { key: null, target: null, guest: -1 };

interface Variant { i: number; target?: number; guest: number }
export interface Act { key: string; group: string; label: string; variants: Variant[]; uid?: number; spot?: number }

const END = "_end";
const ORDER = ["Block", "Fight", "Drawn card", "Omens", "Geis & oath", "Supplant", "Champions", "Attendants", "Focus"];

function keyOf(o: Option): string {
  switch (o.t) {
    case "duel": return `duel:${o.act}:${o.spot}:${o.mode}:${o.as ?? ""}:${o.aim ?? ""}`;
    case "drawn": return `drawn:${o.how}:${o.mode ?? ""}:${o.as ?? ""}:${o.aim ?? ""}`;
    case "focus": return `focus:${o.el ?? ""}`;
    case "sacrifice": case "summon": return `${o.t}:${o.id}`;
    case "draw": case "hold": case "lateDone": return o.t;
    case "block": return `block:${o.spot}`;
    default: return `${o.t}:${(o as { uid: number }).uid}`;
  }
}
function groupOf(S: State, d: Decision, o: Option): string {
  switch (o.t) {
    case "duel": case "draw": return "Fight";
    case "drawn": return "Drawn card";
    case "block": return o.spot < 0 ? END : "Block";
    case "duelCard": return S.players[d.player].omens.some((x) => x.card.uid === o.uid) ? "Omens" : "Geis & oath";
    case "champion": case "sacrifice": case "summon": return "Champions";
    case "omen": case "late": return "Omens";
    case "bind": case "swear": return "Geis & oath";
    case "supplant": return "Supplant";
    case "attend": return "Attendants";
    case "focus": return "Focus";
    default: return END;
  }
}
const targetOf = (o: Option): number | undefined =>
  o.t === "swear" ? o.spot : o.t === "omen" || o.t === "late" || o.t === "duelCard" || o.t === "drawn" ? o.target : undefined;

/** The decision's options, folded into one row per action. */
export function buildActs(S: State, d: Decision): Act[] {
  const by = new Map<string, Act>();
  d.options.forEach((o, i) => {
    const key = keyOf(o);
    let a = by.get(key);
    if (!a) {
      a = { key, group: groupOf(S, d, o), label: "", variants: [], uid: "uid" in o ? (o as { uid: number }).uid : undefined, spot: o.t === "duel" && o.act === "use" ? o.spot : undefined };
      by.set(key, a);
    }
    a.variants.push({ i, target: targetOf(o), guest: o.t === "duel" ? o.guest : -1 });
  });
  for (const a of by.values()) {
    const rep = a.variants.find((v) => v.guest < 0) ?? a.variants[0];
    const o = d.options[rep.i];
    a.label = o.t === "swear" ? `Swear ${cardName(S, o.uid)}`
      : targetOf(o) !== undefined && new Set(a.variants.map((v) => v.target)).size > 1 ? optionLabel(S, d, { ...o, target: undefined } as Option)
      : optionLabel(S, d, o);
  }
  return [...by.values()];
}

/** The one option a pick comes to, or null if it still needs a target. */
export function resolvePick(acts: Act[], p: Pick): number | null {
  const a = acts.find((x) => x.key === p.key);
  if (!a) return null;
  const targets = [...new Set(a.variants.map((v) => v.target))];
  const t = targets.length > 1 ? p.target : targets[0];
  if (targets.length > 1 && (t === null || t === undefined)) return null;
  const ok = a.variants.filter((v) => v.target === t);
  return (ok.find((v) => v.guest === p.guest) ?? ok.find((v) => v.guest < 0) ?? ok[0])?.i ?? null;
}

export function ActionPanel(props: {
  S: State; d: Decision; pick: Pick; group: string | null;
  onPick: (p: Pick) => void; onGroup: (g: string) => void; onCommit: (i: number) => void;
}) {
  const { S, d, pick } = props;
  const [folded, setFolded] = useStoredState<boolean>("roth-react-panel-folded", false);
  const acts = useMemo(() => buildActs(S, d), [S, d]);
  const groups = ORDER.filter((g) => acts.some((a) => a.group === g));
  const ends = acts.filter((a) => a.group === END);
  const sel = acts.find((a) => a.key === pick.key) ?? null;
  const group = sel && sel.group !== END ? sel.group : props.group && groups.includes(props.group) ? props.group : groups[0] ?? null;
  const rows = acts.filter((a) => a.group === group);
  const guests = useMemo(() => [...new Set(d.options.flatMap((o) => (o.t === "duel" && o.guest >= 0 ? [o.guest] : [])))], [d]);
  const resolved = resolvePick(acts, pick);
  const targets = sel ? [...new Set(sel.variants.map((v) => v.target))].filter((t): t is number => t !== undefined) : [];
  const previewFor = (a: Act) => {
    const i = resolvePick(acts, { key: a.key, target: a === sel ? pick.target : null, guest: pick.guest });
    return i === null ? (targets.length > 1 && a === sel ? "choose a target" : null) : previewOf(S, d, i);
  };
  const choose = (a: Act) => {
    if (a.key === pick.key && resolved !== null) { props.onCommit(resolved); return; } // a second tap commits
    const ts = [...new Set(a.variants.map((v) => v.target))];
    props.onPick({ key: a.key, target: ts.length === 1 ? (ts[0] ?? null) : null, guest: pick.guest });
  };

  // keys: 1–9 pick in the group, Enter commits, Esc clears, ←/→ change group, G changes the guest
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 9 && rows[k - 1]) { e.preventDefault(); choose(rows[k - 1]); }
      else if (e.key === "Enter" && resolved !== null && !(e.target as HTMLElement)?.closest?.("button")) { e.preventDefault(); props.onCommit(resolved); }
      else if (e.key === "Escape") props.onPick({ ...NO_PICK, guest: pick.guest });
      else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && groups.length > 1 && group) {
        const j = (groups.indexOf(group) + (e.key === "ArrowRight" ? 1 : groups.length - 1)) % groups.length;
        props.onPick({ ...NO_PICK, guest: pick.guest }); props.onGroup(groups[j]);
      } else if ((e.key === "g" || e.key === "G") && guests.length) {
        const all = [-1, ...guests];
        props.onPick({ ...pick, guest: all[(all.indexOf(pick.guest) + 1) % all.length] });
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const short = d.kind === "duel" ? (S.combat?.drew ? "You put the drawn card aside: choose something else." : "Your turn: choose one.") : prompt(S, d);
  return (
    <div className={`actions${folded ? " folded" : ""}`} aria-label="Your choices">
      <div className="act-head">
        <p className="prompt">{short}</p>
        <button type="button" className="btn quiet small act-fold" aria-expanded={!folded} onClick={() => setFolded(!folded)}>{folded ? "Show choices ▴" : "Hide ▾"}</button>
      </div>
      {groups.length > 1 ? (
        <div className="act-tabs" role="tablist" aria-label="Kinds of action">
          {groups.map((g) => {
            const n = acts.filter((a) => a.group === g).length;
            return <button key={g} type="button" role="tab" aria-selected={g === group} className={`act-tab${g === group ? " cur" : ""}`} onClick={() => { props.onGroup(g); if (sel && sel.group !== g) props.onPick({ ...NO_PICK, guest: pick.guest }); }}>{g} <span className="count">{n}</span></button>;
          })}
        </div>
      ) : null}
      <div className="act-rows" role="listbox" aria-label={group ?? "Choices"}>
        {rows.map((a, k) => {
          const on = a.key === pick.key;
          const pv = previewFor(a);
          return (
            <button key={a.key} type="button" role="option" aria-selected={on} className={`act-row${on ? " on" : ""}`} onClick={() => choose(a)}>
              {k < 9 ? <kbd className="choice-key" aria-hidden="true">{k + 1}</kbd> : null}
              <span className="choice-txt">{a.label}{pv ? <small className="choice-preview">{pv}</small> : null}</span>
            </button>
          );
        })}
      </div>
      {sel && targets.length > 1 ? (
        <div className="act-targets" role="radiogroup" aria-label="Target">
          <span className="zone-label">On which hero?</span>
          {targets.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={pick.target === t} className={`btn small${pick.target === t ? " primary" : ""}`} onClick={() => props.onPick({ ...pick, target: t })}>
              {S.board[t]?.def.name ?? `spot ${t + 1}`} <small>(spot {t + 1})</small>
            </button>
          ))}
        </div>
      ) : null}
      {guests.length ? (
        <div className="act-guest" role="radiogroup" aria-label="A guest heals 1 first">
          <span className="zone-label">Guest heals 1 first</span>
          {[-1, ...guests].map((g) => (
            <button key={g} type="button" role="radio" aria-checked={pick.guest === g} className={`btn small${pick.guest === g ? " primary" : ""}`} onClick={() => props.onPick({ ...pick, guest: g })}>
              {g < 0 ? "No guest" : cardName(S, g)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="act-commit">
        {ends.map((a) => <button key={a.key} type="button" className="btn quiet" onClick={() => props.onCommit(a.variants[0].i)}>{a.label}</button>)}
        <button type="button" className="btn primary act-go" disabled={resolved === null} onClick={() => resolved !== null && props.onCommit(resolved)}>
          {resolved !== null ? optionLabel(S, d, d.options[resolved]) : sel ? "Choose a target" : "Choose an action"}
        </button>
      </div>
    </div>
  );
}
