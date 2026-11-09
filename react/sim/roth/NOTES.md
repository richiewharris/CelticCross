# Roth Catha simulator

A rules engine and four computer players (Novice, Casual, Skilled, Expert) for the Roth Catha
draft rules, used to playtest skill, seat and deck balance and rule variants.

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
npx vitest run --config sim/roth/vitest.config.ts
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
