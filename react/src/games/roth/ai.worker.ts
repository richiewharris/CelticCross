// The computer's choices, off the main thread (Expert plays many games out per decision).
import { makePolicy } from "./engine/ai";
import type { Decision, State } from "./engine/engine";
import { Rng } from "./engine/rng";

type Msg = { id: number; type: "choose"; payload: { view: State; d: Decision; level: string; seed: number } };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, payload } = e.data;
  const { view, d, level, seed } = payload;
  let result = 0;
  if (d.options.length > 1) {
    try { result = makePolicy(level, { N: 16, K: 3 }).choose(view, d, new Rng(seed)); }
    catch (err) {
      // never leave the match waiting on an answer: fall back to Casual's rules of thumb, and say so in the console
      console.error("the computer's choice failed; playing by rules of thumb instead", err);
      result = makePolicy("casual").choose(view, d, new Rng(seed));
    }
  }
  self.postMessage({ id, result });
};
