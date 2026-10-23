# Online play, statistics and tallies

Code: `src/online/`. Rules for the database: `../firestore.rules` (pasted into the Firebase console).

## Online games by invite (Monsiv, Cnoc, Fidchell)

A game is one Firestore document (`games/{id}`) with the options, who sits in each seat, and the
list of moves. Every browser rebuilds the position by replaying the moves through the game's own
engine, checking each one, so the rules on the page are the referee. Players sign in anonymously.

Address: `#/<game>/play/<id>`. Opening it joins or follows that game.

To make a game playable online:

1. **Write an adapter** (`OnlineAdapter<S, M, O>` in `src/online/types.ts`) in the game's folder,
   e.g. `src/games/cnoc/online.ts`. Pure, tested (`online.test.ts`):
   - `game`: the registry id. `seats`: two seats, e.g. `[{ id: "host", label: "Host" }, { id: "si", label: "Sí" }]`.
   - `defaultOptions` and `describeOptions(o)`: the game options an invite carries (variants,
     hold length, setup style…), plain JSON.
   - `start(o)`, `seatToAct(s)` (null when over), `legal(s, m)`, `apply(s, m)`, `result(s)`.
   - Moves `M` must be small plain JSON (numbers or short arrays/objects; Firestore stores them
     as a list in the document). Setup placements count as moves.
   - Test: replaying a whole self-played game through the adapter gives the same final state
     and result as the engine; illegal moves are refused; `replay()` stops at a bad move.
2. **Use the session hook** in the game page: `useOnlineGame(adapter, useOnlineId("<game>"), "<Title>")`.
   It returns `{ phase, doc, s, mySeat, myTurn, play(m), … }`.
3. **Drive the board from the session** when `session.id` is set: show `session.s`, flip/orient
   the board for `session.mySeat` the way the game already does for "your side", let the player
   act only when `session.myTurn`, and send moves with `session.play(m)` (it checks legality,
   updates at once, and rolls back if the server refuses). No undo, no computer, no local saving
   in online mode. Show the last move as the game already does (from the replayed history).
4. **Add the panel**: `<OnlinePanel session adapter options title />` from `src/online/OnlinePanel.tsx`.
   Offer it from the game's own controls, e.g. a third choice "Online" next to "Computer" and
   "Friend": choosing it shows the panel (make an invite / your recent online games); opening an
   invite link shows it automatically. Leaving goes back to `#/<game>`.
5. **Status line**: when online, say whose move it is ("Your move" / "Waiting for the Sí…"),
   and the result at the end. The game's own result dialog can show the online result too.

Local testing without Firebase: open the site with `?online=local` (e.g.
`http://localhost:5173/?online=local#/cnoc`). Games are kept in localStorage and each tab is a
different player, so two tabs play each other.

Notifications: while the page is open in the background, a "your move" notice (if the player
allowed notifications) and a ● in the tab title. Push to a closed tab needs Cloud Functions,
which needs the Blaze plan.

## Statistics and tallies

`src/online/analytics.ts`:

- `recordGameStart(game, info)` and `recordGameEnd(game, info)`: call when a game (or a match,
  lock, day…) starts and ends, in every mode. `info = { mode, result?, variant?, level? }`.
  `recordGameEnd` also adds one to the public tally for that game (not for puzzles). Online games
  are recorded by the session hook, so don't record them again.
- Google Analytics only runs after the visitor allows it (the banner at the bottom of the page).
  Nothing is sent in development or with `?online=local`.
- The home page shows each game's tally ("1,482 games played").
