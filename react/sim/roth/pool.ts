// The card pools: how each card does when it is in a built deck, and how built decks do against the starter decks.
//   npx tsx sim/roth/pool.ts --cards [--n 2000] [--level casual]     per-card score when included (random built decks)
//   npx tsx sim/roth/pool.ts --built [--n 200] [--level skilled]     strong built deck of each faction vs the five starter decks
import { fork } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { ALL_DEFS, DECKS, FACTIONS, type CardDef, type Faction } from "../../src/games/roth/engine/cards";
import { newMatch, playOut, type Policy, type Side } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { buildDeck } from "../../src/games/roth/engine/builder";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

interface Job { mode: "cards" | "built"; from: number; to: number; level: string; seed: number; a?: string; b?: string }
interface Rec { ids: [string[], string[]]; tags: [string, string]; w: -1 | 0 | 1 }

function randomFactions(r: Rng): Faction[] {
  const a = r.pick(FACTIONS);
  if (r.next() < 0.7) return [a];
  const rest = FACTIONS.filter((x) => x !== a);
  return [a, r.pick(rest)];
}

function runOne(j: Job, i: number): Rec {
  const seed = hashSeed(j.seed, `${j.mode}-${j.a ?? ""}-${j.b ?? ""}-${j.level}`, i);
  const r = new Rng(hashSeed(seed, "decks"));
  let decks: [CardDef[], CardDef[]];
  let tags: [string, string];
  if (j.mode === "cards") {
    const fa = randomFactions(r), fb = randomFactions(r);
    decks = [buildDeck({ factions: fa, noise: 2.5 }, r), buildDeck({ factions: fb, noise: 2.5 }, r)];
    tags = [fa.join("+"), fb.join("+")];
  } else {
    const built = buildDeck({ factions: [j.a as Faction], noise: 0.15 }, r);
    const other = process.env.BVB ? buildDeck({ factions: [j.b as Faction], noise: 0.15 }, r) : DECKS[j.b!];
    const side = (i % 2) as Side;
    decks = side === 0 ? [built, other] : [other, built];
    tags = side === 0 ? [`built:${j.a}`, `starter:${j.b}`] : [`starter:${j.b}`, `built:${j.a}`];
  }
  const S = newMatch(decks, {}, seed, false);
  const pols = [makePolicy(j.level, { N: 8, K: 2 }), makePolicy(j.level, { N: 8, K: 2 })] as [Policy, Policy];
  const res = playOut(S, pols, [new Rng(hashSeed(seed, "p1")), new Rng(hashSeed(seed, "p2"))], false);
  return { ids: [decks[0].map((d) => d.id), decks[1].map((d) => d.id)], tags, w: res.winner };
}

const sc = (r: Rec, side: number) => (r.w === -1 ? 0.5 : r.w === side ? 1 : 0);
const pct = (x: number) => (100 * x).toFixed(1) + "%";

