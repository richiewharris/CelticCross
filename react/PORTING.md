# Porting a game to the React edition

Each original game is one self-contained HTML page in the repo (`../<folder>/index.html`).
A port turns it into a folder `src/games/<id>/` that plays and looks the same, built the
same way as Cnoc (`src/games/cnoc/`, the reference port — read it first).

## What a port contains

```
src/games/<id>/
  engine/            pure TypeScript: rules, AI, generators, scoring. No React, no DOM,
                     no localStorage, no timers. Deterministic where the original is
                     (seeded RNGs stay seeded). Pass randomness in (e.g. rng: () => number)
                     where it helps testing.
  engine/*.test.ts   Vitest tests: legal moves, wins/draws, edge cases from the rules text,
                     AI picks an immediate win / blocks an immediate loss, generators produce
                     valid output, any bundled data (puzzles) checked against the rules.
  components/        small presentational components (board, pieces, dice, panels, dialogs)
  use<Thing>.ts      hooks holding game state and effects (timers, the computer's turn, saving)
  ai.worker.ts       if the computer thinks for more than ~50 ms, run it in a worker
                     (see cnoc/ai.worker.ts + kit/rpc.ts); otherwise call it directly
  <id>.css           the original page's CSS, scoped (see below)
  index.tsx          default export: the page, wrapped in <GameScope id="<id>">, importing <id>.css
  Playground.tsx     default export: the game's components with fixed data, wrapped in the
                     same GameScope and inside <div className="pg-game"> with <section>s
                     (see cnoc/Playground.tsx)
sim/<id>-sim.ts      for games with a computer player: a CLI that plays the engine against
                     itself and prints win rates (see sim/cnoc-sim.ts); run with npx tsx
```

## Rules of the road

- Work only inside `src/games/<id>/` and `sim/<id>-*.ts`. Do not edit shared files (`src/kit/`,
  `src/App.tsx`, `src/games/registry.ts`, `package.json`, configs, other games). If the kit is
  missing something, write it inside your game folder and mention it in your report.
- No new npm dependencies.
- Faithful port: same rules, same look, same text, same features (levels, hints, puzzles,
  coach, review, animations, sounds if any). Keep the original's accessibility (labels,
  aria-live status, keyboard use, focus handling, reduced motion).
- Styles: extract the original `<style>` into a file and run
  `node scripts/scope-css.mjs original.css gm-<id> > src/games/<id>/<id>.css`.
  It puts every rule under `body.gm-<id>` (tokens on `:root`/`body` land there too, and dark-mode
  switches keep working) and renames `@keyframes`. Keep the original class names in your JSX so the
  CSS applies unchanged. Delete the temporary file afterwards. Extra fonts: `loadFonts(href)` from
  `src/kit/fonts.ts` at module level (Uncial Antiqua, Spectral and IBM Plex Mono are already loaded).
- The site adds a small top bar ("← All games … Playground"); drop the original's own back link.
- Use the kit where it fits: `Segmented`, `Dialog` (modal, focus trap, inerts `#app-shell`),
  `Disc`, `useStoredState`, `createRpc`, `useBodyClass`/`GameScope`. Keep game-specific markup
  in your own components.
- Saved state: `useStoredState("<id>-react-...")`. Never reuse an original page's key unless the
  stored format is byte-for-byte the same.
- Images from the repo's shared folder: `../images/<file>` (served in dev too).
- Original pages may reference `window.claude?.hot`; drop that.
- Strict TypeScript; no `any` unless unavoidable.

## Checking your work (other ports run at the same time, so stay in your lane)

- Types: `npx tsc -p tsconfig.json --noEmit 2>&1 | grep "src/games/<id>\|sim/<id>"` (errors in other
  folders are someone else's work in progress; ignore them).
- Tests: `npx vitest run src/games/<id>`.
- In a browser: `npx vite --port <your port> --strictPort` (background it, e.g. with
  `setsid nohup ... &`), then Playwright from Python (`from playwright.async_api import async_playwright`;
  Chromium is preinstalled) at `http://localhost:<port>/#/<id>` and `#/playground`. Open the
  original side by side (`python3 -m http.server` in the repo root, then `/<folder>/`) and compare
  screenshots in light and dark (`page.emulate_media(color_scheme="dark")`). Play real games
  through: wins, losses, draws, every mode and option, resizing to phone width (390 px).
  Fix every console error. Stop your servers when done (kill by PID, not `pkill -f`).
- Do not run `npm run build`, `npm run publish-site`, `npm install` or git commands.
