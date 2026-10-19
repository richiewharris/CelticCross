import { useLayoutEffect, useRef } from "react";

/** Moves in pairs, numbered; scrolls to the latest. */
export function MoveLog({ notes, empty }: { notes: string[]; empty: string }) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [notes.length]);
  if (!notes.length) return <ol className="log" ref={ref}><li className="empty">{empty}</li></ol>;
  const out = [];
  for (let k = 0; k < notes.length; k += 2) {
    out.push(<li key={`n${k}`} className="n">{k / 2 + 1}.</li>, <li key={`a${k}`}>{notes[k]}</li>, <li key={`b${k}`}>{notes[k + 1] ?? ""}</li>);
  }
  return <ol className="log" ref={ref}>{out}</ol>;
}
