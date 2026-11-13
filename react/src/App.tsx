import { Suspense, useEffect } from "react";
import { ConsentBanner } from "./online/ConsentBanner";
import { trackPageView } from "./online/analytics";
import { GAMES } from "./games/registry";
import { Home } from "./home/Home";
import { Playground } from "./playground/Playground";
import { useHashRoute } from "./useHashRoute";
import { YourGames, YourGamesLink } from "./online/YourGames";
import { PrivateGate } from "./online/PrivateGate";
import { useIsOwner } from "./online/owner";
import { TelemetryPage } from "./online/TelemetryPage";

export function App() {
  const route = useHashRoute();
  const [first] = route.split("/");
  const game = GAMES.find(g => g.id === first);
  const owner = useIsOwner();
  const locked = !!game?.private && owner !== true;
  useEffect(() => { trackPageView(); }, [route]);
  const page = locked ? <PrivateGate checking={owner === undefined} /> : game ? <game.Page /> : first === "playground" ? <Playground /> : first === "games" ? <YourGames /> : first === "telemetry" ? <TelemetryPage /> : <Home />;
  return (
    <div id="app-shell">
      <nav className="topnav" aria-label="Pages">
        <a href="#/" aria-current={!game && first !== "playground" && first !== "games" && first !== "telemetry" ? "page" : undefined}>← All games</a>
        {game && !locked ? <span className="here">{game.title}</span> : null}
        <span className="topnav-right">
          <YourGamesLink current={first === "games"} />
          <a href="#/playground" aria-current={first === "playground" ? "page" : undefined}>Playground</a>
        </span>
      </nav>
      <Suspense fallback={<p className="loading">Loading…</p>}>{page}</Suspense>
      <ConsentBanner />
    </div>
  );
}
