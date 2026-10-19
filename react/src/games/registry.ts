// Every game on the site. Each game lives in src/games/<id>/ and provides:
//   index.tsx       default export: the whole game page
//   Playground.tsx  default export: that game's components shown with fixed data
// Both are loaded on demand, so each game's code and styles are fetched only when visited.
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface GameEntry {
  id: string;
  title: string;
  say?: string;
  kicker: string;
  blurb: string;
  image: string; // file in the site's images/ folder
  alt?: string;
  facts?: string[];
  /** Shown as a large card on the home page; the rest go under "Also in the collection". */
  featured?: boolean;
  Page: LazyExoticComponent<ComponentType>;
  Playground: LazyExoticComponent<ComponentType>;
}

export const GAMES: GameEntry[] = [
  {
    id: "monsiv", title: "Monsiv", kicker: "Strategy · 2 players or vs computer", image: "monsiv.jpg",
    blurb: "A fast cousin of chess on a 5×5 board. Each side has a Throne, two Angels and two Crosses, and every piece steps one square at a time. The twist is the swap: trade places with a piece of your own instead of moving, and catch your opponent off guard. Take the enemy Throne or reach the far row to win. Then sharpen up on endless puzzles that rate you as you solve.",
    alt: "The Monsiv board: a 5 by 5 grid with black Angels, Crosses and a Throne on the top row and white ones on the bottom row.", featured: true,
    facts: ["5×5 board", "5 pieces a side", "Games in 5–10 minutes", "Endless rated puzzles"],
    Page: lazy(() => import("./monsiv/index")), Playground: lazy(() => import("./monsiv/Playground")),
  },
  {
    id: "fidchell", title: "Fidchell", kicker: "Strategy · 2 players or vs computer", image: "fidchell.jpg",
    blurb: "The \"wood-wisdom\" of early Ireland. Gold against white on a pegged board: slide your pieces along rows and columns and trap an enemy piece between two of yours to take it. Its rules were lost centuries ago. This version follows what the old Irish texts say about the game.",
    alt: "A carved yew Fidchell board with a plaited border, bone-white pieces on the top row and bronze pieces on the bottom row.", featured: true,
    facts: ["5×5 board", "Capture by trapping", "Hints for new players"],
    Page: lazy(() => import("./fidchell/index")), Playground: lazy(() => import("./fidchell/Playground")),
  },
  {
    id: "lock", title: "Celtic Cross Lock", kicker: "Puzzle · solo", image: "celtic-cross-lock.jpg",
    blurb: "Pick the lock on a Celtic puzzle box. Turn the stones of a carved dial until its bronze knot runs unbroken, with only a third of the dial showing through the shield at a time. Press the triskele to try the lock: get it right and the pins drop home and the dial spins free.",
    alt: "A bronze puzzle box with a window onto a carved stone dial, showing bronze knotwork pins and a triskele button at the centre.", featured: true,
    facts: ["5 lock tiers", "Moves set by your skill", "Cheat mode to learn"],
    Page: lazy(() => import("./lock/index")), Playground: lazy(() => import("./lock/Playground")),
  },
  {
    id: "fiche", title: "Fiche", kicker: "Dice · 2 players or vs computer", image: "fiche.jpg",
    blurb: "A race to twenty with three odd dice: a bone caltrop, a wire-wrapped cube, and two cubes on a rod that only shows a 1 when it lands standing on end. Take turns rolling into one shared total. A three or a seven rolls again, nine hands the round to your rival, twelve is a draw, and only an exact twenty wins.",
    alt: "A bronze number dial resting on 20, above a bone caltrop, a wire-wrapped cube and two cubes joined by a rod.", featured: true,
    facts: ["3 dice each", "Best of 3 or 5", "Coach shows your odds"],
    Page: lazy(() => import("./fiche/index")), Playground: lazy(() => import("./fiche/Playground")),
  },
  {
    id: "cnoc", title: "Cnoc", say: "(k’nuk)", kicker: "Strategy · 2 players or vs computer", image: "cnoc.jpg",
    blurb: "A fight for a fairy mound. Eight Host pieces, a Lord and his spearmen, climb from the low ground. Five Sí, a Chariot and four Riders, hold the summit. Set your pieces down in turn, then crown the Lord on the hilltop or hold it for seven turns. Includes 90 puzzles for both sides and a move-by-move review after every game.",
    alt: "A stepped green mound on a 7 by 7 pegged board with a pale stone cross on top, gold Host pieces and silver Sí pieces.", featured: true,
    facts: ["7×7 three-tier board", "Uneven sides", "4 computer levels", "90 puzzles"],
    Page: lazy(() => import("./cnoc/index")), Playground: lazy(() => import("./cnoc/Playground")),
  },
  {
    id: "cnoc-mor", title: "Cnoc Mór", say: "(k’nuk mor)", kicker: "Strategy · 2 players or vs computer", image: "cnoc-mor.jpg",
    blurb: "The big hill: a longer Cnoc on a 9×9, four-tier hill, with reserves and a cairn to reach.",
    Page: lazy(() => import("./cnoc-mor/index")), Playground: lazy(() => import("./cnoc-mor/Playground")),
  },
  {
    id: "fidchell-cups", title: "Fidchell of Cups", kicker: "Strategy and dice · 2 players or vs computer", image: "fidchell-cups.jpg",
    blurb: "Fidchell with two dice and cups of mead and wine, by the rules of Tablero.",
    Page: lazy(() => import("./fidchell-cups/index")), Playground: lazy(() => import("./fidchell-cups/Playground")),
  },
  {
    id: "goldmines", title: "Goldmines River", kicker: "Dexterity · solo", image: "goldmines-river.jpg",
    blurb: "Pan a Wicklow stream for gold without losing it over the lip.",
    Page: lazy(() => import("./goldmines/index")), Playground: lazy(() => import("./goldmines/Playground")),
  },
];

export const gameById = (id: string) => GAMES.find(g => g.id === id);
