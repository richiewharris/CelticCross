# Celtic Cross

Small browser games with a Celtic theme. None needs installing or building: open `index.html` for the front page that links them all, or open a game's own `index.html`.

| Game | File |
|------|------|
| **Celtic Cross Lock**: a lock-picking puzzle | [`celtic-cross-lock/index.html`](celtic-cross-lock/index.html) |
| Celtic Cross Lock v1 (the original stone-swapping version) | [`celtic-cross-lock/v1/index.html`](celtic-cross-lock/v1/index.html) |
| **Fidchell**: the early Irish board game | [`fidchell/index.html`](fidchell/index.html) |
| **Fidchell of Cups**: Fidchell with dice and drinks, by Tablero's rules | [`fidchell-cups/index.html`](fidchell-cups/index.html) |
| **Goldmines River**: a gold panning game | [`goldmines-river/index.html`](goldmines-river/index.html) |
| **Fiche**: a dice race to twenty | [`fiche/index.html`](fiche/index.html) |
| **Cnoc**: a battle for a fairy mound | [`cnoc/index.html`](cnoc/index.html) |
| **Cnoc Mór**: the big hill, a longer Cnoc | [`cnoc-mor/index.html`](cnoc-mor/index.html) |
| **Cnoc, React edition**: built from shared components (source in [`react/`](react/)) | [`next/index.html`](next/index.html) |
| **Monsiv**: a 5×5 chess-like strategy game | [`monsiv/index.html`](monsiv/index.html) |

To host them free, turn on **GitHub Pages** for this repo (Settings → Pages → deploy from the `main` branch, root folder). The front page will be at `/`, Monsiv at `/monsiv/`, the lock at `/celtic-cross-lock/`, v1 at `/celtic-cross-lock/v1/`, Fidchell at `/fidchell/`, Fidchell of Cups at `/fidchell-cups/`, Goldmines River at `/goldmines-river/`, Fiche at `/fiche/`, Cnoc at `/cnoc/`, Cnoc Mór at `/cnoc-mor/`, and the React edition at `/next/`.

---

## Celtic Cross Lock (v2)

Pick the lock on a Celtic puzzle box. The dial is a disc of carved stone. Its knot is made of raised bronze pins, and some stones have been turned so the knot is broken. A bronze shield hides all but a third of the dial.

### How to play

- **Turn stones:** tap a stone in the window to turn it a quarter turn clockwise. Press and hold, or right-click, to turn it anticlockwise. Each quarter turn uses one turn.
- **Spin the disc:** drag it, or use ⟲ ⟳. Spinning is free. Use it to see the rest of the knot.
- **The goal:** the knot has no loose ends anywhere. A loose end shows as a round knob on a pin. Any arrangement with no loose ends opens the lock.
- **Crossings:** stones with corner rivets are over-under crossings. They're fixed and can't turn.
- **Open it:** press the triskele button in the center of the dial, or "Try the lock". If the knot is whole, the shield catches, snaps partly open and glides away, the pins sink into their slots, and the stone dial spins free with the knot showing through. If the knot is broken anywhere, the dial spins, the stones scramble, and your turns refill.

### Difficulty and skill

| Tier | Stones | Stones turned |
|------|--------|---------------|
| Iron | 12 (2 rings × 6) | 3 |
| Bronze | 16 (2 rings × 8) | 4 |
| Silver | 18 (3 rings × 6, with crossings) | 5 |
| Gold | 24 (3 rings × 8, with crossings) | 6 |
| Ogham | 30 (3 rings × 10, with crossings) | 8 |

- Every knot is randomly generated, and the number of stones turned varies by about one either way.
- **Turn budget:** the fewest turns needed to solve the lock, plus spare turns. Higher skill gives more spare turns; harder tiers give fewer.
- **Skill** rises each time you open a lock, more for harder tiers and leftover turns. It's saved in your browser.

### Cheat (training)

The **Cheat** button makes the cover see-through, rings every loose end in red, and puts a badge on each stone that needs turning showing which way (↻, ↺ or 2). A lock opened with Cheat on counts as practice and doesn't raise your skill.

### Tuning

These values in the script in `celtic-cross-lock/index.html` control the feel:

- `TIERS`: rings, stones per ring and stones turned for each tier.
- `spareTurns`: how many spare turns skill buys.
- `WIN` and `WC`: the window's half-width and position, in degrees (60 and 90, a third of the disc on the right).
- `pressHub` and the shield timings in `tryOpen`: the button press, the snap and the glide.
- `ribbon`: the colours and width of the bronze pins.

