# Celtic Cross

Small browser games with a Celtic theme. None needs installing or building: open `index.html` for the front page that links them all, or open a game's own `index.html`.

| Game | File |
|------|------|
| **Celtic Cross Lock**: a lock-picking puzzle | [`celtic-cross-lock/index.html`](celtic-cross-lock/index.html) |
| Celtic Cross Lock v1 (the original stone-swapping version) | [`celtic-cross-lock/v1/index.html`](celtic-cross-lock/v1/index.html) |
| **Fidchell**: the early Irish board game | [`fidchell/index.html`](fidchell/index.html) |
| **Fidchell of Cups**: Fidchell with dice and drinks, by Tablero's rules | [`fidchell-cups/index.html`](fidchell-cups/index.html) |
| **Goldmines River**: a gold panning game | [`goldmines-river/index.html`](goldmines-river/index.html) |
| **Monsiv**: a 5×5 chess-like strategy game | [`monsiv/index.html`](monsiv/index.html) |

To host them free, turn on **GitHub Pages** for this repo (Settings → Pages → deploy from the `main` branch, root folder). The front page will be at `/`, Monsiv at `/monsiv/`, the lock at `/celtic-cross-lock/`, v1 at `/celtic-cross-lock/v1/`, Fidchell at `/fidchell/`, Fidchell of Cups at `/fidchell-cups/`, and Goldmines River at `/goldmines-river/`.

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

## Monsiv

A playable rebuild of **Monsiv**, a browser strategy game first released around 2017 at monsiv.com. It played like a small, fast version of chess with one twist: you can swap two of your own pieces. The original site is offline; this version is reconstructed from the original board layout and player descriptions.

### Play

Open `monsiv/index.html` in any modern browser. There's nothing to install or build.

To host it free, turn on **GitHub Pages** for this repo (Settings → Pages → deploy from the `main` branch, root folder).

You can play against the computer (Casual, Steady or Strong) or against a friend on the same screen. The game in progress is saved in your browser.

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
- **Win** by capturing the enemy Throne, or by landing any of your pieces on the opponent's back row.
- A player with no legal move loses, so there are no draws.

#### Reconstructed rules

These details couldn't be confirmed from surviving sources and are best guesses:

- A swap uses your whole turn, and diagonal neighbours can swap.
- Swapping two identical pieces isn't allowed, and the same pair can't be swapped twice in a row.
- The Throne reaching the far row also wins.
- Having no legal move is a loss.

### Credits

Monsiv was designed by Harley Bailey. This is an unofficial fan rebuild with original artwork and code.
