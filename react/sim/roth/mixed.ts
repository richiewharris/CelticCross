// Two-people decks: how strong can a deck drawn from two peoples get?
//   npx tsx sim/roth/mixed.ts --screen [--n 10]
//       builds the best deck the deck builder finds for each of the 30 pairs of peoples (the first leads, the second lends) (and, for comparison, for each
//       people alone), and plays each against the six starter decks at Skilled, seats swapped evenly.
//   npx tsx sim/roth/mixed.ts --tune ulster,sidhe [--steps 20] [--n 10]
//       hill-climbs that pair's deck (ulster leading, the Sídhe lending) from the cards the rule allows (swap one card at a time; keep a swap only when it
//       scores better on the same seeds and again on fresh ones), against the six starter decks.
// Results go to sim/roth/mixed-decks.json (never to the computer's own decks).
import { fork } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  const n = num("n", 10), steps = num("steps", 20);
  const OUT = new URL("./mixed-decks.json", import.meta.url);
  const saved: Record<string, { ids: string[]; score: number; vs: Record<string, number> }> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const save = () => writeFileSync(OUT, JSON.stringify(saved, null, 1) + "\n");
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
  const field = FACTIONS.map((f) => DECK_IDS[f]);
  let seedBase = 1;
  /** Each candidate's score against each starter deck, all on the same seeds. */
  const evalMany = async (cands: string[][]) => {
    const seeds = Array.from({ length: n }, (_, i) => hashSeed(seedBase, i));
    const jobs: Job[] = [];
    for (const c of cands) for (const o of field) jobs.push({ ids: c, opp: o, seeds });
    const res = await run(jobs);
    return cands.map((_, k) => res.slice(k * field.length, (k + 1) * field.length).map((s) => s / n));
  };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const key = (fs: Faction[]) => fs.join("+");
  const record = (fs: Faction[], ids: string[], vs: number[]) => {
    saved[key(fs)] = { ids, score: Math.round(1000 * mean(vs)) / 10, vs: Object.fromEntries(FACTIONS.map((f, i) => [f, Math.round(1000 * vs[i]) / 10])) };
    save();
  };
  const show = (k: string) => { const x = saved[k]; console.log(`${k.padEnd(18)} ${x.score.toFixed(1)}%   ${FACTIONS.map((f) => `${f.slice(0, 4)} ${x.vs[f].toFixed(0)}`).join("  ")}`); };

  if (args.includes("--screen")) {
    const r = new Rng(23);
    // the first people leads, the second lends: every ordered pair
    const sets: Faction[][] = [...FACTIONS.map((f) => [f]), ...FACTIONS.flatMap((a) => FACTIONS.filter((b) => b !== a).map((b) => [a, b]))];
    const decks = sets.map((fs) => buildDeck({ factions: fs, noise: 0 }, r).map((d) => d.id));
    decks.forEach((d, i) => { const e = deckErrors(d.map((x) => ALL_DEFS[x] as CardDef)); if (e.length) console.log(`${key(sets[i])}: not legal (${e.join("; ")})`); });
    console.log(`Each built deck against the six starter decks, ${n} matches each (seats swapped): score, then by starter deck.`);
    for (let i = 0; i < sets.length; i++) {
      seedBase = 100 + i;
      const [vs] = await evalMany([decks[i]]);
      record(sets[i], decks[i], vs);
      show(key(sets[i]));
    }
  }
  const ti = args.indexOf("--tune");
  if (ti >= 0) {
    const fs = args[ti + 1].split(",") as Faction[];
    const leads = new Set(["hero", "host", "monster"]);
    const pool = [...new Map(fs.flatMap((f, k) => poolOf(f).filter((d) => k === 0 || !leads.has(d.type))).map((d) => [d.id, d])).values()];
    const r = new Rng(hashSeed(31, key(fs)));
    let best = saved[key(fs)]?.ids ?? buildDeck({ factions: fs, noise: 0 }, r).map((d) => d.id);
    const mutate = (ids: string[]): string[] | null => {
      const i = r.int(ids.length), out = ids.slice();
      let t = ALL_DEFS[ids[i]].type;
      if (t === "support" && r.next() < 0.3) t = "attendant"; else if (t === "attendant" && r.next() < 0.3) t = "support";
      const cands = pool.filter((d) => d.type === t && d.id !== ids[i]);
      if (!cands.length) return null;
      out[i] = r.pick(cands).id;
      return deckErrors(out.map((x) => ALL_DEFS[x] as CardDef)).length ? null : out;
    };
    seedBase = 500;
    let [cur] = await evalMany([best]);
    console.log(`${key(fs)} start: ${(100 * mean(cur)).toFixed(1)}%`);
    for (let s = 0; s < steps; s++) {
      const tries: string[][] = [];
      for (let g = 0; tries.length < 4 && g < 200; g++) { const m = mutate(best); if (m) tries.push(m); }
      seedBase++;
      const sc = await evalMany([best, ...tries]);
      const k = sc.slice(1).reduce((bi, v, j, a) => (mean(v) > mean(a[bi]) ? j : bi), 0);
      if (mean(sc[k + 1]) > mean(sc[0]) + 0.03) {
        seedBase++;
        const [b2, c2] = await evalMany([best, tries[k]]);
        if (mean(c2) > mean(b2)) {
          const out = best.find((x, j) => x !== tries[k][j]), inn = tries[k].find((x, j) => x !== best[j]);
          best = tries[k]; cur = c2;
          console.log(`  step ${s + 1}: ${ALL_DEFS[out!]?.name} → ${ALL_DEFS[inn!]?.name}: ${(100 * mean(c2)).toFixed(1)}%`);
        }
      }
    }
    seedBase = 999;
    const [fin] = await evalMany([best]);
    record(fs, best, fin);
    console.log("final (fresh seeds):"); show(key(fs));
  }
  for (const w of workers) w.disconnect();
}
