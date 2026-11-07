// Live check of firestore.rules against the real project: three anonymous players try the allowed
// and forbidden actions for games, tallies, lock races and race scores. Run the dev server (npx vite) and open /live-check/index.html; every line
// should say PASS. It leaves one finished test game (options.test = true) and one finished
// 1-minute test race (seed 0, with one challenge score) in the database.
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, query, runTransaction, serverTimestamp, setDoc, increment, updateDoc, where } from "firebase/firestore";
import { firebaseConfig } from "../src/online/config";

const out: string[] = [];
const log = (s: string) => { out.push(s); (document.getElementById("out") as HTMLElement).textContent = out.join("\n"); };
async function expect(name: string, shouldPass: boolean, f: () => Promise<unknown>) {
  try { await f(); log(`${shouldPass ? "PASS" : "FAIL"} ${name} (allowed)`); }
  catch (e) { const c = (e as { code?: string }).code ?? String(e); log(`${!shouldPass && c.includes("permission") ? "PASS" : "FAIL"} ${name} (refused: ${c})`); }
}
(async () => {
  const mk = async (n: string) => { const app = initializeApp(firebaseConfig, n); const u = (await signInAnonymously(getAuth(app))).user; return { db: getFirestore(app), uid: u.uid }; };
  const A = await mk("A"), B = await mk("B"), C = await mk("C");
  log(`signed in A=${A.uid.slice(0, 6)} B=${B.uid.slice(0, 6)} C=${C.uid.slice(0, 6)}`);
  const now = Date.now();
  const base = { v: 1, game: "fidchell", options: { test: true }, seats: { gold: A.uid, white: null }, players: [A.uid], creator: A.uid, status: "open", firstSeat: "gold", moves: {}, moveCount: 0, turn: null, result: null, next: null, createdAt: now, updatedAt: now };
  await expect("create with someone else as creator", false, () => addDoc(collection(A.db, "games"), { ...base, creator: B.uid }));
  await expect("create an unknown game", false, () => addDoc(collection(A.db, "games"), { ...base, game: "chess" }));
  let id = "";
  await expect("create a game", true, async () => { id = (await addDoc(collection(A.db, "games"), base)).id; });
  const ref = (db: typeof A.db) => doc(db, "games", id);
  await expect("C reads by link", true, () => getDoc(ref(C.db)));
  await expect("B takes the gold seat (occupied)", false, () => updateDoc(ref(B.db), { seats: { gold: B.uid, white: null }, players: [A.uid, B.uid], status: "active", turn: B.uid, updatedAt: Date.now() }));
  await expect("B joins white but makes self first", false, () => updateDoc(ref(B.db), { seats: { gold: A.uid, white: B.uid }, players: [A.uid, B.uid], status: "active", turn: B.uid, updatedAt: Date.now() }));
  await expect("B joins white", true, () => updateDoc(ref(B.db), { seats: { gold: A.uid, white: B.uid }, players: [A.uid, B.uid], status: "active", turn: A.uid, updatedAt: Date.now() }));
  await expect("C joins a full game", false, () => updateDoc(ref(C.db), { seats: { gold: A.uid, white: C.uid }, players: [A.uid, B.uid, C.uid], updatedAt: Date.now() }));
  await expect("B moves out of turn", false, () => updateDoc(ref(B.db), { "moves.0": { f: 20, t: 15 }, moveCount: 1, turn: A.uid, updatedAt: Date.now() }));
  await expect("A moves (transaction)", true, () => runTransaction(A.db, async t => { const s = await t.get(ref(A.db)); t.update(ref(A.db), { [`moves.${s.data()!.moveCount}`]: { f: 20, t: 15 }, moveCount: s.data()!.moveCount + 1, turn: B.uid, updatedAt: Date.now() }); }));
  await expect("B rewrites A's move while moving", false, () => updateDoc(ref(B.db), { "moves.0": { f: 21, t: 16 }, "moves.1": { f: 4, t: 9 }, moveCount: 2, turn: A.uid, updatedAt: Date.now() }));
  await expect("B adds two moves at once", false, () => updateDoc(ref(B.db), { "moves.1": { f: 4, t: 9 }, "moves.2": { f: 3, t: 8 }, moveCount: 3, turn: A.uid, updatedAt: Date.now() }));
  await expect("B moves", true, () => updateDoc(ref(B.db), { "moves.1": { f: 4, t: 9 }, moveCount: 2, turn: A.uid, updatedAt: Date.now() }));
  await expect("B skips an index", false, () => updateDoc(ref(B.db), { "moves.3": { f: 4, t: 9 }, moveCount: 3, turn: A.uid, updatedAt: Date.now() }));
  await expect("A moves while lying about the count", false, () => updateDoc(ref(A.db), { "moves.2": { f: 21, t: 16 }, moveCount: 5, turn: B.uid, updatedAt: Date.now() }));
  await expect("A changes the options", false, () => updateDoc(ref(A.db), { options: { test: false }, updatedAt: Date.now() }));
  await expect("A hands the turn to a stranger", false, () => updateDoc(ref(A.db), { "moves.2": { f: 21, t: 16 }, moveCount: 3, turn: C.uid, updatedAt: Date.now() }));
  await expect("C resigns for them", false, () => updateDoc(ref(C.db), { status: "done", turn: null, result: { winner: "gold", text: "x", resigned: "white" }, updatedAt: Date.now() }));
  await expect("A lists own games", true, async () => { const s = await getDocs(query(collection(A.db, "games"), where("players", "array-contains", A.uid), limit(60))); if (!s.docs.some(d => d.id === id)) throw new Error("missing"); });
  await expect("C lists A's games", false, () => getDocs(query(collection(C.db, "games"), where("players", "array-contains", A.uid), limit(5))));
  await expect("B resigns", true, () => updateDoc(ref(B.db), { status: "done", turn: null, result: { winner: "gold", text: "White resigned.", resigned: "white" }, updatedAt: Date.now() }));
  await expect("A moves after the end", false, () => updateDoc(ref(A.db), { "moves.2": { f: 21, t: 16 }, moveCount: 3, turn: B.uid, updatedAt: Date.now() }));
  await expect("A offers a rematch", true, () => updateDoc(ref(A.db), { next: "someOtherGameId", updatedAt: Date.now() }));
  await expect("B overwrites the rematch", false, () => updateDoc(ref(B.db), { next: "x", updatedAt: Date.now() }));
  await expect("delete a game", false, async () => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(ref(A.db)); });
  await expect("tally +2", false, () => setDoc(doc(C.db, "stats", "games"), { cnoc: increment(2) }, { merge: true }));
  await expect("tally unknown game", false, () => setDoc(doc(C.db, "stats", "games"), { chess: increment(1) }, { merge: true }));
  await expect("tally two games at once", false, () => setDoc(doc(C.db, "stats", "games"), { cnoc: increment(1), fiche: increment(1) }, { merge: true }));

  // ---------- Lock races ----------
  // 1 minute, Bronze dial: −10 s a failed try, +1 s a lock.
  const opts = { minutes: 1, kind: "dial", tier: 2, resets: "free", penalty: true, bonus: true };
  const zero = { solves: 0, fails: 0, bonus: 0, penalty: 0, finished: false, finishedAt: null };
  const t0 = Date.now();
  const race = { v: 1, options: opts, seed: 0, creator: A.uid, seats: { a: A.uid, b: null }, players: [A.uid], names: { a: null, b: null }, status: "open", ready: { a: false, b: false }, runs: { a: zero, b: zero }, startedAt: null, next: null, createdAt: t0, updatedAt: t0 };
  await expect("race: create for someone else", false, () => addDoc(collection(A.db, "races"), { ...race, creator: B.uid }));
  await expect("race: create with a 2-minute option", false, () => addDoc(collection(A.db, "races"), { ...race, options: { ...opts, minutes: 2 } }));
  await expect("race: create with a head start", false, () => addDoc(collection(A.db, "races"), { ...race, runs: { a: { ...zero, solves: 3, bonus: 3 }, b: zero } }));
  await expect("race: create already running", false, () => addDoc(collection(A.db, "races"), { ...race, status: "running" }));
  let rid = "";
  await expect("race: create", true, async () => { rid = (await addDoc(collection(A.db, "races"), race)).id; });
  const rref = (db: typeof A.db) => doc(db, "races", rid);
  await expect("race: C reads by link", true, () => getDoc(rref(C.db)));
  await expect("race: A readies before anyone joins", false, () => updateDoc(rref(A.db), { "ready.a": true, updatedAt: Date.now() }));
  await expect("race: B joins into seat a", false, () => updateDoc(rref(B.db), { seats: { a: B.uid, b: null }, players: [A.uid, B.uid], status: "ready", updatedAt: Date.now() }));
  await expect("race: B joins", true, () => updateDoc(rref(B.db), { seats: { a: A.uid, b: B.uid }, players: [A.uid, B.uid], "names.b": "Bea", status: "ready", updatedAt: Date.now() }));
  await expect("race: C takes the seat as well", false, () => updateDoc(rref(C.db), { seats: { a: A.uid, b: C.uid }, players: [A.uid, B.uid, C.uid], updatedAt: Date.now() }));
  await expect("race: B sets A's ready flag", false, () => updateDoc(rref(B.db), { "ready.a": true, updatedAt: Date.now() }));
  await expect("race: A starts the race alone", false, () => updateDoc(rref(A.db), { "ready.a": true, status: "running", startedAt: serverTimestamp(), updatedAt: Date.now() }));
  await expect("race: A is ready", true, () => updateDoc(rref(A.db), { "ready.a": true, updatedAt: Date.now() }));
  await expect("race: B readies with a made-up start time", false, () => updateDoc(rref(B.db), { "ready.b": true, status: "running", startedAt: Date.now() - 600000, updatedAt: Date.now() }));
  await expect("race: B is ready, the race starts", true, () => updateDoc(rref(B.db), { "ready.b": true, status: "running", startedAt: serverTimestamp(), updatedAt: Date.now() }));
  await expect("race: A changes the options", false, () => updateDoc(rref(A.db), { "options.minutes": 10, updatedAt: Date.now() }));
  await expect("race: A reports a solve", true, () => updateDoc(rref(A.db), { "runs.a": { ...zero, solves: 1, bonus: 1 }, updatedAt: Date.now() }));
  await expect("race: A writes B's run", false, () => updateDoc(rref(A.db), { "runs.b": { ...zero, fails: 1, penalty: 10 }, updatedAt: Date.now() }));
  await expect("race: A claims too much bonus", false, () => updateDoc(rref(A.db), { "runs.a": { ...zero, solves: 2, bonus: 9 }, updatedAt: Date.now() }));
  await expect("race: A skips the fail penalty", false, () => updateDoc(rref(A.db), { "runs.a": { ...zero, solves: 1, bonus: 1, fails: 1 }, updatedAt: Date.now() }));
  await expect("race: A's count goes down", false, () => updateDoc(rref(A.db), { "runs.a": zero, updatedAt: Date.now() }));
  await expect("race: C reports for A", false, () => updateDoc(rref(C.db), { "runs.a": { ...zero, solves: 2, bonus: 2 }, updatedAt: Date.now() }));
  await expect("race: B reports a fail", true, () => updateDoc(rref(B.db), { "runs.b": { ...zero, fails: 1, penalty: 10 }, updatedAt: Date.now() }));
  await expect("race: A ends the race while unfinished", false, () => updateDoc(rref(A.db), { status: "done", updatedAt: Date.now() }));
  await expect("race: A finishes", true, () => updateDoc(rref(A.db), { "runs.a": { solves: 2, fails: 0, bonus: 2, penalty: 0, finished: true, finishedAt: Date.now() }, updatedAt: Date.now() }));
  await expect("race: A adds a solve after finishing", false, () => updateDoc(rref(A.db), { "runs.a": { solves: 3, fails: 0, bonus: 3, penalty: 0, finished: true, finishedAt: Date.now() }, updatedAt: Date.now() }));
  await expect("race: B finishes and closes the race", true, () => updateDoc(rref(B.db), { "runs.b": { solves: 1, fails: 1, bonus: 1, penalty: 10, finished: true, finishedAt: Date.now() }, status: "done", updatedAt: Date.now() }));
  await expect("race: A offers a rematch", true, () => updateDoc(rref(A.db), { next: "someOtherRaceId", updatedAt: Date.now() }));
  await expect("race: delete", false, async () => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(rref(A.db)); });
  await expect("race: A lists own races", true, async () => { const s = await getDocs(query(collection(A.db, "races"), where("players", "array-contains", A.uid), limit(60))); if (!s.docs.some(d => d.id === rid)) throw new Error("missing"); });

  // ---------- Challenge scores ----------
  const sref = (db: typeof A.db, uid: string) => doc(db, "races", rid, "scores", uid);
  const score0 = { name: null, ...zero, startedAt: serverTimestamp(), updatedAt: Date.now() };
  await expect("score: C writes one for B", false, () => setDoc(sref(C.db, B.uid), { uid: B.uid, ...score0 }));
  await expect("score: A (a racer) posts one", false, () => setDoc(sref(A.db, A.uid), { uid: A.uid, ...score0 }));
  await expect("score: C starts with a head start", false, () => setDoc(sref(C.db, C.uid), { uid: C.uid, ...score0, solves: 4, bonus: 4 }));
  await expect("score: C starts with a made-up start time", false, () => setDoc(sref(C.db, C.uid), { uid: C.uid, ...score0, startedAt: Date.now() - 600000 }));
  await expect("score: C starts", true, () => setDoc(sref(C.db, C.uid), { uid: C.uid, ...score0 }));
  await expect("score: C starts again over it", false, () => setDoc(sref(C.db, C.uid), { uid: C.uid, ...score0 }));
  await expect("score: C reports two solves", true, () => updateDoc(sref(C.db, C.uid), { solves: 2, bonus: 2, updatedAt: Date.now() }));
  await expect("score: C claims extra bonus", false, () => updateDoc(sref(C.db, C.uid), { solves: 3, bonus: 30, updatedAt: Date.now() }));
  await expect("score: C changes their start", false, () => updateDoc(sref(C.db, C.uid), { startedAt: serverTimestamp(), updatedAt: Date.now() }));
  await expect("score: B edits C's score", false, () => updateDoc(sref(B.db, C.uid), { solves: 0, bonus: 0, updatedAt: Date.now() }));
  await expect("score: C finishes", true, () => updateDoc(sref(C.db, C.uid), { solves: 3, bonus: 3, fails: 1, penalty: 10, finished: true, finishedAt: Date.now(), updatedAt: Date.now() }));
  await expect("score: C edits after finishing", false, () => updateDoc(sref(C.db, C.uid), { solves: 9, bonus: 9, updatedAt: Date.now() }));
  await expect("score: B reads the board", true, () => getDocs(collection(B.db, "races", rid, "scores")));
  await expect("score: delete", false, async () => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(sref(C.db, C.uid)); });
  log("DONE");
})().catch(e => log("ERROR " + String(e)));
