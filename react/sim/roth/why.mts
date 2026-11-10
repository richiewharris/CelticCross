// Why does a deck win or lose? Plays one deck against each of the others and breaks down where damage came from.
//   npx tsx sim/roth/why.ts sidhe [--n 200] [--tuned]
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ALL_DEFS, DECK_IDS, FACTIONS } from "../../src/games/roth/engine/cards";
import { newMatch, playOut, type MatchStats, type Policy } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";
import TUNED from "../../src/games/roth/engine/computerDecks.json";

interface Job { me: string; opp: string; from: number; to: number; tuned: boolean }
interface Rec { opp: string; score: number; mine: number; fx: MatchStats["fx"]; oppOmens: string[]; oppGeasa: string[]; myHeroes: string[]; felled: string[] }
const deckOf = (f: string, tuned: boolean) => (tuned ? (TUNED as Record<string, string[]>)[f] : DECK_IDS[f as keyof typeof DECK_IDS]).map((x) => ALL_DEFS[x]);

if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => {
    const out: Rec[] = [];
    for (let i = j.from; i < j.to; i++) {
      const side = i % 2, seed = hashSeed(31, `${j.me}-${j.opp}`, i);
      const A = deckOf(j.me, j.tuned), B = deckOf(j.opp, j.tuned);
      const S = newMatch(side === 0 ? [A, B] : [B, A], {}, seed, true);
      const r = playOut(S, [makePolicy("skilled"), makePolicy("skilled")] as [Policy, Policy], [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))], false);
      const st = S.stats!;
      const o = 1 - side;
      const C = S.combat;
      const felled: string[] = [];
      if (C) for (const d of [0, 1]) if (C.felled[d][side]) { const spot = d === 0 ? (side === 0 ? 0 : 6) : (side === 0 ? 3 : 9); felled.push(S.board[spot]?.def.id ?? "?"); }
      out.push({
        opp: j.opp, score: r.winner === -1 ? 0.5 : r.winner === side ? 1 : 0, mine: side, fx: st.fx,
        oppOmens: st.omensTurned.filter((x) => x.side === o).map((x) => x.id),
        oppGeasa: st.bound.filter((x) => x.side === o).map((x) => x.id),
        myHeroes: [0, 3, 6, 9].filter((sp) => (sp < 6 ? 0 : 1) === side).map((sp) => S.board[sp]?.def.id ?? "?"),
        felled,
      });
    }
    process.send!(out);
  });
} else {
  const args = process.argv.slice(2);
  const me = args[0];
  const n = Number(args[args.indexOf("--n") + 1]) || 200;
  const tuned = args.includes("--tuned");
  const jobs: Job[] = [];
  const only = args.includes("--vs") ? args[args.indexOf("--vs") + 1].split(",") : null;
  for (const f of FACTIONS) if (f !== me && (!only || only.includes(f))) for (let i = 0; i < n; i += 50) jobs.push({ me, opp: f, from: i, to: Math.min(n, i + 50), tuned });
  const recs: Rec[] = [];
  let next = 0;
  await new Promise<void>((resolve) => { let live = 2;
    for (let w = 0; w < 2; w++) { const c = fork(fileURLToPath(import.meta.url), ["--worker"]);
      const feed = () => { if (next >= jobs.length) { c.disconnect(); if (--live === 0) resolve(); return; } c.send(jobs[next++]); };
      c.on("message", (m: Rec[]) => { recs.push(...m); feed(); }); feed(); } });
  const pct = (x: number) => (100 * x).toFixed(0) + "%";
  const f1 = (x: number) => x.toFixed(2);
  console.log(`${me} (${tuned ? "tuned decks" : "starter decks"}) at Skilled, n=${n} per opponent. "me" = ${me}, "them" = the opponent.\n`);
  const head = ["opponent", "score", "dmg/duel me", "them", "weak-hit% me", "them", "beats% me", "them", "Valour lost at start me", "them", "Init lost me", "them", "strike 1st me", "Shield/blunt soaked of mine", "Valour paid breaking me", "them"];
  console.log(head.join(" | "));
  for (const f of FACTIONS) {
    if (f === me) continue;
    const rs = recs.filter((r) => r.opp === f);
    if (!rs.length) continue;
    const sum = (k: keyof MatchStats["fx"], who: "me" | "them") => rs.reduce((a, r) => a + r.fx[k][who === "me" ? r.mine : 1 - r.mine], 0);
    const duelsMe = sum("duels", "me"), duelsThem = sum("duels", "them");
    const row = [
      f, pct(rs.reduce((a, r) => a + r.score, 0) / rs.length),
      f1(sum("dmg", "me") / duelsMe), f1(sum("dmg", "them") / duelsThem),
      pct(sum("weakHits", "me") / sum("strikes", "me")), pct(sum("weakHits", "them") / sum("strikes", "them")),
      pct(sum("beatsHits", "me") / sum("strikes", "me")), pct(sum("beatsHits", "them") / sum("strikes", "them")),
      f1(sum("startLoss", "me") / duelsMe), f1(sum("startLoss", "them") / duelsThem),
      f1(sum("initLoss", "me") / duelsMe), f1(sum("initLoss", "them") / duelsThem),
      pct(sum("first", "me") / (sum("first", "me") + sum("first", "them"))),
      pct((sum("soaked", "me") + sum("blunted", "me")) / Math.max(1, sum("dmg", "me") + sum("soaked", "me") + sum("blunted", "me"))),
      f1(sum("broke", "me") / duelsMe), f1(sum("broke", "them") / duelsThem),
    ];
    console.log(row.join(" | "));
  }
  // what the opponents played that hurt
  const base = recs.reduce((a, r) => a + r.score, 0) / recs.length;
  const lift = (key: (r: Rec) => string[]) => {
    const m = new Map<string, { n: number; s: number }>();
    for (const r of recs) for (const id of new Set(key(r))) { const x = m.get(id) ?? { n: 0, s: 0 }; x.n++; x.s += r.score; m.set(id, x); }
    return [...m].filter(([, v]) => v.n >= 30).map(([id, v]) => ({ id, n: v.n, d: v.s / v.n - base })).sort((a, b) => a.d - b.d);
  };
  console.log(`\nOverall ${pct(base)}. Opponents' omens turned, by ${me}'s score when they were (vs ${pct(base)} overall), worst first:`);
  for (const x of lift((r) => r.oppOmens).slice(0, 8)) console.log(`  ${ALL_DEFS[x.id]?.name.padEnd(30)} ${(100 * x.d).toFixed(1).padStart(6)} pts  n=${x.n}`);
  console.log(`\nGeasa the opponents laid, worst first:`);
  for (const x of lift((r) => r.oppGeasa).slice(0, 8)) console.log(`  ${ALL_DEFS[x.id]?.name.padEnd(30)} ${(100 * x.d).toFixed(1).padStart(6)} pts  n=${x.n}`);
  console.log(`\n${me}'s heroes: how often each is felled when it fights`);
  const hm = new Map<string, { n: number; f: number; s: number }>();
  // a joined host's id is "host:monster+monster"; count it by host type and size, and each monster in it
  const keys = (h: string) => h.includes(":") ? [`${h.split(":")[0]} with ${h.split(":")[1].split("+").length}`, ...h.split(":")[1].split("+").map((m) => `  in a host: ${m}`)] : [h];
  for (const r of recs) for (const h of r.myHeroes) for (const k of keys(h)) { const x = hm.get(k) ?? { n: 0, f: 0, s: 0 }; x.n++; x.s += r.score; if (r.felled.includes(h)) x.f++; hm.set(k, x); }
  for (const [h, x] of [...hm].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${(ALL_DEFS[h]?.name ?? h).padEnd(30)} fought ${String(x.n).padStart(4)}  felled ${pct(x.f / x.n).padStart(4)}  score ${pct(x.s / x.n)}`);
}
