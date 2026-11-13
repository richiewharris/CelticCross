#!/usr/bin/env python3
"""Reads the rules cube (sim/roth/rulescube.ts): the game's numbers and their interactions, exact, no play, chained
into primary, secondary and tertiary actions.

  python3 sim/roth/cube/rules.py [<id>] [--settings <id>] [--extras <id>] [--sql "<query over tables p (positions), a (actions)>"]

<id> is a cube in sim/roth/cube/rules (<id>.pos.csv.gz and <id>.act.csv.gz); without one, the newest chained cube.
--settings: a cube over every setting (default: settings-d1, if there); --extras: one with the shield, low-Valour and
geis situations (default: extras-d1, if there).

Sections:
  1. wounds per blow, people against people (later in a duel, no Shield, every fighter, card and foe card), and the
     interaction: the matchup less the people's blow against the neutral dummy
  2. where each interaction comes from, step by step
  3. what 2 Shield keeps off each people's blows (extras)
  4. every kind of action: what it gives and costs, in Valour (rest, the cry, a geis broken, sacrifice, summon, a draw)
  5. lines: the best action alone, against the best reply, and with the best follow-up; what the reply takes back
  6. the depth of the choices, by matchup: how often looking further changes the best first action, and how many
     options there are
  7. the settings: wounds per blow at each, less the ford
"""
import glob
import os
import sys

import duckdb

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules")


def load(db, cid, pre):
    db.execute(f"CREATE TABLE {pre}p AS SELECT * FROM read_csv_auto('{os.path.join(HERE, cid)}.pos.csv.gz', sample_size=-1, types={{'pos': 'VARCHAR', 'best': 'VARCHAR'}})")
    db.execute(f"CREATE TABLE {pre}a AS SELECT * FROM read_csv_auto('{os.path.join(HERE, cid)}.act.csv.gz', sample_size=-1, types={{'pos': 'VARCHAR', 'next': 'VARCHAR', 'sig': 'VARCHAR', 'reply': 'VARCHAR', 'card': 'VARCHAR'}})")


