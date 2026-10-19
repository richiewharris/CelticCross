import { createRpc } from "../../kit/rpc";
import type { Level } from "./engine/ai";
import type { Move, State } from "./engine/rules";

let shared: ReturnType<typeof createRpc> | null = null;
const rpc = () => (shared ??= createRpc(new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" })));

/** Ask the worker for a move. */
export const think = (s: State, lv: Level) => rpc().call<Move | null>("move", { s, lv });
