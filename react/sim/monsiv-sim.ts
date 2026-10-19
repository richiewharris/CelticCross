// Self-play simulator for Monsiv, built on the same engine as the game.
// Usage: npx tsx sim/monsiv-sim.ts --games 50 --white 2 --black 2 [--ms 300]
import { LEVELS, search } from "../src/games/monsiv/engine/ai";
import { newGame, pathOf, playMove, type Game } from "../src/games/monsiv/engine/game";

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const games = opt("games", 20), wLvl = opt("white", 2) as 1 | 2 | 3, bLvl = opt("black", 2) as 1 | 2 | 3, ms = opt("ms", 300);

function playOne(): Game {
  let g = newGame();
  for (let ply = 0; ply < 400 && g.winner === null; ply++) {
    const lv = LEVELS[g.s.turn === 0 ? wLvl : bLvl];
    const m = search(g.s, pathOf(g), { ...lv, ms: Math.min(lv.ms, ms) });
    if (!m) break;
    g = playMove(g, m);
  }
  return g;
}

const tally = { white: 0, black: 0, unfinished: 0 }, why: Record<string, number> = {};
let plies = 0;
const t0 = Date.now();
for (let k = 0; k < games; k++) {
  const g = playOne();
  if (g.winner === 0) tally.white++; else if (g.winner === 8) tally.black++; else tally.unfinished++;
  why[g.reason ?? "limit"] = (why[g.reason ?? "limit"] ?? 0) + 1;
  plies += g.history.length;
  process.stdout.write(`\rgame ${k + 1}/${games}`);
}
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
console.log(`\nWhite (${LEVELS[wLvl].name}) ${pct(tally.white)} · Black (${LEVELS[bLvl].name}) ${pct(tally.black)}${tally.unfinished ? ` · unfinished ${pct(tally.unfinished)}` : ""}`);
console.log(`average game ${(plies / games).toFixed(1)} moves · endings ${JSON.stringify(why)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