async function main() {
  const args = process.argv.slice(2);
  const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
  const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
  const mode = args.includes("--built") ? "built" : "cards";
  const level = str("level", mode === "cards" ? "casual" : "skilled");
  const n = num("n", mode === "cards" ? 2000 : 200);
  const seed = num("seed", 1);
  const W = Math.max(1, num("workers", cpus().length));
  const jobs: Job[] = [];
  const chunk = 25;
  if (mode === "cards") for (let i = 0; i < n; i += chunk) jobs.push({ mode, from: i, to: Math.min(n, i + chunk), level, seed });
  else for (const a of FACTIONS) for (const b of FACTIONS) for (let i = 0; i < n; i += chunk) jobs.push({ mode, from: i, to: Math.min(n, i + chunk), level, seed, a, b });
  console.log(`Roth Catha pools: ${mode}, ${level}, n=${n}, ${W} workers`);
  const recs: Rec[] = [];
  const t0 = Date.now();
  await new Promise<void>((resolve, reject) => {
    let next = 0, active = 0, done = 0;
    const self = fileURLToPath(import.meta.url);
    for (let w = 0; w < W; w++) {
      const child = fork(self, ["--worker"], { stdio: ["inherit", "inherit", "inherit", "ipc"] });
      const feed = () => {
        if (next >= jobs.length) { child.disconnect(); if (active === 0) resolve(); return; }
        active++; child.send(jobs[next++]);
      };
      child.on("message", (m: Rec[]) => {
        active--; done++; recs.push(...m);
        if (done % 10 === 0) process.stderr.write(`  ... ${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        feed();
      });
      child.on("error", reject);
      child.on("exit", (code) => { if (code) reject(new Error(`worker exited ${code}`)); });
      feed();
    }
  });

  if (mode === "cards") {
    // per card: mean score of the side holding it (once per deck, however many copies) against the field
    const agg = new Map<string, { n: number; s: number }>();
    const fac = new Map<string, { n: number; s: number }>();
    for (const r of recs) for (const side of [0, 1]) {
      const s = sc(r, side);
      for (const id of new Set(r.ids[side])) { const a = agg.get(id) ?? { n: 0, s: 0 }; a.n++; a.s += s; agg.set(id, a); }
      const f = fac.get(r.tags[side]) ?? { n: 0, s: 0 }; f.n++; f.s += s; fac.set(r.tags[side], f);
    }
    console.log(`\n${recs.length} matches. Faction mixes (score against the field):`);
    for (const [k, v] of [...fac].sort((a, b) => b[1].s / b[1].n - a[1].s / a[1].n)) if (v.n >= 30) console.log(`  ${k.padEnd(18)} ${pct(v.s / v.n).padStart(6)}  n=${v.n}`);
    // lift: the holder's score less its faction mix's average, so a strong people doesn't flatter its own cards
    const base = new Map([...fac].map(([k, v]) => [k, v.s / v.n]));
    const lift = new Map<string, { n: number; s: number }>();
    for (const r of recs) for (const side of [0, 1]) {
      const d = sc(r, side) - base.get(r.tags[side])!;
      for (const id of new Set(r.ids[side])) { const a = lift.get(id) ?? { n: 0, s: 0 }; a.n++; a.s += d; lift.set(id, a); }
    }
    console.log("\nCards by lift: score when in the deck, less its faction mix's average (n ≥ 40); ±95% shown:");
    const rows = [...lift].filter(([, v]) => v.n >= 40).map(([id, v]) => ({ id, m: 0.5 + v.s / v.n, n: v.n, moe: 1.96 * Math.sqrt(0.25 / v.n) }))
      .sort((a, b) => b.m - a.m);
    for (const x of rows) {
      const d = ALL_DEFS[x.id];
      const flag = x.m - x.moe > 0.5 ? " HIGH" : x.m + x.moe < 0.5 ? " LOW" : "";
      console.log(`  ${(d.name).slice(0, 34).padEnd(34)} ${d.type.padEnd(8)} ${pct(x.m).padStart(6)} ±${(100 * x.moe).toFixed(1).padStart(4)}  n=${String(x.n).padStart(5)}${flag}`);
    }
    const unseen = Object.keys(ALL_DEFS).filter((id) => !agg.has(id) || agg.get(id)!.n < 40);
    if (unseen.length) console.log(`\nRarely built (n < 40): ${unseen.join(", ")}`);
  } else {
    console.log("\nStrong built deck (row) vs starter deck (column): built deck's score, seats swapped evenly");
    console.log("  " + "".padEnd(10) + FACTIONS.map((f) => f.padStart(9)).join(""));
    for (const a of FACTIONS) {
      const cells = FACTIONS.map((b) => {
        const rs = recs.filter((r) => r.tags.includes(`built:${a}`) && r.tags.includes(`starter:${b}`));
        const m = rs.reduce((t, r) => t + sc(r, r.tags[0] === `built:${a}` ? 0 : 1), 0) / rs.length;
        return pct(m).padStart(9);
      });
      const avg = FACTIONS.map((b) => { const rs = recs.filter((r) => r.tags.includes(`built:${a}`) && r.tags.includes(`starter:${b}`)); return rs.reduce((t, r) => t + sc(r, r.tags[0] === `built:${a}` ? 0 : 1), 0) / rs.length; });
      console.log("  " + a.padEnd(10) + cells.join("") + "   avg " + pct(avg.reduce((x, y) => x + y, 0) / avg.length));
    }
    const r = new Rng(7);
    for (const a of FACTIONS) {
      const d = buildDeck({ factions: [a], noise: 0 }, r);
      console.log(`\n${a} (noise 0): ${d.map((x) => x.id).join(" ")}`);
    }
  }
}

if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => {
    const out: Rec[] = [];
    for (let i = j.from; i < j.to; i++) out.push(runOne(j, i));
    process.send!(out);
  });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
