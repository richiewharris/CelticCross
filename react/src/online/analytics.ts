// Site statistics:
// - Google Analytics (through Firebase), only after the visitor agrees, for visits and game events.
// - A public "games played" tally per game in Firestore (stats/games), bumped when a game ends.
//   It holds no personal data and sets no cookies, so it runs without asking.
import { backendKind } from "./backend";

export type Consent = "yes" | "no" | null;
const CONSENT_KEY = "analytics-consent";

export function getConsent(): Consent {
  try { const v = localStorage.getItem(CONSENT_KEY); return v === "yes" || v === "no" ? v : null; } catch { return null; }
}

type Log = (name: string, params?: Record<string, unknown>) => void;
let logger: Promise<Log | null> | null = null;

function analytics(): Promise<Log | null> {
  if (getConsent() !== "yes" || backendKind() === "local" || import.meta.env.DEV) return Promise.resolve(null);
  logger ??= (async () => {
    try {
      const [{ firebaseApp }, an] = await Promise.all([import("./firebaseApp"), import("firebase/analytics")]);
      if (!(await an.isSupported())) return null;
      const a = an.getAnalytics(firebaseApp());
      return (name: string, params?: Record<string, unknown>) => an.logEvent(a, name, params);
    } catch { return null; }
  })();
  return logger;
}

export function setConsent(v: "yes" | "no") {
  try { localStorage.setItem(CONSENT_KEY, v); } catch { /* storage blocked: ask again next visit */ }
  window.dispatchEvent(new Event("consentchange"));
  if (v === "yes") void analytics(); // the first load sends a page view by itself
}

export function track(name: string, params?: Record<string, unknown>) {
  void analytics().then(log => log?.(name, params));
}

/** Hash routes don't change the page path, so report each one as a page view. */
export function trackPageView() {
  track("page_view", { page_location: window.location.href, page_path: "/" + window.location.hash.replace(/^#\/?/, "").replace(/\/play\/.+$/, "/play"), page_title: document.title });
}

export interface GameEventInfo { mode: "computer" | "friend" | "online" | "solo" | "puzzle"; result?: string; variant?: string; level?: string | number; score?: number; cheat?: boolean }

export function recordGameStart(game: string, info: GameEventInfo) {
  track("game_start", { game, ...info });
}

/** Call once when a game, match, lock or day is finished. */
export function recordGameEnd(game: string, info: GameEventInfo) {
  track("game_end", { game, ...info });
  if (info.mode !== "puzzle") void bumpPlayed(game);
}

// ---- The public tally ----
const TALLY_CACHE = "games-played-cache";

async function bumpPlayed(game: string) {
  if (backendKind() === "local" || import.meta.env.DEV) return;
  try {
    const [{ firebaseApp }, fs] = await Promise.all([import("./firebaseApp"), import("firebase/firestore/lite")]);
    const db = fs.getFirestore(firebaseApp());
    await fs.setDoc(fs.doc(db, "stats", "games"), { [game]: fs.increment(1) }, { merge: true });
    try { sessionStorage.removeItem(TALLY_CACHE); } catch { /* ignore */ }
  } catch { /* counting is best effort */ }
}

/** Games played per game id, cached for this visit. */
export async function fetchPlayed(): Promise<Record<string, number>> {
  try { const c = sessionStorage.getItem(TALLY_CACHE); if (c) return JSON.parse(c) as Record<string, number>; } catch { /* ignore */ }
  if (backendKind() === "local") return {};
  try {
    const [{ firebaseApp }, fs] = await Promise.all([import("./firebaseApp"), import("firebase/firestore/lite")]);
    const snap = await fs.getDoc(fs.doc(fs.getFirestore(firebaseApp()), "stats", "games"));
    const data = (snap.exists() ? snap.data() : {}) as Record<string, number>;
    try { sessionStorage.setItem(TALLY_CACHE, JSON.stringify(data)); } catch { /* ignore */ }
    return data;
  } catch { return {}; }
}
