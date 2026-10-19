import { useEffect, useState } from "react";

/** Every way to play the lock, by address: #/lock, #/lock/earn, #/lock/stack, #/lock/cube, #/lock/v1. */
export type Version = "v2" | "earn" | "stack" | "cube" | "v1";

export const VARIANTS: { v: Version; hash: string; label: string; blurb: string }[] = [
  { v: "v2", hash: "#/lock", label: "The dial", blurb: "Turn stones on a dial seen through a one-third window." },
  { v: "earn", hash: "#/lock/earn", label: "Earned turns", blurb: "Start with a few turns and earn more for every join you make." },
  { v: "stack", hash: "#/lock/stack", label: "Stacked discs", blurb: "Open dial after dial on one purse of turns." },
  { v: "cube", hash: "#/lock/cube", label: "The cube", blurb: "A knot wrapped round a cube. Turn the cube to see each side." },
  { v: "v1", hash: "#/lock/v1", label: "Classic cross", blurb: "The first version: swap stones on a ringed cross." },
];

export function versionOf(hash: string): Version {
  const m = hash.match(/^#\/?lock\/(v1|earn|stack|cube)\/?$/);
  return m ? (m[1] as Version) : "v2";
}

/** Which version of the lock the address asks for. */
export function useVersion(): Version {
  const [v, setV] = useState(() => versionOf(window.location.hash));
  useEffect(() => {
    const on = () => setV(versionOf(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return v;
}
