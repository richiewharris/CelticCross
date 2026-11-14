//   npx tsx sim/roth/review.ts records.json <record id>
// Review one match record: replay it under its build's rules, narrate every move, and set each of the player's
// choices beside what the Skilled and Expert computer players would choose in the same position.
import { readFileSync } from "node:fs";
import { ALL_DEFS, type CardDef } from "../../src/games/roth/engine/cards";
import { applyDecision, cloneState, newMatch, nextDecision, observe, NARRATE, type Side } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { Rng } from "../../src/games/roth/engine/rng";
import { logLine, optionLabel } from "../../src/games/roth/text";
const RULES: Record<string, Record<string, number>> = {
  "670b6ca": { "rule.reckoning": 0, "setting.afterMarshalling": 0, "rule.supportsFaceDown": 0 },
  "49ede9d": { "rule.reckoning": 0, "setting.afterMarshalling": 0, "rule.supportsFaceDown": 0, "people.ulster.fury": 0, "people.sluagh.dreams": 1, "people.fomoire.roundDown": 0 },
};
const recs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rec = recs.find((r: any) => r.id === process.argv[3]).data;
const m = rec.match, me = m.me as Side;
const deck = (ids: string[]) => ids.map((id) => ALL_DEFS[id] as CardDef);
const S = newMatch([deck(m.decks.first), deck(m.decks.second)], { params: RULES[rec.build] }, m.seed, true);
const sk = makePolicy("skilled"), ex = makePolicy("expert");
let n = 0;
for (const i of m.moves as number[]) {
  const d = nextDecision(S)!;
  let note = "";
  if (d.player === me && d.options.length > 1 && d.kind !== "muster") {
    const V = observe(S, me);
    const a = sk.choose(cloneState(V), d, new Rng(n + 1)), b = d.kind === "place" || d.kind === "action" ? ex.choose(cloneState(V), d, new Rng(n + 7)) : a;
    const lab = (k: number) => optionLabel(S, d, d.options[k], me);
    note = a === i && b === i ? "   [Skilled and Expert agree]" : `   [Skilled: ${a === i ? "same" : lab(a)}${b !== a ? `; Expert: ${b === i ? "same" : lab(b)}` : ""}]`;
  }
  const line = logLine(S, d, d.options[i], me);
  const lines: string[] = []; NARRATE.lines = lines;
  applyDecision(S, d, i, false);
  NARRATE.lines = null;
  const C = S.combat;
  const vs = C && S.phase === "combat" ? `  {V ${C.valour[me]}/${C.valour[1 - me]} sh ${C.shield[me]}/${C.shield[1 - me]}}` : "";
  console.log(`${String(n).padStart(3)} ${d.kind.padEnd(10)} ${line}${note}${vs}`);
  if (lines.length && (d.kind === "duel" || d.kind === "drawn" || d.kind === "block" || d.kind === "action")) console.log("        " + lines.join(" ").slice(0, 600));
  n++;
}
nextDecision(S);
console.log("setting:", S.rules.setting, "result:", JSON.stringify(S.result), "recorded:", JSON.stringify(m.result));
