// The site's Firebase web app. This config is public by design: it only names the project.
// Access is controlled by the Firestore security rules (firestore.rules) and the sign-in methods
// enabled in the Firebase console.
export const firebaseConfig = {
  apiKey: "AIzaSyCgmYgco8CxFWdG8neFfPGD_sgPfuvwFN8",
  authDomain: "celtic-cross-games.firebaseapp.com",
  projectId: "celtic-cross-games",
  storageBucket: "celtic-cross-games.firebasestorage.app",
  messagingSenderId: "376325689994",
  appId: "1:376325689994:web:3ea797b348a50f2f121373",
  measurementId: "G-71B6PFKW8J",
};

/** Games that can be played online by invite. Must match the list in firestore.rules. */
export const ONLINE_GAMES = ["monsiv", "cnoc", "fidchell"] as const;
export type OnlineGameId = (typeof ONLINE_GAMES)[number];
