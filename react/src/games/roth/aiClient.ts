import { createRpc } from "../../kit/rpc";
import { observe, type Decision, type State } from "./engine/engine";

let shared: ReturnType<typeof createRpc> | null = null;
const rpc = () => (shared ??= createRpc(new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" })));

/** The index of the option the computer picks, seeing only what its seat may see. */
export const computerChoice = (S: State, d: Decision, level: string, seed: number) =>
  rpc().call<number>("choose", { view: observe(S, d.player), d, level, seed });
export const cancelComputer = () => shared?.cancelAll();
