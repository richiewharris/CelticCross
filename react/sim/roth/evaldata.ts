// Training data for the duel evaluation: plays every pairing, and at every duel decision the computer weighs it
// records the position's features (engine/ai.ts EVAL_FEATURES, from the deciding side's view) and how that duel ended
// for that side: 1 it felled its foe and stood, 0 it fell and its foe stood, 0.5 anything else.
//   npx tsx sim/roth/evaldata.ts [--n 30] [--workers 2] [--seed 1] [--level skilled] [--out sim/roth/cube/evaldata/<id>.csv.gz]
// Then fit and compare: python3 sim/roth/cube/fiteval.py <file.csv.gz> ...
import { fork } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { DECKS, FACTIONS } from "../../src/games/roth/engine/cards";
import { newMatch, playOut, type Policy } from "../../src/games/roth/engine/engine";
import { DECISIONS, EVAL_FEATURES, makePolicy } from "../../src/games/roth/engine/ai";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

interface Job { a: string; b: string; from: number; to: number; seed: number; level: string }
function play(j: Job, i: number): string[] {
  const side = i % 2;
  const decks = side === 0 ? [j.a, j.b] : [j.b, j.a];
  const seed = hashSeed(j.seed, `eval-${j.a}-${j.b}`, i);
  const S = newMatch([DECKS[decks[0]], DECKS[decks[1]]], {}, seed);
  DECISIONS.on = true; DECISIONS.features = true; DECISIONS.log = []; DECISIONS.real = S;
  playOut(S, [makePolicy(j.level), makePolicy(j.level)] as [Policy, Policy], [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))], false);
  const duels = S.stats!.duels ?? [];
  const out: string[] = [];
  for (const r of DECISIONS.log) {
    if (!r.x || r.duel === undefined) continue;
    const du = duels.find((x) => x.duel === r.duel);
    if (!du) continue;
    const me = r.side, o = 1 - me;
    const y = du.felled[o] && !du.felled[me] ? 1 : du.felled[me] && !du.felled[o] ? 0 : 0.5;
    const calc = r.calc ?? [NaN, NaN, NaN, NaN, NaN, NaN, NaN];
    out.push([decks[me], decks[o], r.duel, ...r.x.map((v) => Math.round(v * 1000) / 1000), ...calc.map((v) => Math.round(v * 1000) / 1000), y].join(","));
  }
  return out;
}
if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => { const rows: string[] = []; for (let i = j.from; i < j.to; i++) rows.push(...play(j, i)); process.send!(rows); });
} else {
  const args = process.argv.slice(2);
  const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
  const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
  const n = num("n", 30), W = num("workers", 2), seed = num("seed", 1), level = str("level", "skilled");
  const out = str("out", `sim/roth/cube/evaldata/${level.replace(/[^a-z0-9]/gi, "_")}-s${seed}-n${n}.csv.gz`);
  const jobs: Job[] = [];
  for (const a of FACTIONS) for (const b of FACTIONS) if (a !== b) for (let i = 0; i < n; i += 10) jobs.push({ a, b, from: i, to: Math.min(n, i + 10), seed, level });
  const rows: string[] = [];
  let next = 0, done = 0;
  const t0 = Date.now();
  await new Promise<void>((resolve) => {
    let live = W;
    for (let w = 0; w < W; w++) {
      const c = fork(fileURLToPath(import.meta.url), ["--worker"]);
      const feed = () => { if (next < jobs.length) c.send(jobs[next++]); else { c.disconnect(); if (--live === 0) resolve(); } };
      c.on("message", (m: string[]) => { rows.push(...m); if (++done % 10 === 0) process.stderr.write(`  ${done}/${jobs.length}\n`); feed(); });
      feed();
    }
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, gzipSync(["deck,foe,duel," + EVAL_FEATURES.join(",") + ",tMe,tFoe,margin,blowMe,blowFoe,sustainMe,sustainFoe,y", ...rows].join("\n") + "\n"));
  console.log(`${rows.length} positions from ${30 * n} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}`);
}
