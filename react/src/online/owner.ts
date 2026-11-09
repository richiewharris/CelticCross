// Owner-only pages: shown only to the site's owner, signed in with Google.
// The owner is recognised by a SHA-256 hash of their email, so the address itself isn't in the site's code.
// This only hides pages: the code of a private game still ships with the site and sits in the public repo.
import { useEffect, useState } from "react";
import { getBackend } from "./backend";

const OWNER_EMAIL_SHA256 = "e0889ba0796378ca3ea761c86aeebbadf190d4e5caaa83ce85797358f5a4695b";
/** The local stand-in backend's owner (sign in on ?online=local&owner). */
export const LOCAL_OWNER_EMAIL = "owner@local.test";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function isOwnerEmail(email: string | null | undefined, local: boolean): Promise<boolean> {
  if (!email) return false;
  if (local) return email === LOCAL_OWNER_EMAIL;
  return (await sha256(email.trim().toLowerCase())) === OWNER_EMAIL_SHA256;
}

/** true when the owner is signed in; false otherwise; undefined while still finding out. */
export function useIsOwner(): boolean | undefined {
  const [owner, setOwner] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let stop = () => {}, live = true;
    void getBackend().then(b => {
      if (!live) return;
      stop = b.onAccount(a => {
        void isOwnerEmail(a && !a.anonymous ? a.email : null, b.kind === "local").then(v => { if (live) setOwner(v); });
      });
    }).catch(() => { if (live) setOwner(false); });
    return () => { live = false; stop(); };
  }, []);
  return owner;
}
