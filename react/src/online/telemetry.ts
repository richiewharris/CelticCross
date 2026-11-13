// Match records: for games we are balancing (Roth Catha), what was played, so the cards can be judged on real matches.
// A record holds the setup, both decks, the match's seed and every choice made (its index), so the whole match can
// be replayed by the rules of the build it was played on; and the result. It holds no name, account or id.
// Records are sent only for visitors who allowed the visit statistics (the same Allow), never on the local stand-in
// or in development. The site's owner reads them on #/telemetry (firestore.rules: telemetry, admins).
import { getConsent } from "./analytics";
import { backendKind } from "./backend";

export interface MatchTelemetry {
  game: "roth";
  /** How it ended for the player: won, lost, drawn, or left before the end. */
  outcome: "won" | "lost" | "drawn" | "abandoned";
  /** The game's own record (setup, decks, seed, choices, result): plain JSON. */
  match: Record<string, unknown>;
}

export const telemetryOn = () => getConsent() === "yes" && backendKind() !== "local" && !import.meta.env.DEV;

/** Send one match's record (best effort: a failure is ignored). */
export async function recordMatch(t: MatchTelemetry) {
  if (!telemetryOn()) return;
  try {
    const [{ firebaseApp }, fs] = await Promise.all([import("./firebaseApp"), import("firebase/firestore/lite")]);
    await fs.addDoc(fs.collection(fs.getFirestore(firebaseApp()), "telemetry"), { v: 1, game: t.game, build: __BUILD__, at: Date.now(), outcome: t.outcome, match: t.match });
  } catch { /* recording is best effort */ }
}

/** Every record (the owner only: the rules refuse anyone not listed under admins/{uid}). */
export async function fetchTelemetry(game: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const [{ firebaseApp }, fs] = await Promise.all([import("./firebaseApp"), import("firebase/firestore")]);
  const db = fs.getFirestore(firebaseApp());
  const snap = await fs.getDocs(fs.query(fs.collection(db, "telemetry"), fs.where("game", "==", game)));
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}
