import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the viewer asked for less motion (follows changes to the setting). */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof matchMedia !== "undefined" && matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(QUERY), on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}
