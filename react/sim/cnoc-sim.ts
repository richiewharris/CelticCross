// Self-play simulator for Cnoc, built on the same engine as the game.
// Usage: npm run sim -- --games 50 --host 3 --si 3 [--ms 300] [--hold 7] [--swap]
import { LEVELS, cpuPlace, search } from "../src/games/cnoc/engine/ai";
import { currentSlot, newGame, placePiece, playMove, rulesOf, seenMap, trayChoices, type Game } from "../src/games/cnoc/engine/game";
import { slotZone } from "../src/games/cnoc/engine/setup";
import { CH, LO, RI, SP } from "../src/games/cnoc/engine/rules";

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const games = opt("games", 20), hostLvl = opt("host", 3), siLvl = opt("si", 3), ms = opt("ms", 300), holdN = opt("hold", 7);
const swap = args.includes("--swap");

function playOne(): Game {
  let g = newGame({ swap, holdN });
  while (g.phase === "place") {
    const slot = currentSlot(g), choices = trayChoices(g), lvl = slot.p === 0 ? hostLvl : siLvl;
    const special = slot.o === 0 ? LO : CH, plain = slot.o === 0 ? SP : RI;
    const piece = slot.k ?? (choices.includes(special) && (Math.random() < 1 / choices.length || !choices.includes(plain)) ? special : plain);
    g = placePiece(g, cpuPlace(g.s, slot.o, piece, lvl, slot.o !== slot.p, i => slotZone(slot, i), rulesOf(g)), piece);
  }
  for (let ply = 0; ply < 400 && g.winner === null; ply++) {
    const lv = LEVELS[g.s.turn === 0 ? hostLvl : siLvl];
    const m = search(g.s, { ...lv, ms: Math.min(lv.ms, ms) }, seenMap(g), rulesOf(g));
    if (m === null) break;
    g = playMove(g, m);
  }
  return g;
}

const tally = { host: 0, si: 0, draw: 0 }, why: Record<string, number> = {};
let plies = 0;
const t0 = Date.now();
for (let k = 0; k < games; k++) {
  const g = playOne();
  if (g.winner === 0) tally.host++; else if (g.winner === 1) tally.si++; else tally.draw++;
  why[g.why ?? "limit"] = (why[g.why ?? "limit"] ?? 0) + 1;
  plies += g.history.filter(h => h.phase === "play").length;
  process.stdout.write(`\rgame ${k + 1}/${games}`);
}
const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
console.log(`\nHost (${LEVELS[hostLvl].name}) ${pct(tally.host)} · Sí (${LEVELS[siLvl].name}) ${pct(tally.si)} · draws ${pct(tally.draw)}`);
console.log(`average game ${(plies / games).toFixed(1)} moves · endings ${JSON.stringify(why)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
