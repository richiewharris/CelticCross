// Finds a good teaching game for the guided walkthrough: Ulster starter (you, first) against the Connacht starter,
// both played at Skilled, and keeps the seed whose game shows the most of the rules (a geis, an oath, an omen, a
// supplant, Shields, Heals, the wheel and weaknesses, a hero felled) and ends cleanly. Writes the picks to
// src/games/roth/walkthrough/script.json.   npx tsx sim/roth/walkgen.ts [--tries 200]
import { writeFileSync } from "node:fs";
import { DECKS } from "../../src/games/roth/engine/cards";
import { applyDecision, newMatch, nextDecision, observe, NARRATE } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

const tries = Number(process.argv[process.argv.indexOf("--tries") + 1]) || 200;
let best: { score: number; seed: number; picks: number[]; why: string[] } | null = null;
for (let t = 1; t <= tries; t++) {
  const seed = hashSeed(777, t);
  const S = newMatch([DECKS.ulster, DECKS.connacht], {}, seed, false);
  const pols = [makePolicy("skilled"), makePolicy("skilled")];
  const rngs = [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))];
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
    if (o.t === "duel") { duelActs++; if (o.mode === "break") seen.add("break"); }
    NARRATE.lines = [];
    applyDecision(S, d, i);
    const txt = NARRATE.lines.join(" ");
    NARRATE.lines = null;
    for (const k of ["weakness", "the wheel", "Focus", "Shield soaks", "heals", "kinship", "first Strike against it"]) if (txt.includes(k)) seen.add(k);
  }
  const r = S.result!;
  if (r.tiebreak || r.winner !== 0 || r.decidedBy !== "felled") continue;
  const want = ["bind0", "bind1", "swear0", "swear1", "omen0", "omen1", "supplant0", "supplant1", "weakness", "the wheel", "Focus", "Shield soaks", "heals", "first Strike against it", "break"];
  const got = want.filter((k) => seen.has(k));
  const score = got.length + Math.min(duelActs, 8) / 4 - (r.felled[1] === 2 ? 1 : 0);
  if (!best || score > best.score) best = { score, seed, picks, why: got };
}
if (!best) throw new Error("no game found");
console.log(`seed ${best.seed} score ${best.score.toFixed(2)}: ${best.why.join(", ")}; ${best.picks.length} moves`);
writeFileSync(new URL("../../src/games/roth/walkthrough/script.json", import.meta.url), JSON.stringify({ seed: best.seed, you: "ulster", them: "connacht", picks: best.picks }) + "\n");
