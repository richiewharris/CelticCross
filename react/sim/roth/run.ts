// Roth Catha scenario runner.
//   npx tsx sim/roth/run.ts                 all scenarios (full counts)
//   npx tsx sim/roth/run.ts --quick         fast pass
//   npx tsx sim/roth/run.ts --ladder --seat --deck --texture --levers   pick scenarios
//   options: --n 2000 (matches per non-Expert row)  --ne 100 (Expert-row scale)  --expert-n 24 --expert-k 3
//            --workers 2  --seed 1  --trace [--seed N] [--p1 skilled --p2 skilled]
import { fork } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { ALL_DEFS, DECKS, type CardDef } from "./cards";
import { newMatch, playOut, type MatchStats, type Policy, type Rules, type Side } from "./engine";
import { makePolicy } from "./ai";
import { hashSeed, Rng } from "./rng";
import { traceMatch } from "./trace";

// ---------------------------------------------------------------- rows and records
interface RowSpec {
  key: string;
  A: string; // level
  B: string;
  mode: "cross" | "mirror"; // cross: Ulster vs Connacht with decks and seats swapped evenly; mirror: same deck
  deck?: string;
  rules: Partial<Rules>;
  n: number;
  texture?: boolean;
}
interface Rec {
  w: -1 | 0 | 1;
  by: string;
  aSide: Side;
  ulster: -1 | 0 | 1;
  felled: [number, number];
  valour: [number, number];
  st: Omit<MatchStats, "placed" | "used" | "bound" | "omensTurned"> & Partial<Pick<MatchStats, "placed" | "used" | "bound" | "omensTurned">>;
}
interface Opts { N: number; K: number; seed: number }

function arrangement(row: RowSpec, i: number) {
  if (row.mode === "mirror") {
    const aSide = (row.A === row.B ? 0 : i % 2) as Side;
    return { aSide, decks: [row.deck!, row.deck!] as [string, string], ulster: -1 as const };
  }
  const c = row.A === row.B ? i % 2 : i % 4;
  const aSide = (c >= 2 ? 1 : 0) as Side;
  const aUlster = c % 2 === 0;
  const ulster = (aUlster ? aSide : 1 - aSide) as Side;
  const decks: [string, string] = ulster === 0 ? ["ulster", "connacht"] : ["connacht", "ulster"];
  return { aSide, decks, ulster };
}

function runOne(row: RowSpec, i: number, o: Opts): Rec {
  const { aSide, decks, ulster } = arrangement(row, i);
  const seed = hashSeed(o.seed, row.key, i);
  const S = newMatch([DECKS[decks[0]], DECKS[decks[1]]], row.rules, seed);
  const lv: [string, string] = aSide === 0 ? [row.A, row.B] : [row.B, row.A];
  const pols = lv.map((l) => makePolicy(l, { N: o.N, K: o.K })) as [Policy, Policy];
  const r = playOut(S, pols, [new Rng(hashSeed(seed, "p1")), new Rng(hashSeed(seed, "p2"))], false);
  const st = S.stats!;
  const keep = row.texture ? st : { ...st, placed: undefined, used: undefined, bound: undefined, omensTurned: undefined };
  return { w: r.winner, by: r.decidedBy, aSide, ulster, felled: r.felled, valour: r.valour, st: keep };
}

// ---------------------------------------------------------------- stats helpers
const isExpert = (r: RowSpec) => r.A === "expert" || r.B === "expert";
const pctS = (x: number) => (100 * x).toFixed(1).padStart(5) + "%";
function score(recs: Rec[], side: (r: Rec) => number) {
  let s = 0, s2 = 0;
  for (const r of recs) { const v = r.w === -1 ? 0.5 : r.w === side(r) ? 1 : 0; s += v; s2 += v * v; }
  const n = recs.length, m = s / n;
  const sd = Math.sqrt(Math.max(0, s2 / n - m * m));
  return { m, moe: (1.96 * sd) / Math.sqrt(n) };
}
const frac = (recs: Rec[], f: (r: Rec) => boolean) => recs.filter(f).length / recs.length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pm = (x: { m: number; moe: number }) => `${pctS(x.m)} ±${(100 * x.moe).toFixed(1)}`;

