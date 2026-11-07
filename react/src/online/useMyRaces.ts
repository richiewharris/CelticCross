// The lock races this player sits in (followed live) and the challenges played in this browser,
// for "Your games". Idle until there is a player id.
import { useEffect, useState } from "react";
import { getRaceStore, myChallenges, type PlayedChallenge, type RaceSummary } from "./races";

export function useMyRaces(uid: string | null): { races: RaceSummary[]; challenges: PlayedChallenge[] } {
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [challenges] = useState(myChallenges);
  useEffect(() => {
    if (!uid) { setRaces([]); return; }
    let live = true, stop = () => {};
    void getRaceStore().then(s => { if (live) stop = s.watchMyRaces(uid, r => { if (live) setRaces(r); }, () => { /* no races shown */ }); });
    return () => { live = false; stop(); };
  }, [uid]);
  return { races, challenges };
}
