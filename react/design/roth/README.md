# Roth Catha: wheel and table redesign

Design proposals for the Roth Catha table, made on a Design canvas:
https://claude.ai/artifact/NxT5s63YKDDEUZoqayLPdi (private to the owner until shared).

`boards/` holds the canvas's source: one `.dc.html` file per board plus `canvas.json`, which places them on the
canvas. They render in the canvas editor, not on their own (each loads the editor's `support.js`). The cards
shown are real cards from the starter decks; the "lean" bars marked `[ENGINE]` are placeholders for a number the
engine would have to supply.

## What the current build does (seen running it locally)

- The default view while drafting and playing is a straight two-row lane; the wheel is behind a "Whole wheel"
  toggle, so the round board never feels round. The whole wheel lays twelve equal cards on a ring: quadrants,
  owners, the duel pairs and the direction of turn aren't visible.
- The phase line says "Playing turn · step 1" but not how many steps remain, what comes next, or which duel the
  spot feeds.
- Actions are a bare list with no effect shown until after you commit (`previewOf` in `Choices.tsx` already
  simulates moves, but only for duels); outcomes land only in the Moves log.
- The page header stays on screen during a match; hand and omens sit below the fold.
- "6 in hand" sits above four card backs that are really face-down omens.

## The boards

| Board | File | What it proposes |
| --- | --- | --- |
| 0 | `Names.dc.html` | Themed names for the wheel instead of spot numbers (below). |
| 1 | `Main.dc.html` | Desktop table in the Winnow: the wheel always the centrepiece, seats fixed, the wheel turning clockwise under them; quadrants shaded by owner; match progress bar; a one-line goal; the duel forecast; actions with their consequences; the hand docked under the board. |
| 2 | `Revolution.dc.html` | One revolution: Setting → Muster → Marshalling (half a turn fills the wheel) → the Winnow (the enemy's bands come round to you) → home, and the duels. Plus the same journey as a progress track. |
| 3 | `Muster.dc.html` | Hand, the four drawn cards and the Reserve side by side; requirement meters; decide in any order (H / R / O). |
| 4 | `Outcome.dc.html` | Preview a move on the board before committing; the computer's reply shown on the board with "Replay it" and a hint at a card that answers it; a summary each time the wheel turns. |
| 5 | `PhonePlay.dc.html` | Phone: the dial. Zoom so far into the wheel that only the arc before you shows, about three cards, the front one full size. Cards stay upright; only their places turn. The hub is a map of the whole wheel. Interactive in the canvas. |
| 6 | `PhoneWheel.dc.html` | Phone: the whole wheel as a sheet; tap a card to read it in full. |
| 7 | `PhoneDraft.dc.html` | Phone: Marshalling a Slúagh host, choosing its monsters with live totals. Interactive. |
| 8 | `Duel.dc.html` | Desktop duel at the western crossing: a Slúagh host's combined numbers and powers, the champion bench, what is at stake, and the setting shown wherever it changes a number. |
| 9 | `PhoneDuel.dc.html` | Phone duel with a champion standing in over the hero. |
| 10 | `Setting.dc.html` | The second player chooses where the duels are fought: the ford (neutral) or their deck's home, with the effect on both decks counted. |
| 11 | `PhoneSetting.dc.html` | The same choice on a phone. Interactive. |

Breakpoints: 1100px and wider, the whole table (board 1); 700–1100px, the whole wheel at full width with the
forecast and actions in a panel under it; under 700px, the dial (board 5).

## Names on the wheel

Players never see a spot number (the engine keeps them).

| Name | Instead of |
| --- | --- |
| **Band**: your first band, your second band, their first band, their second band (a hero and its two flanks; a pie slice of the wheel). Once a hero is placed, also "Emer's band". | quadrant 1–4 |
| **Hero · West flank · East flank**: the three seats of a band, in the order they come round (the west flank is the seat right after the hero). Flank rules may come later. | spots |
| **Before you**: the seat you can fill or act on this turn | the faced spot |
| **First duel · Second duel**: opposite slices, first band against first band, then second against second; the final duel only at one each | spots 1 v 7, 4 v 10 |
| **Marshalling** | the drafting turn |
| **The Winnow** | the playing turn |
| Setting · Muster · Last omens | unchanged |

## Settings (home ground)

Each deck's home, from how many of its starter supports the setting helps:
Ulster: Emain Macha · Sídhe: Brú na Bóinne · Merrow: the loughs · Slúagh: the western crossing.
Connacht: Cruachan by name, but the Bog of Allen helps more of its supports. Fomóire: Conand's tower helps none
of its supports. The screens assume the second player chooses between the ford and their own home;
`engine/settings.ts` currently lets them pick any of the eight.

## Smaller quality-of-life changes

- Collapse the page header to a slim bar during a match.
- Keep the hand docked under the wheel; tap a hand card to light up where it can go.
- Point at a geis or oath: the supports it forbids dim on the wheel.
- Show the keys the code already supports (1–9, Enter, Esc, arrows) as key caps.
- Label the enemy zone "6 in hand · 4 omens face down".
- Moves log entries light their card on the wheel.
- Animation speed: off / brisk / ceremonial.
