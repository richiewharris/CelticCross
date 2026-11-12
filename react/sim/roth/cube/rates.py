#!/usr/bin/env python3
"""Valour earned against Valour lost, per own turn, in full-length duels against a target dummy.

Run the duels the full 60 turns with every fighter rising again when it falls and weariness off:
  npx tsx sim/roth/balance.ts --n 60 --against dummy_spar \\
      --rules '{"params":{"setting.choose":0,"sim.undyingAll":1,"duel.weariness":0}}'
then
  python3 sim/roth/cube/rates.py <run> [<run> ...]

Each duel is one observation (60 turns, 30 of the people's own). Per own turn:
  dealt     Valour taken off the dummy (wounds)
  healed    Valour the people healed
  prevented Valour its defence kept off (Shield, blocks, wards, Armour, the mound, halving, the aura)
  taken     Valour the dummy took off the people
  paid      Valour the people paid (reusing cards, breaking geasa and oaths)
  net       dealt + healed - taken - paid: the Valour exchange, the people's edge per turn over an average opponent
Each with its mean, a 95% interval (1.96 standard errors), and the duels needed to pin it to +-0.1 a turn.
Then the rate by stretch of the duel (turns 1-20, 21-40, 41-60), to see whether it holds steady.
"""
import math
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cube  # noqa: E402


def stats(xs):
    n = len(xs)
    m = sum(xs) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in xs) / (n - 1)) if n > 1 else 0.0
    return m, 1.96 * sd / math.sqrt(n), sd


def main():
    runs = sys.argv[1:]
    obs = defaultdict(lambda: defaultdict(list))  # people -> metric -> per-duel values
    stretch = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0]))  # people -> stretch -> [dealt, taken, duels]
    dummy = None
    for r in runs:
        meta, db = cube.load(r)
        dummy = next(d for d in meta["decks"] if d.startswith("dummy_"))
        q = f"""
        SELECT x.deck, d.run, d.a, d.b, d.i, d.duel, d.turns, d.deal, d.heal, d.save, d.cost, d.falls, e.deal, e.falls
          FROM duels d JOIN sides x USING (run, a, b, i, seat)
          JOIN duels e ON e.run = d.run AND e.a = d.a AND e.b = d.b AND e.i = d.i AND e.duel = d.duel AND e.seat <> d.seat
         WHERE x.foe = '{dummy}' AND x.deck <> '{dummy}'"""
        for deck, *_k, turns, deal, heal, save, cost, falls, edeal, efalls in db.execute(q).fetchall():
            own = turns / 2
            o = obs[deck]
            o["dealt"].append(deal / own)
            o["healed"].append(heal / own)
            o["prevented"].append(save / own)
            o["taken"].append(edeal / own)
            o["paid"].append(cost / own)
            o["net"].append((deal + heal - edeal - cost) / own)
            o["fells/30"].append(efalls * 30 / own)
            o["falls/30"].append(falls * 30 / own)
        q2 = f"""
        SELECT x.deck, b.turn // 20 AS st, sum(CASE WHEN b.seat = x.seat THEN final ELSE 0 END), sum(CASE WHEN b.seat <> x.seat THEN final ELSE 0 END)
          FROM blows b JOIN sides x ON x.run = b.run AND x.a = b.a AND x.b = b.b AND x.i = b.i
         WHERE x.foe = '{dummy}' AND x.deck <> '{dummy}' GROUP BY ALL"""
        for deck, st, dl, tk in db.execute(q2).fetchall():
            s = stretch[deck][min(2, st)]
            s[0] += dl
            s[1] += tk
        for deck, n in db.execute(f"SELECT x.deck, count(*) FROM duels d JOIN sides x USING (run, a, b, i, seat) WHERE x.foe = '{dummy}' AND x.deck <> '{dummy}' GROUP BY 1").fetchall():
            for st in range(3):
                stretch[deck][st][2] += n
    metrics = ["dealt", "healed", "prevented", "taken", "paid", "net", "fells/30", "falls/30"]
    print(f"Against {dummy}, per own turn (mean +- 95%; duels in brackets: how many pin it to +-0.1). Runs: {', '.join(runs)}\n")
    print(f"  {'people':9} {'duels':>5}  " + "  ".join(f"{m:>17}" for m in metrics))
    for deck in sorted(obs, key=lambda d: -sum(obs[d]["net"]) / len(obs[d]["net"])):
        o = obs[deck]
        cells = []
        for m in metrics:
            mu, ci, sd = stats(o[m])
            need = math.ceil((1.96 * sd / 0.1) ** 2)
            cells.append(f"{mu:6.2f} +-{ci:4.2f} ({need:>4})")
        print(f"  {deck:9} {len(o['net']):5}  " + "  ".join(cells))
    print("\n  Wounds dealt / taken per own turn, by stretch of the duel (each stretch is 10 own turns):")
    print(f"  {'people':9}  {'turns 1-20':>13}  {'turns 21-40':>13}  {'turns 41-60':>13}")
    for deck in sorted(stretch):
        print(f"  {deck:9}  " + "  ".join(f"{s[0] / (10 * s[2]):5.2f} / {s[1] / (10 * s[2]):5.2f}" for s in (stretch[deck][i] for i in range(3))))


if __name__ == "__main__":
    main()
