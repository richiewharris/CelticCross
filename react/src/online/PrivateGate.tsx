// Shown in place of an owner-only game to anyone who isn't the owner (see owner.ts).
import "./online.css";
import { AccountLine } from "./AccountLine";

export function PrivateGate({ checking }: { checking: boolean }) {
  return (
    <div className="private-gate">
      {checking ? <p className="online-note">Checking who's signed in…</p> : (
        <>
          <h1>Private page</h1>
          <p className="online-note">This game isn't public yet. Sign in with the owner's Google account to open it.</p>
          <AccountLine />
        </>
      )}
    </div>
  );
}
