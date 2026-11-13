// The computer's levels as a player meets them: how long each takes per decision (by kind of decision), and what it
// chooses. Each level plays itself across the deck pairings with the game's own decks.
//   npx tsx sim/roth/levels.ts [--levels novice,casual,skilled,expert@16x3] [--n 1] [--seed 1]
import { DECKS, FACTIONS } from "../../src/games/roth/engine/cards";
import { applyDecision, newMatch, nextDecision, toDeath, type Policy, type State } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

const args = process.argv.slice(2);
const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
const levels = str("levels", "novice,casual,skilled,expert@16x3").split(",");
const n = Number(str("n", "1")), seed = Number(str("seed", "1"));
const pct = (x: number) => (100 * x).toFixed(1) + "%";
for (const lv of levels) {
  const times = new Map<string, number[]>();
  const chose = new Map<string, number>();
  let matches = 0, duelTurns = 0, duels = 0, felled = 0, geis = 0, oath = 0, champs = 0, guests = 0, swear = 0;
  const t0 = Date.now();
  for (const a of FACTIONS) for (const b of FACTIONS) if (a !== b) for (let i = 0; i < n; i++) {
    const s = hashSeed(seed, `lv-${a}-${b}`, i);
    const S: State = newMatch([DECKS[a], DECKS[b]], {}, s);
    const P = [makePolicy(lv, { N: 16, K: 3 }), makePolicy(lv, { N: 16, K: 3 })] as [Policy, Policy];
    const R = [new Rng(hashSeed(s, 1)), new Rng(hashSeed(s, 2))];
    for (let g = 0; g < 20000; g++) {
      const d = nextDecision(S);
      if (!d) break;
      let k = 0;
      if (d.options.length > 1) {
        const kind = d.kind === "duel" || d.kind === "block" || d.kind === "drawn" ? (toDeath(S) ? `${d.kind} (to the death)` : `${d.kind} (first duel)`) : d.kind;
        const t = performance.now();
        k = P[d.player].choose(S, d, R[d.player]);
        (times.get(kind) ?? times.set(kind, []).get(kind)!).push(performance.now() - t);
        const o = d.options[k] as { t: string; act?: string; cry?: boolean; guest?: number };
        const what = `${kind}: ${o.t}${o.act ? ":" + o.act : ""}${o.cry ? "+cry" : ""}${o.guest !== undefined && o.guest >= 0 ? " (guest)" : ""}`;
        chose.set(what, (chose.get(what) ?? 0) + 1);
      }
      applyDecision(S, d, k);
    }
    matches++;
    const st = S.stats!;
    for (const du of st.duels ?? []) { duels++; duelTurns += du.turns ?? 0; felled += (du.felled[0] ? 1 : 0) + (du.felled[1] ? 1 : 0); }
    geis += st.geisBroken; oath += st.oathBroken; champs += st.champions; guests += st.guests; swear += st.actions.swear;
  }
  console.log(`\n== ${lv}: ${matches} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  per match: heroes felled ${(felled / matches).toFixed(2)}, turns per duel ${(duelTurns / Math.max(1, duels)).toFixed(1)}, geasa broken ${(geis / matches).toFixed(2)}, oaths sworn ${(swear / matches).toFixed(2)}, broken ${(oath / matches).toFixed(2)}, champions ${(champs / matches).toFixed(2)}, guests ${(guests / matches).toFixed(2)}`);
  console.log("  time per decision (ms): kind, decisions per match, mean, 95th percentile, slowest");
  for (const [k, v] of [...times].sort((x, y) => y[1].reduce((a, b) => a + b, 0) - x[1].reduce((a, b) => a + b, 0))) {
    const s2 = v.slice().sort((x, y) => x - y);
    console.log(`    ${k.padEnd(26)} ${(v.length / matches).toFixed(1).padStart(6)} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1).padStart(8)} ${s2[Math.floor(0.95 * (s2.length - 1))].toFixed(1).padStart(8)} ${s2[s2.length - 1].toFixed(0).padStart(7)}`);
  }
  console.log("  what it chose (share of decisions of that kind):");
  const byKind = new Map<string, number>();
  for (const [w, c] of chose) { const k = w.split(": ")[0]; byKind.set(k, (byKind.get(k) ?? 0) + c); }
  for (const [w, c] of [...chose].sort()) console.log(`    ${w.padEnd(44)} ${pct(c / byKind.get(w.split(": ")[0])!)}`);
}
