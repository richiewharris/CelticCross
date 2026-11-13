// Lock races online: one Firestore document per race (races/{id}) and one score per challenger
// (races/{id}/scores/{uid}). Kept apart from the move-list games (backend.ts): a race has no turns,
// each racer just reports their own count as they go. firestore.rules enforces who may write what;
// the browsers keep the clocks, so the scores are self-reported (see ONLINE.md).
//
// The local stand-in (?online=local) keeps races in localStorage and syncs tabs with a BroadcastChannel;
// each tab is a different player, as with localBackend.ts.
import { getBackend, markPlayedOnline, OnlineError } from "./backend";
import type { RaceOptions, RaceRun } from "../games/lock/race/engine";

export type RaceSeat = "a" | "b";
export const SEATS: readonly RaceSeat[] = ["a", "b"];
export type RaceStatus = "open" | "ready" | "running" | "done";

export interface RaceDoc {
  v: 1;
  options: RaceOptions;
  /** Every lock in the race comes from this (see race/engine.ts). */
  seed: number;
  creator: string;
  /** The racer in each seat (uid), or null while waiting for an opponent. */
  seats: Record<RaceSeat, string | null>;
  players: string[];
  /** Google display names, if signed in with Google; otherwise "Player 1/2" is shown. */
  names: Record<RaceSeat, string | null>;
  /** open → ready (both seated, pressing Ready) → running (both ready) → done. */
  status: RaceStatus;
  ready: Record<RaceSeat, boolean>;
  /** Each racer's count, written only by that racer, as they go. */
  runs: Record<RaceSeat, RaceRun>;
  /** Server time (ms) when the second racer pressed Ready; the window for reporting runs counts from here. */
  startedAt: number | null;
  /** After the race: the rematch's id, once a racer offers one. */
  next: string | null;
  createdAt: number;
  updatedAt: number;
}

/** One challenger's result for a race's puzzles (the racers' own results are in the race document). */
export interface RaceScore extends RaceRun {
  uid: string;
  name: string | null;
  /** Server time (ms) when the challenge began. */
  startedAt: number | null;
  updatedAt: number;
}

export interface RaceSummary { id: string; doc: RaceDoc }

export interface RaceStore {
  createRace(d: RaceDoc): Promise<string>;
  watchRace(id: string, cb: (d: RaceDoc | null) => void, onError: (e: Error) => void): () => void;
  /** Take the empty seat. */
  joinRace(id: string, uid: string, name: string | null): Promise<void>;
  /** This racer is ready; when both are, the race starts (status running). */
  setReady(id: string, uid: string): Promise<void>;
  /** Report this racer's count. A finished run also ends the race if the other racer has finished. */
  updateRun(id: string, uid: string, run: RaceRun): Promise<void>;
  /** End the race (only once your own run is finished), e.g. when the other racer has gone away. */
  endRace(id: string, uid: string): Promise<void>;
  offerRematch(id: string, uid: string, next: string): Promise<void>;
  /** Call off a race nobody has joined yet (only its creator, while it is open): the race is deleted. */
  cancelRace(id: string, uid: string): Promise<void>;
  /** Begin this player's challenge score; "exists" if they already have one (then they play for practice). */
  startScore(raceId: string, uid: string, name: string | null): Promise<"started" | "exists">;
  /** Report this challenger's count as they go (numbers only grow; frozen once finished). */
  postScore(raceId: string, uid: string, run: RaceRun): Promise<void>;
  watchScores(raceId: string, cb: (s: RaceScore[]) => void, onError: (e: Error) => void): () => void;
  watchMyRaces(uid: string, cb: (r: RaceSummary[]) => void, onError: (e: Error) => void): () => void;
}

export const seatOf = (d: Pick<RaceDoc, "seats">, uid: string | null): RaceSeat | null =>
  !uid ? null : d.seats.a === uid ? "a" : d.seats.b === uid ? "b" : null;
export const otherSeat = (s: RaceSeat): RaceSeat => (s === "a" ? "b" : "a");
export const seatName = (d: Pick<RaceDoc, "names">, s: RaceSeat) => d.names[s] || (s === "a" ? "Player 1" : "Player 2");

