// One race room, followed live: sign-in, the race document, the challenge scores, and the actions.
import { useCallback, useEffect, useRef, useState } from "react";
import { getRaceStore, raceHash, raceSignIn, seatOf, type RaceDoc, type RaceScore } from "../../../online/races";
import { markPlayedOnline } from "../../../online/backend";
import { NEW_RUN, newSeed, type RaceOptions, type RaceRun } from "./engine";

export type RoomPhase = "connecting" | "missing" | "error" | "ok";

export function newRaceDoc(o: RaceOptions, uid: string, name: string | null): RaceDoc {
  const now = Date.now();
  return {
    v: 1, options: { ...o }, seed: newSeed(), creator: uid, seats: { a: uid, b: null }, players: [uid], names: { a: name, b: null },
    status: "open", ready: { a: false, b: false }, runs: { a: NEW_RUN, b: NEW_RUN }, startedAt: null, next: null, createdAt: now, updatedAt: now,
  };
}

/** Make a race and go to its room. */
export async function createRace(o: RaceOptions): Promise<string> {
  const me = await raceSignIn();
  const store = await getRaceStore();
  const id = await store.createRace(newRaceDoc(o, me.uid, me.name));
  markPlayedOnline();
  return id;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/** Sends the latest count, one write at a time (a newer count replaces one still waiting). */
export function runWriter(send: (r: RaceRun) => Promise<void>, onError: (m: string) => void) {
  let busy = false, pending: RaceRun | null = null;
  const pump = async () => {
    if (busy || !pending) return;
    const r = pending; pending = null; busy = true;
    try { await send(r); } catch (e) { onError(message(e)); } finally { busy = false; void pump(); }
  };
  return (r: RaceRun) => { pending = r; void pump(); };
}

export function useRaceRoom(id: string) {
  const [phase, setPhase] = useState<RoomPhase>("connecting");
  const [doc, setDoc] = useState<RaceDoc | null>(null);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [me, setMe] = useState<{ uid: string; name: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const docRef = useRef(doc); docRef.current = doc;

  useEffect(() => {
    let live = true, stopRace = () => {}, stopScores = () => {};
    setPhase("connecting"); setDoc(null); setScores([]); setError(null);
    (async () => {
      const who = await raceSignIn();
      const store = await getRaceStore();
      if (!live) return;
      setMe(who);
      stopRace = store.watchRace(id, d => {
        if (!live) return;
        if (!d) { setPhase("missing"); setDoc(null); return; }
        if (d.players.includes(who.uid)) markPlayedOnline();
        setDoc(d); setPhase("ok");
      }, e => { if (live) { setError(e.message); setPhase("error"); } });
      stopScores = store.watchScores(id, s => { if (live) setScores(s); }, () => { /* the board just stays empty */ });
    })().catch(e => { if (live) { setError(message(e)); setPhase("error"); } });
    return () => { live = false; stopRace(); stopScores(); };
  }, [id]);

  const guard = useCallback(async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(null);
    try { return await f(); } catch (e) { setError(message(e)); return undefined; } finally { setBusy(false); }
  }, []);

  const uid = me?.uid ?? null;
  const seat = doc ? seatOf(doc, uid) : null;

  return {
    phase, doc, scores, uid, name: me?.name ?? null, seat, error, busy, setError,
    join: () => guard(async () => { const s = await getRaceStore(); await s.joinRace(id, me!.uid, me!.name); }),
    ready: () => guard(async () => { const s = await getRaceStore(); await s.setReady(id, me!.uid); }),
    updateRun: async (run: RaceRun) => { const s = await getRaceStore(); await s.updateRun(id, me!.uid, run); },
    endRace: () => guard(async () => { const s = await getRaceStore(); await s.endRace(id, me!.uid); }),
    startScore: async (): Promise<boolean> => {
      try { const s = await getRaceStore(); return (await s.startScore(id, me!.uid, me!.name)) === "started"; } catch { return false; }
    },
    postScore: async (run: RaceRun) => { const s = await getRaceStore(); await s.postScore(id, me!.uid, run); },
    rematch: () => guard(async () => {
      const d = docRef.current;
      if (!d || !me) return;
      if (d.next) { window.location.hash = raceHash(d.next); return; }
      const s = await getRaceStore();
      const next = await s.createRace(newRaceDoc(d.options, me.uid, me.name));
      await s.offerRematch(id, me.uid, next);
      window.location.hash = raceHash(next);
    }),
  };
}
export type RaceRoomState = ReturnType<typeof useRaceRoom>;
