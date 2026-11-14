// The match bar: during a match it takes the place of the page header. Where the match is (a track of its parts),
// the match's own buttons, and one line saying what is before you now (facts only: never what a choice would do).
import { param } from "../engine/params";
import { settingDef } from "../engine/settings";
import { facedSpot, isHeroSpot, needsSetting, quadOf, type Decision, type Side, type State } from "../engine/engine";
import { seatName } from "../text";
import type { DuelEnd } from "../useMatch";

type Part = { key: string; label: string };

/** The parts of this match, in order. */
function parts(S: State): Part[] {
  const out: Part[] = [{ key: "muster", label: "Muster" }, { key: "draft", label: "Marshalling" }];
  if (param(S.rules, "setting.choose") > 0 && param(S.rules, "setting.afterMarshalling") > 0) out.push({ key: "setting", label: "Setting" });
  if (param(S.rules, "rule.reckoning") > 0) out.push({ key: "reckon", label: "Reckoning" });
  out.push({ key: "play", label: S.reversed ? "Backwards round" : "The Winnow" });
  if (S.rules.keepOmensUntilCombat) out.push({ key: "late", label: "Last omens" });
  const where = settingDef(S.rules.setting)?.name;
  out.push({ key: "combat", label: `The duels${where ? ` · ${where.replace(/^The /, "the ")}` : ""}` });
  return out;
}
/** Which part the match is in now. */
function partNow(S: State): string {
  if (S.phase !== "muster" && needsSetting(S) && S.settingDue) return "setting";
  if (S.phase === "end") return "end";
  return S.phase;
}

const name = (S: State, spot: number) => S.board[spot]?.def.type === "unknown" ? "a face-down card" : S.board[spot]?.def.name ?? "an empty seat";
const enemyHeroOf = (spot: number) => { const q = quadOf(spot); return (q < 2 ? q + 2 : q - 2) * 3; };
const duelOfQuad = (q: number) => (q % 2 === 0 ? "first duel" : "second duel");

/** One line: what is before you now, and what happens next. */
export function objective(S: State, d: Decision | null, me: Side, myTurn: boolean, pause: DuelEnd | null): string {
  if (pause) return pause.next ?? "Press Continue when you have seen it.";
  if (S.phase === "end" || !d) return S.result ? "The match is over." : "";
  const them = "The computer";
  if (d.kind === "setting") return d.player === me
    ? "Every hero is on the wheel. You are the second player: choose where the duels are fought."
    : `${them} is the second player, and is choosing where the duels are fought.`;
  switch (S.phase) {
    case "muster": return myTurn
      ? `Split your deck in two. Your hand (up to ${S.rules.handSize}) is what you put on the wheel and play before the duels; the Reserve is what you draw from in them. Omens wait face down.`
      : `${them} is mustering.`;
    case "draft": return myTurn
      ? `Marshalling, step ${S.step} of 6: place a ${isHeroSpot(d.spot!) ? "hero" : "support"} as ${seatName(S, d.spot!, me)}. ${isHeroSpot(d.spot!) ? "Heroes go down face up." : "Supports go down face down until the Winnow."}`
      : `${them} is placing a card as ${seatName(S, d.spot!, me)}.`;
    case "reckon": return myTurn
      ? "Both wheels are whole. Swap two of your own cards of a kind, or keep your wheel; the computer chooses at the same time, in secret."
      : `${them} is choosing its change, in secret.`;
    case "play": case "late": {
      if (d.kind !== "action") return myTurn ? "Turn any omens before the duels." : `${them} is turning omens.`;
      const spot = facedSpot(S.step, me, S.reversed);
      const q = quadOf(spot);
      const mine = S.board[enemyHeroOf(spot)];
      const meets = isHeroSpot(spot) && mine ? ` It meets your ${mine.def.name} in the ${duelOfQuad(q)}.` : ` It fights in the ${duelOfQuad(q)}.`;
      return myTurn
        ? `The Winnow, step ${S.step} of 6: before you, ${name(S, spot)}, ${seatName(S, spot, me)}.${meets} Take one action; then the wheel turns.`
        : `The Winnow, step ${S.step} of 6: ${them.toLowerCase()} is acting.`;
    }
    case "combat": {
      const C = S.combat!;
      const which = C.duel === 2 ? "The final duel" : `Duel ${C.duel + 1}`;
      const H = (p: Side) => S.board[C.hs[p]]?.def.name ?? "?";
      return `${which}, turn ${C.turn + 1}: your ${H(me)} against their ${H((1 - me) as Side)}. ${myTurn ? "Your turn: choose one." : `${them} is acting.`}`;
    }
  }
  return "";
}

export function MatchBar(props: {
  S: State; d: Decision | null; me: Side; myTurn: boolean; thinking: boolean; over: boolean; pause: DuelEnd | null;
  canUndo: boolean; onUndo: () => void; ending: boolean; setEnding: (b: boolean) => void; onQuit: () => void; onMenu: () => void;
}) {
  const { S } = props;
  const ps = parts(S), now = partNow(S);
  const at = ps.findIndex((x) => x.key === (now === "late" && !ps.some((y) => y.key === "late") ? "play" : now));
  const goal = objective(S, props.d, props.me, props.myTurn, props.pause);
  return (
    <div className="match-bar">
      <div className="mb-top">
        <span className="mb-title">Roth Catha</span>
        <ol className="mb-track" aria-label="Match progress">
          {ps.map((x, i) => {
            const done = props.over || (at >= 0 && i < at), cur = !props.over && i === at;
            const step = x.key === "play" && cur && S.phase === "play" ? ` · ${Math.min(S.step, 6)} of 6` : x.key === "draft" && cur ? ` · ${S.step} of 6` : x.key === "combat" && cur && S.combat ? ` · ${S.combat.duel === 2 ? "final" : `duel ${S.combat.duel + 1}`}` : "";
            return <li key={x.key} className={done ? "done" : cur ? "now" : ""} aria-current={cur ? "step" : undefined}>{x.label}{step}{done ? " ✓" : ""}</li>;
          })}
        </ol>
        <div className="mb-tools">
          <button type="button" className="btn small" disabled={!props.canUndo} onClick={() => { props.setEnding(false); props.onUndo(); }} title="Take back your last move (and the computer's reply)">↶ Take back</button>
          {props.over ? null : props.ending ? (
            <>
              <button type="button" className="btn small danger" onClick={() => { props.setEnding(false); props.onQuit(); }}>End it, no result</button>
              <button type="button" className="btn small" onClick={() => props.setEnding(false)}>Keep playing</button>
            </>
          ) : <button type="button" className="btn small" onClick={() => props.setEnding(true)}>End match</button>}
          <button type="button" className="btn small" onClick={props.onMenu}>Menu</button>
        </div>
      </div>
      <div className="mb-goal" role="status" aria-live="polite">
        <span className="mb-who">{props.over ? "The result" : props.pause ? props.pause.title : props.myTurn ? "Your move" : props.thinking ? "The computer" : "…"}</span>
        <p>{goal}</p>
      </div>
    </div>
  );
}
