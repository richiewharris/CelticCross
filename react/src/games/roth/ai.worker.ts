// The computer's choices, off the main thread (Expert plays many games out per decision).
import { makePolicy } from "./engine/ai";
import type { Decision, State } from "./engine/engine";
import { Rng } from "./engine/rng";

type Msg = { id: number; type: "choose"; payload: { view: State; d: Decision; level: string; seed: number } };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, payload } = e.data;
  const { view, d, level, seed } = payload;
  const pol = makePolicy(level, { N: 16, K: 3 });
  const result = d.options.length === 1 ? 0 : pol.choose(view, d, new Rng(seed));
  self.postMessage({ id, result });
};
