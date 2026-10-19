// Runs the computer's thinking and the puzzle generator off the main thread.
import { search, type SearchOpts } from "./engine/ai";
import { puzzleFor, type Path, type State } from "./engine/core";

type Msg =
  | { id: number; type: "move"; payload: { s: State; path: Path; opts: SearchOpts } }
  | { id: number; type: "puzzle"; payload: { L: number; i: number } };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id } = e.data;
  if (e.data.type === "move") {
    const { s, path, opts } = e.data.payload;
    self.postMessage({ id, result: search(s, path, opts) });
  } else {
    const { L, i } = e.data.payload;
    self.postMessage({ id, result: puzzleFor(L, i) });
  }
};
