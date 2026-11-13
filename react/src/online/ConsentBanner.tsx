// A one-time question about anonymous visit statistics (Google Analytics sets cookies).
import { useEffect, useState } from "react";
import { getConsent, setConsent } from "./analytics";
import "./online.css";

export function ConsentBanner() {
  const [c, setC] = useState(getConsent);
  useEffect(() => {
    const on = () => setC(getConsent());
    window.addEventListener("consentchange", on);
    return () => window.removeEventListener("consentchange", on);
  }, []);
  // while the banner shows, leave room under the page so it never covers the last buttons
  useEffect(() => {
    document.body.classList.toggle("has-consent", c === null);
    return () => document.body.classList.remove("has-consent");
  }, [c]);
  if (c !== null) return null;
  return (
    <div className="consent" role="region" aria-label="Visit statistics">
      <p>May we count your visit? We use Google Analytics to see which games people play (it sets cookies). For Roth Catha we also keep a record of each match against the computer: the decks and the moves, with no name or account, to see how people play against the computer.</p>
      <div className="consent-buttons">
        <button type="button" className="consent-yes" onClick={() => setConsent("yes")}>Allow</button>
        <button type="button" onClick={() => setConsent("no")}>No thanks</button>
      </div>
    </div>
  );
}
