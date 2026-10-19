import type { ReactNode } from "react";
import { useBodyClass } from "./useBodyClass";

/** Wraps a game (or a playground section) in its scope class. */
export function GameScope({ id, children }: { id: string; children: ReactNode }) {
  useBodyClass(`gm-${id}`);
  return <>{children}</>;
}
