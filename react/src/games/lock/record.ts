// Statistics for every version of the lock. One game is one attempt at a lock (for the stack: at the
// whole box): it starts with the first stone turned and ends when the center is pressed (opened, or
// the knot is broken and the stones scramble) or, for the stack, when the purse runs dry.
// Dealing a new lock mid-attempt just drops it: that is not an end.
import { useRef } from "react";
import { recordGameEnd, recordGameStart } from "../../online/analytics";
import { TIERS, type TierId } from "./engine/knot";

export type LockVariant = "dial" | "earn" | "stack" | "cube" | "classic";

export function useLockRecord(variant: LockVariant) {
  const started = useRef(false);
  const r = useRef<{ begin: (tier: TierId) => void; end: (tier: TierId, result: "opened" | "failed", cheated: boolean) => void; drop: () => void } | null>(null);
  r.current ??= {
    /** A stone was turned: the first one starts the attempt. */
    begin(tier) {
      if (started.current) return;
      started.current = true;
      recordGameStart("lock", { mode: "solo", variant, level: TIERS[tier].name });
    },
    /** The attempt is over (called from the press / run-dry handlers, once each). */
    end(tier, result, cheated) {
      r.current!.begin(tier); // pressed without turning a stone: still an attempt
      started.current = false;
      recordGameEnd("lock", { mode: "solo", variant, level: TIERS[tier].name, result, ...(cheated ? { cheat: true } : {}) });
    },
    /** A new lock was dealt: whatever was under way is dropped unrecorded. */
    drop() { started.current = false; },
  };
  return r.current;
}
