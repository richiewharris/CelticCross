// The five tuned computer decks against each other (seats swapped evenly).
//   npx tsx sim/roth/tuned.ts [--n 200]
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ALL_DEFS, FACTIONS } from "../../src/games/roth/engine/cards";
import { newMatch, playOut, type Policy } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";
import DECKS from "../../src/games/roth/engine/computerDecks.json";
const D = DECKS as Record<string, string[]>;
interface Job { a: string; b: string; from: number; to: number }
if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => {
    let s = 0;
    for (let i = j.from; i < j.to; i++) {
      const side = i % 2, A = D[j.a].map((x) => ALL_DEFS[x]), B = D[j.b].map((x) => ALL_DEFS[x]);
      const seed = hashSeed(77, `${j.a}-${j.b}`, i);
      const S = newMatch(side === 0 ? [A, B] : [B, A], {}, seed, false);
      const r = playOut(S, [makePolicy("skilled"), makePolicy("skilled")] as [Policy, Policy], [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))], false);
      s += r.winner === -1 ? 0.5 : r.winner === side ? 1 : 0;
    }
    process.send!({ ...j, s });
  });
} else {
  const n = Number(process.argv[process.argv.indexOf("--n") + 1]) || 200;
  const jobs: Job[] = [];
  for (const a of FACTIONS) for (const b of FACTIONS) if (a < b) for (let i = 0; i < n; i += 50) jobs.push({ a, b, from: i, to: Math.min(n, i + 50) });
  const res = new Map<string, number>();
  let next = 0;
  await new Promise<void>((resolve) => {
    let live = 2;
    for (let w = 0; w < 2; w++) {
      const c = fork(fileURLToPath(import.meta.url), ["--worker"]);
      const feed = () => { if (next >= jobs.length) { c.disconnect(); if (--live === 0) resolve(); return; } c.send(jobs[next++]); };
      c.on("message", (m: Job & { s: number }) => { res.set(`${m.a}|${m.b}`, (res.get(`${m.a}|${m.b}`) ?? 0) + m.s); feed(); });
      feed();
    }
  });
  const score = (a: string, b: string) => (a === b ? 0.5 : a < b ? res.get(`${a}|${b}`)! / n : 1 - res.get(`${b}|${a}`)! / n);
  console.log("Tuned computer decks, row vs column (Skilled, n=" + n + "):");
  console.log("  " + "".padEnd(10) + FACTIONS.map((f) => f.padStart(9)).join("") + "   vs field");
  for (const a of FACTIONS) {
    const others = FACTIONS.filter((b) => b !== a).map((b) => score(a, b));
    console.log("  " + a.padEnd(10) + FACTIONS.map((b) => (a === b ? "—" : (100 * score(a, b)).toFixed(1) + "%").padStart(9)).join("") + "   " + (100 * others.reduce((x, y) => x + y, 0) / others.length).toFixed(1) + "%");
  }
}
