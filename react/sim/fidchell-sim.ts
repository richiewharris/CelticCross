// Self-play simulator for Fidchell, built on the same engine as the game.
// Usage: npx tsx sim/fidchell-sim.ts --games 50 --gold 3 --white 2 [--ms 300] [--seed 1]
import { LEVELS, LEVEL_NAMES, search, type LevelId } from "../src/games/fidchell/engine/ai";
import { GOLD, WHITE, initial, play, type State } from "../src/games/fidchell/engine/rules";
import { mulberry32 } from "../src/games/fidchell/engine/rng";

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const games = opt("games", 20), goldLvl = opt("gold", 2) as LevelId, whiteLvl = opt("white", 2) as LevelId, ms = opt("ms", 300);
const seed = opt("seed", 0);
const rng = seed ? mulberry32(seed) : Math.random;

function playOne(): State {
  let s = initial();
  // The 30-move quiet rule ends every game, so this cap is only a safety net.
  for (let ply = 0; ply < 1000 && s.winner === null; ply++) {
    const lv = LEVELS[s.turn === GOLD ? goldLvl : whiteLvl];
    const m = search(s, { ...lv, ms: Math.min(lv.ms, ms) }, { rng });
    if (!m) break;
    s = play(s, m);
  }
  return s;
}

const tally = { gold: 0, white: 0, draw: 0 }, why: Record<string, number> = {};
let plies = 0;
const t0 = Date.now();
for (let k = 0; k < games; k++) {
  const s = playOne();
  if (s.winner === GOLD) tally.gold++; else if (s.winner === WHITE) tally.white++; else tally.draw++;
  const r = s.reason ?? "limit";
  why[r] = (why[r] ?? 0) + 1;
  plies += s.ply;
  process.stdout.write(`\rgame ${k + 1}/${games}`);
}
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
console.log(`\nGold (${LEVEL_NAMES[goldLvl]}) ${pct(tally.gold)} · White (${LEVEL_NAMES[whiteLvl]}) ${pct(tally.white)} · draws ${pct(tally.draw)}`);
console.log(`average game ${(plies / games).toFixed(1)} moves · endings ${JSON.stringify(why)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
