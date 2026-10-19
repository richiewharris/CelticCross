// Self-play simulator for Fidchell of Cups, built on the same engine as the game.
// Usage: npx tsx sim/fidchell-cups-sim.ts --games 200 --mead 3 --wine 2 [--one] [--seed 1]
import { LEVELS, bestPlan, bestToastTarget, type Level } from "../src/games/fidchell-cups/engine/ai";
import { MEAD, d6, legalNow, move, passTurn, rollAgain, rollOutcome, toast, withDice, type State } from "../src/games/fidchell-cups/engine/rules";
import { newState } from "../src/games/fidchell-cups/engine/rules";
import { seeded } from "../src/games/fidchell-cups/engine/testkit";

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const games = opt("games", 100), meadLvl = opt("mead", 2) as Level, wineLvl = opt("wine", 2) as Level, seed = opt("seed", 1);
const oneRoll = args.includes("--one");
const rng = seeded(seed);

let slowest = 0, thinkMs = 0, decisions = 0;
function playOne(): { s: State; rolls: number; moves: number } {
  let s = newState(d6(rng) + d6(rng)), rolls = 0, moves = 0;
  while (s.winner === null && rolls < 5000) {
    s = withDice(s, [d6(rng), d6(rng)]); rolls++;
    const out = rollOutcome(s);
    if (out === "queen") { s = toast(s, bestToastTarget(s, rng)).s; continue; }
    if (out === "pass" || out === "stuck") { s = passTurn(s); continue; }
    const lvl = s.turn === MEAD ? meadLvl : wineLvl;
    // Like the page: plan, play the first step, plan again for the die that is left.
    while (legalNow(s).length) {
      const t0 = performance.now();
      const plan = bestPlan(s, lvl, rng);
      const dt = performance.now() - t0;
      thinkMs += dt; decisions++; if (dt > slowest) slowest = dt;
      if (!plan) break;
      const [k, f, t] = plan.steps[0];
      s = move(s, k, f, t).s; moves++;
    }
    if (s.winner === null) s = oneRoll ? passTurn(s) : rollAgain(s);
  }
  return { s, rolls, moves };
}

const tally = { mead: 0, wine: 0, draw: 0 }, why: Record<string, number> = {};
let rolls = 0, moves = 0, skunks = 0;
const t0 = Date.now();
for (let k = 0; k < games; k++) {
  const g = playOne();
  if (g.s.winner === 1) tally.mead++; else if (g.s.winner === 2) tally.wine++; else tally.draw++;
  if (g.s.winner) { if (g.s.jug[g.s.winner] === 4) skunks++; }
  const r = g.s.reason ?? "limit";
  why[r] = (why[r] ?? 0) + 1;
  rolls += g.rolls; moves += g.moves;
  process.stdout.write(`\rgame ${k + 1}/${games}`);
}
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
console.log(`\nMead (${LEVELS[meadLvl].name}) ${pct(tally.mead)} · Wine (${LEVELS[wineLvl].name}) ${pct(tally.wine)} · draws ${pct(tally.draw)} · skunks ${pct(skunks)}`);
console.log(`turns: ${oneRoll ? "one roll a turn" : "roll till a pass"} · average game ${(rolls / games).toFixed(1)} rolls, ${(moves / games).toFixed(1)} moves · endings ${JSON.stringify(why)}`);
console.log(`thinking: ${(thinkMs / Math.max(1, decisions)).toFixed(1)} ms average, ${slowest.toFixed(0)} ms slowest · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
