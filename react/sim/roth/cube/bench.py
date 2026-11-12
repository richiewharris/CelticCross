#!/usr/bin/env python3
"""Benchmarks against the target dummies (sim/roth/dummy.ts): each people scored on its own, on a fixed yardstick.

  python3 sim/roth/cube/bench.py [--post <run> ...] [--spar <run> ...]

With no runs named, it takes every run in the cube played --against dummy_post / dummy_spar under the newest engine.

Against the post (never hits back): offence alone.
  turns/fell   the people's own turns to fell one average hero (Valour 4.5 + the ford's 3)
  dmg/turn     wounds dealt per own turn
  blow         wounds per blow, and how the formula builds it: printed, the use-stage bonuses (kinship, Focus,
               the wheel, weakness, the setting, the rest), the strike-stage adds, and what the defence took off
Against the sparring partner (an average deck with no people): offence and defence together.
  win          match score
  duel         share of duels won (the dummy's hero felled and the people's not)
  dealt/taken  wounds per own turn dealt to it and taken from it
  healed       Valour healed per match
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cube  # noqa: E402

ADD = ["base", "kin", "focus", "watch", "wheel", "weak", "fx", "setting", "extra"]
DEF = ["ward", "block", "resist", "armour", "mound", "shield", "halved", "aura"]


def runs_against(dummy):
    ms = [m for m in cube.metas() if dummy in (m.get("decks") or []) and m.get("blowCols")]
    if not ms:
        return []
    eng = ms[-1]["engine"]
    return [m["id"] for m in ms if m["engine"] == eng]


def collect(runs, dummy):
    out = defaultdict(lambda: defaultdict(float))
    for r in runs:
        _, db = cube.load(r)
        q = f"""
        WITH s AS (SELECT run, a, b, i, seat, deck, score FROM sides WHERE foe = '{dummy}' AND deck <> '{dummy}'),
        d AS (SELECT run, a, b, i, sum(turns) / 4.0 t, count(*) / 2 n FROM duels GROUP BY ALL),  -- own turns: each duel has a row per seat, and its turns alternate
        dw AS (SELECT x.run, x.a, x.b, x.i, x.seat, sum(CASE WHEN y.felled = 1 AND x.felled = 0 THEN 1 ELSE 0 END) won,
                      sum(y.felled) fells, sum(CASE WHEN y.felled = 1 THEN x.turns / 2.0 ELSE 0 END) fell_turns
                 FROM duels x JOIN duels y ON x.run = y.run AND x.a = y.a AND x.b = y.b AND x.i = y.i AND x.duel = y.duel AND x.seat <> y.seat
                GROUP BY ALL),
        bo AS (SELECT run, a, b, i, seat, count(*) nb, sum(final) fin, sum(printed) pr, {", ".join(f"sum({c}) {c}" for c in ADD + DEF)},
                      sum(atk + floor + cap) atk FROM blows GROUP BY ALL),
        bt AS (SELECT run, a, b, i, seat, sum(final) taken FROM blows GROUP BY ALL),
        he AS (SELECT run, a, b, i, seat, sum(value) healed FROM ledger WHERE kind = 'heal' GROUP BY ALL)
        SELECT s.deck, count(*) m, sum(s.score) score, sum(d.t) turns, sum(d.n) duels, sum(dw.won) won, sum(dw.fells) fells,
               sum(dw.fell_turns) fell_turns, sum(bo.nb) nb, sum(bo.fin) fin, sum(bo.pr) pr, {", ".join(f"sum(bo.{c})" for c in ADD + DEF)},
               sum(bo.atk), sum(coalesce(bt.taken, 0)), sum(coalesce(he.healed, 0))
          FROM s JOIN d USING (run, a, b, i) JOIN dw USING (run, a, b, i, seat)
          LEFT JOIN bo USING (run, a, b, i, seat)
          LEFT JOIN bt ON bt.run = s.run AND bt.a = s.a AND bt.b = s.b AND bt.i = s.i AND bt.seat <> s.seat
          LEFT JOIN he USING (run, a, b, i, seat)
         GROUP BY s.deck"""
        cols = ["m", "score", "turns", "duels", "won", "fells", "fell_turns", "nb", "fin", "pr", *ADD, *DEF, "atk", "taken", "healed"]
        for row in db.execute(q).fetchall():
            for c, v in zip(cols, row[1:]):
                out[row[0]][c] += v or 0
        # what each people's defence took off the dummy's blows
        q2 = f"""SELECT s.deck, count(*), {", ".join(f"sum(b.{c})" for c in DEF)} FROM blows b
                 JOIN sides s ON s.run = b.run AND s.a = b.a AND s.b = b.b AND s.i = b.i AND s.seat <> b.seat
                WHERE s.foe = '{dummy}' AND s.deck <> '{dummy}' GROUP BY 1"""
        for row in db.execute(q2).fetchall():
            dd = out[row[0]].setdefault("_def", defaultdict(float))
            dd["n"] += row[1]
            for c, v in zip(DEF, row[2:]):
                dd[c] += v or 0
    return out


def main():
    a = sys.argv[1:]
    def named(flag):
        return [a[i + 1] for i, x in enumerate(a) if x == flag]
    post = named("--post") or runs_against("dummy_post")
    spar = named("--spar") or runs_against("dummy_spar")
    if post:
        P = collect(post, "dummy_post")
        print(f"Against the post (offence alone; runs {', '.join(post)}):")
        print(f"  {'people':9} {'turns/fell':>10} {'dmg/turn':>8} {'blows/turn':>10} {'wounds/blow':>11}   printed  +bonuses (kin focus wheel weak setting other)  +strike  -defence")
        for d, x in sorted(P.items(), key=lambda kv: kv[1]["fell_turns"] / max(1, kv[1]["fells"])):
            nb = max(1, x["nb"])
            bon = {c: x[c] / nb for c in ADD}
            print(f"  {d:9} {x['fell_turns'] / max(1, x['fells']):10.1f} {x['fin'] / max(1, x['turns']):8.2f} {x['nb'] / max(1, x['turns']):10.2f} {x['fin'] / nb:11.2f}"
                  f"   {x['pr'] / nb:6.2f}   +{sum(bon.values()):.2f} ({bon['kin']:.2f} {bon['focus']:.2f} {bon['wheel']:.2f} {bon['weak']:.2f} {bon['setting']:.2f} {bon['base'] + bon['watch'] + bon['fx'] + bon['extra']:.2f})"
                  f"    {x['atk'] / nb:+.2f}   -{sum(x[c] for c in DEF) / nb:.2f}")
    if spar:
        Q = collect(spar, "dummy_spar")
        print(f"\nAgainst the sparring partner: rates, not wins (runs {', '.join(spar)}):")
        print(f"  {'people':9} {'dealt/turn':>10} {'taken/turn':>10} {'healed/turn':>11} {'net/turn':>8} {'turns/duel':>10}   its defence per blow taken (ward block resist armour mound shield halved aura)")
        for d, x in sorted(Q.items(), key=lambda kv: -(kv[1]["fin"] - kv[1]["taken"] + kv[1]["healed"]) / max(1, kv[1]["turns"])):
            t = max(1, x["turns"])
            dfn = x.get("_def", {})
            nb = max(1, dfn.get("n", 0))
            print(f"  {d:9} {x['fin'] / t:10.2f} {x['taken'] / t:10.2f} {x['healed'] / t:11.2f} {(x['fin'] - x['taken'] + x['healed']) / t:8.2f} {x['turns'] / max(1, x['duels']):10.1f}"
                  f"   {sum(dfn.get(c, 0) for c in DEF) / nb:.2f} (" + " ".join(f"{dfn.get(c, 0) / nb:.2f}" for c in DEF) + ")")

if __name__ == "__main__":
    main()
