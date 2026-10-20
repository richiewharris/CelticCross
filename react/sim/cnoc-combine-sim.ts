// Self-play simulator for Cnoc's combining variant (the Phalanx and merging Riders), next to standard Cnoc.
// Usage: npx tsx sim/cnoc-combine-sim.ts --games 40 --host 3 --si 3 [--ms 300] [--hold 7] [--swap] [--combine]
//          [--phx auto|always|never]   (who decides the Phalanx: the computer's judgement, or forced)
//          [--json]                    (also print one JSON line with the totals)
import { LEVELS, cpuPlace, search } from "../src/games/cnoc/engine/ai";
import { cpuSetupChoice } from "../src/games/cnoc/engine/cpu";
import { currentSlot, placePiece, playMove, newGame, rulesOf, seenMap, type Game } from "../src/games/cnoc/engine/game";
import { slotZone } from "../src/games/cnoc/engine/setup";
import { PH, isMerge } from "../src/games/cnoc/engine/rules";

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const str = (name: string, dflt: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const games = opt("games", 20), hostLvl = opt("host", 3), siLvl = opt("si", 3), ms = opt("ms", 300), holdN = opt("hold", 7);
const swap = args.includes("--swap"), combine = args.includes("--combine"), phx = str("phx", "auto");

interface Out { g: Game; tookPhalanx: boolean; merges: number; phalanxTaken: boolean }

function playOne(): Out {
  let g = newGame({ swap, holdN, combine });
  while (g.phase === "place") {
    const slot = currentSlot(g), lvl = slot.p === 0 ? hostLvl : siLvl;
    const { piece, takePhalanx } = cpuSetupChoice(g, lvl, Math.random, phx === "auto" ? undefined : phx === "always");
    g = placePiece(g, cpuPlace(g.s, slot.o, piece, lvl, slot.o !== slot.p, i => slotZone(slot, i), rulesOf(g)), piece, takePhalanx);
  }
  const tookPhalanx = g.s.b.includes(PH);
  let merges = 0;
  for (let ply = 0; ply < 400 && g.winner === null; ply++) {
    const lv = LEVELS[g.s.turn === 0 ? hostLvl : siLvl];
    const m = search(g.s, { ...lv, ms: Math.min(lv.ms, ms) }, seenMap(g), rulesOf(g));
    if (m === null) break;
    if (isMerge(g.s.b, m)) merges++;
    g = playMove(g, m);
  }
  return { g, tookPhalanx, merges, phalanxTaken: tookPhalanx && !g.s.b.includes(PH) };
}

const tally = { host: 0, si: 0, draw: 0 }, why: Record<string, number> = {};
let plies = 0, phCount = 0, phWins = 0, mergeGames = 0, mergeTotal = 0, mergeSiWins = 0, phLost = 0;
const t0 = Date.now();
for (let k = 0; k < games; k++) {
  const { g, tookPhalanx, merges, phalanxTaken } = playOne();
  if (g.winner === 0) tally.host++; else if (g.winner === 1) tally.si++; else tally.draw++;
  why[g.why ?? "limit"] = (why[g.why ?? "limit"] ?? 0) + 1;
  plies += g.history.filter(h => h.phase === "play").length;
  if (tookPhalanx) { phCount++; if (g.winner === 0) phWins++; if (phalanxTaken) phLost++; }
  if (merges) { mergeGames++; mergeTotal += merges; if (g.winner === 1) mergeSiWins++; }
  process.stdout.write(`\rgame ${k + 1}/${games}`);
}
const pct = (n: number, d = games) => (d ? `${((100 * n) / d).toFixed(1)}%` : "–");
const label = `${combine ? "combining" : "standard"}${swap ? ", rival's setup" : ", own setup"}${combine ? `, phalanx ${phx}` : ""}`;
console.log(`\n[${label}] Host (${LEVELS[hostLvl].name}) ${pct(tally.host)} · Sí (${LEVELS[siLvl].name}) ${pct(tally.si)} · draws ${pct(tally.draw)}`);
console.log(`average game ${(plies / games).toFixed(1)} moves · endings ${JSON.stringify(why)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (combine) {
  console.log(`Phalanx taken in ${pct(phCount)} of games (Host won ${pct(phWins, phCount)} of those; it was captured in ${pct(phLost, phCount)})`);
  console.log(`merges in ${pct(mergeGames)} of games (${mergeTotal} in all; the Sí won ${pct(mergeSiWins, mergeGames)} of those)`);
}
if (args.includes("--json")) {
  console.log(JSON.stringify({ label, hostLvl, siLvl, games, ...tally, why, plies: plies / games, phCount, phWins, phLost, mergeGames, mergeTotal, mergeSiWins }));
}
