// The four puzzle sets. Board puzzles come from boards.json (made and proved by sim/roth/makepuzzles.ts);
// deck-building puzzles are questions about the deck rules, checked in puzzles.test.ts.
import boards from "./boards.json";

export type PuzzleSet = "deck" | "draft" | "play" | "combat";
export const SETS: { id: PuzzleSet; title: string; intro: string }[] = [
  { id: "deck", title: "Deck building", intro: "Copies, legends, allegiances and the cards your heroes refuse." },
  { id: "draft", title: "Marshalling", intro: "Place the last support. The other seats are settled, and nobody acts in the Winnow." },
  { id: "play", title: "The Winnow", intro: "Your action in the Winnow. Afterwards everyone holds, and both duels are played perfectly." },
  { id: "combat", title: "Combat", intro: "A move at the ford. Both sides play perfectly from here; guests and champions sit this one out." },
];

interface Base { id: string; set: PuzzleSet; level: "Beginner" | "Intermediate" | "Advanced"; title: string; question: string; explain: string; answer: number[] }
export interface BoardPuzzle extends Base { kind: "board"; state: string }
export interface ChoicePuzzle extends Base { kind: "choice"; choices: string[] }
export type Puzzle = BoardPuzzle | ChoicePuzzle;

export const DECK_PUZZLES: ChoicePuzzle[] = [
  {
    kind: "choice", id: "k-copies", set: "deck", level: "Beginner", title: "How many copies?",
    question: "Your Ulster deck holds 2 Thunder feats, 1 warp-spasm, 1 Sling of Emain and 1 Láeg. You cut the Salmon leap to add another copy of one of them. Which can you add?",
    choices: ["Thunder feat", "The warp-spasm", "Sling of Emain", "Láeg, the charioteer"], answer: [2],
    explain: "A deck may hold 2 copies of a common card and 1 of a rare or legendary. Thunder feat already has two; the warp-spasm and Láeg are rare. Sling of Emain is a common with one copy, so a second is fine.",
  },
  {
    kind: "choice", id: "k-legends", set: "deck", level: "Beginner", title: "Two legends",
    question: "Your Ulster deck already holds two legendary cards: Cú Chulainn and Gáe Bolga. Which of these can replace the Salmon leap?",
    choices: ["The spear of Assal", "Caladbolg", "The gaze of Balor", "Fragarach, the answerer"], answer: [3],
    explain: "No more than 2 legendary cards in a deck. The spear of Assal, Caladbolg and the gaze of Balor are all legendary; Fragarach is rare. It's Sídhe, but that's fine: Sídhe supports are Unwilling only for Fomóire heroes, so your Ulstermen can use it (without kinship).",
  },
  {
    kind: "choice", id: "k-allegiance", set: "deck", level: "Intermediate", title: "Two allegiances",
    question: "Medb, Ferdiad and Ailill lead your Connacht deck, which borrows Goibniu's forge from the Sídhe. You cut a Spear of Cet for a fourth hero. Which can join?",
    choices: ["Conall Cernach", "Fergus mac Róich", "Brigid", "Bres"], answer: [1],
    explain: "A deck may draw on two peoples, but only the first, its primary people, leads: every hero is of it. The second lends supports, champions, geasa, oaths, omens and attendants, never heroes, so Brigid can't lead though the Sídhe are your second people. Conall (Ulaid) and Bres (Fomóire) are of other peoples altogether. Fergus is an exile of Ulster who fights for Connacht: an exile leads beside Ulster or Connacht heroes.",
  },
  {
    kind: "choice", id: "k-unwilling", set: "deck", level: "Intermediate", title: "Old enemies",
    question: "You're building a Fomóire deck. Which of these supports would do nothing at all for your own heroes?",
    choices: ["Salmon leap", "The tathlum", "Undertow", "Spear of Cet mac Mágach"], answer: [1],
    explain: "The Sídhe and the Fomóire are old enemies (the battles of Mag Tuired): a Sídhe support is Unwilling for a Fomóire hero and does nothing. The tathlum, the stone that killed Balor, is Sídhe. Merrow, Connachta and Unaligned supports work for a Fomóire hero, just without kinship.",
  },
  {
    kind: "choice", id: "k-champions", set: "deck", level: "Advanced", title: "Why two champions?",
    question: "Each starter deck carries two champions. If you keep every card you draw in the Muster until your hand is full, how often do you hold at least one of them?",
    choices: ["About half the time", "Three times in five", "Six times in seven", "Nineteen times in twenty"], answer: [2],
    explain: "Kept as they come, your hand is the first 12 of your 20 non-omen cards. With one champion you hold it 60% of the time; with two, 85%; with three, 95%. You can do better by choosing: keep a champion when it comes up, or set it aside to draw in a duel. But every champion takes the place of a support or an oath you'd otherwise draft, so two is the sweet spot.",
  },
];

export const PUZZLES: Puzzle[] = [
  ...DECK_PUZZLES,
  ...(boards as Omit<BoardPuzzle, "kind">[]).map((b) => ({ ...b, kind: "board" as const })),
];
