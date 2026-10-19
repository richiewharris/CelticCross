import { useLayoutEffect } from "react";

/** Put a class on <body> while this component is mounted. Each game scopes its look with
 *  body.gm-<id>, so the page background and portalled dialogs pick up the game's colours. */
export function useBodyClass(cls: string) {
  useLayoutEffect(() => {
    document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [cls]);
}
