import { useLayoutEffect, useRef } from "react";
import type { HistoryEntry } from "../engine/game";

/** Moves in play, two to a row; keeps the latest in view. */
export function MoveLog({ history, settingUp }: { history: HistoryEntry[]; settingUp: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  const h = history.filter(x => x.phase === "play");
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [h.length]);
  if (!h.length) return <ol className="log" ref={ref}><li className="empty">{settingUp ? "Setting up the pieces." : "No moves yet."}</li></ol>;
  const out = [];
  for (let k = 0; k < h.length; k += 2) {
    out.push(<li key={`n${k}`} className="n">{k / 2 + 1}.</li>, <li key={`a${k}`}>{h[k].note}</li>, <li key={`b${k}`}>{h[k + 1]?.note ?? ""}</li>);
  }
  return <ol className="log" ref={ref}>{out}</ol>;
}
