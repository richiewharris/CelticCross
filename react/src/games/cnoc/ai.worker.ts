// Runs the computer's thinking and the game review off the main thread.
import { cpuPlace, search, type SearchOpts } from "./engine/ai";
import type { Game } from "./engine/game";
import { analyseMove, assessPlacement, buildEntries, finishReview } from "./engine/review";
import type { Piece, Rules, Side, State } from "./engine/rules";
import { slotAt, slotZone } from "./engine/setup";

type Msg =
  | { id: number; type: "move"; payload: { s: State; opts: SearchOpts; seen: [string, number][]; rules: Rules } }
  | { id: number; type: "place"; payload: { s: State; placed: number; swap: boolean; piece: Piece; lvl: number; rules: Rules } }
  | { id: number; type: "review"; payload: { game: Game; ms: number } };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, type } = e.data;
  if (type === "move") {
    const { s, opts, seen, rules } = e.data.payload;
    self.postMessage({ id, result: search(s, opts, new Map(seen), rules) });
  } else if (type === "place") {
    const { s, placed, swap, piece, lvl, rules } = e.data.payload;
    const slot = slotAt(placed, swap);
    self.postMessage({ id, result: cpuPlace(s, slot.o as Side, piece, lvl, slot.o !== slot.p, i => slotZone(slot, i), rules) });
  } else if (type === "review") {
    const { game, ms } = e.data.payload;
    const list = buildEntries(game), seen = new Map<string, number>();
    list.forEach((entry, k) => {
      if (entry.kind === "place") assessPlacement(entry, game);
      else analyseMove(entry, game, seen, ms);
      self.postMessage({ id, progress: k + 1 });
    });
    finishReview(list, game);
    self.postMessage({ id, result: list });
  }
};
