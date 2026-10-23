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
  if (c !== null) return null;
  return (
    <div className="consent" role="region" aria-label="Visit statistics">
      <p>May we count your visit? We use Google Analytics to see which games people play. It sets cookies but never sees your games or moves.</p>
      <div className="consent-buttons">
        <button type="button" className="consent-yes" onClick={() => setConsent("yes")}>Allow</button>
        <button type="button" onClick={() => setConsent("no")}>No thanks</button>
      </div>
    </div>
  );
}
