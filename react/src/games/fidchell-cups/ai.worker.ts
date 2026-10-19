// Runs the computer's choice of move off the main thread (the Strong level can take a few hundred ms).
import { bestPlan, type Level } from "./engine/ai";
import type { State, Step } from "./engine/rules";

type Msg = { id: number; type: "plan"; payload: { s: State; lvl: Level } };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, payload } = e.data;
  const plan = bestPlan(payload.s, payload.lvl);
  const result: Step | null = plan ? plan.steps[0] : null;
  self.postMessage({ id, result });
};
