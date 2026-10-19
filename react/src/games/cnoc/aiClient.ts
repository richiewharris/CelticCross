import { createRpc } from "../../kit/rpc";

export const makeAiWorker = () => new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });

let shared: ReturnType<typeof createRpc> | null = null;
/** One long-lived worker for the computer's moves (the review gets its own, so it never blocks play). */
export const aiRpc = () => (shared ??= createRpc(makeAiWorker()));
export type Rpc = ReturnType<typeof createRpc>;
