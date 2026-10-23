import { Suspense, useEffect } from "react";
import { ConsentBanner } from "./online/ConsentBanner";
import { trackPageView } from "./online/analytics";
import { GAMES } from "./games/registry";
import { Home } from "./home/Home";
import { Playground } from "./playground/Playground";
import { useHashRoute } from "./useHashRoute";

export function App() {
  const route = useHashRoute();
  const [first] = route.split("/");
  const game = GAMES.find(g => g.id === first);
  useEffect(() => { trackPageView(); }, [route]);
  const page = game ? <game.Page /> : first === "playground" ? <Playground /> : <Home />;
  return (
    <div id="app-shell">
      <nav className="topnav" aria-label="Pages">
        <a href="#/" aria-current={!game && first !== "playground" ? "page" : undefined}>← All games</a>
        {game ? <span className="here">{game.title}</span> : null}
        <a href="#/playground" aria-current={first === "playground" ? "page" : undefined}>Playground</a>
      </nav>
      <Suspense fallback={<p className="loading">Loading…</p>}>{page}</Suspense>
      <ConsentBanner />
    </div>
  );
}
