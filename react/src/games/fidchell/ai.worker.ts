// Runs the computer's search (up to 1.5 s at Strong) and the hint arrow off the main thread.
import { search, type Level } from "./engine/ai";
import type { State } from "./engine/rules";

type Msg = { id: number; type: "move"; payload: { s: State; lv: Level } };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, payload } = e.data;
  self.postMessage({ id, result: search(payload.s, payload.lv) });
};
