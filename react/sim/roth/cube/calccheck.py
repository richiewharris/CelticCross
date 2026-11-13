#!/usr/bin/env python3
"""Checks the duel calculator (engine/calc.ts) against how duels actually ended.

  python3 sim/roth/cube/calccheck.py --train <calc-s1.csv.gz> --test <calc-s2.csv.gz>

Data from sim/roth/evaldata.ts: at every duel decision, the calculator's race from the deciding side's view (turns it
needs to fell its foe, turns the foe needs, the margin allowing for who acts next, each side's best blow and best
sustain) and how the duel ended for that side.

Level 3, the race, is judged as a predictor: the margin alone, with one measured constant (the spread: how many turns
of margin make a duel a near certainty), against the hand-set evaluation (given its best scale) and a coin. Then the
residuals: where the race is wrong, grouped by what might explain it (sustain, the size of the blows, the people,
the stage of the duel), so the next term of the formula comes from the data, not a guess.
"""
import csv
import gzip
import math
import sys

import numpy as np

HAND = {"vdiff": 3, "race": 6, "rest": 1, "mound": 1, "cry": -1, "summon": -1, "stall": 1}


def load(paths):
    rows = []
    for p in paths:
        with gzip.open(p, "rt") as fh:
            r = csv.DictReader(fh)
            for x in r:
                if x["y"] != "0.5" and x.get("margin") not in (None, "", "nan", "NaN"):
                    rows.append(x)
    return rows


def ll(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())


def fit1(z, y):
    """Best a, b for p = sigmoid(a z + b) (Newton)."""
    w = np.zeros(2)
    Z = np.c_[z, np.ones_like(z)]
    for _ in range(50):
        p = 1 / (1 + np.exp(-Z @ w))
        H = (Z * (p * (1 - p))[:, None]).T @ Z + 1e-9 * np.eye(2)
        w -= np.linalg.solve(H, Z.T @ (p - y))
    return w


def main():
    a = sys.argv[1:]
    tr = load(a[a.index("--train") + 1:a.index("--test")])
    te = load(a[a.index("--test") + 1:])
    f = lambda rows, k: np.array([float(x[k]) for x in rows])
    ytr, yte = f(tr, "y"), f(te, "y")
    print(f"train {len(tr)} positions, test {len(te)}\n")
    # the race: margin alone, its scale measured on the training data (offset kept at 0: the margin already counts who acts next)
    mtr, mte = f(tr, "margin"), f(te, "margin")
    wa = fit1(mtr, ytr)
    p_race = 1 / (1 + np.exp(-(wa[0] * mte + wa[1])))
    hz = lambda rows: sum(v * f(rows, k) for k, v in HAND.items())
    wh = fit1(hz(tr), ytr)
    p_hand = 1 / (1 + np.exp(-(wh[0] * hz(te) + wh[1])))
    acc = lambda p: 100 * float(((p > 0.5) == (yte > 0.5)).mean())
    print(f"  coin        log-loss {ll(np.full(len(yte), ytr.mean()), yte):.4f}")
    print(f"  hand-set    log-loss {ll(p_hand, yte):.4f}  accuracy {acc(p_hand):.1f}%")
    print(f"  the race    log-loss {ll(p_race, yte):.4f}  accuracy {acc(p_race):.1f}%   (spread: {2 / wa[0]:.2f} turns of margin per logit 2; offset {wa[1]:+.2f})")
    # residuals: observed minus the race's prediction, by group
    res = yte - p_race
    def by(name, keyf, bins):
        print(f"\n  where the race is off, by {name} (n, mean observed - predicted):")
        vals = np.array([keyf(x) for x in te])
        for lo, hi, lab in bins:
            m = (vals >= lo) & (vals < hi)
            if m.sum() >= 100:
                print(f"    {lab:22} n={m.sum():6}  {res[m].mean():+.3f}   (predicted {p_race[m].mean():.2f}, observed {yte[m].mean():.2f})")
    by("my sustain minus the foe's blow", lambda x: float(x["sustainMe"]) - float(x["blowFoe"]),
       [(-99, -3, "< -3"), (-3, -1, "-3..-1"), (-1, 1, "-1..1"), (1, 99, ">= 1 (out-heals it)")])
    by("blow sizes (mine / the foe's)", lambda x: float(x["blowMe"]) / max(0.5, float(x["blowFoe"])),
       [(0, 0.5, "< 0.5"), (0.5, 0.9, "0.5-0.9"), (0.9, 1.1, "about even"), (1.1, 2, "1.1-2"), (2, 99, ">= 2")])
    by("turn of the duel", lambda x: float(x["turn"]), [(0, 4, "0-3"), (4, 10, "4-9"), (10, 20, "10-19"), (20, 999, "20+")])
    by("either side unable to wound (30 = for ever)", lambda x: (float(x["tMe"]) >= 30) * 2 + (float(x["tFoe"]) >= 30),
       [(0, 1, "both can wound"), (1, 2, "the foe can't"), (2, 3, "I can't"), (3, 4, "neither can")])
    print("\n  by people (the deciding side):")
    for d in sorted({x["deck"] for x in te}):
        m = np.array([x["deck"] == d for x in te])
        print(f"    {d:9} n={m.sum():6}  {res[m].mean():+.3f}   log-loss race {ll(p_race[m], yte[m]):.4f} / hand {ll(p_hand[m], yte[m]):.4f}")


if __name__ == "__main__":
    main()
