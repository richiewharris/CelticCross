import { useEffect, useState } from "react";

export type Version = "v2" | "v1";

/** Which version of the lock the address asks for: #/lock is the current one, #/lock/v1 the classic. */
export function useVersion(): Version {
  const read = (): Version => (/^#\/?lock\/v1\/?$/.test(window.location.hash) ? "v1" : "v2");
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return v;
}
