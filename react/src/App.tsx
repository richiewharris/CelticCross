import { CnocGame } from "./games/cnoc/CnocGame";
import { CnocPiece } from "./games/cnoc/glyphs";
import { CH, LO, RI, SP } from "./games/cnoc/engine/rules";
import { Playground } from "./playground/Playground";
import { useHashRoute } from "./useHashRoute";

const ROUTES: { path: string; label: string }[] = [
  { path: "", label: "Home" },
  { path: "cnoc", label: "Cnoc" },
  { path: "playground", label: "Playground" },
];

function Home() {
  return (
    <div className="home">
      <header>
        <h1>The games, in React</h1>
        <p className="tag">The same games, rebuilt from shared components. One so far; more to follow.</p>
      </header>
      <div className="cards">
        <a className="card" href="#/cnoc">
          <div className="pieces"><CnocPiece p={LO} /><CnocPiece p={SP} /><CnocPiece p={CH} /><CnocPiece p={RI} /></div>
          <h2>Cnoc</h2>
          <p>Take the fairy mound, or hold it. Computer opponents, puzzles and a full game review.</p>
        </a>
        <a className="card" href="#/playground">
          <h2>Playground</h2>
          <p>Every component on one page: pieces, boards, the hold, the tray, controls, dialogs and the review summary.</p>
        </a>
        <a className="card" href="../">
          <h2>All games</h2>
          <p>Back to the full collection: Monsiv, Fidchell, Goldmines River, Fiche, Cnoc Mór and more.</p>
        </a>
      </div>
    </div>
  );
}

export function App() {
  const route = useHashRoute();
  const page = route === "cnoc" ? <CnocGame /> : route === "playground" ? <Playground /> : <Home />;
  return (
    <div id="app-shell">
      <nav className="topnav" aria-label="Pages">
        <a href="../">← All games</a>
        {ROUTES.map(r => <a key={r.path} href={`#/${r.path}`} aria-current={route === r.path ? "page" : undefined}>{r.label}</a>)}
      </nav>
      {page}
    </div>
  );
}
