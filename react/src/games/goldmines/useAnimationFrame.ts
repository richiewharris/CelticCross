import { useEffect, useRef } from "react";

/** Call `frame(now)` on every animation frame while mounted (now is performance.now() time).
 *  The latest callback is always used, so it can close over fresh props without restarting the loop.
 *  (A candidate for the shared kit.) */
export function useAnimationFrame(frame: (now: number) => void) {
  const cb = useRef(frame);
  cb.current = frame;
  useEffect(() => {
    let id = requestAnimationFrame(function tick(now) {
      cb.current(now);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);
}
