// Every online game this player sits in, followed live. Used by the "Your games" page and the
// badge in the top bar. Stays idle (Firebase not even loaded) until this browser has played online,
// unless `force` is set.
import { useEffect, useState } from "react";
import { getBackend, hasPlayedOnline, type Account } from "./backend";
import type { OnlineGameSummary } from "./types";

export interface MyGames { state: "idle" | "loading" | "ready" | "error"; uid: string | null; account: Account | null; games: OnlineGameSummary[]; error: string | null }

export function useMyGames(force = false): MyGames {
  const [v, setV] = useState<MyGames>({ state: "idle", uid: null, account: null, games: [], error: null });
  const [played, setPlayed] = useState(hasPlayedOnline);
  useEffect(() => {
    if (played) return;
    const on = () => setPlayed(true);
    window.addEventListener("onlineplayed", on);
    return () => window.removeEventListener("onlineplayed", on);
  }, [played]);
  useEffect(() => {
    if (!force && !played) return;
    let live = true, stopGames = () => {}, stopAcct = () => {};
    setV(x => ({ ...x, state: "loading" }));
    void getBackend().then(b => {
      if (!live) return;
      stopAcct = b.onAccount(a => {
        stopGames();
        if (!live) return;
        if (!a) { setV({ state: "ready", uid: null, account: null, games: [], error: null }); return; }
        setV(x => ({ ...x, uid: a.uid, account: a }));
        stopGames = b.watchMyGames(a.uid,
          games => { if (live) setV(x => ({ ...x, state: "ready", games, error: null })); },
          e => { if (live) setV(x => ({ ...x, state: "error", error: e.message })); });
      });
    }).catch(e => { if (live) setV(x => ({ ...x, state: "error", error: (e as Error).message })); });
    return () => { live = false; stopGames(); stopAcct(); };
  }, [force, played]);
  return v;
}

export const isMyTurn = (g: OnlineGameSummary, uid: string | null) => !!uid && g.doc.status === "active" && g.doc.turn === uid;
