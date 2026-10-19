// Tiny request/response wrapper around a Web Worker, with optional progress messages.
type Pending = { resolve: (v: unknown) => void; progress?: (p: unknown) => void };

export function createRpc(worker: Worker) {
  let next = 1;
  const pending = new Map<number, Pending>();
  worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; progress?: unknown }>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    if ("progress" in e.data && e.data.progress !== undefined) { job.progress?.(e.data.progress); return; }
    pending.delete(e.data.id);
    job.resolve(e.data.result);
  };
  return {
    call<T>(type: string, payload: unknown, progress?: (p: unknown) => void): Promise<T> {
      const id = next++;
      return new Promise<T>(resolve => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, progress });
        worker.postMessage({ id, type, payload });
      });
    },
    /** Drop answers to calls made before now (after a new game, an undo, ...). */
    cancelAll() { pending.clear(); },
  };
}
