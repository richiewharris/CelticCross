# Roth Catha simulator

A rules engine and four computer players (Novice, Casual, Skilled, Expert) for the Roth Catha
draft rules, used to playtest skill, seat and deck balance and rule variants. The engine lives in
`src/games/roth/engine/` (shared with the game page); its tests run with `npm test`.

Second draft: five faction decks (Ulster, Connacht, Sídhe, Fomóire, Merrow), card rarity, heroes with
their own Valour (3–6), oaths, modifying geasa, and a wounds tie-break. Every card is data in `cards.ts`;
the engine reads the fields (no hero or card is special-cased by name).

```sh
npx tsx sim/roth/balance.ts --n 400 --cards       # five-deck round robin at Skilled (≈1 min per 3,000 matches)
npx tsx sim/roth/balance.ts --level skilled --vs casual --n 40   # skill gap across every deck pair
npx tsx sim/roth/run.ts --quick          # every scenario, small samples (~70 s)
npx tsx sim/roth/run.ts                  # full run (~35 min on 2 cores)
npx tsx sim/roth/run.ts --ladder|--seat|--deck|--texture|--levers [--n 2000 --ne 80 --workers 2 --seed 1]
npx tsx sim/roth/run.ts --trace --seed 3 --d1 sidhe --d2 fomoire --p1 skilled --p2 expert   # one match, move by move
npx vitest run src/games/roth
npx tsx sim/roth/puzzlegen.ts --games 800 --seed 2 > candidates.json      # puzzle candidates from self-play
npx tsx sim/roth/makepuzzles.ts candidates.json > src/games/roth/puzzles/boards.json   # curated + proved
```

`run.ts` holds the first draft's scenarios (Ulster against Connacht: ladder, seat, levers).

## Rulings the simulator makes where the rules are silent

1. Muster: overflow beyond a hand of 12 goes to the Reserve in draw order; missing cards come from the
   Reserve first, then the deck. A returned card can't break the 2-hero / 4-support guarantee.
2. An Invoke cost when a geis is laid comes off the hero's starting Valour in its duel (as does the giant's portion). Invoke costs
   are direct Valour loss, not Strikes (Shields and Wards don't reduce them).
3. +1 bonuses and Reinforcements apply to a support's first effect only.
4. Strike order: base, +1 bonuses, hero qualities, Láeg's bonus, Debility; floor at 0; Truce cap (now 3);
   Indech's cap; first-Strike reductions (Lugh, Fog, Culann's hound, Manannán), even on a 0; Shields soak unless the
   Strike ignores Shield.
5. Only the Morrígan's crow is a board geis that forbids (supports with a Heal). Breaking it lifts it
   for both players for the rest of the match. Debility, Truce and Mist are unbreakable modifiers.
6. Debility hits Deorad heroes, so it hits Fergus.
7. Emain's ward is automatic: the geis card and its Invoke cost are ignored.
8. Cathbad's ignore leaves the geis standing; it works only when exactly one geis forbids that support.
9. A hero with no support left may rest even under the open-door geis.
10. Breaking costs 2 per geis broken.
11. Sling of Emain: "first support used in the duel" counts either hero; an Unwilling use counts.
12. The warp-spasm's self-loss can fell its own hero, so both heroes can fall.
13. Blessing of the ford counts supports fighting for your hero, including ones the enemy supplanted in.
14. King's due: Conchobar's quadrant geis applies to a borrowed support; one borrowed in the first
    duel is spent in the second.
15. Guests: Deorad matches Ulaid and Connachta; one guest use per duel per player.
16. Deck building: a Deorad hero adds no alignment if the deck has Ulaid or Connachta heroes.
17. (First draft only: the boyhood deeds gave +1 starting Valour. It is now "first-duel Strikes +1".)
18. Omens kept until combat: P1 then P2 turn any they like.
19. Initiative ties by coin flip is an extra lever for the seat analysis, not a proposed rule.

## Rulings added in the second draft

20. Swearing is a Playing-turn action taken instead of acting on the faced spot, at any step, on one of your own
    heroes with no oath yet. One oath per hero. Oaths are public once sworn.
21. An oath's vow uses the same "forbids" terms as a geis; breaking costs 2 (the oath-break-cost lever) and the boon
    ends at once for the rest of the match. Valour and Shield already granted stay.
22. Cathbad's ignore works on an oath as on a geis. Emain's ward ignores geasa only, not your own oaths.
23. Heals stop at printed Valour + oath + omens + 2. Invoke and the giant's portion lower the starting Valour
    but not this cap, so a hero can heal back what they took.
