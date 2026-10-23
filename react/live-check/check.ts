// Live check of firestore.rules against the real project: three anonymous players try 29 allowed
// and forbidden actions. Run the dev server (npx vite) and open /live-check/index.html; every line
// should say PASS. It leaves one finished test game (options.test = true) in the database.
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, query, runTransaction, setDoc, increment, updateDoc, where } from "firebase/firestore";
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
  log("DONE");
})().catch(e => log("ERROR " + String(e)));
