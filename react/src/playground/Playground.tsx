// Every game's components on one page, with fixed data, so they can be built and checked in isolation.
import { Suspense, useState } from "react";
import { Segmented } from "../kit/Segmented";
import { useStoredState } from "../kit/useStoredState";
import { GAMES } from "../games/registry";

type Theme = "auto" | "light" | "dark";

export function Playground() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || "auto");
  const [id, setId] = useStoredState("playground-game", "cnoc");
  const game = GAMES.find(g => g.id === id) ?? GAMES[0];
  const setThemeAttr = (t: Theme) => {
    setTheme(t);
    if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  };
  return (
    <div className="pg">
      <header>
        <h1>Playground</h1>
        <p className="tag">The building blocks of each game, shown with fixed data.</p>
      </header>
      <div className="pg-bar">
        <nav className="chips pg-games" aria-label="Game">
          {GAMES.map(g => <button key={g.id} type="button" className={g.id === game.id ? "cur" : ""} aria-pressed={g.id === game.id} onClick={() => setId(g.id)}>{g.title}</button>)}
        </nav>
        <Segmented label="Theme" value={theme} onChange={setThemeAttr}
          options={[{ value: "auto", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as { value: Theme; label: string }[]} />
      </div>
      <Suspense fallback={<p className="note">Loading…</p>}>
        <game.Playground key={game.id} />
      </Suspense>
    </div>
  );
}
