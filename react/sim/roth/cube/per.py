#!/usr/bin/env python3
"""The PER view of one people from the cube: every card, power and setting effect's worth, against the field and
against each foe, with the foe's worth beside it.

Worth (Valour points a match) = dealt + prevented + healed + denied - paid. Shield is credited to whatever raised it,
in proportion to how much of the Shield raised that match actually soaked (as in sim/roth/musthave.ts).

  python3 sim/roth/cube/per.py <deck> <run> [<run> ...]

For a card: share (of the people's worth), PER (worth a match it was on the board or used), in% (how often it was),
and the people's score in the matches it was in and those it wasn't (a must-have scores far better in than out).
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cube  # noqa: E402

KINDS = ("deal", "save", "heal", "deny", "cost")
WORTH_SQL = """
WITH l AS (SELECT run, a, b, i, seat, kind, source, value FROM ledger),
raised AS (SELECT run, a, b, i, seat, sum(value) r FROM l WHERE kind = 'shield' GROUP BY ALL),
soaked AS (SELECT run, a, b, i, seat, sum(value) s FROM l WHERE kind = 'save' AND source = 'shield' GROUP BY ALL),
w AS (
  SELECT run, a, b, i, seat, kind, source, CASE WHEN kind = 'cost' THEN -value ELSE value END v FROM l
   WHERE kind IN ('deal', 'heal', 'deny', 'cost') OR (kind = 'save' AND source <> 'shield')
  UNION ALL
  SELECT l.run, l.a, l.b, l.i, l.seat, 'save', l.source, l.value * coalesce(soaked.s, 0) / raised.r
    FROM l JOIN raised USING (run, a, b, i, seat) LEFT JOIN soaked USING (run, a, b, i, seat)
   WHERE l.kind = 'shield' AND raised.r > 0
)
SELECT s.deck, s.foe, w.kind, w.source, w.v, s.run, s.a, s.b, s.i, s.seat
  FROM w JOIN sides s USING (run, a, b, i, seat) WHERE s.deck <> s.foe
"""


def label(src, names):
    if src.startswith("people:"):
        return "power: " + src[7:]
    if src.startswith("setting:"):
        return "setting: " + src[8:]
    if src.startswith(("hero:", "ward:")):
        return "host " + ":".join(src.split(":")[1:])
    return names.get(src, src)


def main():
    deck, runs = sys.argv[1], sys.argv[2:]
    names = {}
    try:
        import json
        import subprocess
        names = json.loads(subprocess.check_output(
            ["npx", "tsx", "-e", 'import { ALL_DEFS } from "./src/games/roth/engine/cards"; '
             'console.log(JSON.stringify(Object.fromEntries(Object.entries(ALL_DEFS).map(([k, v]) => [k, (v as any).name]))))'],
            cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")), text=True))
    except Exception:
        pass
    src_w = defaultdict(float)            # (foe, source) -> worth
    kind_w = defaultdict(float)           # (deck, foe, kind) -> worth
    match_src = defaultdict(float)        # (match, source) -> worth for our deck
    n_side = defaultdict(int)             # (deck, foe) -> sides
    score = {}                            # match -> our score
    present = defaultdict(set)            # match -> cards present
    foe_of = {}
    for r in runs:
        _, db = cube.load(r)
        for d, f, k, src, v, run, a, b, i, seat in db.execute(WORTH_SQL).fetchall():
            if d == deck or f == deck:
                kind_w[(d, f if d == deck else d, k, d == deck)] += v
            if d == deck:
                src_w[(f, src)] += v
                match_src[((run, a, b, i, seat), src)] += v
        for d, f, run, a, b, i, seat, sc in db.execute(
                "SELECT deck, foe, run, a, b, i, seat, score FROM sides WHERE deck <> foe").fetchall():
            if d == deck:
                n_side[f] += 1
                score[(run, a, b, i, seat)] = sc
                foe_of[(run, a, b, i, seat)] = f
            elif f == deck:
                n_side["vs:" + d] += 1
        for run, a, b, i, seat, card in db.execute(
                f"SELECT p.run, p.a, p.b, p.i, p.seat, p.card FROM present p JOIN sides s USING (run, a, b, i, seat) "
                f"WHERE s.deck = '{deck}' AND s.foe <> s.deck").fetchall():
            present[(run, a, b, i, seat)].add(card)
    foes = sorted(f for f in n_side if not f.startswith("vs:"))
    N = sum(n_side[f] for f in foes)
    win = sum(score.values())
    total = sum(v for (_, _), v in src_w.items())
    print(f"{deck}: {N} matches over {len(runs)} run(s), score {100 * win / N:.1f}%, worth {total / N:.1f} a match\n")

    print("Worth a match by kind, ours vs the foe's, per foe:")
    print(f"  {'foe':9} {'score':>6}  " + "  ".join(f"{k:>11}" for k in KINDS) + "  {:>11}".format("net"))
    for f in foes:
        sc = sum(s for m, s in score.items() if foe_of[m] == f) / n_side[f]
        cells, net = [], [0.0, 0.0]
        for k in KINDS:
            us = kind_w[(deck, f, k, True)] / n_side[f]
            them = kind_w[(f, f, k, False)] / n_side["vs:" + f]
            sign = 1  # cost is already negative
            cells.append(f"{us:5.1f}/{them:5.1f}")
            net[0] += sign * us
            net[1] += sign * them
        print(f"  {f:9} {100 * sc:5.1f}%  " + "  ".join(cells) + f"  {net[0]:5.1f}/{net[1]:5.1f}")

    print("\nEvery source, worth a match against the field and against each foe:")
    srcs = sorted({s for (_, s) in src_w}, key=lambda s: -sum(src_w[(f, s)] for f in foes))
    print(f"  {'source':34} {'field':>6} {'share':>6}  " + " ".join(f"{f[:7]:>7}" for f in foes))
    for s in srcs:
        fv = sum(src_w[(f, s)] for f in foes) / N
        if abs(fv) < 0.05:
            continue
        print(f"  {label(s, names)[:34]:34} {fv:6.2f} {100 * fv / total * N:5.1f}%  " +
              " ".join(f"{src_w[(f, s)] / n_side[f]:7.2f}" for f in foes))

    print("\nCards: PER (worth a match it was in), in%, and the score with it in / out:")
    cards = defaultdict(lambda: [0, 0.0, 0.0])  # in-count, worth, score-in
    for m, cs in present.items():
        for c in cs:
            x = cards[c]
            x[0] += 1
            x[1] += match_src.get((m, c), 0.0)
            x[2] += score[m]
    print(f"  {'card':34} {'PER':>5} {'in%':>5}   score in / out")
    for c, (n, v, sw) in sorted(cards.items(), key=lambda kv: -kv[1][1] / max(1, kv[1][0])):
        if n / N < 0.05 or ":" in c:
            continue
        out = N - n
        o = f"{100 * (win - sw) / out:5.1f}%" if out / N >= 0.05 else "  (always)"
        print(f"  {names.get(c, c)[:34]:34} {v / n:5.2f} {100 * n / N:5.1f}   {100 * sw / n:5.1f}% / {o}")


if __name__ == "__main__":
    main()