/* ---------- Addresses ---------- */
export const raceIdFrom = (hash: string): string | null => {
  const m = hash.match(/^#\/?lock\/race\/([A-Za-z0-9]{8,40})\/?$/);
  return m ? m[1] : null;
};
export const raceHash = (id: string) => `#/lock/race/${id}`;
export const raceUrl = (id: string) => `${window.location.origin}${window.location.pathname}${window.location.search}${raceHash(id)}`;

/** Short words for a race's options (for lists that don't load the lock's code). */
export function raceLine(o: RaceOptions): string {
  const kind = o.kind === "cube" ? "cube" : o.kind === "cross" ? "classic cross" : "dial";
  const tier = ["Iron", "Bronze", "Silver", "Gold", "Ogham"][o.tier - 1];
  return `${o.minutes}-minute race · ${tier} ${kind}`;
}

/* ---------- Who is playing ---------- */
/** Sign in (anonymously if need be) and return this player's id and Google name (null if anonymous). */
export async function raceSignIn(): Promise<{ uid: string; name: string | null }> {
  const b = await getBackend();
  const uid = await b.signIn();
  const name = await new Promise<string | null>(resolve => {
    let stop: () => void = () => {};
    let done = false;
    stop = b.onAccount(a => { if (done) return; done = true; resolve(a && !a.anonymous ? (a.name ?? null) : null); queueMicrotask(() => stop()); });
  });
  return { uid, name: name ? name.slice(0, 40) : null };
}

/* ---------- Challenges you've played (kept in this browser for "Your games") ---------- */
export interface PlayedChallenge { id: string; line: string; solves: number; fails: number; at: number; counted: boolean }
const PLAYED_KEY = "lock-race-challenges";
export function myChallenges(): PlayedChallenge[] {
  try { const v = JSON.parse(localStorage.getItem(PLAYED_KEY) || "[]") as PlayedChallenge[]; return Array.isArray(v) ? v : []; } catch { return []; }
}
export function rememberChallenge(c: PlayedChallenge) {
  const all = myChallenges();
  // the counted score for a race stays; later practice runs don't replace it
  if (!c.counted && all.some(x => x.id === c.id && x.counted)) return;
  const list = all.filter(x => x.id !== c.id);
  try { localStorage.setItem(PLAYED_KEY, JSON.stringify([c, ...list].slice(0, 30))); } catch { /* ignore */ }
  markPlayedOnline();
}

/* ---------- The store ---------- */
let chosen: Promise<RaceStore> | null = null;
export function getRaceStore(): Promise<RaceStore> {
  chosen ??= getBackend().then(b => (b.kind === "local" ? localRaces() : import("./firebaseRaces").then(m => m.firebaseRaces())));
  return chosen;
}

/** The checks both stores make before writing (the server makes them again in firestore.rules). */
export const raceChecks = {
  join(d: RaceDoc, uid: string) {
    if (d.status !== "open" || d.seats.b !== null || d.players.includes(uid)) throw new OnlineError("taken", "Someone else has taken the other seat.");
  },
  ready(d: RaceDoc, uid: string): RaceSeat {
    const s = seatOf(d, uid);
    if (d.status !== "ready" || !s) throw new OnlineError("stale", "The race isn't waiting for you to be ready.");
    return s;
  },
  run(d: RaceDoc, uid: string): RaceSeat {
    const s = seatOf(d, uid);
    if (!s || (d.status !== "running" && d.status !== "done")) throw new OnlineError("stale", "This race isn't running.");
    if (d.runs[s].finished) throw new OnlineError("stale", "Your run is already finished.");
    return s;
  },
  end(d: RaceDoc, uid: string) {
    const s = seatOf(d, uid);
    if (!s || d.status !== "running" || !d.runs[s].finished) throw new OnlineError("stale", "The race can't end yet.");
  },
  cancel(d: RaceDoc, uid: string) {
    if (d.status !== "open" || d.creator !== uid || d.seats.b !== null || d.players.length !== 1) throw new OnlineError("stale", "Someone has joined, so the race can't be called off now.");
  },
  rematch(d: RaceDoc, uid: string) {
    if (d.status !== "done" || !d.players.includes(uid) || d.next) throw new OnlineError("stale", "A rematch is already on offer.");
  },
};

/** Status after a run update: done once both runs are finished. */
export const statusAfterRun = (d: RaceDoc, s: RaceSeat, run: RaceRun): RaceStatus =>
  d.status === "running" && run.finished && d.runs[otherSeat(s)].finished ? "done" : d.status;

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 57]).join("");

