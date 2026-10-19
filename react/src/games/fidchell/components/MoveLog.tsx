import { useLayoutEffect, useRef } from "react";
import type { HistoryEntry } from "../engine/game";

/** Two columns, gold then white, scrolled to the latest move. */
export function MoveLog({ history }: { history: HistoryEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [history.length]);
  const out = [];
  for (let k = 0; k < history.length; k += 2) {
    out.push(<li key={`n${k}`} className="n">{k / 2 + 1}.</li>, <li key={`a${k}`}>{history[k].note}</li>, <li key={`b${k}`}>{history[k + 1]?.note ?? ""}</li>);
  }
  return <ol className="log" ref={ref}>{history.length ? out : <li className="empty">No moves yet. Gold goes first.</li>}</ol>;
}
