// Self-play simulator for Cnoc Mór, built on the same engine as the game.
// Usage: npx tsx sim/cnoc-mor-sim.ts --games 50 --host 2 --si 2 [--ms 300] [--review]
import { LEVELS, cpuPick, cpuPlace, search, type Level } from "../src/games/cnoc-mor/engine/ai";
import { newGame, placePiece, placer, playMove, seenMap, type Game } from "../src/games/cnoc-mor/engine/game";
import { reviewGame, summarize } from "../src/games/cnoc-mor/engine/review";

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const games = opt("games", 20), hostLvl = opt("host", 2) as Level, siLvl = opt("si", 2) as Level, ms = opt("ms", 300);
const doReview = args.includes("--review");

function playOne(): Game {
  let g = newGame();
  while (g.phase === "place") {
    const side = placer(g), piece = cpuPick(g.trays[side], side);
    g = placePiece(g, cpuPlace(g.s, side, piece, side === 0 ? hostLvl : siLvl), piece);
  }
  while (g.winner === null) {
    const lv = LEVELS[g.s.turn === 0 ? hostLvl : siLvl];
    const m = search(g.s, { ...lv, ms: Math.min(lv.ms, ms) }, seenMap(g));
    if (m === null) break;
    g = playMove(g, m);
  }
  return g;
}

const tally = { host: 0, si: 0, draw: 0 }, why: Record<string, number> = {};
let plies = 0, drops = 0, perf = [0, 0];
const t0 = Date.now();
for (let k = 0; k < games; k++) {
  const g = playOne();
  if (g.winner === 0) tally.host++; else if (g.winner === 1) tally.si++; else tally.draw++;
  why[g.why ?? "unfinished"] = (why[g.why ?? "unfinished"] ?? 0) + 1;
  const moves = g.history.filter(h => h.phase === "play");
  plies += moves.length;
  drops += moves.filter(h => h.note.includes(" in at ")).length;
  if (doReview) {
    const sums = summarize(reviewGame(g, 60));
    perf = [perf[0] + sums[0].perf, perf[1] + sums[1].perf];
  }
  process.stdout.write(`\rgame ${k + 1}/${games}`);
}
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
console.log(`\nHost (${LEVELS[hostLvl].name}) ${pct(tally.host)} · Sí (${LEVELS[siLvl].name}) ${pct(tally.si)} · draws ${pct(tally.draw)}`);
console.log(`average game ${(plies / games).toFixed(1)} plies, ${(drops / games).toFixed(1)} reserve entries · endings ${JSON.stringify(why)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (doReview) console.log(`average review rating: Host ${Math.round(perf[0] / games)} · Sí ${Math.round(perf[1] / games)}`);