function table(head: string[], rows: (string | number)[][]) {
  const all = [head, ...rows.map((r) => r.map(String))];
  const w = head.map((_, j) => Math.max(...all.map((r) => r[j].length)));
  const line = (r: string[]) => "  " + r.map((c, j) => (j === 0 ? c.padEnd(w[j]) : c.padStart(w[j]))).join("  ");
  console.log(line(head));
  console.log("  " + w.map((x) => "-".repeat(x)).join("  "));
  for (const r of all.slice(1)) console.log(line(r));
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- main
async function main() {
  const args = process.argv.slice(2);
  const flag = (f: string) => args.includes(`--${f}`);
  const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
  const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
  const quick = flag("quick");
  const o: Opts = { N: num("expert-n", quick ? 8 : 24), K: num("expert-k", quick ? 2 : 3), seed: num("seed", 1) };

  if (flag("trace")) {
    const S = newMatch([DECKS[str("d1", "ulster")], DECKS[str("d2", "connacht")]], {}, o.seed);
    const lines = traceMatch(S, [makePolicy(str("p1", "skilled"), o), makePolicy(str("p2", "skilled"), o)], [new Rng(o.seed * 2 + 1), new Rng(o.seed * 2 + 2)]);
    console.log(lines.join("\n"));
    return;
  }

  const n = num("n", quick ? 300 : 2000);
  const ne = num("ne", quick ? 6 : 80); // Expert-row scale
  const scen = ["ladder", "seat", "deck", "texture", "levers"].filter(flag);
  const want = (s: string) => scen.length === 0 || scen.includes(s);
  const levels = ["novice", "casual", "skilled", "expert"];
  const rowsByKey = new Map<string, RowSpec>();
  const row = (A: string, B: string, mode: "cross" | "mirror", rules: Partial<Rules>, count: number, deck?: string, texture = false): RowSpec => {
    const key = `${A}-${B}-${mode}-${deck ?? ""}-${JSON.stringify(rules)}`;
    const ex = rowsByKey.get(key);
    if (ex) { ex.n = Math.max(ex.n, count); ex.texture ||= texture; return ex; }
    const r: RowSpec = { key, A, B, mode, deck, rules, n: count, texture };
    rowsByKey.set(key, r);
    return r;
  };
  const eCount = (A: string, B: string, scale: number) => (A === "expert" || B === "expert" ? Math.max(2, Math.round(ne * scale)) : n);

  // scenario definitions
  const ladder: RowSpec[] = [];
  if (want("ladder")) for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const [A, B] = [levels[j], levels[i]];
    ladder.push(row(A, B, "cross", {}, eCount(A, B, B === "skilled" ? 2 : 1)));
  }
  const seat: RowSpec[] = [];
  if (want("seat")) for (const L of levels) for (const D of ["ulster", "connacht"]) seat.push(row(L, L, "mirror", {}, eCount(L, L, 0.6), D));
  const seatVariants: [string, Partial<Rules>][] = [
    ["rules as written", {}],
    ["blind heroes (no counter-pick)", { blindHeroes: true }],
    ["Init ties by coin flip", { initTie: "random" }],
    ["blind + coin flip", { blindHeroes: true, initTie: "random" }],
  ];
  const decomp: { L: string; label: string; rows: RowSpec[] }[] = [];
  if (want("seat")) for (const L of ["casual", "skilled", "expert"]) for (const [label, rules] of seatVariants) {
    if (L === "expert" && label.includes("coin")) continue; // Expert: only as written vs blind (runtime)
    decomp.push({ L, label, rows: ["ulster", "connacht"].map((D) => row(L, L, "mirror", rules, eCount(L, L, 0.6), D)) });
  }
  const deckRows: RowSpec[] = [];
  if (want("deck") || want("texture")) for (const L of levels) deckRows.push(row(L, L, "cross", {}, eCount(L, L, 1.2), undefined, L === "skilled" || L === "expert"));
  const leverVariants: [string, Partial<Rules>][] = [
    ["rules as written", {}],
    ["starting Valour +1", { valourBonus: 1 }],
    ["geis break cost 1", { geisBreakCost: 1 }],
    ["geis break cost 3", { geisBreakCost: 3 }],
    ["3 Omen spots", { omenSpots: 3 }],
    ["omens kept until combat", { keepOmensUntilCombat: true }],
    ["blind first heroes", { blindHeroes: true }],
  ];
  const levers: { label: string; ss: RowSpec; sn: RowSpec; en: RowSpec }[] = [];
  if (want("levers")) for (const [label, rules] of leverVariants) {
    levers.push({ label, ss: row("skilled", "skilled", "cross", rules, n), sn: row("skilled", "novice", "cross", rules, n), en: row("expert", "novice", "cross", rules, eCount("expert", "novice", 0.6)) });
  }

  // run everything through a worker pool
  const rows = [...rowsByKey.values()];
  const results = new Map<string, Rec[]>(rows.map((r) => [r.key, []]));
  const jobs: { row: RowSpec; from: number; to: number; cost: number }[] = [];
  for (const r of rows) {
    const chunk = isExpert(r) ? 2 : 250;
    const per = r.A === "expert" && r.B === "expert" ? 2000 : isExpert(r) ? 1000 : r.A === "skilled" || r.B === "skilled" ? 10 : 1;
    for (let i = 0; i < r.n; i += chunk) jobs.push({ row: r, from: i, to: Math.min(r.n, i + chunk), cost: per * (Math.min(r.n, i + chunk) - i) });
  }
  jobs.sort((a, b) => b.cost - a.cost);
  const W = Math.max(1, num("workers", Math.min(cpus().length, 8)));
  const totalCost = jobs.reduce((a, j) => a + j.cost, 0);
  const totalMatches = rows.reduce((a, r) => a + r.n, 0);
  console.log(`Roth Catha sim: ${rows.length} rows, ${totalMatches} matches, ${W} workers, Expert N=${o.N} K=${o.K}, seed ${o.seed}${quick ? " (quick)" : ""}`);
  const t0 = Date.now();
  let doneCost = 0, lastLog = 0;
  await new Promise<void>((resolve, reject) => {
    let next = 0, active = 0;
    const self = fileURLToPath(import.meta.url);
    for (let w = 0; w < W; w++) {
      const child = fork(self, ["--worker"], { stdio: ["inherit", "inherit", "inherit", "ipc"] });
      const feed = () => {
        if (next >= jobs.length) { child.disconnect(); if (active === 0) resolve(); return; }
        const j = jobs[next++];
        active++;
        child.send({ row: j.row, from: j.from, to: j.to, o });
        (child as unknown as { _job: typeof j })._job = j;
      };
      child.on("message", (m: { key: string; from: number; recs: Rec[] }) => {
        active--;
        const j = (child as unknown as { _job: (typeof jobs)[number] })._job;
        doneCost += j.cost;
        results.get(m.key)!.push(...m.recs);
        const now = Date.now();
        if (now - lastLog > 15000) { lastLog = now; process.stderr.write(`  ... ${((100 * doneCost) / totalCost).toFixed(0)}% (${((now - t0) / 1000).toFixed(0)}s)\n`); }
        feed();
      });
      child.on("error", reject);
      child.on("exit", (code) => { if (code) reject(new Error(`worker exited ${code}`)); });
      feed();
    }
  });
  const secs = (Date.now() - t0) / 1000;
  const R = (r: RowSpec) => results.get(r.key)!;
  const lvName = (r: RowSpec) => `${cap(r.A)} vs ${cap(r.B)}`;

  // ---- 1. skill ladder
  if (ladder.length) {
    console.log("\n1. Skill ladder (Ulster vs Connacht, decks and seats swapped evenly). Score = win + ½ draw for the first-named.");
    table(["pairing", "n", "win", "draw", "loss", "score ±95%"], ladder.map((r) => {
      const rs = R(r);
      return [lvName(r), rs.length, pctS(frac(rs, (x) => x.w === x.aSide)), pctS(frac(rs, (x) => x.w === -1)), pctS(frac(rs, (x) => x.w === 1 - x.aSide)), pm(score(rs, (x) => x.aSide))];
    }));
  }

  // ---- 2. seat balance
  if (seat.length) {
    console.log("\n2. Seat balance (mirror matches, same deck both sides). P2 edge = P2 score − P1 score.");
    table(["level", "deck", "n", "P1 win", "P2 win", "draw", "P2 edge ±95%", "Init-tie duels", "P2 strikes first"], seat.map((r) => {
      const rs = R(r);
      const p2 = score(rs, () => 1);
      return [cap(r.A), cap(r.deck!), rs.length, pctS(frac(rs, (x) => x.w === 0)), pctS(frac(rs, (x) => x.w === 1)), pctS(frac(rs, (x) => x.w === -1)), `${((2 * p2.m - 1) * 100).toFixed(1).padStart(5)} ±${(200 * p2.moe).toFixed(1)}`, pctS(mean(rs.map((x) => x.st.initTies / 2))), pctS(mean(rs.map((x) => x.st.p2First / 2)))];
    }));
    console.log("\n   Where P2's edge comes from (both mirrors pooled):");
    table(["level", "variant", "n", "P2 edge ±95%"], decomp.map((d) => {
      const rs = d.rows.flatMap(R);
      const p2 = score(rs, () => 1);
      return [cap(d.L), d.label, rs.length, `${((2 * p2.m - 1) * 100).toFixed(1).padStart(5)} ±${(200 * p2.moe).toFixed(1)}`];
    }));
  }

  // ---- 3. deck balance
  if (want("deck")) {
    console.log("\n3. Deck balance (Ulster vs Connacht at equal skill, seats swapped).");
    table(["level", "n", "Ulster win", "draw", "Connacht win", "Ulster score ±95%", "P1 score ±95%"], deckRows.map((r) => {
      const rs = R(r);
      return [cap(r.A), rs.length, pctS(frac(rs, (x) => x.w === x.ulster)), pctS(frac(rs, (x) => x.w === -1)), pctS(frac(rs, (x) => x.w !== -1 && x.w !== x.ulster)), pm(score(rs, (x) => x.ulster)), pm(score(rs, () => 0))];
    }));
  }

  // ---- 4. game texture
  if (want("texture")) {
    const tex = deckRows.filter((r) => r.texture);
    console.log("\n4. Game texture (Ulster vs Connacht, seats swapped).");
    const metric = (label: string, f: (rs: Rec[]) => string) => [label, ...tex.map((r) => f(R(r)))];
    const per = (f: (x: Rec) => number) => (rs: Rec[]) => mean(rs.map(f)).toFixed(2);
    const actShare = (k: "omen" | "bind" | "supplant" | "hold") => (rs: Rec[]) => {
      const tot = rs.reduce((a, x) => a + x.st.actions.omen + x.st.actions.bind + x.st.actions.supplant + x.st.actions.hold, 0);
      return pctS(rs.reduce((a, x) => a + x.st.actions[k], 0) / tot);
    };
    table(["metric", ...tex.map(lvName)], [
      metric("matches", (rs) => String(rs.length)),
      metric("turns taken per duel (max 4)", (rs) => mean(rs.flatMap((x) => x.st.exchanges)).toFixed(2)),
      metric("duels ending early (a hero fell)", (rs) => pctS(mean(rs.flatMap((x) => x.st.exchanges.map((e) => (e < 4 ? 1 : 0)))))),
      metric("heroes felled per match", per((x) => x.felled[0] + x.felled[1])),
      metric("decided by heroes felled", (rs) => pctS(frac(rs, (x) => x.by === "felled"))),
      metric("decided by Valour tie-break", (rs) => pctS(frac(rs, (x) => x.by === "valour"))),
      metric("decided by first-duel tie-break", (rs) => pctS(frac(rs, (x) => x.by === "firstDuel"))),
      metric("draws", (rs) => pctS(frac(rs, (x) => x.by === "draw"))),
      metric("playing turn: Turn an Omen", actShare("omen")),
      metric("playing turn: Bind", actShare("bind")),
      metric("playing turn: Supplant", actShare("supplant")),
      metric("playing turn: Hold", actShare("hold")),
      metric("geasa broken per match", per((x) => x.st.geisBroken)),
      metric("Cathbad ignores per match", per((x) => x.st.cathbadIgnores)),
      metric("Unwilling supports used per match", per((x) => x.st.unwilling)),
      metric("Invoke triggers per match", per((x) => x.st.invokes)),
      metric("guests used per match", per((x) => x.st.guests)),
      metric("duels with an Initiative tie", (rs) => pctS(mean(rs.map((x) => x.st.initTies / 2)))),
      metric("duels where P2 strikes first", (rs) => pctS(mean(rs.map((x) => x.st.p2First / 2)))),
    ]);
    for (const r of tex) cardTable(lvName(r), R(r));
  }

  // ---- 5. levers
  if (levers.length) {
    console.log("\n5. Lever tests. S v S = Skilled vs Skilled (Ulster vs Connacht, seats swapped); gap rows score the stronger side vs Novice.");
    table(["variant", "S v S n", "Ulster score", "P1 score", "draws", "tie-breaks", "felled/match", "turns/duel", "Skilled v Novice", "Expert v Novice (n)"], levers.map((l) => {
      const ss = R(l.ss), sn = R(l.sn), en = R(l.en);
      return [l.label, ss.length, pm(score(ss, (x) => x.ulster)), pm(score(ss, () => 0)), pctS(frac(ss, (x) => x.w === -1)), pctS(frac(ss, (x) => x.by !== "felled")),
        mean(ss.map((x) => x.felled[0] + x.felled[1])).toFixed(2), mean(ss.flatMap((x) => x.st.exchanges)).toFixed(2), pm(score(sn, (x) => x.aSide)), `${pm(score(en, (x) => x.aSide))} (${en.length})`];
    }));
  }
  console.log(`\nRuntime: ${secs.toFixed(0)}s for ${totalMatches} matches (${W} workers).`);
}