def main():
    a = sys.argv[1:]
    opt = lambda f, d=None: a[a.index(f) + 1] if f in a else d
    plain = [x for x in a if not x.startswith("--") and (a.index(x) == 0 or not a[a.index(x) - 1].startswith("--"))]
    cubes = sorted(os.path.basename(f)[:-11] for f in glob.glob(os.path.join(HERE, "*.act.csv.gz")))
    main_id = plain[0] if plain else [c for c in cubes if not c.startswith(("settings", "extras"))][-1]
    sid = opt("--settings", "settings-d1" if "settings-d1" in cubes else None)
    xid = opt("--extras", "extras-d1" if "extras-d1" in cubes else None)
    db = duckdb.connect()
    load(db, main_id, "")
    if "--sql" in a:
        cur = db.execute(opt("--sql"))
        print("  " + "  ".join(c[0] for c in cur.description))
        for row in cur.fetchall():
            print("  " + "  ".join(str(x) for x in row))
        return
    q = lambda s: db.execute(s).fetchall()
    n_p, n_a = q("select count(*) from p")[0][0], q("select count(*) from a")[0][0]
    print(f"rules cube {main_id}: {n_p} positions, {n_a} actions")
    for d, n, k in q("select p.depth, count(distinct p.pos), count(*) from p join a using (pos) group by 1 order by 1"):
        print(f"  depth {d} ({['primary', 'secondary', 'tertiary', 'deeper'][min(d, 3)]}): {n} positions, {k} actions ({k / n:.2f} each)")
    print()
    blow = "p.depth = 0 AND p.situation = 'later' AND a.action = 'use' AND a.struck = 1 AND a.cry = 0 AND a.mode = 'normal'"
    decks = [x[0] for x in q("select distinct deck from p where depth = 0 and deck not like 'dummy%' order by 1")]
    foes = decks + ["dummy_spar"]
    m = {(d, f): v for d, f, v in q(f"select p.deck, p.foeDeck, avg(a.final) from p join a using (pos) where {blow} group by 1, 2")}
    print("1. Wounds per blow (row people striking the column people, later in the duel, no Shield); last column the neutral dummy:")
    print("   " + " " * 9 + "".join(f"{x[:8]:>9}" for x in foes))
    for d in decks:
        print(f"   {d:9}" + "".join(f"{m.get((d, x), float('nan')):9.2f}" for x in foes))
    print("\n   The interaction: the matchup less the people's blow against the dummy (what this foe adds or takes off):")
    print("   " + " " * 9 + "".join(f"{x[:8]:>9}" for x in decks))
    for d in decks:
        print(f"   {d:9}" + "".join(f"{m.get((d, x), 0) - m.get((d, 'dummy_spar'), 0):+9.2f}" for x in decks))
    steps = ["kin", "focus", "watch", "wheel", "weak", "setBonus", "atk", "ward", "block", "resist", "armour", "mound", "shield", "halved", "aura"]
    up = ("kin", "focus", "watch", "wheel", "weak", "setBonus", "atk")
    print("\n2. Where the interaction comes from: each step against this foe, less the same step against the dummy")
    print("   (+ helps the striker; a defence step shows what it takes off, as a minus)")
    S = {}
    for row in q(f"select p.deck, p.foeDeck, {', '.join(f'avg(a.{s})' for s in steps)} from p join a using (pos) where {blow} group by 1, 2"):
        S[(row[0], row[1])] = dict(zip(steps, row[2:]))
    for d in decks:
        for x in decks:
            if (d, x) not in S or (d, "dummy_spar") not in S:
                continue
            diff = {s: (S[(d, x)][s] - S[(d, "dummy_spar")][s]) * (1 if s in up else -1) for s in steps}
            big = sorted(((v, s) for s, v in diff.items() if abs(v) >= 0.15), key=lambda t: -abs(t[0]))
            if big:
                print(f"   {d:9} vs {x:9} {m[(d, x)] - m[(d, 'dummy_spar')]:+.2f}: " + ", ".join(f"{s} {v:+.2f}" for v, s in big))
    if xid:
        load(db, xid, "x")
        print(f"\n3. What 2 Shield keeps off each people's blows ({xid}: later in the duel, every foe):")
        for d, v0, v2 in q("""select p.deck, avg(a.final) filter (where p.situation = 'later'), avg(a.final) filter (where p.situation = 'shield')
                              from xp p join xa a using (pos) where p.depth = 0 and a.action = 'use' and a.struck = 1 and a.cry = 0 and a.mode = 'normal'
                              and p.foeDeck <> 'dummy_spar' group by 1 order by 1"""):
            if v0 is not None and v2 is not None:
                print(f"   {d:9} {v0:.2f} -> {v2:.2f}   Shield 2 is worth {v0 - v2:.2f} of 2")
    print("\n4. Every kind of action (later in the duel, at full Valour unless low; every foe): its worth in Valour to the side")
    print("   taking it (Valour swing, Shield at its measured worth, a card spent at half a point, a duel ended at 20), and its parts")
    print(f"   {'people':9} {'action':16} {'n':>6} {'worth':>7} {'own V':>7} {'foe V':>7} {'own Sh':>7} {'cards':>6}")
    kind = """case when a.action = 'use' and a.cry = 1 then 'the cry' when a.action = 'use' and a.mode = 'break' then 'use, breaking' when a.action = 'rest' and a.mode = 'break' then 'rest, breaking'
              else a.action end"""
    tabs = [("", "p.situation = 'later'")] + ([("x", "p.situation in ('low') or p.situation like 'geis:%'")] if xid else [])
    for pre, cond in tabs:
        for row in q(f"""select p.deck, {kind} || case when p.situation = 'low' then ' (low)' else '' end, count(*), avg(a.value), avg(a.dSelf), avg(a.dFoe), avg(a.dSelfShield), avg(a.spent)
                         from {pre}p p join {pre}a a using (pos) where p.depth = 0 and {cond} and p.foeDeck <> 'dummy_spar' group by 1, 2 order by 1, 2"""):
            print(f"   {row[0]:9} {row[1]:16} {row[2]:6} {row[3]:+7.2f} {row[4]:+7.2f} {row[5]:+7.2f} {row[6]:+7.2f} {row[7]:6.2f}")
    print("\n   A draw (the card off the Reserve played at once, by the deck's count; against the best board action there):")
    for d, v, b in q("""select regexp_extract(pos, 'draw:([a-z_]+)', 1), avg(value), avg(line2) from a where action = 'draw' and pos like '%/later/%' group by 1 order by 1"""):
        print(f"   {d:9} a draw is worth {v:+.2f} (with the foe's best reply: {b:+.2f})")
    print("\n5. Lines (the duel's first blow and later): the best action alone; against the foe's best reply; with the best")
    print("   follow-up. What the reply takes back is the first less the second.")
    print(f"   {'people':9} {'situation':9} {'alone':>7} {'+reply':>7} {'+follow':>8} {'takes back':>10}")
    for d, sit, l1, l2, l3 in q("""select deck, situation, avg(line1), avg(line2), avg(line3) from p where depth = 0 and foeDeck <> 'dummy_spar' group by 1, 2 order by 1, 2"""):
        print(f"   {d:9} {sit:9} {l1:+7.2f} {l2:+7.2f} {l3:+8.2f} {l1 - l2:10.2f}")
    print("\n6. The depth of the choices, by matchup (row people choosing, at the duel's start and later): how often the best")
    print("   first action changes when the look goes one action further (alone -> with the reply) and two (-> with the")
    print("   follow-up), and the options there are. A matchup where the look changes the choice often is a deep one.")
    print("   (A line that ends on the chooser's own action favours keeping the big blow for last: the line can't see the")
    print("   card still waiting after it. So 'at 3' runs high; it is the horizon the search's leaf judgement must cover.)")
    best = """with o as (select a.pos, arg_max(a.sig, a.value) b1, arg_max(a.sig, a.line2) b2, arg_max(a.sig, a.line3) b3, count(*) k from a group by 1)
              select p.deck, p.foeDeck, avg((o.b1 <> o.b2)::int), avg((o.b1 <> o.b3)::int), avg(o.k) from p join o using (pos)
              where p.depth = 0 and p.foeDeck <> 'dummy_spar' group by 1, 2"""
    B = {(d, f): (c2, c3, k) for d, f, c2, c3, k in q(best)}
    print("   changed at 2 / at 3 (options)")
    print("   " + " " * 9 + "".join(f"{x[:8]:>17}" for x in decks))
    for d in decks:
        print(f"   {d:9}" + "".join(f"  {100 * B[(d, x)][0]:3.0f}% {100 * B[(d, x)][1]:3.0f}% ({B[(d, x)][2]:.1f})" if (d, x) in B else " " * 17 for x in decks))
    if sid:
        load(db, sid, "s")
        print(f"\n7. Wounds per blow at each setting, less the ford ({sid}: later in the duel, no Shield, every foe):")
        sets = [x[0] for x in q("select distinct setting from sp order by 1")]
        W = {(d, s): v for d, s, v in q(f"""select p.deck, p.setting, avg(a.final) from sp p join sa a using (pos) where {blow} and p.foeDeck <> 'dummy_spar' group by 1, 2""")}
        print("   " + " " * 9 + "".join(f"{s[:8]:>9}" for s in sets if s != "ford"))
        for d in decks:
            print(f"   {d:9}" + "".join(f"{W.get((d, s), 0) - W.get((d, 'ford'), 0):+9.2f}" for s in sets if s != "ford"))


if __name__ == "__main__":
    main()
