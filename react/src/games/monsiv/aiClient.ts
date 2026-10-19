import { createRpc } from "../../kit/rpc";
import { puzzleFor, type Puzzle } from "./engine/core";

const makeWorker = () => new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
export type Rpc = ReturnType<typeof createRpc>;

let ai: Rpc | null = null;
/** One long-lived worker for the computer's moves. */
export const aiRpc = () => (ai ??= createRpc(makeWorker()));

// Puzzles are carved in their own worker, so prefetching never delays the computer's move.
let gen: Rpc | null | undefined;
const cache = new Map<string, Promise<Puzzle | null>>();
export function fetchPuzzle(L: number, i: number): Promise<Puzzle | null> {
  const k = `${L}-${i}`;
  let p = cache.get(k);
  if (!p) {
    if (gen === undefined) { try { gen = createRpc(makeWorker()); } catch { gen = null; } }
    const rpc = gen;
    p = rpc ? rpc.call<Puzzle | null>("puzzle", { L, i }) : new Promise(res => setTimeout(() => res(puzzleFor(L, i)), 40));
    cache.set(k, p);
  }
  return p;
}
