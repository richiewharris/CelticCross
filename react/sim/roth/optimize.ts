// Hill-climbs a strong deck for each faction from its pool: swap one card at a time, keep the swap when the deck
// scores better against a fixed field (the five starter decks and the five decks found so far). Common seeds for
// both sides of each comparison keep the noise down. Writes src/games/roth/engine/computerDecks.json.
//   npx tsx sim/roth/optimize.ts [--rounds 3] [--steps 30] [--n 30]
import { fork } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALL_DEFS, DECK_IDS, FACTIONS, deckErrors, poolOf, type CardDef, type Faction } from "../../src/games/roth/engine/cards";
import { newMatch, playOut, type Policy } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { buildDeck } from "../../src/games/roth/engine/builder";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

interface Job { ids: string[]; opp: string[]; seeds: number[] }
function play(ids: string[], opp: string[], seed: number, side: number) {
  const a = ids.map((x) => ALL_DEFS[x]), b = opp.map((x) => ALL_DEFS[x]);
  const S = newMatch(side === 0 ? [a, b] : [b, a], {}, seed, false);
  const pols = [makePolicy("skilled"), makePolicy("skilled")] as [Policy, Policy];
  const r = playOut(S, pols, [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))], false);
  return r.winner === -1 ? 0.5 : r.winner === side ? 1 : 0;
}
if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => { let s = 0; j.seeds.forEach((sd, i) => { s += play(j.ids, j.opp, sd, i % 2); }); process.send!(s); });
} else {
  const args = process.argv.slice(2);
  const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
  const rounds = num("rounds", 3), steps = num("steps", 30), n = num("n", 30);
  const self = fileURLToPath(import.meta.url);
  const workers = [fork(self, ["--worker"]), fork(self, ["--worker"])];
  const run = (jobs: Job[]) => new Promise<number[]>((resolve) => {
    const out: number[] = new Array(jobs.length);
    let next = 0, done = 0;
    for (const w of workers) {
      const feed = () => { if (next >= jobs.length) return; const k = next++; w.once("message", (s: number) => { out[k] = s; if (++done === jobs.length) resolve(out); else feed(); }); w.send(jobs[k]); };
      feed();
    }
  });
  const r = new Rng(17);
  // --resume starts from the stored decks; --only f,g tunes just those factions
  const stored = args.includes("--resume") ? (JSON.parse(readFileSync(new URL("../../src/games/roth/engine/computerDecks.json", import.meta.url), "utf8")) as Record<string, string[]>) : {};
  const best: Record<string, string[]> = Object.fromEntries(FACTIONS.map((f) => [f, stored[f] ?? buildDeck({ factions: [f], noise: 0 }, r).map((d) => d.id)]));
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : FACTIONS;
  // --tuned plays against the five tuned decks only (the starters drop out of the field)
  const field = () => [...(args.includes("--tuned") ? [] : FACTIONS.map((f) => DECK_IDS[f])), ...FACTIONS.map((f) => best[f])];
  let seedBase = 1;
  /** Mean score of each candidate against the field, all on the same seeds. */
  const evalMany = async (cands: string[][]) => {
    const F = field();
    const seeds = Array.from({ length: n }, (_, i) => hashSeed(seedBase, i));
    const jobs: Job[] = [];
    for (const c of cands) for (const o of F) jobs.push({ ids: c, opp: o, seeds });
    const res = await run(jobs);
    return cands.map((_, k) => res.slice(k * F.length, (k + 1) * F.length).reduce((a, b) => a + b, 0) / (F.length * n));
  };
  const mutate = (ids: string[], f: Faction): string[] | null => {
    const pool = poolOf(f);
    const i = r.int(ids.length);
    const out = ids.slice();
    const t = ALL_DEFS[ids[i]].type;
    const cands = pool.filter((d) => d.type === t && d.id !== ids[i]);
    if (!cands.length) return null;
    out[i] = r.pick(cands).id;
    return deckErrors(out.map((x) => ALL_DEFS[x] as CardDef)).length ? null : out;
  };
  for (let round = 0; round < rounds; round++) {
    for (const f of FACTIONS.filter((x) => only.includes(x))) {
      seedBase++;
      let [cur] = await evalMany([best[f]]);
      for (let s = 0; s < steps; s++) {
        const tries: string[][] = [];
        while (tries.length < 4) { const m = mutate(best[f], f); if (m) tries.push(m); }
        seedBase++;
        const scores = await evalMany([best[f], ...tries]);
        cur = scores[0];
        const k = scores.slice(1).reduce((bi, v, j, a) => (v > a[bi] ? j : bi), 0);
        if (scores[k + 1] > cur + 0.02) { best[f] = tries[k]; cur = scores[k + 1]; }
      }
      console.log(`round ${round + 1} ${f}: ${(100 * cur).toFixed(1)}%  ${best[f].join(" ")}`);
      writeFileSync(new URL("../../src/games/roth/engine/computerDecks.json", import.meta.url), JSON.stringify(best, null, 1) + "\n");
    }
  }
  seedBase = 999;
  const n0 = n; void n0;
  const final = await evalMany(FACTIONS.map((f) => best[f]));
  FACTIONS.forEach((f, i) => console.log(`final ${f}: ${(100 * final[i]).toFixed(1)}%`));
  writeFileSync(new URL("../../src/games/roth/engine/computerDecks.json", import.meta.url), JSON.stringify(best, null, 1) + "\n");
  for (const w of workers) w.disconnect();
}
