// Self-play simulator for Fiche, built on the same engine as the game.
// Usage: npx tsx sim/fiche-sim.ts --matches 20000 --p1 3 --p2 1 [--best 3] [--seed 1]
import { aiChoice, LEVEL_NAMES } from "../src/games/fiche/engine/ai";
import { ALL, sample, seeded } from "../src/games/fiche/engine/dice";
import { newMatch, nextRound, applyRoll, type Game, type Level } from "../src/games/fiche/engine/game";
import { V } from "../src/games/fiche/engine/odds";

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const matches = opt("matches", 20000), lvl1 = opt("p1", 3) as Level, lvl2 = opt("p2", 3) as Level;
const best = opt("best", 3) as 3 | 5, rng = seeded(opt("seed", 1));

const tally = { p1: 0, p2: 0 }, rounds = { p1: 0, p2: 0, draw: 0, starter: 0, total: 0 };
const why: Record<string, number> = {};
let rolls = 0;
const t0 = Date.now();
for (let m = 0; m < matches; m++) {
  let g: Game = newMatch({ mode: "cpu", lvl: lvl1, best }, rng);
  while (!g.M.over) {
    if (g.R.over) { g = nextRound(g); continue; }
    const starter = g.R.turn;
    while (!g.R.over) {
      const d = aiChoice(g.R, g.R.turn === 1 ? lvl1 : lvl2, rng);
      g = applyRoll(g, d, sample(d, rng), rng());
      rolls++;
    }
    const w = g.R.over.winner;
    rounds.total++;
    if (w === 1) rounds.p1++; else if (w === 2) rounds.p2++; else rounds.draw++;
    if (w === starter) rounds.starter++;
    why[g.R.over.why] = (why[g.R.over.why] ?? 0) + 1;
  }
  if (g.M.over === 1) tally.p1++; else tally.p2++;
}
const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1)}%`;
console.log(`P1 ${LEVEL_NAMES[lvl1]} vs P2 ${LEVEL_NAMES[lvl2]}, best of ${best}, ${matches} matches`);
console.log(`matches: P1 ${pct(tally.p1, matches)} · P2 ${pct(tally.p2, matches)}`);
console.log(`rounds: P1 ${pct(rounds.p1, rounds.total)} · P2 ${pct(rounds.p2, rounds.total)} · drawn ${pct(rounds.draw, rounds.total)} · starter wins ${pct(rounds.starter, rounds.total)}`);
console.log(`endings ${JSON.stringify(why)} · ${(rolls / rounds.total).toFixed(2)} rolls a round · ${(rounds.total / matches).toFixed(2)} rounds a match`);
console.log(`coach: the starter's value with best play is ${V(0, ALL, ALL, -1).toFixed(4)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
