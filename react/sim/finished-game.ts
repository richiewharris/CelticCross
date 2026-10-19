// Print a finished computer-vs-computer game as JSON (handy for testing the review screen).
import { LEVELS, cpuPlace, search } from "../src/games/cnoc/engine/ai";
import { currentSlot, newGame, placePiece, playMove, rulesOf, seenMap, trayChoices } from "../src/games/cnoc/engine/game";
import { slotZone } from "../src/games/cnoc/engine/setup";
let g = newGame();
while (g.phase === "place") {
  const slot = currentSlot(g), piece = slot.k ?? trayChoices(g)[0];
  g = placePiece(g, cpuPlace(g.s, slot.o, piece, 2, false, i => slotZone(slot, i), rulesOf(g)), piece);
}
while (g.winner === null && g.history.length < 200) {
  const m = search(g.s, { ...LEVELS[g.s.turn === 0 ? 3 : 1], ms: 100 }, seenMap(g), rulesOf(g));
  if (m === null) break;
  g = playMove(g, m);
}
console.log(JSON.stringify(g));