/** The local stand-in: races in localStorage, tabs kept in step by a BroadcastChannel. */
export function localRaces(): RaceStore {
  const KEY = "online-local-races", SKEY = "online-local-race-scores";
  const load = (): Record<string, RaceDoc> => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, RaceDoc>; } catch { return {}; } };
  const loadScores = (): Record<string, Record<string, RaceScore>> => { try { return JSON.parse(localStorage.getItem(SKEY) || "{}") as Record<string, Record<string, RaceScore>>; } catch { return {}; } };
  const chan = typeof BroadcastChannel === "function" ? new BroadcastChannel("online-local-races") : null;
  const subs = new Set<() => void>();
  chan?.addEventListener("message", () => subs.forEach(f => f()));
  const changed = () => { subs.forEach(f => f()); chan?.postMessage(1); };
  const sub = (f: () => void) => { subs.add(f); queueMicrotask(f); return () => { subs.delete(f); }; };
  const update = (id: string, f: (d: RaceDoc) => Partial<RaceDoc>) => {
    const all = load(), d = all[id];
    if (!d) throw new OnlineError("missing", "That race doesn't exist.");
    all[id] = { ...d, ...f(d), updatedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all)); changed();
  };
  const setScore = (raceId: string, s: RaceScore) => {
    const all = loadScores();
    all[raceId] = { ...(all[raceId] ?? {}), [s.uid]: s };
    localStorage.setItem(SKEY, JSON.stringify(all)); changed();
  };
  return {
    async createRace(d) { const id = rid(), all = load(); all[id] = d; localStorage.setItem(KEY, JSON.stringify(all)); changed(); return id; },
    async cancelRace(id, uid) {
      const all = load(), d = all[id];
      if (!d) return;
      raceChecks.cancel(d, uid);
      delete all[id]; localStorage.setItem(KEY, JSON.stringify(all)); changed();
    },
    watchRace(id, cb) {
      let last = "";
      return sub(() => { const d = load()[id] ?? null; const k = JSON.stringify(d); if (k !== last) { last = k; cb(d); } });
    },
    async joinRace(id, uid, name) {
      update(id, d => { raceChecks.join(d, uid); return { seats: { ...d.seats, b: uid }, players: [...d.players, uid], names: { ...d.names, b: name }, status: "ready" }; });
    },
    async setReady(id, uid) {
      update(id, d => {
        const s = raceChecks.ready(d, uid), ready = { ...d.ready, [s]: true };
        const both = ready.a && ready.b;
        return { ready, status: both ? "running" : "ready", startedAt: both ? Date.now() : null };
      });
    },
    async updateRun(id, uid, run) {
      update(id, d => { const s = raceChecks.run(d, uid); return { runs: { ...d.runs, [s]: run }, status: statusAfterRun(d, s, run) }; });
    },
    async endRace(id, uid) { update(id, d => { raceChecks.end(d, uid); return { status: "done" }; }); },
    async offerRematch(id, uid, next) { update(id, d => { raceChecks.rematch(d, uid); return { next }; }); },
    async startScore(raceId, uid, name) {
      const d = load()[raceId];
      if (!d || (d.status !== "running" && d.status !== "done") || d.players.includes(uid)) throw new OnlineError("denied", "This race can't take a challenge score from you.");
      if (loadScores()[raceId]?.[uid]) return "exists";
      const now = Date.now();
      setScore(raceId, { uid, name, solves: 0, fails: 0, bonus: 0, penalty: 0, finished: false, finishedAt: null, startedAt: now, updatedAt: now });
      return "started";
    },
    async postScore(raceId, uid, run) {
      const old = loadScores()[raceId]?.[uid];
      if (!old || old.finished) throw new OnlineError("stale", "That score is already final.");
      setScore(raceId, { ...old, ...run, updatedAt: Date.now() });
    },
    watchScores(raceId, cb) {
      let last = "";
      return sub(() => { const s = Object.values(loadScores()[raceId] ?? {}); const k = JSON.stringify(s); if (k !== last) { last = k; cb(s); } });
    },
    watchMyRaces(uid, cb) {
      let last = "";
      return sub(() => {
        const list = Object.entries(load()).filter(([, d]) => d.players.includes(uid)).map(([id, doc]) => ({ id, doc })).sort((a, b) => b.doc.updatedAt - a.doc.updatedAt);
        const k = JSON.stringify(list); if (k !== last) { last = k; cb(list); }
      });
    },
  };
}
