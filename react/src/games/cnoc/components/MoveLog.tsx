import type { HistoryEntry } from "../engine/game";

export function MoveLog({ history, settingUp }: { history: HistoryEntry[]; settingUp: boolean }) {
  const h = history.filter(x => x.phase === "play");
  if (!h.length) return <ol className="log"><li className="empty">{settingUp ? "Setting up the pieces." : "No moves yet."}</li></ol>;
  const rows: (HistoryEntry | null)[] = h[0].by === 1 ? [null, ...h] : h;
  const out = [];
  for (let k = 0; k < rows.length; k += 2) {
    out.push(<li key={`n${k}`} className="n">{k / 2 + 1}.</li>, <li key={`a${k}`}>{rows[k]?.note ?? "…"}</li>, <li key={`b${k}`}>{rows[k + 1]?.note ?? ""}</li>);
  }
  return <ol className="log">{out}</ol>;
}
