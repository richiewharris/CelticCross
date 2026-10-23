import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

let app: FirebaseApp | null = null;
/** The one Firebase app for the site, created on first use. */
export function firebaseApp(): FirebaseApp {
  return app ??= getApps()[0] ?? initializeApp(firebaseConfig);
}
