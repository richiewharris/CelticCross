// Runs the computer's thinking and the game review off the main thread.
import { search, type SearchOpts } from "./engine/ai";
import type { Game } from "./engine/game";
import { analyseMove, assessPlacement, buildEntries, finishReview } from "./engine/review";
import type { State } from "./engine/rules";

type Msg =
  | { id: number; type: "move"; payload: { s: State; opts: SearchOpts; seen: [string, number][] } }
  | { id: number; type: "review"; payload: { game: Game } };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id } = e.data;
  if (e.data.type === "move") {
    const { s, opts, seen } = e.data.payload;
    self.postMessage({ id, result: search(s, opts, new Map(seen)) });
  } else {
    const { game } = e.data.payload;
    const list = buildEntries(game), seen = new Map<string, number>();
    list.forEach((entry, k) => {
      if (entry.kind === "place") assessPlacement(entry);
      else analyseMove(entry, seen);
      self.postMessage({ id, progress: { k: k + 1, entry } });
    });
    finishReview(list, game);
    self.postMessage({ id, result: list });
  }
};
