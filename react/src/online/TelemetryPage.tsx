// The owner's view of the match records (telemetry.ts): how many there are, and a download of them all as JSON,
// for the balancing tools (sim/roth/telemetry.ts replays them). Reading needs an admins/{uid} document for the
// owner's account, made once by hand in the Firebase console; this page shows the uid to use.
import { useEffect, useState, type ReactNode } from "react";
import { GameScope } from "../kit/GameScope";
import { getBackend } from "./backend";
import { useIsOwner } from "./owner";
import { fetchTelemetry } from "./telemetry";
import "./online.css";

const Page = ({ children }: { children: ReactNode }) => <GameScope id="home"><div className="home yg online">{children}</div></GameScope>;

export function TelemetryPage() {
  const owner = useIsOwner();
  const [uid, setUid] = useState<string | null>(null);
  const [recs, setRecs] = useState<{ id: string; data: Record<string, unknown> }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let stop = () => {}; void getBackend().then(b => { stop = b.onAccount(a => setUid(a?.uid ?? null)); }); return () => stop(); }, []);
  if (owner === undefined) return <Page><p>Checking…</p></Page>;
  if (!owner) return <Page><h1>Match records</h1><p className="yg-empty">This page is for the site's owner.</p></Page>;
  const load = async () => {
    setBusy(true); setErr(null);
    try { setRecs(await fetchTelemetry("roth")); }
    catch (e) { setErr(String((e as { code?: string }).code ?? (e as Error).message).includes("permission") ? "The database refused: add a document for this account under admins (see below)." : (e as Error).message); }
    finally { setBusy(false); }
  };
  const count = (k: string) => {
    const m = new Map<string, number>();
    for (const r of recs ?? []) { const v = k === "level" ? String(((r.data.match as Record<string, unknown>)?.setup as Record<string, unknown>)?.level) : String(r.data[k]); m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(" · ");
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(recs, null, 0)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `roth-matches-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <Page>
      <header><h1>Match records</h1>
      <p className="lede">How people play Roth Catha against the computer: each match by a visitor who allowed visit statistics, with its setup, decks, every choice and the result.</p></header>
      <div className="row">
        <button className="btn primary" type="button" disabled={busy} onClick={() => void load()}>{recs ? "Reload" : "Load records"}</button>
        {recs?.length ? <button className="btn" type="button" onClick={download}>Download JSON</button> : null}
      </div>
      {err ? <p className="online-error" role="alert">{err}</p> : null}
      {recs ? <ul className="facts">
        <li>{recs.length} matches</li>
        {recs.length ? <><li>Outcome: {count("outcome")}</li><li>Level: {count("level")}</li><li>Build: {count("build")}</li></> : null}
      </ul> : null}
      <p className="yg-empty">Reading needs a document at <code>admins/{uid ?? "(sign in with Google)"}</code> in the Firestore database (any content), made once in the Firebase console.</p>
    </Page>
  );
}
