// Online play on Firebase: anonymous sign-in and one Firestore document per game.
// The checks here mirror firestore.rules, which enforce them on the server.
import {
  GoogleAuthProvider, getAuth, linkWithPopup, onAuthStateChanged, signInAnonymously, signInWithCredential,
  signInWithPopup, signOut, type User,
} from "firebase/auth";
import {
  addDoc, collection, doc, getDocs, getFirestore, limit, onSnapshot, query, runTransaction, where,
  type Firestore,
} from "firebase/firestore";
import { OnlineError, type OnlineBackend } from "./backend";
import { firebaseApp } from "./firebaseApp";
import type { OnlineDoc } from "./types";

function friendly(e: unknown): Error {
  if (e instanceof OnlineError) return e;
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("permission-denied")) return new OnlineError("denied", "The game server refused that. If this keeps happening, online play may not be set up yet.");
  if (code.includes("admin-restricted-operation") || code.includes("operation-not-allowed")) return new OnlineError("denied", "Online play isn't switched on yet (anonymous sign-in is disabled).");
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return new OnlineError("other", "Sign-in was cancelled.");
  if (code.includes("popup-blocked")) return new OnlineError("other", "The sign-in window was blocked. Allow pop-ups for this site and try again.");
  if (code.includes("unauthorized-domain")) return new OnlineError("denied", "Google sign-in isn't allowed on this address yet (add it under Authentication → Settings → Authorized domains).");
  if (code.includes("unavailable") || code.includes("network")) return new OnlineError("offline", "Can't reach the game server. Check your connection.");
  return new OnlineError("other", (e as Error)?.message || "Something went wrong.");
}

export function firebaseBackend(): OnlineBackend {
  const auth = getAuth(firebaseApp());
  const db: Firestore = getFirestore(firebaseApp());
  const games = collection(db, "games");
  let ready: Promise<User> | null = null;

  const tx = async (id: string, f: (d: OnlineDoc) => Partial<OnlineDoc>) => {
    try {
      await runTransaction(db, async t => {
        const ref = doc(games, id), snap = await t.get(ref);
        if (!snap.exists()) throw new OnlineError("missing", "That game doesn't exist.");
        t.update(ref, { ...f(snap.data() as OnlineDoc), updatedAt: Date.now() });
      });
    } catch (e) { throw friendly(e); }
  };

  return {
    kind: "firebase",
    onAccount(cb) {
      return onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, name: u.displayName ?? u.email ?? null, anonymous: u.isAnonymous } : null));
    },
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      const u = auth.currentUser;
      try {
        if (u?.isAnonymous) await linkWithPopup(u, provider);
        else await signInWithPopup(auth, provider);
      } catch (e) {
        // This Google account already plays here from another browser: switch to it.
        if ((e as { code?: string }).code === "auth/credential-already-in-use") {
          const cred = GoogleAuthProvider.credentialFromError(e as never);
          if (cred) { await signInWithCredential(auth, cred); return; }
        }
        throw friendly(e);
      }
      ready = null;
    },
    async signOut() { await signOut(auth); ready = null; },
    knownUid() {
      return new Promise<string | null>(resolve => {
        const stop = onAuthStateChanged(auth, u => { stop(); resolve(u?.uid ?? null); }, () => resolve(null));
      });
    },
    offerRematch(id, uid, next) {
      return tx(id, d => {
        if (d.status !== "done" || !d.players.includes(uid) || d.next) throw new OnlineError("stale", "A rematch is already on offer.");
        return { next };
      });
    },
    signIn() {
      ready ??= new Promise<User>((resolve, reject) => {
        const stop = onAuthStateChanged(auth, u => {
          if (u) { stop(); resolve(u); }
          else signInAnonymously(auth).catch(e => { stop(); ready = null; reject(friendly(e)); });
        }, e => { ready = null; reject(friendly(e)); });
      });
      return ready.then(u => u.uid);
    },
    async create(d) {
      try { return (await addDoc(games, d)).id; } catch (e) { throw friendly(e); }
    },
    watch(id, cb, onError) {
      return onSnapshot(doc(games, id), snap => cb(snap.exists() ? (snap.data() as OnlineDoc) : null), e => onError(friendly(e)));
    },
    join(id, seat, uid) {
      return tx(id, d => {
        if (d.status !== "open" || d.seats[seat] !== null || d.players.includes(uid)) throw new OnlineError("taken", "That seat has been taken.");
        const seats = { ...d.seats, [seat]: uid };
        const full = Object.values(seats).every(Boolean);
        return { seats, players: [...d.players, uid], status: full ? "active" : "open", turn: full ? seats[d.firstSeat] ?? null : null };
      });
    },
    move(id, uid, expected, move, nextTurn, result) {
      return tx(id, d => {
        if (d.status !== "active") throw new OnlineError("stale", "The game is over.");
        if (d.turn !== uid) throw new OnlineError("not-your-turn", "It isn't your turn.");
        if (d.moves.length !== expected) throw new OnlineError("stale", "The game moved on. Try again.");
        return { moves: [...d.moves, move], turn: result ? null : nextTurn, status: result ? "done" : "active", result };
      });
    },
    resign(id, uid, result) {
      return tx(id, d => {
        if (d.status !== "active" || !d.players.includes(uid)) throw new OnlineError("stale", "The game is over.");
        return { status: "done", turn: null, result };
      });
    },
    async myGames(game, uid) {
      try {
        // One condition only, so no composite index is needed; the game filter happens here.
        const snap = await getDocs(query(games, where("players", "array-contains", uid), limit(60)));
        return snap.docs.map(s => ({ id: s.id, doc: s.data() as OnlineDoc })).filter(g => g.doc.game === game).sort((a, b) => b.doc.updatedAt - a.doc.updatedAt);
      } catch (e) { throw friendly(e); }
    },
  };
}
