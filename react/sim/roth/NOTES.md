# Roth Catha simulator

A rules engine and four computer players (Novice, Casual, Skilled, Expert) for the Roth Catha
draft rules, used to playtest skill, seat and deck balance and rule variants.

```sh
npx tsx sim/roth/run.ts --quick          # every scenario, small samples (~70 s)
npx tsx sim/roth/run.ts                  # full run (~35 min on 2 cores)
npx tsx sim/roth/run.ts --ladder|--seat|--deck|--texture|--levers [--n 2000 --ne 80 --workers 2 --seed 1]
npx tsx sim/roth/run.ts --trace --seed 3 --p1 skilled --p2 expert   # one match, move by move
npx vitest run --config sim/roth/vitest.config.ts
```

Cards flagged `testOnly` in `cards.ts` (shown as `[test]`) were added so Connacht has a legal deck;
they are not part of the drafted card list.

## Rulings the simulator makes where the rules are silent

1. Muster: overflow beyond a hand of 12 goes to the Reserve in draw order; missing cards come from the
   Reserve first, then the deck. A returned card can't break the 2-hero / 4-support guarantee.
2. An Invoke cost when a geis is laid comes off the hero's starting Valour in its duel. Invoke costs
   are direct Valour loss, not Strikes (Shields and Wards don't reduce them).
3. +1 bonuses and Reinforcements apply to a support's first effect only.
4. Strike order: base, +1 bonuses, hero qualities, Láeg's bonus, Debility; floor at 0; Truce cap 2;
   Lugh −1 (first Strike against that hero each duel, even a 0); Shields soak.
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
17. The boyhood deeds gives +1 (5 under the "starting Valour 4" lever).
18. Omens kept until combat: P1 then P2 turn any they like.
19. Initiative ties by coin flip is an extra lever for the seat analysis, not a proposed rule.