// ---------------------------------------------------------------- card table
function cardTable(label: string, rs: Rec[]) {
  const n = rs.length;
  type Row = { drafted: number; supIn: number; used: number; unw: number; win: number; winN: number; bound: number; turned: number };
  const t = new Map<string, Row>();
  const g = (id: string) => { let r = t.get(id); if (!r) { r = { drafted: 0, supIn: 0, used: 0, unw: 0, win: 0, winN: 0, bound: 0, turned: 0 }; t.set(id, r); } return r; };
  const sc = (x: Rec, side: Side) => (x.w === -1 ? 0.5 : x.w === side ? 1 : 0);
  for (const x of rs) {
    for (const p of x.st.placed ?? []) {
      const r = g(p.id);
      if (p.how === "draft") { r.drafted++; r.win += sc(x, p.side); r.winN++; } else r.supIn++;
    }
    for (const u of x.st.used ?? []) { const r = g(u.id); if (u.unwilling) r.unw++; else if (u.effect) r.used++; }
    for (const b of x.st.bound ?? []) { const r = g(b.id); r.bound++; r.win += sc(x, b.side); r.winN++; }
    for (const o of x.st.omensTurned ?? []) { const r = g(o.id); r.turned++; r.win += sc(x, o.side); r.winN++; }
  }
  console.log(`\n   Cards in ${label} (${n} matches; per match, both players together; win% = score of the player who drafted/laid/turned it):`);
  const order = Object.values(ALL_DEFS).filter((d: CardDef) => d.type !== "unknown");
  const rows: (string | number)[][] = [];
  for (const d of order) {
    const r = t.get(d.id) ?? { drafted: 0, supIn: 0, used: 0, unw: 0, win: 0, winN: 0, bound: 0, turned: 0 };
    const placedish = d.type === "geis" ? r.bound : d.type === "omen" ? r.turned : r.drafted;
    const wr = r.winN ? r.win / r.winN : NaN;
    let flag = "";
    if (d.type === "support" && placedish + r.supIn > 0 && r.used / Math.max(1, placedish + r.supIn) < 0.15) flag = "dead? (rarely used to effect)";
    if (r.winN >= 30 && wr >= 0.62) flag = (flag ? flag + "; " : "") + "strong";
    if (r.winN >= 30 && wr <= 0.38) flag = (flag ? flag + "; " : "") + "weak";
    if (d.type !== "hero" && placedish === 0 && r.supIn === 0) flag = "never played";
    rows.push([
      d.name + ("testOnly" in d && d.testOnly ? " [test]" : ""), d.type,
      (placedish / n).toFixed(2), d.type === "support" ? (r.supIn / n).toFixed(2) : "", d.type === "support" ? (r.used / n).toFixed(2) : "", d.type === "support" ? (r.unw / n).toFixed(2) : "",
      Number.isNaN(wr) ? "" : pctS(wr), flag,
    ]);
  }
  table(["card", "type", "placed*", "supplanted in", "used to effect", "unwilling", "win%", "flag"], rows);
  console.log("   * placed = drafted (heroes, supports), laid by Bind (geasa), turned face up (omens).");
}

// ---------------------------------------------------------------- worker mode
if (process.argv.includes("--worker")) {
  process.on("message", (m: { row: RowSpec; from: number; to: number; o: Opts }) => {
    const recs: Rec[] = [];
    for (let i = m.from; i < m.to; i++) recs.push(runOne(m.row, i, m.o));
    process.send!({ key: m.row.key, from: m.from, recs });
  });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}

