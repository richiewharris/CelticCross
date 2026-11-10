// Finds a good teaching game for the guided walkthrough: Ulster starter (you, first) against the Connacht starter,
// both played at Skilled, and keeps the seed whose game shows the most of the rules (a geis, an oath, an omen, a
// supplant, Shields, Heals, the wheel and weaknesses, draws played and put aside, a support used again, a final
// duel) in a game short enough to read, and that Ulster wins on heroes felled. Writes the picks to
// src/games/roth/walkthrough/script.json.   npx tsx sim/roth/walkgen.ts [--tries 200]
import { writeFileSync } from "node:fs";
import { DECKS } from "../../src/games/roth/engine/cards";
import { applyDecision, newMatch, nextDecision, observe, NARRATE } from "../../src/games/roth/engine/engine";
import { CasualPolicy, makePolicy } from "../../src/games/roth/engine/ai";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

const tries = Number(process.argv[process.argv.indexOf("--tries") + 1]) || 200;
let best: { score: number; seed: number; picks: number[]; why: string[] } | null = null;
for (let t = 1; t <= tries; t++) {
  const seed = hashSeed(777, t);
  const S = newMatch([DECKS.ulster, DECKS.connacht], {}, seed, false);
  const pols = [makePolicy("skilled"), makePolicy("skilled")];
  const rngs = [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))];
  // the Muster as the guided game replays it: both sides keep what they draw
  const keeper = new CasualPolicy(), krng = new Rng(1);
  for (let d = nextDecision(S); d && S.phase === "muster"; d = nextDecision(S)) applyDecision(S, d, keeper.choose(S, d, krng));
  const picks: number[] = [];
  const seen = new Set<string>();
  let duelActs = 0;
  for (;;) {
    const d = nextDecision(S);
    if (!d) break;
    const i = d.options.length === 1 ? 0 : pols[d.player].choose(observe(S, d.player), d, rngs[d.player]);
    picks.push(i);
    const o = d.options[i];
    seen.add(`${o.t}${d.player}`);
    if (o.t === "drawn") seen.add(`drawn-${o.how}`);
    if (o.t === "duel" && o.act === "use" && S.combat && S.combat.uses[o.spot] > 0) seen.add("reuse");
    if (o.t === "duel" || o.t === "draw" || o.t === "duelCard") { duelActs++; if (o.t === "duel" && o.mode === "break") seen.add("break"); }
    NARRATE.lines = [];
    applyDecision(S, d, i);
    const txt = NARRATE.lines.join(" ");
    NARRATE.lines = null;
    for (const k of ["weakness", "the wheel", "Focus", "Shield soaks", "heals", "kinship", "first Strike against it", "blocks with", "Armour", "rests and braces", "rested"]) if (txt.includes(k)) seen.add(k);
  }
  const r = S.result!;
  if (r.tiebreak || r.winner !== 0 || r.decidedBy !== "felled") continue;
  if (S.combat!.startV[2][0] || S.combat!.startV[2][1]) seen.add("final");
  const want = ["bind0", "swear0", "omen0", "omen1", "supplant0", "supplant1", "weakness", "the wheel", "Focus", "Shield soaks", "heals", "draw0", "draw1", "drawn-play", "drawn-discard", "duelCard0", "reuse", "final", "break", "blocks with", "Armour", "rests and braces", "rested"];
  const got = want.filter((k) => seen.has(k));
  // a whole game, but one a person can read through: not too long
  // the new defence is worth showing above all: a block, Armour, a braced rest
  const score = got.length + 2 * got.filter((k) => ["blocks with", "Armour", "rests and braces", "rested"].includes(k)).length - Math.max(0, duelActs - 60) / 5;
  if (!best || score > best.score) best = { score, seed, picks, why: got };
}
if (!best) throw new Error("no game found");
console.log(`seed ${best.seed} score ${best.score.toFixed(2)}: ${best.why.join(", ")}; ${best.picks.length} moves`);
writeFileSync(new URL("../../src/games/roth/walkthrough/script.json", import.meta.url), JSON.stringify({ seed: best.seed, you: "ulster", them: "connacht", picks: best.picks }) + "\n");
