// Five-deck balance: every deck against every other (and itself), seats swapped evenly.
//   npx tsx sim/roth/balance.ts [--level skilled] [--n 400] [--workers 2] [--seed 1] [--cards] [--rules '{"capOver":1}'] [--dump recs.jsonl]
//     [--cube sim/roth/cube/data] [--no-cube] [--base <run id> --touch setting=crossing,deck=sluagh] [--against dummy_post]
// Every run is written to the cube (sim/roth/cube): one row per match, with the setting, seats, seed and ledger, tagged
// with the rules and a hash of the engine. With --base and --touch, only the matches a change can reach are played
// (those whose setting, or whose decks, match a --touch term); the rest are taken from the base run, so a narrow change
// costs a fraction of a full run. Match seeds don't depend on the rules, so an untouched match replays the same anyway.
// Read the cube with: python3 sim/roth/cube/cube.py table <run id> (or sql / worth / seats; see cube.py).
import { fork } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { ALL_DEFS, DECKS, DECK_IDS, FACTIONS, type CardDef } from "../../src/games/roth/engine/cards";
import { newMatch, playOut, type MatchStats, type Policy, type Rules, type Side } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";
import { pickSettingId } from "../../src/games/roth/engine/ai";
import { PostPolicy, registerDummies } from "./dummy";
import { param } from "../../src/games/roth/engine/params";

// the target dummies (dummy_post, dummy_spar) play like any deck; see sim/roth/dummy.ts
registerDummies();

interface Job { a: string; b: string; from: number; to: number; level: string; levelB: string; seed: number; rules: Partial<Rules>; touch?: Touch }
interface Rec {
  a: string; b: string; aSide: Side; w: -1 | 0 | 1; by: string; felled: [number, number]; wounds: [number, number];
  st: MatchStats; i: number; seed: number; setting: string | null;
}
/** Which matches a change can reach: any whose setting is one of these, or that has one of these decks in it. */
interface Touch { setting?: string[]; deck?: string[] }
/** The setting a match will be fought at, as the second player would choose it (or as the rules fix it). */
function predictedSetting(j: Job, i: number): string | null {
  if (j.rules.setting) return j.rules.setting;
  if (j.rules.duels && j.rules.duels !== "death") return null;
  if (param(j.rules as Rules, "setting.choose") === 0) return null;
  const aSide = i % 2;
  const [p1, p2] = aSide === 0 ? [j.a, j.b] : [j.b, j.a];
  return pickSettingId(DECKS[p2], DECKS[p1]);
}
function touched(j: Job, i: number): boolean {
  const t = j.touch;
  if (!t) return true;
  if (t.deck?.some((d) => d === j.a || d === j.b)) return true;
  const set = t.setting?.length ? predictedSetting(j, i) : null;
  return !!set && !!t.setting?.includes(set);
}

function runOne(j: Job, i: number): Rec {
  const aSide = (i % 2) as Side;
  const decks = aSide === 0 ? [j.a, j.b] : [j.b, j.a];
  // the seed doesn't depend on the rules: a match a change doesn't reach plays out exactly as before
  const seed = hashSeed(j.seed, `${j.a}-${j.b}-${j.level}-${j.levelB}`, i);
  const S = newMatch([DECKS[decks[0]], DECKS[decks[1]]], j.rules, seed);
  const lv = aSide === 0 ? [j.level, j.levelB] : [j.levelB, j.level];
  const pols = lv.map((l, k) => (decks[k] === "dummy_post" ? new PostPolicy(makePolicy(l, { N: 8, K: 2 })) : makePolicy(l, { N: 8, K: 2 }))) as [Policy, Policy];
  const r = playOut(S, pols, [new Rng(hashSeed(seed, "p1")), new Rng(hashSeed(seed, "p2"))], false);
  return { a: j.a, b: j.b, aSide, w: r.winner, by: r.decidedBy, felled: r.felled, wounds: r.valour, st: S.stats!, i, seed, setting: S.rules.setting ?? null };
}

