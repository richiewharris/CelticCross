// The store behind online play. The live site uses Firebase (firebaseBackend.ts); a local stand-in
// (localBackend.ts) keeps games in this browser and syncs tabs, for development and tests.
// Open the site with ?online=local to use it.
import type { OnlineDoc, OnlineGameSummary, OnlineResult, SeatId } from "./types";

export interface Account { uid: string; name: string | null; anonymous: boolean }

export interface OnlineBackend {
  kind: "firebase" | "local";
  /** This browser's player id if it has signed in before, without signing in. */
  knownUid(): Promise<string | null>;
  /** Sign in (anonymously) and return this player's id. */
  signIn(): Promise<string>;
  create(doc: OnlineDoc): Promise<string>;
  /** Follow a game; the callback gets null if it doesn't exist. Returns an unsubscribe function. */
  watch(id: string, cb: (doc: OnlineDoc | null) => void, onError: (e: Error) => void): () => void;
  /** Take an empty seat. Fails if it was taken first. */
  join(id: string, seat: SeatId, uid: string): Promise<void>;
  /** Add a move, if the game still has `expected` moves and it is this player's turn. */
  move(id: string, uid: string, expected: number, move: unknown, nextTurn: string | null, result: OnlineResult | null): Promise<void>;
  resign(id: string, uid: string, result: OnlineResult): Promise<void>;
  /** Follow who is signed in (null when nobody has signed in on this browser yet). */
  onAccount(cb: (a: Account | null) => void): () => void;
  /** Sign in with Google. An anonymous player keeps their games: the Google account is linked to them. */
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** After a finished game: point both players at a rematch game. */
  offerRematch(id: string, uid: string, next: string): Promise<void>;
  /** Follow every game this player sits in (all kinds), live. */
  watchMyGames(uid: string, cb: (games: OnlineGameSummary[]) => void, onError: (e: Error) => void): () => void;
  /** This player's games of one kind, newest first. */
  myGames(game: string, uid: string): Promise<OnlineGameSummary[]>;
}

export class OnlineError extends Error {
  constructor(public code: "taken" | "stale" | "not-your-turn" | "missing" | "denied" | "offline" | "other", message: string) { super(message); }
}

let chosen: Promise<OnlineBackend> | null = null;

// Remember that this browser has played online, so the "your games" link can show turns without
// loading Firebase for visitors who never play online.
const PLAYED = "online-played";
export const markPlayedOnline = () => {
  if (hasPlayedOnline()) return;
  try { localStorage.setItem(PLAYED, "1"); } catch { /* ignore */ }
  window.dispatchEvent(new Event("onlineplayed"));
};
export const hasPlayedOnline = () => { try { return localStorage.getItem(PLAYED) === "1"; } catch { return false; } };

export function backendKind(): "firebase" | "local" {
  try {
    const q = new URLSearchParams(window.location.search).get("online");
    if (q === "local" || q === "firebase") sessionStorage.setItem("online-backend", q);
    return sessionStorage.getItem("online-backend") === "local" ? "local" : "firebase";
  } catch { return "firebase"; }
}

/** The backend for this page, loaded on first use (Firebase code is only fetched when needed). */
export function getBackend(): Promise<OnlineBackend> {
  if (!chosen) {
    chosen = backendKind() === "local"
      ? import("./localBackend").then(m => m.localBackend())
      : import("./firebaseBackend").then(m => m.firebaseBackend());
  }
  return chosen;
}
