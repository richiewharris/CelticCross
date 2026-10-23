// Who you're playing as, with Google sign-in so your games follow you to other devices.
import { useEffect, useState } from "react";
import { getBackend, type Account } from "./backend";

export function AccountLine() {
  const [acct, setAcct] = useState<Account | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stop = () => {}, live = true;
    void getBackend().then(b => { if (live) stop = b.onAccount(a => setAcct(a)); });
    return () => { live = false; stop(); };
  }, []);
  // A different player id means a different list of games: start the page afresh.
  const run = async (f: (b: Awaited<ReturnType<typeof getBackend>>) => Promise<void>) => {
    setBusy(true); setErr(null);
    try {
      const b = await getBackend(), before = await b.knownUid();
      await f(b);
      const after = await b.knownUid();
      if (before && after !== before) window.location.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  if (acct === undefined) return null;
  return (
    <div className="online-account">
      {acct && !acct.anonymous ? (
        <p className="online-note small">Signed in as {acct.name ?? "a Google account"}. <button type="button" className="linkish" disabled={busy} onClick={() => void run(b => b.signOut())}>Sign out</button></p>
      ) : (
        <p className="online-note small">
          <button type="button" className="linkish" disabled={busy} onClick={() => void run(b => b.signInWithGoogle())}>Sign in with Google</button>
          {" "}to keep your online games on every device. Without it they stay in this browser.
        </p>
      )}
      {err ? <p className="online-error" role="alert">{err}</p> : null}
    </div>
  );
}