---

## Fidchell

*Fidchell* ("wood-wisdom") was the board game of early Ireland. Its rules are lost. This version follows what the Irish texts do say: the pieces were split into gold and white halves, and a piece was taken by trapping it between two enemy pieces. Moves are borrowed from the Roman game it's often compared with, *ludus latrunculorum*, and the board is marked like the 7×7 Ballinderry board, scaled down to 5×5.

### How to play

- Each side has five pieces on its back row. Gold moves first.
- On your turn, move one piece any distance along a row or column through empty holes. No diagonals, no jumping.
- **Capture** by trapping an enemy piece between the piece you just moved and another of yours, in a line. One move can take up to three pieces.
- Moving into a gap between two enemy pieces is safe.
- **Win** by cutting your rival down to one piece, or by leaving them with no move.
- After 30 moves in a row without a capture, the side with more pieces wins. Equal pieces is a draw.

Play the computer (Casual, Steady or Strong, as gold or white) or a friend on the same screen. **Hints** rings your pieces in danger and shows a suggested move.

---

## Fidchell of Cups

Fidchell played by the rules of [Tablero](https://www.drinkiwiki.com/Tablero), with cups instead of stones. Mead in bronze cups against wine in silver ones.

- Seven cups a side on a 7×7 board. Each side has a jug holding four refills. Mead goes first.
- Roll two dice. Each die moves a different cup exactly that many holes along a row or column, through empty holes. You choose the cups and directions. If a move fits a die you must make it; if neither fits, your turn ends.
- A total of 7, 11 or 12 is a pass. Otherwise keep rolling until you pass or can't move. (A switch allows one roll per turn instead.)
- Trap a rival cup between the cup you moved and another of yours to drink it. Moving into a gap between two rival cups is safe.
- A drunk cup goes back to its owner's back row, refilled from their jug. Whoever has to refill from an empty jug loses. Winning without touching your own jug is a skunk.
- **The Queen's number** is rolled before play. Roll it and you toast the Queen: drink any rival cup instead of moving, then roll again. Roll on without toasting and it's treason: your rival drinks one of your cups.
- After 60 moves with no cup drunk, whoever has drunk more wins.

Play the computer (Casual, Steady or Strong) or a friend on the same screen. **Hints** rings your cups in danger and suggests a move.

---

## Goldmines River

Pan a Wicklow stream for gold, on the river of Ireland's 1795 gold rush.

1. **Scoop** from one of five spots on the river. Gold drops where the water slows: behind boulders, in bedrock cracks, on the inside of bends. The best spots change each day, and a spot yields less each time you pan it.
2. **Shake** the pan side to side under water. Gold sinks; stones and gravel rise.
3. **Pick out the stones** once they're on top.
4. **Wash** by tilting the pan so water carries the top layer over the lip. Dip for more water. Tilt too steep and the gold goes too.
5. **Collect** the gold you can see. Gold still buried under sand when you finish is lost.

A day is eight pans. Each pan ends with a summary of gold kept, washed out and left buried. **Coach** shows the buried gold and how well it has settled. Play by dragging the pan, with the Shake and Wash hold buttons, or with the keyboard.

---

## Fiche

*Fiche* is Irish for twenty. Two players race one shared total to exactly 20.

**The dice.** Each player has three:

- **Caltrop (1–4):** four bone legs. Three rest on the table and one stands up; the notches cut around the standing leg give the number.
- **Wire cube (1–6):** a wooden cube wrapped in copper wire. The number is how many wires run across its top.
- **Twin cubes (1–8):** two small wire cubes on a rod. Their two tops add up to 2–8. A 1 only comes up when the bar lands standing on end, 1 time in 16.

**Rules**

- Take turns. Pick one of your dice and roll it; its number goes onto the shared total. Each die is used once a round.
- Roll a **three** on any die and you roll again, with another die if you have one, or the same one if it was your last.
- Land the total on **7** and you roll again. Land on **9** and your opponent takes the round. Land on **12** and the round is drawn.
- Land on **20** to take the round. Go over 20 and you lose it.
- If all six dice are used up short of 20, the round is drawn. Whoever rolled last starts the next round.
- Play best of 3 or 5.

**Coach** shows your exact chance of taking the round with each die. The Shrewd computer plays those exact odds.

---

## Cnoc

*Cnoc* (pronounced *k'nuk*, with the k sounded) is Irish for hill. Two uneven armies fight over a fairy mound: a 7×7 pegged board, as at Ballinderry, built in three tiers. The outer ring is the low ground (24 holes), the next ring is the slope (20), and a cross of five holes is the summit. Brandub, the Irish game of five pieces against eight, inspired the 8-against-5 armies and the board.

**The pieces**

| Piece | Side | Count | Moves |
|---|---|---|---|
| Lord | Host | 1 | 1 or 2 holes in a straight line, any direction |
| Spearman | Host | 7 | 1 hole forward, back or sideways |
| Chariot | Sí | 1 | Any distance along a row or column |
| Rider | Sí | 4 | 1 hole diagonally |

Every piece takes by moving onto an enemy piece. A move that steps *up* a tier stops there; going downhill is free.

**Setup.** Starting with the Host, the players take turns setting one piece at a time: Host pieces on the low ground, Sí pieces on the slope or summit. When the Sí run out, the Host set their last three. The Host move first. In the *Set your rival's* option, the Host first set their Lord and the Sí set their Chariot on the summit. Then the sides take turns setting each other's pieces, Host first (a Sí rider, then a Host spearman, and so on), and the Sí set the last three spearmen. In this setup the hold is five turns (six for the easier option).

Without those adjustments, setting the rival's pieces is lopsided: whoever moves first plants the rival's pieces where they can be taken at once. In 200 computer games each, the Host won 86% when moving first and the Sí won 94% when the Sí moved first. With the Lord and Chariot set by their owners, the Chariot starting on the summit, and a five-turn hold, the Host won 35% (5 moves of search) and 46% (6 moves), about the same as the standard setup.

**Winning**

- **The Host** win by moving the Lord onto the summit while no Sí piece stands there, or by taking every Sí piece.
- **The Sí** win by taking the Lord, or by holding the summit: after seven of their turns in a row, they have a piece on the summit and the Host have none. A Host piece on the summit at the end of either side's turn resets the count. (*Hold 8* makes it easier for the Host.)
- A player with no legal move loses. If a position comes round a third time, the side with fewer pieces wins; with equal pieces it is a draw.

Play the computer (Novice, Warrior, Champion or High King) or a friend. **Game review**: after a game, every move is judged by a deep search (up to 8 moves ahead) of the position before it and the position it led to, anchored to the actual result, so the move where a defence stopped holding is marked as the turning point. Setup placements are scored with a placement heuristic, with wider bands because many holes are near-equal. Each is marked Best, Excellent, Good, Miss or Blunder; the counts cover moves in play, and setup gets its own accuracy. You can step or play through the game, and the better choice is ringed on the board. Each player gets an accuracy (setup counts for a quarter, play for three quarters) and a performance rating, with a rank from Novice to High King. **Puzzles**: 90 positions, 48 for the Host and 42 for the Sí, each a forced win in 2 to 5 moves against the computer's best defence. Every puzzle was found and checked by an exhaustive solver; where more than one move wins, any winning move counts.

**Balance.** The rules were tuned over about 4,000 computer games. With the standard setup, the Host win about 40–48% of games. The two rules that make it work are that the Lord can only climb onto a clear summit, and that the hold lasts seven turns.

## Cnoc Mór

*Cnoc Mór* (pronounced *k'nuk mor*, "the big hill") is a longer Cnoc: speed and reach against numbers and a steady advance. There is no hold; the Sí simply have to keep the Lord off the cairn.

- **The hill:** 9×9 in four tiers: the outer ring (32 holes), lower slope (24), upper slope (20) and a summit cross (5). The cairn is the centre hole. A move that steps up a tier ends there; downhill is free.
- **Host:** the Lord steps one hole any way, and is safe from Riders while he is on the outer ring. 4 spearmen step one hole any way but climb only straight; 3 more wait in reserve.
- **Sí:** the Chariot runs any distance along rows and columns, and 4 Riders run any distance diagonally; 1 more Rider waits in reserve. Instead of moving, a Sí piece may jump to any empty summit hole while no Host piece is on the summit.
- **Reserves:** bringing one in is your move. Host spearmen enter on the outer ring; the Sí Rider on the upper slope or summit.
- **Setup:** Host first, the sides alternate: the Host set the Lord and 4 spearmen on the outer ring, the Sí the Chariot and 4 Riders on the upper slope or summit. The Host move first.
- **Winning:** the Host win by standing the Lord on the cairn (he can't take a piece standing there) or by taking every Sí piece. The Sí win by taking the Lord. No legal move loses; a third repetition goes to the side with fewer pieces; 150 moves each is a draw.

Tuned over several thousand computer games with full-depth search: the Host win about 55% when both sides look 4 moves ahead and about 47% at 6, with games of 80–100 moves. Play the computer at four levels or a friend, and review any finished game.

## Monsiv

A playable rebuild of **Monsiv**, a browser strategy game first released around 2017 at monsiv.com. It played like a small, fast version of chess with one twist: you can swap two of your own pieces. The original site is offline; this version is reconstructed from the original board layout and player descriptions.

### Play

Open `monsiv/index.html` in any modern browser. There's nothing to install or build.

To host it free, turn on **GitHub Pages** for this repo (Settings → Pages → deploy from the `main` branch, root folder).

You can play against the computer (Casual, Steady or Strong) or against a friend on the same screen. The game in progress is saved in your browser.

### Puzzles

Switch to **Puzzles** for an endless run of training puzzles: find the move that wins by force in 1, 2 or 3 moves, while the computer defends as well as it can.

- **Built from seeds.** Puzzle `L·i` (level L, number i) is generated from a fixed seed, so it is the same puzzle for everyone. Each one is checked by a solver to have exactly one winning first move and no quicker win.
- **Rating.** You start at 600. Each puzzle has its own rating, and yours moves Elo-style: solving gains more against a harder puzzle, missing loses more against an easier one. A solve after a hint counts as half; viewing the solution counts as a miss. *Try again* replays a puzzle for practice without changing your rating.
- **Difficulty.** "Match my rating" picks the level that fits you; you can also pick any of 12 levels (300 to 1950+). Lower levels are wins in 1, middle levels wins in 2, higher levels wins in 3. Swaps, quiet moves, sacrifices and "no moves left" wins rate higher.
- **Solution.** *Show solution* plays the winning line against the best defence at slow, normal or fast speed, with pause and step, and tags the idea (swap, quiet move, sacrifice, far row, throne hunt, no moves left).

### Rules

The board is 5×5. Each side starts with five pieces on its back row, the Throne in the middle:

```
5  A  C  T  A  C   ← Black
4  .  .  .  .  .
3  .  .  .  .  .
2  .  .  .  .  .
1  C  A  T  C  A   ← White
   a  b  c  d  e
```

| Piece  | Moves |
|--------|-------|
| Throne | One square in any direction |
| Angel  | One square diagonally |
| Cross  | One square straight (forward, back or sideways) |

- **White moves first.**
- **Capture** by stepping onto an enemy piece. It's removed from the board.
- **Swap**: instead of moving, swap two of your own touching pieces (diagonals count). They must be different types, and you can't swap the same pair twice in a row.
- **The Throne can't walk into danger.** It may never move or swap onto a square where an enemy piece could take it, so it can't capture a guarded piece. A move that wins on the spot is always allowed.
- **No repeats.** You can't make a move that recreates a position already seen this game, unless it wins.
- **Win** by capturing the enemy Throne, or by landing any of your pieces on the opponent's back row.
- A player with no legal move loses, so there are no draws.

#### Balance rules

The Throne and no-repeat rules were added after testing. In 50 computer games per rule set, with both sides searching 8 moves ahead:

| | Original rules | Current rules |
|---|---|---|
| White (moves first) wins | 14 (28%) | 30 (60%) |
| Black wins | 36 (72%) | 20 (40%) |

Without the no-repeat rule, careful players can shuffle forever and the game never ends.

#### Reconstructed rules

These details couldn't be confirmed from surviving sources and are best guesses:

- A swap uses your whole turn, and diagonal neighbours can swap.
- Swapping two identical pieces isn't allowed, and the same pair can't be swapped twice in a row.
- The Throne reaching the far row also wins.
- Having no legal move is a loss.

### Credits

Monsiv was designed by Harley Bailey. This is an unofficial fan rebuild with original artwork and code.

## The React edition

[`react/`](react/) holds a Vite + React + TypeScript rebuild, starting with Cnoc. Its rules engine is
plain TypeScript with tests (including a check of all 90 puzzle solutions); the same engine drives the
game, the computer in a Web Worker, and a command-line simulator. A playground page shows every component
with fixed data. Run `npm run publish-site` in `react/` to rebuild into [`next/`](next/). See
[`react/README.md`](react/README.md).