24. Wounds tie-break: for each duel, starting Valour (after Invoke and the giant's portion) minus ending Valour, floored at 0; a felled hero's
    whole start counts. The player who dealt more wounds wins the tie.
25. Drain ("if it wounds, Heal n") needs at least 1 damage past Shield and a standing hero.
26. "Ignores Shield" Strikes leave the Shield in place. Ward and hero first-Strike reductions still apply.
27. Mist of the druids: its owner strikes first; if both players have a Mist face up, Initiative decides.
    Night of the Fomóire inverts Initiative in the first duel only; a Mist beats the Night.
28. Debility hits the named alignment and Deorad heroes, unless the hero is spared (Cú Chulainn).
29. Unwilling pairs: Ulaid–Connachta and Sídhe–Fomóire. Merrow, Deorad and Unaligned are never Unwilling.
30. Deck limits: commons ×2, rares ×1, legendaries ×1, at most 2 legendaries; heroes and omens ×1 each.

## Rulings added in the third draft (champions, scopes)

31. Initiative ties go to the first player (`initTie: "p1"`; the old rule is the lever `"p2"`).
32. A global geis is laid with Bind while facing any enemy hero; it sits in the centre and binds all four heroes,
    the layer's too. At most 4 global geasa. Each hero breaks a global geis for itself only (2 Valour). Its
    modifiers and Invoke apply to every hero at the start of its duel. Emain's ward ignores global geasa too.
33. A targeted omen is turned like any omen, naming one hero spot (either side's). It touches whoever fights from
    that spot, including a champion. Global omens touch everyone; "yours" omens touch your fighters.
34. Champions: called on your fighter's turn instead of using a support or resting (it uses the turn). The first
    player may call in either duel, the second only in the second; one per side per duel. The champion fights with
    its printed Valour (+ the Valour-bonus lever), Heal cap +2, its own Shield-start quality only (the hero's Shield
    is lost), and no oath boon. No geis, global geis, crow or oath binds it. It has no tag. Its fall is the hero's.
    Wounds: the Valour the hero lost before the swap still counts.
35. Guests may heal a champion of the same alignment.
36. Lever `champions: false` turns champions off (for the seat analysis).

## Rulings added for the tie-break (the round run backwards)

37. Triggered when felled and wounds are level after the duels (`tiebreak: "reverse"`; `"none"` skips it).
38. Reset: targeted geasa, global geasa and oaths return to the hands of the players who played them; turned
    omens go back face down with no target. Supplanted supports stay; spent champions, guests and lost omens stay gone.
39. The Playing turn runs counter-clockwise: P1 faces spots 12→7, P2 faces 6→1; P2 acts first at each step
    (`reverseFirst: "p1"` flips it). Late omens follow the same order. Unturned omens are lost after it again.
40. The duels are fought afresh, spots 4/10 first, then 1/7. "First duel" effects (Night of the Fomóire, the
    boyhood deeds, champion timing) mean the first duel fought. Only the backwards round decides the result; if it
    is level too, the first-duel rule, then a draw.

## Deck building (the pools)

41. Each people has a pool about twice its starter deck: 17–18 supports (9 new each), its heroes and champions,
    and the omens tied to it. Exiles (Deorad: Fergus, Caladbolg, Fergus's shield) are in Ulster's and Connacht's
    pools. Unaligned supports, all 23 geasa, all 15 oaths and the omens tied to no people are open to every deck.
42. A deck is 24 cards in the old ranges and rarity limits, drawing on at most two peoples: heroes, champions,
    supports and people-bound omens all count, and exiles count only when no Ulaid or Connachta card is there.
43. Omens tied to a people: Ulaid (Emain's ward, Culann's hound, the Red Branch), Connachta (the ráth, Cruachan's
    plenty, the Debility), Sídhe (the Mist, Lugh's protection, the crow, the Brú), Fomóire (the Night, Tory's
    tower, Samhain tribute), Merrow (the fog, the flood tide, the blessing of the ford). The rest are open.
44. The Mist of the druids now works in the first duel only. Open to every deck in pool simulations it was worth
    about 30 points of score on its own (`ablate.ts`). The Sídhe starter swaps the Morrígan's crow for Druid's
    sleep to make up for it; the five starters then score 47–55% against each other at Skilled.
45. New cards reuse existing mechanics only: printed effects, pierce, next-Strike, drain, first-support bonus,
    big-hero bonus, a better number for one hero, and Invoke. New geasa invoke the tags no card invoked before
    (Sea, Satire, Bounty, Feast, Evil eye, Many skills, Hoard); new oaths are boon/vow pairs.
46. The computer builds its deck: Novice and Casual with `buildDeck` (a scored pick, blurred by level); Skilled
    and Expert play the deck `optimize.ts` hill-climbed for each faction against the starters and each other
    (`computerDecks.json`). The player can still set it to play the starter deck.
47. Pool tools: `pool.ts --cards` (random built decks, each card's score lift over its faction's average),
    `pool.ts --built` (strong built decks against the starters; `BVB=1` against each other), `ablate.ts <faction>`
    (drop one card at a time and refill), `optimize.ts`.

## Attendants

48. A seventh card type, up to 2 a deck (rarity limits as usual), mustered to hand like oaths. In the Playing
    turn, instead of another action, a player may call one attendant from hand; it stays for the match and goes
    back to hand in the backwards round.
49. Reach (printed): yours (the supports your fighters use, whoever placed them), enemy (the enemy fighter's
    supports, or the enemy's heroes for a curse), or global (everyone).
50. Modes: enchant (supports of a kind count as an element), turn (one element counts as another), channel (as
    turn, primary Strike +1, and the user loses 1 Valour per use), reforge (one kind counts as another), curse
    (fighters in reach are also weak to an element, as well as their printed weakness).
51. Attendants apply in the order called, each seeing the earlier ones' changes. The changed element or kind
    counts for everything: kinship is untouched, but Focus, the element wheel, weakness, element and kind
    reinforcements, and geis/oath/crow prohibitions all read the changed card. Champions are reached like heroes.
52. Built decks carry one attendant (8 supports); the optimizer may swap supports and attendants.

## The Slúagh (a monster deck)

53. A sixth people, the Slúagh. Instead of heroes they have hosts (the Hunt, the Prey, the Taboo; one each) and
    monsters. A host is placed on a hero spot in the Drafting turn with 2 or 3 monsters joined from hand (all of
    them if fewer than 2). Host and monsters become one fighter (it keeps the host card's uid): Valour = the sum of
    the monsters' Valour (+1 each for the Prey), Initiative = the host's + each monster's, qualities summed, and it
    is weak to every element its host type and its monsters bring. It counts as a hero for everything else.
54. Spirit (anam) is a support element outside the wheel: no beats, no weakness to it; a Spirit Strike ignores
    Shield and heals its user 1 when it wounds. Every host's Focus is Spirit.
55. New support effects: the enemy's next Strike −n (foeNext), the enemy loses n Valour outright (foeLoss).
56. Deck rules with hosts: hosts and heroes together 3–6, monsters 4–9, one copy of each host and monster. The
    Muster also guarantees 4 monsters in hand for a host deck. Slúagh and Aos Sídhe are Unwilling.
57. Starter: 3 hosts, 2 champions (the Banshee, Fear Doirich), 5 monsters, 8 supports, 2 geasa, 4 omens. It
    scores about 50% against the five other starters at Skilled; the tuned Slúagh deck about 53% against the
    tuned field. The Aos Sídhe beat them (about 65–70%) and the Fomóire lose to them.

## Charm, the veil, and the hosts' sacrifice and summon

58. Charm (Aos Sídhe supports: Glamour, the music of the mounds, Aengus's kisses): Strike 1 that ignores Shield;
    before it lands it takes up to n of the enemy fighter's Shield for your own (stealShield), and some dull the
    enemy's next Strike. The Aos Sídhe starter swaps one Raven's war-cry for Glamour.
59. Veiled (rule `veiled`, on): the first Strike against an Aos Sídhe fighter each duel −1, and its own first Strike
    each duel −1. Tried one-way it pushed the Aos Sídhe to 68–70% against the field. Positions saved before the
    rule leave it out.
60. Slúagh hosts in combat, each as the fighter's action (the turn passes): sacrifice a monster (once a duel; the
    host must keep one): the host Heals that monster's Valour, up to its cap, and loses its weakness and quality;
    summon a monster from the other host (once a match; that host must keep one and not have been felled): the
    fighting host gains its Valour (and cap), weakness and quality, and the other host fights without it.
    Monster Valour went back to the first numbers once these came in.
61. Connacht's starter swaps Ferdiad's horn-shield for Fráech's spear. Six starters at Skilled: 45–56% against
    the field.

## Hybrid damage, the uninvited guest, the Reserve top-up

62. Hybrid monsters carry the element opposite their weakness (Fire against Water, Wind against Earth): the
    Dullahan Fire, the Fear Dearg Wind, the Bean Nighe Earth, the Dearg-due Water. A host's Spirit blows also count
    as its monsters' hybrids. (Revised: see 66.)
63. The Fear Dearg's uninvited guest: when a Strike wounds his host, the striker loses 1 Valour.
64. A host placed with fewer than two monsters in hand takes the rest from the Reserve. A deck holds 4–6 monsters.
65. Each of these added about 5–7 points to the Slúagh (together ~20). To pay for them: a host has one Valour
    less than its monsters together; the Hunt's bonus is its first Strike each duel +1 (not every Strike); the
    Prey no longer gains Valour per monster; the Taboo no longer spoils Heals. Slúagh starter ~52% against the
    field; the Fomóire still beat it (~80%) and it beats Ulster (~73%).

## Puzzles

Board puzzles (drafting, Playing turn, combat) come from Skilled self-play: `puzzlegen.ts` keeps positions where
one choice is best by exact search and a Casual player would get it wrong. `makepuzzles.ts` holds the chosen
positions with their titles and explanations, tidies them (drafting: no omens; combat: no hands), and refuses to
write a puzzle whose answer isn't the single best choice. The rule each puzzle assumes is shown on the page:
drafting, nobody acts in the Playing turn; Playing turn, everyone holds afterwards; combat, both sides play
perfectly without guests or champions. `src/games/roth/puzzles/puzzles.test.ts` re-proves every answer.
