// The fast calculator (engine/calc.ts calc3Terms) against the table calculator it stands in for (calc2Terms): time per
// position and how closely the terms agree, over the duel positions of real matches (in order, as a search meets them).
//   npx tsx sim/roth/fastcheck.ts [--matches 6] [--level casual]
import { DECKS, FACTIONS } from "../../src/games/roth/engine/cards";
import { actorOf, applyDecision, cloneState, newMatch, nextDecision, toDeath, type Policy, type State } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { CALC2_TERMS, calc2Terms, calc3Terms, clearFast, FAST } from "../../src/games/roth/engine/calc";
import { Rng } from "../../src/games/roth/engine/rng";

const args = process.argv.slice(2);
const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
const level = (() => { const i = args.indexOf("--level"); return i >= 0 ? args[i + 1] : "casual"; })();
const pos: State[] = [];
for (let m = 0; m < num("matches", 6); m++) {
  const A = FACTIONS[m % 6], B = FACTIONS[(m * 5 + 1) % 6];
  const S = newMatch([DECKS[A], DECKS[B]], {}, 100 + m);
  const P = [makePolicy(level), makePolicy(level)] as [Policy, Policy];
  const R = [new Rng(m * 2 + 1), new Rng(m * 2 + 2)];
  for (let g = 0; g < 5000; g++) {
    const d = nextDecision(S);
    if (!d) break;
    const C = S.combat;
    if (d.kind === "duel" && C && toDeath(S) && C.stage === "turns" && !C.pending && !C.drawn) pos.push(cloneState(S));
    applyDecision(S, d, P[d.player].choose(S, d, R[d.player]));
  }
}
const time = (f: (S: State) => unknown) => { const t0 = performance.now(); const out = pos.map((S) => f(S)); return { ms: (performance.now() - t0) / pos.length, out }; };
const slow = time((S) => calc2Terms(S, actorOf(S.combat!)));
clearFast();
const cold = time((S) => calc3Terms(S, actorOf(S.combat!)));
const coldStats = { hits: FAST.hits, misses: FAST.misses };
const warm = time((S) => calc3Terms(S, actorOf(S.combat!)));
console.log(`${pos.length} positions. table calculator ${slow.ms.toFixed(3)} ms; fast, first pass ${cold.ms.toFixed(3)} ms (${coldStats.misses} measured, ${coldStats.hits} kept); fast, kept ${(warm.ms * 1000).toFixed(1)} µs`);
for (const k of CALC2_TERMS) {
  let n = 0, same = 0, sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0;
  slow.out.forEach((a, i) => {
    const b = cold.out[i] as Record<string, number> | null, x = a as Record<string, number> | null;
    if (!x || !b) return;
    n++; if (Math.abs(x[k] - b[k]) < 1e-6) same++;
    sa += x[k]; sb += b[k]; sab += x[k] * b[k]; saa += x[k] ** 2; sbb += b[k] ** 2;
  });
  const r = (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
  console.log(`  ${k.padEnd(11)} equal ${((100 * same) / n).toFixed(1)}%  correlation ${r.toFixed(3)}`);
}
// --decide a,b,c: the time each policy takes per duel decision over the same positions (and how often it agrees with the first)
const di = args.indexOf("--decide");
if (di >= 0) {
  const levels = args[di + 1].split(",");
  const picks: number[][] = [];
  for (const lv of levels) {
    clearFast();
    const P = makePolicy(lv);
    const rng = new Rng(7);
    const t0 = performance.now();
    picks.push(pos.map((S) => { const d = nextDecision(S)!; return P.choose(cloneState(S), d, rng); }));
    const ms = (performance.now() - t0) / pos.length;
    const agree = picks[0].filter((x, i) => x === picks[picks.length - 1][i]).length / pos.length;
    console.log(`  ${lv.padEnd(14)} ${ms.toFixed(1)} ms per decision; same choice as ${levels[0]} ${(100 * agree).toFixed(0)}%${FAST.hits + FAST.misses ? `; repertoires measured ${FAST.misses}, kept ${FAST.hits}` : ""}`);
  }
}
// --keys: which parts of the standing key make the kept repertoires miss (how many entries would merge without each)
if (args.includes("--keys")) {
  const keys = [...FAST.map.keys()].map((k) => k.split("|"));
  const names = "p setting board qgeis qoath ggeis omens hostAdj duel hs broken cap focus stagger armour mound bleed cried ebbed block nextStrike cathbad kingsDue champ sacrificed summoned rested init pile".split(" ");
  console.log(`${keys.length} kept entries; merged without each part:`);
  for (let i = 0; i < names.length; i++) { const s = new Set(keys.map((k) => k.filter((_, j) => j !== i).join("|"))); const m = keys.length - s.size; if (m) console.log(`  ${names[i].padEnd(11)} ${m}`); }
}
