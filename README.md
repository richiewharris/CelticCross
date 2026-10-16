# Celtic Cross

Two small browser games. Neither needs installing or building: open the `index.html` file in any modern browser.

| Game | File |
|------|------|
| **Celtic Cross Lock**: a lock-picking puzzle | [`celtic-cross-lock/index.html`](celtic-cross-lock/index.html) |
| **Monsiv**: a 5×5 chess-like strategy game | [`index.html`](index.html) |

To host both free, turn on **GitHub Pages** for this repo (Settings → Pages → deploy from the `main` branch, root folder). Monsiv will be at `/` and the lock at `/celtic-cross-lock/`.

---

## Celtic Cross Lock (v1)

Pick the lock on a Celtic cross puzzle box. The cross and its ring are made of 15 carved stones, each carrying strands of knotwork. Rejoin the knotwork to open the box.

### How to play

- **Drag** a stone onto another to swap them. You can also tap one stone, then another. Each swap uses a move.
- The lock is complete when every strand meets a strand of the same kind on the neighbouring stone, and no strand runs off the edge of the cross.
- **Try the lock** whenever you think it's done. If it isn't, the tumblers fall: the stones scramble again and your moves refill.
- When you run out of moves, the only thing left to do is try the lock.

### Difficulty and skill

- **Lock tiers** (Iron, Bronze, Silver, Gold, Ogham) set how many strand kinds there are (gold, verdigris, garnet), how dense the knotwork is, and how scrambled the stones start. Every lock is randomly generated, and the scramble varies by about one move around the tier's base.
- **Move budget**: the fewest swaps needed to solve the lock, plus spare moves. Higher skill gives more spare moves; harder tiers give fewer.
- **Skill** rises each time you open a lock, more for harder tiers and leftover moves. It's saved in your browser.

### Cheat (training)

The **Cheat** button shows broken joins as red notches, stones out of place with a red tint, and the next swap to make as two glowing stones. Following the hints always opens the lock within the move budget. A lock opened with Cheat on counts as practice and doesn't raise your skill.

---

## Monsiv

A playable rebuild of **Monsiv**, a browser strategy game first released around 2017 at monsiv.com. It played like a small, fast version of chess with one twist: you can swap two of your own pieces. The original site is offline; this version is reconstructed from the original board layout and player descriptions.

### Play

Open `index.html` in any modern browser. There's nothing to install or build.

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
