# The games, in React

A React + TypeScript rebuild of the whole collection: Monsiv, Fidchell, Celtic Cross Lock (current and classic), Fiche, Cnoc, Cnoc Mór, Fidchell of Cups and Goldmines River, plus the front page and a component playground. The built site is
committed to [`/next/`](../next/) so GitHub Pages serves it next to the original pages.

## Commands

```sh
npm install
npm run dev           # live-reloading dev server: #/, #/<game>, #/playground
npm test              # 424 engine tests across the games (rules, AI, generators, puzzles, odds)
npm run sim -- --games 50 --host 3 --si 3        # Cnoc self-play on the same engine
npx tsx sim/<game>-sim.ts --help                  # the other games' simulators
npx tsx sim/finished-game.ts > game.json          # a finished game, for testing the review
npm run publish-site  # type-check, build, and copy into ../next/
```

## Layout

```
src/
  kit/                 shared pieces for every game
    base.css           site-wide tokens, resets, and controls outside a game
    GameScope.tsx      puts a game's scope class (body.gm-<id>) on the page
    fonts.ts           load a game's extra web fonts once
    Segmented.tsx      radio group drawn as one control
    Dialog.tsx         modal with focus trap; the page behind goes inert
    Disc.tsx           round playing piece with a glyph slot
    useStoredState.ts  useState that survives reloads
    rpc.ts             promise wrapper around a Web Worker
  home/                the front page, built from the registry
  games/registry.ts    every game: title, card text, lazy-loaded page and playground
  games/<id>/          one folder per game, laid out like Cnoc below
  games/cnoc/
    engine/            pure TypeScript rules, AI, setup, review, puzzles (+ *.test.ts)
    components/        Board, Terrain, HoldStones, Tray, MoveLog, panels, ResultDialog
    usePlayGame.ts     a real game: computer turns, undo, saving, the review
    usePuzzles.ts      the puzzle trainer
    ai.worker.ts       computer moves and the review, off the main thread
    CnocGame.tsx       the page, composed from the above
  playground/          every component on one page with fixed data
sim/                   command-line tools on the same engine
```

The engine has no React or DOM in it, so the game, the tests and the simulator all run
exactly the same rules. Each game's stylesheet is scoped under `body.gm-<id>` (see
`scripts/scope-css.mjs`), so games keep their own look side by side. To add a game, follow
[PORTING.md](PORTING.md) and add an entry to `src/games/registry.ts`.
