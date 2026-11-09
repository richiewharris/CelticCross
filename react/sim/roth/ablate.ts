// Which cards make a built deck strong? Remove one card at a time (the builder refills the gap) and replay
// the deck against the five strong built decks.
//   npx tsx sim/roth/ablate.ts sidhe [--n 80] [--cards id,id]
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ALL_DEFS, FACTIONS, type CardDef, type Faction } from "../../src/games/roth/engine/cards";
import { newMatch, playOut, type Policy } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { buildDeck } from "../../src/games/roth/engine/builder";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

interface Job { ids: string[]; opp: string[]; from: number; to: number; tag: string }
const play = (j: Job, i: number) => {
  const side = i % 2;
  const a = j.ids.map((x) => ALL_DEFS[x]), b = j.opp.map((x) => ALL_DEFS[x]);
  const seed = hashSeed(11, j.tag, i);
  const S = newMatch(side === 0 ? [a, b] : [b, a], {}, seed, false);
  const pols = [makePolicy("skilled"), makePolicy("skilled")] as [Policy, Policy];
  const r = playOut(S, pols, [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))], false);
  return r.winner === -1 ? 0.5 : r.winner === side ? 1 : 0;
};
if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => { let s = 0; for (let i = j.from; i < j.to; i++) s += play(j, i); process.send!({ tag: j.tag, s, n: j.to - j.from }); });
} else {
  const args = process.argv.slice(2);
  const f = args[0] as Faction;
  const n = Number(args[args.indexOf("--n") + 1] || 80) || 80;
  const r = new Rng(5);
  const opps = FACTIONS.map((x) => buildDeck({ factions: [x], noise: 0 }, r).map((d) => d.id));
  const base = buildDeck({ factions: [f], noise: 0 }, r);
  const only = args.includes("--cards") ? args[args.indexOf("--cards") + 1].split(",") : null;
  const variants: { tag: string; ids: string[] }[] = [{ tag: "base", ids: base.map((d) => d.id) }];
  for (const id of new Set(base.map((d) => d.id))) {
    if (only && !only.includes(id)) continue;
    const d = ALL_DEFS[id];
    if (d.type === "hero") continue;
    const start: CardDef[] = [];
    let dropped = false;
    for (const x of base) { if (x.id === id && !dropped) { dropped = true; continue; } start.push(x); }
    // refill without that card
    const save = (ALL_DEFS as Record<string, CardDef>)[id];
    delete (ALL_DEFS as Record<string, CardDef>)[id];
    const v = buildDeck({ factions: [f], noise: 0, start }, r);
    (ALL_DEFS as Record<string, CardDef>)[id] = save;
    variants.push({ tag: `-${id} +${v.find((x, i) => x.id !== start[i]?.id)?.id ?? v[v.length - 1].id}`, ids: v.map((x) => x.id) });
  }
  const jobs: Job[] = [];
  for (const v of variants) for (const o of opps) for (let i = 0; i < n; i += 40) jobs.push({ ids: v.ids, opp: o, from: i, to: Math.min(n, i + 40), tag: v.tag });
  const res = new Map<string, { s: number; n: number }>();
  let next = 0;
  const self = fileURLToPath(import.meta.url);
  await new Promise<void>((resolve) => {
    let live = 2;
    for (let w = 0; w < 2; w++) {
      const c = fork(self, ["--worker"]);
      const feed = () => { if (next >= jobs.length) { c.disconnect(); if (--live === 0) resolve(); return; } c.send(jobs[next++]); };
      c.on("message", (m: { tag: string; s: number; n: number }) => { const a = res.get(m.tag) ?? { s: 0, n: 0 }; a.s += m.s; a.n += m.n; res.set(m.tag, a); feed(); });
      feed();
    }
  });
  console.log(`${f} built deck vs the five built decks, n=${n} each:`);
  const b0 = res.get("base")!; const bm = b0.s / b0.n;
  console.log(`  base ${(100 * bm).toFixed(1)}%`);
  for (const [k, v] of [...res].filter(([k]) => k !== "base").sort((a, b) => a[1].s / a[1].n - b[1].s / b[1].n)) console.log(`  ${k.padEnd(34)} ${(100 * v.s / v.n).toFixed(1)}%  (${(100 * (v.s / v.n - bm)).toFixed(1)})`);
}
