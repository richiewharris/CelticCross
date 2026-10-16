# Monsiv

A playable rebuild of **Monsiv**, a browser strategy game first released around 2017 at monsiv.com. It played like a small, fast version of chess with one twist: you can swap two of your own pieces. The original site is offline; this version is reconstructed from the original board layout and player descriptions.

## Play

Open `index.html` in any modern browser. There's nothing to install or build.

To host it free, turn on **GitHub Pages** for this repo (Settings → Pages → deploy from the `main` branch, root folder).

You can play against the computer (Casual, Steady or Strong) or against a friend on the same screen. The game in progress is saved in your browser.

## Rules

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

### Reconstructed rules

These details couldn't be confirmed from surviving sources and are best guesses:

- A swap uses your whole turn, and diagonal neighbours can swap.
- Swapping two identical pieces isn't allowed, and the same pair can't be swapped twice in a row.
- The Throne reaching the far row also wins.
- Having no legal move is a loss.

## Credits

Monsiv was designed by Harley Bailey. This is an unofficial fan rebuild with original artwork and code.
