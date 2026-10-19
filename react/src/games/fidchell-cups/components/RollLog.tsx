import { useLayoutEffect, useRef } from "react";
import type { LogEntry } from "../engine/game";

/** Every roll so far, newest at the bottom (kept scrolled into view). */
export function RollLog({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; });
  return (
    <div className="panel">
      <p className="label">Rolls</p>
      <ol className="log" id="log" ref={ref}>
        {log.length
          ? log.map((l, k) => <li key={k}><span className="who">{l.who}</span><span>{l.text}</span></li>)
          : <li className="empty">No rolls yet. Mead goes first.</li>}
      </ol>
    </div>
  );
}
