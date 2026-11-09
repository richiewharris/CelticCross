// Human-readable trace of one match (for eyeballing the rules): npx tsx sim/roth/run.ts --trace [--seed N]

import type { SupportDef } from "./cards";
import {
  applyDecision, heroAt, nextDecision, observe,
  type Decision, type Option, type Policy, type State,
} from "./engine";
import { Rng } from "./rng";

function cardName(S: State, uid: number): string {
  for (const P of S.players) {
    for (const z of [P.hand, P.reserve, P.discard, P.deck, P.lost]) for (const c of z) if (c.uid === uid) return c.def.name;
    for (const o of P.omens) if (o.card.uid === uid) return o.card.def.name;
  }
  if (S.pendingOmen?.uid === uid) return S.pendingOmen.def.name;
  for (const c of S.board) if (c?.uid === uid) return c.def.name;
  if (S.combat) for (const g of S.combat.guests) for (const c of g) if (c.uid === uid) return c.def.name;
  return `#${uid}`;
}

export function describe(S: State, d: Decision, o: Option): string {
  const who = `P${d.player + 1}`;
  switch (o.t) {
    case "musterOmen": return `${who} muster: ${cardName(S, o.uid)} to Reserve`;
    case "musterReturn": return `${who} muster check: ${cardName(S, o.uid)} to Reserve`;
    case "place": return `${who} places ${cardName(S, o.uid)} at spot ${d.spot! + 1}`;
    case "omen": return `${who} (facing ${d.spot! + 1}) turns omen ${cardName(S, o.uid)}`;
    case "bind": return `${who} binds hero at ${d.spot! + 1} with ${cardName(S, o.uid)}`;
    case "supplant": return `${who} supplants ${S.board[d.spot!]!.def.name} at ${d.spot! + 1} with ${cardName(S, o.uid)}`;
    case "hold": return `${who} holds (facing ${d.spot! + 1})`;
    case "late": return `${who} turns omen ${cardName(S, o.uid)} before combat`;
    case "lateDone": return `${who} done turning omens`;
    case "focus": return `${who}'s Morrígan Focus -> ${o.el ?? "unchanged"}`;
    case "duel": {
      const C = S.combat!;
      const h = heroAt(S, C.hs[d.player]);
      const g = o.guest >= 0 ? ` [guest ${cardName(S, o.guest)} heals 1]` : "";
      const m = o.mode === "break" ? " (breaks geis)" : o.mode === "ignore" ? " (Cathbad: ignores geis)" : "";
      const act = o.act === "rest" ? "rests" : `uses ${(S.board[o.spot]!.def as SupportDef).name}`;
      return `${who} ${h.name} [V${C.valour[0]}/${C.valour[1]} Sh${C.shield[0]}/${C.shield[1]}]${g} ${act}${m}`;
    }
  }
}

export function traceMatch(S: State, policies: [Policy, Policy], rngs: [Rng, Rng]): string[] {
  const out: string[] = [];
  let lastPhase = "";
  for (;;) {
    const d = nextDecision(S);
    if (S.phase !== lastPhase) {
      lastPhase = S.phase;
      if (S.phase === "combat" || S.phase === "end") {
        out.push(`-- board: ${S.board.map((c, i) => `${i + 1}:${c?.def.name ?? "-"}`).join(" | ")}`);
        out.push(`-- geasa: ${S.quadGeis.map((g, q) => `Q${q + 1}:${g?.def.name ?? "-"}`).join(" ")}`);
        out.push(`-- omens up: P1 ${S.players[0].omens.filter((o) => o.faceUp).map((o) => o.card.def.name).join(", ") || "-"}; P2 ${S.players[1].omens.filter((o) => o.faceUp).map((o) => o.card.def.name).join(", ") || "-"}`);
      }
      out.push(`== ${S.phase}`);
    }
    if (!d) break;
    const i = d.options.length === 1 ? 0 : policies[d.player].choose(observe(S, d.player), d, rngs[d.player]);
    const duelBefore = S.combat?.duel;
    out.push("  " + describe(S, d, d.options[i]));
    applyDecision(S, d, i);
    if (S.combat && duelBefore !== undefined && (S.combat.duel !== duelBefore || S.combat.stage === "done")) {
      const C = S.combat;
      out.push(`  -> duel ${duelBefore + 1} ends: valour ${C.endValour[duelBefore].join("/")}, felled ${C.felled[duelBefore].map((f) => (f ? "yes" : "no")).join("/")}`);
    }
  }
  const r = S.result!;
  out.push(`Result: ${r.winner === -1 ? "draw" : `P${r.winner + 1} wins`} by ${r.decidedBy}; felled P1 ${r.felled[0]} P2 ${r.felled[1]}; standing valour ${r.valour.join("/")}`);
  return out;
}
