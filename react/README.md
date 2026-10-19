# The games, in React

A React + TypeScript rebuild of the collection, starting with **Cnoc**. The built site is
committed to [`/next/`](../next/) so GitHub Pages serves it next to the original pages.

## Commands

```sh
npm install
npm run dev           # live-reloading dev server: #/cnoc, #/playground
npm test              # rules, game flow, AI, review and all 90 puzzle solutions
npm run sim -- --games 50 --host 3 --si 3        # self-play on the same engine
npx tsx sim/finished-game.ts > game.json          # a finished game, for testing the review
npm run publish-site  # type-check, build, and copy into ../next/
```

## Layout

```
src/
  kit/                 shared pieces for every game
    theme.css          colours, type, board and panel styles (light and dark)
    Segmented.tsx      radio group drawn as one control
    Dialog.tsx         modal with focus trap; the page behind goes inert
    Disc.tsx           round playing piece with a glyph slot
    useStoredState.ts  useState that survives reloads
    rpc.ts             promise wrapper around a Web Worker
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
exactly the same rules. To add a game: put its rules in `src/games/<name>/engine/` with
tests first, build its board from `kit/`, add it to the playground, then add a route in `App.tsx`.
