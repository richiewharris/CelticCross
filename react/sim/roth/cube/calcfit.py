#!/usr/bin/env python3
"""Measures the duel calculator's Valour-equivalents (engine/calc.ts calcTerms) from how duels ended.

  python3 sim/roth/cube/calcfit.py --train <calc-s1.csv.gz> --test <calc-s2.csv.gz> [--write src/games/roth/engine/calcWeights.json]

The duel turned out additive: a side's edge in Valour points is its Valour lead plus a Valour-equivalent for each other
term (its Shield lead; its best blow now, its sustained blow, and its sustain, each less the foe's). Each equivalent is
how many points of Valour lead the same edge in that term is worth in winning the duel: a logistic fit on the terms
(no offset: the position is the same whoever's view it is; every weight kept to the sign the rules guarantee: more of
yours never hurts), divided by the Valour weight. Held-out log-loss and accuracy against Valour alone and the
hand-set evaluation say how much each step of the formula adds.
"""
import csv
import gzip
import json
import sys

import numpy as np

HAND = {"vdiff": 3, "race": 6, "rest": 1, "mound": 1, "cry": -1, "summon": -1, "stall": 1}
TERMS = [("valour", "vMe", "vFoe"), ("shield", "shMe", "shFoe"), ("blow", "blowMe", "blowFoe"), ("sustained", "sustainedMe", "sustainedFoe"),
         ("sustain", "sustainMe", "sustainFoe")]
# --table: the table calculator (calc.ts CALC2_TERMS): the duel played out on the rules' numbers; its verdict (who
# fell) and the Valour margin it ended at, beside the Valour and Shield leads (and the move, the offset)
TABLE = [("valour", "vMe", "vFoe"), ("shield", "shMe", "shFoe"), ("rollWin", "rollWin", None), ("rollMargin", "rollMargin", None)]
if "--table" in sys.argv:
    TERMS = TABLE
elif "--both" in sys.argv:
    TERMS = TERMS + TABLE[2:]


def load(paths):
    rows = []
    for p in paths:
        with gzip.open(p, "rt") as fh:
            for x in csv.DictReader(fh):
                if x["y"] != "0.5" and x.get("vMe") not in (None, "", "NaN", "nan") and all(x.get(a) not in (None, "", "NaN", "nan") for _, a, _b in TERMS):
                    rows.append(x)
    X = np.array([[float(x[a]) - (float(x[b]) if b else 0) for _, a, b in TERMS] for x in rows])
    y = np.array([float(x["y"]) for x in rows])
    H = np.array([sum(v * float(x[k]) for k, v in HAND.items()) for x in rows])
    return X, y, H, rows


def fit(X, y, iters=4000, lr=0.3, offset=False):
    """Logistic regression, weights >= 0, by projected gradient on scaled columns. With offset, also the value of having
    the move (every row is the view of the side about to act); returned as the last weight."""
    sd = X.std(0)
    sd[sd == 0] = 1
    Z = X / sd
    w, b = np.zeros(X.shape[1]), 0.0
    for _ in range(iters):
        p = 1 / (1 + np.exp(-(Z @ w + b)))
        w = np.maximum(0, w - lr * Z.T @ (p - y) / len(y))
        if offset:
            b -= lr * (p - y).mean()
    return np.r_[w / sd, b] if offset else w / sd


def ll(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())


def main():
    a = sys.argv[1:]
    def group(flag):
        i = a.index(flag) + 1
        out = []
        while i < len(a) and not a[i].startswith("--"):
            out.append(a[i]); i += 1
        return out
    Xtr, ytr, Htr, _ = load(group("--train"))
    Xte, yte, Hte, rte = load(group("--test"))
    print(f"train {len(ytr)} positions, test {len(yte)}\n")
    acc = lambda p: 100 * float(((p > 0.5) == (yte > 0.5)).mean())
    hw = fit(Htr[:, None], ytr)
    p = 1 / (1 + np.exp(-hw[0] * Hte))
    print(f"  {'hand-set evaluation':34} log-loss {ll(p, yte):.4f}  accuracy {acc(p):.1f}%")
    for k in range(1, len(TERMS) + 1):
        w = fit(Xtr[:, :k], ytr)
        p = 1 / (1 + np.exp(-Xte[:, :k] @ w))
        print(f"  {'+ '.join(t[0] for t in TERMS[:k]):34} log-loss {ll(p, yte):.4f}  accuracy {acc(p):.1f}%")
    wb = fit(Xtr, ytr, offset=True)
    w, b = wb[:-1], wb[-1]
    p = 1 / (1 + np.exp(-(Xte @ w + b)))
    print(f"  {'+ having the move':34} log-loss {ll(p, yte):.4f}  accuracy {acc(p):.1f}%")
    eq = w / w[0]
    print("\n  Valour-equivalents (one point of each, less the foe's, is worth this much Valour lead in winning the duel):")
    for (name, _, _), e in zip(TERMS, eq):
        print(f"    {name:10} {e:6.2f}")
    print(f"    {'the move':10} {b / w[0]:6.2f}  (being the side to act next)")
    print(f"  (one point of Valour lead moves the odds of winning the duel by a factor of {np.exp(w[0]):.2f})")
    # how well the formula holds for each people (a big miss means an interaction the formula lacks)
    print("\n  by people (the deciding side): observed - predicted, log-loss")
    for d in sorted({x["deck"] for x in rte}):
        m = np.array([x["deck"] == d for x in rte])
        print(f"    {d:9} {(yte[m] - p[m]).mean():+.3f}  {ll(p[m], yte[m]):.4f}")
    if "--write" in a:
        out = a[a.index("--write") + 1]
        with open(out, "w") as fh:
            json.dump({"note": ("Valour-equivalents of the table calculator's terms (calc.ts CALC2_TERMS)" if "--table" in sys.argv else "Valour-equivalents of the duel calculator's terms") + ", measured by sim/roth/cube/calcfit.py. Don't edit by hand.",
                       "train": group("--train"), "weights": {**{t[0]: round(float(e), 4) for t, e in zip(TERMS, eq)}, "move": round(float(b / w[0]), 4)},
                       "perValourLogit": round(float(w[0]), 5)}, fh, indent=1)
            fh.write("\n")
        print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
