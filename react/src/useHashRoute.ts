import { useEffect, useState } from "react";

/** The current #/route, kept in sync with the address bar. */
export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, "") || "";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
