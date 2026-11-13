#!/usr/bin/env python3
"""Fits the duel evaluation to measured outcomes (data from sim/roth/evaldata.ts) and compares it with the hand-set one.

  python3 sim/roth/cube/fiteval.py --train <a.csv.gz> [...] --test <b.csv.gz> [...] [--write src/games/roth/engine/evalWeights.json]

Each row is a position at a duel decision (the deciding side's features) and how that duel ended for that side
(1 won, 0 lost; neither-fell rows are left out). Both evaluations are judged as predictors of that outcome on the test
data, by log-loss (lower is better), accuracy, and Brier score:
  hand     the hand-set weights (engine/ai.ts HAND_WEIGHTS), given the best scale and offset the training data allows,
           so it is judged on how it ranks positions, not on its units
  fitted   a logistic regression on every feature
The fitted weights are on the features' own units: the logit of winning the duel. Written with --write, the engine can
use them (EVAL.weights, EVAL.logit = true).
"""
import csv
import gzip
import json
import sys

import numpy as np

HAND = {"vdiff": 3, "race": 6, "rest": 1, "mound": 1, "cry": -1, "summon": -1, "stall": 1}


def load(paths):
    rows, cols = [], None
    for p in paths:
        with gzip.open(p, "rt") as fh:
            r = csv.reader(fh)
            head = next(r)
            cols = head
            for x in r:
                if x and x[-1] != "0.5":
                    rows.append(x)
    feats = cols[3:-1]
    X = np.array([[float(v) for v in x[3:-1]] for x in rows])
    y = np.array([float(x[-1]) for x in rows])
    meta = [(x[0], x[1], int(x[2])) for x in rows]
    return feats, X, y, meta


def fit_logistic(X, y, l2=1e-3, iters=50):
    """Newton's method (IRLS) with a little ridge, on standardised columns; returns weights on the raw units and the offset."""
    mu, sd = X.mean(0), X.std(0)
    sd[sd == 0] = 1
    Z = np.hstack([np.ones((len(X), 1)), (X - mu) / sd])
    w = np.zeros(Z.shape[1])
    for _ in range(iters):
        p = 1 / (1 + np.exp(-Z @ w))
        g = Z.T @ (p - y) + l2 * np.r_[0, w[1:]]
        H = (Z * (p * (1 - p))[:, None]).T @ Z + l2 * np.diag(np.r_[0, np.ones(len(w) - 1)])
        step = np.linalg.solve(H, g)
        w -= step
        if np.abs(step).max() < 1e-8:
            break
    raw = w[1:] / sd
    b = w[0] - (raw * mu).sum()
    return raw, b


def score(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {"logloss": float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean()), "accuracy": float(((p > 0.5) == (y > 0.5)).mean()),
            "brier": float(((p - y) ** 2).mean())}


def main():
    a = sys.argv[1:]
    def group(flag):
        if flag not in a:
            return []
        i = a.index(flag) + 1
        out = []
        while i < len(a) and not a[i].startswith("--"):
            out.append(a[i]); i += 1
        return out
    feats, Xtr, ytr, _ = load(group("--train"))
    _, Xte, yte, mte = load(group("--test"))
    print(f"train {len(ytr)} positions, test {len(yte)} (duels that ended with one side felled); base rate {ytr.mean():.3f}\n")
    hw = np.array([HAND.get(f, 0) for f in feats])
    # the hand-set evaluation, given its best scale and offset
    hs, hb = fit_logistic((Xtr @ hw)[:, None], ytr)
    p_hand = 1 / (1 + np.exp(-((Xte @ hw) * hs[0] + hb)))
    w, b = fit_logistic(Xtr, ytr)
    p_fit = 1 / (1 + np.exp(-(Xte @ w + b)))
    base = np.full(len(yte), ytr.mean())
    for name, p in (("coin (base rate)", base), ("hand-set", p_hand), ("fitted", p_fit)):
        s = score(p, yte)
        print(f"  {name:18} log-loss {s['logloss']:.4f}  accuracy {100 * s['accuracy']:.1f}%  Brier {s['brier']:.4f}")
    # where the fitted one is better: by stage of the duel
    turns = Xte[:, feats.index("turn")]
    print("\n  log-loss by turn of the duel (hand / fitted):")
    for lo, hi in ((0, 4), (4, 10), (10, 20), (20, 999)):
        m = (turns >= lo) & (turns < hi)
        if m.sum() > 50:
            print(f"    turns {lo:>2}-{hi if hi < 999 else '':<3} n={m.sum():5}  {score(p_hand[m], yte[m])['logloss']:.4f} / {score(p_fit[m], yte[m])['logloss']:.4f}")
    print("\n  fitted weights (logit of winning the duel per unit), and the hand-set weight times its best scale for comparison:")
    for f, x, h in zip(feats, w, hw):
        print(f"    {f:8} {x:+.4f}   hand {h * hs[0]:+.4f}")
    print(f"    {'(offset)':8} {b:+.4f}")
    if "--write" in a:
        out = a[a.index("--write") + 1]
        with open(out, "w") as fh:
            json.dump({"note": "Fitted by sim/roth/cube/fiteval.py: logit of winning the duel. Don't edit by hand.",
                       "train": group("--train"), "weights": {f: round(float(x), 5) for f, x in zip(feats, w)}, "offset": round(float(b), 5)}, fh, indent=1)
            fh.write("\n")
        print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
