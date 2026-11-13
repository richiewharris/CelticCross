// Lock races on Firestore (see races.ts). The checks here mirror firestore.rules, which enforce them.
// startedAt is a server timestamp: the rules use it to close the window for reporting a run.
import {
  Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getFirestore, limit, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where,
  type DocumentData,
} from "firebase/firestore";
import { OnlineError } from "./backend";
import { firebaseApp } from "./firebaseApp";
import { raceChecks, statusAfterRun, type RaceDoc, type RaceScore, type RaceStore } from "./races";

function friendly(e: unknown): Error {
  if (e instanceof OnlineError) return e;
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("permission-denied")) return new OnlineError("denied", "The race server refused that (the race may have moved on, or its time is up).");
  if (code.includes("unavailable") || code.includes("network")) return new OnlineError("offline", "Can't reach the race server. Check your connection.");
  return new OnlineError("other", (e as Error)?.message || "Something went wrong.");
}

const ms = (t: unknown): number | null => (t instanceof Timestamp ? t.toMillis() : typeof t === "number" ? t : null);
const fromRace = (x: DocumentData): RaceDoc => ({ ...(x as RaceDoc), startedAt: ms(x.startedAt) });
const fromScore = (x: DocumentData): RaceScore => ({ ...(x as RaceScore), startedAt: ms(x.startedAt) });

export function firebaseRaces(): RaceStore {
  const db = getFirestore(firebaseApp());
  const races = collection(db, "races");
  const scores = (raceId: string) => collection(db, "races", raceId, "scores");

  const tx = async (id: string, f: (d: RaceDoc) => Record<string, unknown>) => {
    try {
      await runTransaction(db, async t => {
        const ref = doc(races, id), snap = await t.get(ref);
        if (!snap.exists()) throw new OnlineError("missing", "That race doesn't exist.");
        t.update(ref, { ...f(fromRace(snap.data())), updatedAt: Date.now() });
      });
    } catch (e) { throw friendly(e); }
  };

  return {
    async createRace(d) {
      try { return (await addDoc(races, d)).id; } catch (e) { throw friendly(e); }
    },
    watchRace(id, cb, onError) {
      return onSnapshot(doc(races, id), s => cb(s.exists() ? fromRace(s.data()) : null), e => onError(friendly(e)));
    },
    joinRace(id, uid, name) {
      return tx(id, d => { raceChecks.join(d, uid); return { seats: { a: d.seats.a, b: uid }, players: [...d.players, uid], names: { a: d.names.a, b: name }, status: "ready" }; });
    },
    setReady(id, uid) {
      return tx(id, d => {
        const s = raceChecks.ready(d, uid), ready = { ...d.ready, [s]: true };
        const both = ready.a && ready.b;
        return { ready, status: both ? "running" : "ready", ...(both ? { startedAt: serverTimestamp() } : {}) };
      });
    },
    updateRun(id, uid, run) {
      return tx(id, d => { const s = raceChecks.run(d, uid); return { [`runs.${s}`]: run, status: statusAfterRun(d, s, run) }; });
    },
    async cancelRace(id, uid) {
      try {
        const ref = doc(races, id), snap = await getDoc(ref);
        if (!snap.exists()) return;
        raceChecks.cancel(fromRace(snap.data()), uid);
        await deleteDoc(ref);
      } catch (e) { throw friendly(e); }
    },
    endRace(id, uid) { return tx(id, d => { raceChecks.end(d, uid); return { status: "done" }; }); },
    offerRematch(id, uid, next) { return tx(id, d => { raceChecks.rematch(d, uid); return { next }; }); },
    async startScore(raceId, uid, name) {
      try {
        return await runTransaction(db, async t => {
          const ref = doc(scores(raceId), uid);
          if ((await t.get(ref)).exists()) return "exists" as const;
          t.set(ref, { uid, name, solves: 0, fails: 0, bonus: 0, penalty: 0, finished: false, finishedAt: null, startedAt: serverTimestamp(), updatedAt: Date.now() });
          return "started" as const;
        });
      } catch (e) { throw friendly(e); }
    },
    async postScore(raceId, uid, run) {
      try {
        await updateDoc(doc(scores(raceId), uid), {
          solves: run.solves, fails: run.fails, bonus: run.bonus, penalty: run.penalty, finished: run.finished, finishedAt: run.finishedAt, updatedAt: Date.now(),
        });
      } catch (e) { throw friendly(e); }
    },
    watchScores(raceId, cb, onError) {
      return onSnapshot(query(scores(raceId), limit(500)), s => cb(s.docs.map(x => fromScore(x.data()))), e => onError(friendly(e)));
    },
    watchMyRaces(uid, cb, onError) {
      return onSnapshot(query(races, where("players", "array-contains", uid), limit(60)),
        s => cb(s.docs.map(x => ({ id: x.id, doc: fromRace(x.data()) })).sort((a, b) => b.doc.updatedAt - a.doc.updatedAt)),
        e => onError(friendly(e)));
    },
  };
}
