// A stand-in for Firebase that keeps games in localStorage and syncs open tabs with a
// BroadcastChannel. Each tab is a different player (its id lives in sessionStorage), so two tabs
// can play each other. Used with ?online=local and by the tests.
import { OnlineError, type OnlineBackend } from "./backend";
import type { OnlineDoc } from "./types";

const KEY = "online-local-games";

function load(): Record<string, OnlineDoc> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, OnlineDoc>; } catch { return {}; }
}
function save(all: Record<string, OnlineDoc>) { localStorage.setItem(KEY, JSON.stringify(all)); }
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 57]).join("");

export function localBackend(): OnlineBackend {
  const chan = typeof BroadcastChannel === "function" ? new BroadcastChannel("online-local") : null;
  const listeners = new Map<string, Set<(d: OnlineDoc | null) => void>>();
  const notify = (id: string) => listeners.get(id)?.forEach(cb => cb(load()[id] ?? null));
  chan?.addEventListener("message", e => notify((e.data as { id: string }).id));
  const changed = (id: string) => { notify(id); chan?.postMessage({ id }); };
  const update = (id: string, f: (d: OnlineDoc) => OnlineDoc) => {
    const all = load(), d = all[id];
    if (!d) throw new OnlineError("missing", "That game doesn't exist.");
    all[id] = { ...f(d), updatedAt: Date.now() };
    save(all); changed(id);
  };
  return {
    kind: "local",
    onAccount(cb) {
      const uid = sessionStorage.getItem("online-local-uid");
      const name = sessionStorage.getItem("online-local-name");
      queueMicrotask(() => cb(uid ? { uid, name, anonymous: !name } : null));
      return () => {};
    },
    async signInWithGoogle() { sessionStorage.setItem("online-local-name", "Local player"); },
    async signOut() { sessionStorage.removeItem("online-local-name"); },
    async knownUid() { return sessionStorage.getItem("online-local-uid"); },
    async offerRematch(id, uid, next) {
      update(id, d => {
        if (d.status !== "done" || !d.players.includes(uid) || d.next) throw new OnlineError("stale", "A rematch is already on offer.");
        return { ...d, next };
      });
    },
    async signIn() {
      let uid = sessionStorage.getItem("online-local-uid");
      if (!uid) { uid = "local-" + rid().slice(0, 8); sessionStorage.setItem("online-local-uid", uid); }
      return uid;
    },
    async create(doc) {
      const id = rid(), all = load();
      all[id] = doc; save(all); changed(id);
      return id;
    },
    watch(id, cb) {
      let set = listeners.get(id);
      if (!set) listeners.set(id, set = new Set());
      set.add(cb);
      queueMicrotask(() => cb(load()[id] ?? null));
      return () => { set!.delete(cb); };
    },
    async join(id, seat, uid) {
      update(id, d => {
        if (d.status !== "open" || d.seats[seat] !== null || d.players.includes(uid)) throw new OnlineError("taken", "That seat has been taken.");
        const seats = { ...d.seats, [seat]: uid };
        const full = Object.values(seats).every(Boolean);
        return { ...d, seats, players: [...d.players, uid], status: full ? "active" : "open", turn: full ? seats[d.firstSeat] ?? null : null };
      });
    },
    async move(id, uid, expected, move, nextTurn, result) {
      update(id, d => {
        if (d.status !== "active") throw new OnlineError("stale", "The game is over.");
        if (d.turn !== uid) throw new OnlineError("not-your-turn", "It isn't your turn.");
        if (d.moves.length !== expected) throw new OnlineError("stale", "The game moved on. Try again.");
        return { ...d, moves: [...d.moves, move], turn: result ? null : nextTurn, status: result ? "done" : "active", result };
      });
    },
    async resign(id, uid, result) {
      update(id, d => {
        if (d.status !== "active" || !d.players.includes(uid)) throw new OnlineError("stale", "The game is over.");
        return { ...d, status: "done", turn: null, result };
      });
    },
    watchMyGames(uid, cb) {
      const send = () => cb(Object.entries(load()).filter(([, d]) => d.players.includes(uid)).map(([id, doc]) => ({ id, doc })).sort((a, b) => b.doc.updatedAt - a.doc.updatedAt));
      const all = (e: StorageEvent) => { if (e.key === KEY) send(); };
      const onMsg = () => send();
      window.addEventListener("storage", all);
      chan?.addEventListener("message", onMsg);
      queueMicrotask(send);
      return () => { window.removeEventListener("storage", all); chan?.removeEventListener("message", onMsg); };
    },
    async myGames(game, uid) {
      return Object.entries(load())
        .filter(([, d]) => d.game === game && d.players.includes(uid))
        .map(([id, doc]) => ({ id, doc }))
        .sort((a, b) => b.doc.updatedAt - a.doc.updatedAt);
    },
  };
}
