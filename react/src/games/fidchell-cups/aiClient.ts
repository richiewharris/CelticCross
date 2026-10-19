import { createRpc } from "../../kit/rpc";
import type { Level } from "./engine/ai";
import type { State, Step } from "./engine/rules";

let shared: ReturnType<typeof createRpc> | null = null;
const rpc = () => (shared ??= createRpc(new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" })));

/** The first step of the computer's best plan for this roll. */
export const planStep = (s: State, lvl: Level) => rpc().call<Step | null>("plan", { s, lvl });
