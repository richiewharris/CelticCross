#!/usr/bin/env python3
"""Reads the rules cube (sim/roth/rulescube.ts): the game's numbers and their interactions, exact, no play.

  python3 sim/roth/cube/rules.py [<rules.csv.gz>] [--sql "<query over table r>"]

Without a file, the newest in sim/roth/cube/rules. Sections:
  1. wounds per blow, people against people (a later blow, no Shield, not rested, every setting, fighter and card),
     against the neutral dummy, and the interaction: the matchup minus the dummy baseline
  2. where each matchup's interaction comes from, step by step (bonuses added, defence taken off, halving, the aura)
  3. what 2 Shield keeps off each people's blows
  4. the other actions: rest, reuse, breaking a geis, the cry, sacrifice, summon: what each gives and costs
  5. the settings: wounds per blow at each, against the ford
"""
import glob
import os
import sys

import duckdb

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    a = sys.argv[1:]
    files = [x for x in a if x.endswith(".csv.gz")]
    f = files[0] if files else sorted(glob.glob(os.path.join(HERE, "rules", "*.csv.gz")))[-1]
    db = duckdb.connect()
    db.execute(f"CREATE TABLE r AS SELECT * FROM read_csv_auto('{f}')")
    # older files named the setting's bonus step "setting" too (read back as setting_1)
    cols = [c[0] for c in db.execute("describe r").fetchall()]
    if "setting_1" in cols:
        db.execute("ALTER TABLE r RENAME setting_1 TO setBonus")
    if "--sql" in a:
        q = a[a.index("--sql") + 1]
        cur = db.execute(q)
        print("  " + "  ".join(c[0] for c in cur.description))
        for row in cur.fetchall():
            print("  " + "  ".join(str(x) for x in row))
        return
    print(f"rules cube {os.path.basename(f)}: {db.execute('select count(*) from r').fetchone()[0]} cells\n")
    base = "action = 'use' AND struck = 1 AND first = 0 AND foeShield = 0 AND rested = 0"
    decks = [x[0] for x in db.execute("select distinct deck from r order by 1").fetchall()]
    foes = decks + ["dummy_spar"]
    m = {(d, fo): v for d, fo, v in db.execute(f"select deck, foeDeck, avg(final) from r where {base} group by 1, 2").fetchall()}
    print("1. Wounds per blow (row people striking the column people); last column the neutral dummy:")
    print("   " + " " * 9 + "".join(f"{x[:8]:>9}" for x in foes))
    for d in decks:
        print(f"   {d:9}" + "".join(f"{m.get((d, x), float('nan')):9.2f}" for x in foes))
    print("\n   The interaction: the matchup minus the people's blow against the dummy (what this foe adds or takes off):")
    print("   " + " " * 9 + "".join(f"{x[:8]:>9}" for x in decks))
    for d in decks:
        print(f"   {d:9}" + "".join(f"{m[(d, x)] - m[(d, 'dummy_spar')]:+9.2f}" for x in decks))
    steps = ["kin", "focus", "watch", "wheel", "weak", "setBonus", "atk", "ward", "block", "resist", "armour", "mound", "shield", "halved", "aura"]
    print("\n2. Where the interaction comes from: each step against this foe, less the same step against the dummy")
    print("   (+ helps the striker; the defence steps are shown as what they take off, so a + there means less is taken off)")
    S = {}
    for row in db.execute(f"select deck, foeDeck, {', '.join(f'avg({s})' for s in steps)} from r where {base} group by 1, 2").fetchall():
        S[(row[0], row[1])] = dict(zip(steps, row[2:]))
    for d in decks:
        for x in decks:
            diff = {s: (S[(d, x)][s] - S[(d, "dummy_spar")][s]) * (1 if s in ("kin", "focus", "watch", "wheel", "weak", "setBonus", "atk") else -1) for s in steps}
            big = sorted(((v, s) for s, v in diff.items() if abs(v) >= 0.15), key=lambda t: -abs(t[0]))
            if big:
                print(f"   {d:9} vs {x:9} {m[(d, x)] - m[(d, 'dummy_spar')]:+.2f}: " + ", ".join(f"{s} {v:+.2f}" for v, s in big))
    print("\n3. What 2 Shield keeps off each people's blows (later blow, every foe):")
    for d, v0, v2 in db.execute("select deck, avg(final) filter (where foeShield = 0), avg(final) filter (where foeShield = 2) from r where action = 'use' and struck = 1 and first = 0 and rested = 0 and foeDeck <> 'dummy_spar' group by 1 order by 1").fetchall():
        print(f"   {d:9} {v0:.2f} -> {v2:.2f}   Shield 2 is worth {v0 - v2:.2f} of 2")
    print("\n4. The other actions (later in the duel, no Shield, not rested; every foe):")
    print(f"   {'people':9} {'action':11} {'cells':>6} {'wounds':>7} {'own Valour':>10} {'foe Valour':>10} {'own Shield':>10} {'cards':>6}")
    for row in db.execute("""select deck, action, count(*), avg(final), avg(dSelf), avg(dFoe), avg(dSelfShield), avg(spent) from r
                              where first = 0 and foeShield = 0 and rested = 0 and foeDeck <> 'dummy_spar' group by 1, 2 order by 1, 2""").fetchall():
        print(f"   {row[0]:9} {row[1]:11} {row[2]:6} {row[3]:7.2f} {row[4]:+10.2f} {row[5]:+10.2f} {row[6]:+10.2f} {row[7]:6.2f}")
    print("\n5. Wounds per blow at each setting, less the ford (later blow, no Shield, every foe):")
    sets = [x[0] for x in db.execute("select distinct setting from r order by 1").fetchall()]
    W = {(d, s): v for d, s, v in db.execute(f"select deck, setting, avg(final) from r where {base} and foeDeck <> 'dummy_spar' group by 1, 2").fetchall()}
    print("   " + " " * 9 + "".join(f"{s[:8]:>9}" for s in sets if s != "ford"))
    for d in decks:
        print(f"   {d:9}" + "".join(f"{W[(d, s)] - W[(d, 'ford')]:+9.2f}" for s in sets if s != "ford"))


if __name__ == "__main__":
    main()