const pct = (x: number) => (Number.isNaN(x) ? "" : (100 * x).toFixed(1) + "%");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
function table(head: string[], rows: (string | number)[][]) {
  const all = [head, ...rows.map((r) => r.map(String))];
  const w = head.map((_, j) => Math.max(...all.map((r) => r[j].length)));
  const line = (r: string[]) => "  " + r.map((c, j) => (j === 0 ? c.padEnd(w[j]) : c.padStart(w[j]))).join("  ");
  console.log(line(head));
  console.log("  " + w.map((x) => "-".repeat(x)).join("  "));
  for (const r of all.slice(1)) console.log(line(r));
}
/** Score of the player in seat `side`: win 1, draw ½. */
const sc = (r: Rec, side: number) => (r.w === -1 ? 0.5 : r.w === side ? 1 : 0);
/** Which seat played deck d in record r (the first one if a mirror). */
const seatOf = (r: Rec, d: string): Side => (r.a === d ? r.aSide : ((1 - r.aSide) as Side));

async function main() {
  const args = process.argv.slice(2);
  const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
  const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
  const level = str("level", "skilled");
  const levelB = str("vs", level);
  const n = num("n", 400);
  const seed = num("seed", 1);
  const rules = JSON.parse(str("rules", "{}")) as Partial<Rules>;
  const decks = str("decks", FACTIONS.join(",")).split(",");
  const W = Math.max(1, num("workers", Math.min(cpus().length, 8)));
  const base = str("base", "");
  const touchArg = str("touch", "");
  let touch: Touch | undefined;
  if (touchArg) {
    touch = {};
    for (const term of touchArg.split(",")) { const [k, v] = term.split("="); if (k === "setting" || k === "deck") (touch[k] ??= []).push(v); else throw new Error(`--touch: unknown term ${term}`); }
  }
  if (touch && !base) throw new Error("--touch needs --base (the run to take the untouched matches from)");

  const jobs: Job[] = [];
  const chunk = level === "expert" ? 2 : 50;
  // --against X: each deck plays only X (a target dummy, say), not the rest of the field.
  const against = str("against", "");
  if (against) {
    for (const d of decks) if (d !== against) for (let i = 0; i < n; i += chunk) jobs.push({ a: d, b: against, from: i, to: Math.min(n, i + chunk), level, levelB, seed, rules, touch });
  } else
  // With two levels, run every ordered pair so each level plays each deck equally.
  for (let x = 0; x < decks.length; x++) for (let y = levelB !== level ? 0 : x; y < decks.length; y++) {
    for (let i = 0; i < n; i += chunk) jobs.push({ a: decks[x], b: decks[y], from: i, to: Math.min(n, i + chunk), level, levelB, seed, rules, touch });
  }
  console.log(`Roth Catha balance: ${decks.length} decks, ${level} vs ${levelB}, ${n} matches per pairing, rules ${JSON.stringify(rules)}, ${W} workers`);
  const recs: Rec[] = [];
  const t0 = Date.now();
  await new Promise<void>((resolve, reject) => {
    let next = 0, active = 0, done = 0;
    const self = fileURLToPath(import.meta.url);
    for (let w = 0; w < W; w++) {
      const child = fork(self, ["--worker"], { stdio: ["inherit", "inherit", "inherit", "ipc"] });
      const feed = () => {
        if (next >= jobs.length) { child.disconnect(); if (active === 0) resolve(); return; }
        active++;
        child.send(jobs[next++]);
      };
      child.on("message", (m: Rec[]) => {
        active--; done++;
        recs.push(...m);
        if (done % 20 === 0) process.stderr.write(`  ... ${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        feed();
      });
      child.on("error", reject);
      child.on("exit", (code) => { if (code) reject(new Error(`worker exited ${code}`)); });
      feed();
    }
  });

  // ---- the cube: one row per match, tagged with the rules and the engine it was played under
  if (!args.includes("--no-cube")) {
    const { writeCubeRun } = await import("./cube/write");
    const id = writeCubeRun(str("cube", "sim/roth/cube/data"), { rules, seed, n, level, levelB, decks: against && !decks.includes(against) ? [...decks, against] : decks, base: base || null, touch: touch ?? null }, recs.map((r) => ({
      i: r.i, a: r.a, b: r.b, aSide: r.aSide, p1: r.aSide === 0 ? r.a : r.b, p2: r.aSide === 0 ? r.b : r.a, setting: r.setting, w: r.w, by: r.by,
      felled: r.felled, seed: r.seed, ledger: r.st.ledger, exchanges: r.st.exchanges,
      placed: r.st.placed.map((p) => ({ side: p.side, id: p.id, how: p.how })), used: r.st.used.map((u) => ({ side: u.side, id: u.id })),
      bound: r.st.bound, sworn: r.st.sworn,
    })));
    console.log(`(cube run ${id}${base ? `, on top of ${base} for the matches it didn't touch` : ""}: python3 sim/roth/cube/cube.py table ${id})`);
    if (base) {
      console.log(`Only the ${recs.length} matches the change reaches were played; the table below covers just those. For the whole table: python3 sim/roth/cube/cube.py table ${id}`);
    }
  }
  // ---- raw records for later analysis (the ledger of what every card and power was worth)
  const dump = str("dump", "");
  if (dump) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(dump, recs.map((r) => JSON.stringify({ a: r.a, b: r.b, aSide: r.aSide, w: r.w, felled: r.felled, ledger: r.st.ledger, placed: r.st.placed, used: r.st.used.map((u) => ({ side: u.side, id: u.id })), fx: r.st.fx })).join("\n") + "\n");
    console.log(`(records written to ${dump})`);
  }
  // ---- matrix
  console.log("\nScore of the row deck against the column deck (seats swapped evenly):");
  const vs = (a: string, b: string) => {
    const rs = recs.filter((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
    if (a === b) return mean(rs.map((r) => sc(r, 1))); // mirror: P2's score
    return mean(rs.map((r) => sc(r, seatOf(r, a))));
  };
  table(["deck", ...decks, "vs field"], decks.map((a) => [a, ...decks.map((b) => (a === b ? "(P2 " + pct(vs(a, b)) + ")" : pct(vs(a, b)))), pct(mean(decks.filter((b) => b !== a).map((b) => vs(a, b))))]));
  const all = recs;
  if (levelB !== level) {
    // Level A plays deck a in record r from seat r.aSide; for the skill score, A is the "a" deck's player.
    console.log(`\n${level} score against ${levelB}: ${pct(mean(all.map((r) => sc(r, r.aSide))))} over ${all.length} matches`);
  }
  console.log(`\nP1 score overall: ${pct(mean(all.map((r) => sc(r, 0))))}  draws: ${pct(mean(all.map((r) => (r.w === -1 ? 1 : 0))))}`);
  console.log(`Decided by felled ${pct(mean(all.map((r) => (r.by === "felled" ? 1 : 0))))}, wounds ${pct(mean(all.map((r) => (r.by === "valour" ? 1 : 0))))}, first duel ${pct(mean(all.map((r) => (r.by === "firstDuel" ? 1 : 0))))}`);
  console.log(`Heroes felled per match ${mean(all.map((r) => r.felled[0] + r.felled[1])).toFixed(2)}; turns per duel ${mean(all.flatMap((r) => r.st.exchanges)).toFixed(2)}`);
  const act = all.reduce((a, r) => { for (const k of Object.keys(r.st.actions) as (keyof MatchStats["actions"])[]) a[k] = (a[k] ?? 0) + r.st.actions[k]; return a; }, {} as Record<string, number>);
  const actTot = Object.values(act).reduce((a, b) => a + b, 0);
  console.log(`Playing turn: ${Object.entries(act).map(([k, v]) => `${k} ${pct(v / actTot)}`).join(", ")}`);
  console.log(`Tie-break rounds: ${pct(mean(all.map((r) => r.st.tiebreaks)))} of matches; still drawn after it: ${pct(mean(all.map((r) => (r.w === -1 ? 1 : 0))))}`);
  console.log(`Champions called per match: P1 ${mean(all.map((r) => r.st.championsBySide[0])).toFixed(2)}, P2 ${mean(all.map((r) => r.st.championsBySide[1])).toFixed(2)}`);
  console.log(`Per match: geasa broken ${mean(all.map((r) => r.st.geisBroken)).toFixed(2)}, oaths broken ${mean(all.map((r) => r.st.oathBroken)).toFixed(2)}, unwilling uses ${mean(all.map((r) => r.st.unwilling)).toFixed(2)}, invokes ${mean(all.map((r) => r.st.invokes)).toFixed(2)}, guests ${mean(all.map((r) => r.st.guests)).toFixed(2)}`);

  // ---- heroes
  console.log("\nHeroes (non-mirror matches): drafted per match its deck played, score when drafted, felled rate.");
  const nonMirror = recs.filter((r) => r.a !== r.b);
  const heroRows: (string | number)[][] = [];
  for (const d of decks) {
    const rs = nonMirror.filter((r) => r.a === d || r.b === d);
    for (const id of DECK_IDS[d as keyof typeof DECK_IDS]) {
      const def = ALL_DEFS[id];
      if (def.type !== "hero") continue;
      let drafted = 0, s = 0;
      for (const r of rs) {
        const side = seatOf(r, d);
        if (r.st.placed.some((p) => p.side === side && p.id === id && p.how === "draft")) { drafted++; s += sc(r, side); }
      }
      heroRows.push([`${def.name} (${d})`, `V${def.valour} I${def.init}`, def.rarity, (drafted / rs.length).toFixed(2), pct(s / drafted)]);
    }
  }
  table(["hero", "stats", "rarity", "drafted", "score"], heroRows);

  // ---- oaths, geasa, omens
  const cardRows = (type: CardDef["type"], label: string, used: (r: Rec) => { side: Side; id: string }[]) => {
    const rows: (string | number)[][] = [];
    const ids = new Set(Object.values(DECK_IDS).flat().filter((id) => ALL_DEFS[id].type === type));
    for (const id of ids) {
      const holders = decks.filter((d) => DECK_IDS[d as keyof typeof DECK_IDS].includes(id));
      const rs = nonMirror.filter((r) => holders.includes(r.a) || holders.includes(r.b));
      let k = 0, s = 0;
      for (const r of rs) for (const u of used(r)) if (u.id === id) { k++; s += sc(r, u.side); }
      rows.push([ALL_DEFS[id].name, holders.join(","), (k / Math.max(1, rs.length)).toFixed(2), pct(s / k)]);
    }
    console.log(`\n${label}`);
    table(["card", "decks", "per match", "score"], rows);
  };
  cardRows("oath", "Oaths: sworn per match (in matches with a deck holding it), score of the swearer.", (r) => r.st.sworn);
  cardRows("geis", "Geasa: laid per match, score of the binder.", (r) => r.st.bound);
  cardRows("omen", "Omens: turned per match, score of the turner.", (r) => r.st.omensTurned);
  if (args.includes("--cards")) {
    const rows: (string | number)[][] = [];
    const ids = new Set(Object.values(DECK_IDS).flat().filter((id) => ALL_DEFS[id].type === "support"));
    for (const id of ids) {
      const holders = decks.filter((d) => DECK_IDS[d as keyof typeof DECK_IDS].includes(id));
      const rs = nonMirror.filter((r) => holders.includes(r.a) || holders.includes(r.b));
      let dr = 0, sup = 0, eff = 0, s = 0;
      for (const r of rs) {
        for (const p of r.st.placed) if (p.id === id) { if (p.how === "draft") { dr++; s += sc(r, p.side); } else sup++; }
        for (const u of r.st.used) if (u.id === id && u.effect && !u.unwilling) eff++;
      }
      rows.push([ALL_DEFS[id].name, holders.join(","), (dr / rs.length).toFixed(2), (sup / rs.length).toFixed(2), (eff / rs.length).toFixed(2), pct(s / dr)]);
    }
    console.log("\nSupports: drafted / supplanted in / used to effect per match, score of the drafter.");
    table(["card", "decks", "drafted", "supplanted", "used", "score"], rows);
  }
  console.log(`\nRuntime ${((Date.now() - t0) / 1000).toFixed(0)}s for ${recs.length} matches.`);
}

if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => {
    const out: Rec[] = [];
    for (let i = j.from; i < j.to; i++) {
      if (!touched(j, i)) continue;
      const r = runOne(j, i);
      r.st = { ...r.st, used: r.st.used.filter((u) => u.effect || u.unwilling) };
      out.push(r);
    }
    process.send!(out);
  });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
