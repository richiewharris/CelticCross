#!/usr/bin/env python3
"""Reads the rules cubes (sim/roth/rulescube.ts): the game's numbers and their interactions, exact, no play.

  python3 sim/roth/cube/rules.py [--dir sim/roth/cube/rules] [--sql "<query over p, s, sc, t, tc>"]

Tables: p the primary cube (every action from the static position), s the secondary (what one prior action changed
about the next, only what changed) with sc its counts (compared, changed), t the tertiary (what two priors together
changed beyond the sum of each, only where they did) with tc its counts.

A worth, in Valour, to the side acting: its Valour change less its foe's, Shield at 0.19 a point (its measured worth),
a Reserve card spent at half a point, a duel won at 10.

Primary:   1. wounds per blow, people against people, and the interaction with each foe (less the neutral dummy)
           2. where each interaction comes from, step by step
           3. every kind of action, and what it does at once
           4. the settings: wounds per blow at each, less the ford
           5. the supports: each one's worth for its people
Secondary: 6. which priors change the next choice, and how often
           7. the priors that change the next action's worth most (own and the foe's), and what they change
Tertiary:  8. how often two priors interact (are not the sum of each), by people, and the pairs that interact most
"""
import os
import sys

import duckdb

HERE = os.path.dirname(os.path.abspath(__file__))
def worth(p="", x="", fell=True):
    """An outcome's worth to the side acting, in Valour: its Valour change less its foe's, Shield at 0.19 a point, a
    Reserve card at half a point, a duel won (or lost) at 10. Columns {p}name{x}."""
    c = lambda n: f"\"{p}{n}{x}\""
    v = f"({c('dSelf')} - {c('dFoe')} + 0.19 * ({c('dSelfShield')} - {c('dFoeShield')}) - 0.5 * {c('spent')}"
    return v + (f" + 10 * ({c('end')} in (2, 3))::int - 10 * ({c('end')} in (1, 3))::int)" if fell else ")")


def main():
    a = sys.argv[1:]
    opt = lambda f, d=None: a[a.index(f) + 1] if f in a else d
    d = opt("--dir", os.path.join(HERE, "rules"))
    db = duckdb.connect()
    have = set()
    for name, tab in (("primary", "p"), ("secondary", "s"), ("secondary.counts", "sc"), ("tertiary", "t"), ("tertiary.counts", "tc")):
        f = os.path.join(d, f"{name}.csv.gz")
        if os.path.exists(f):
            db.execute(f"CREATE TABLE {tab} AS SELECT * FROM read_csv_auto('{f}', sample_size=-1, all_varchar=false, types={{'card': 'VARCHAR', 'mode': 'VARCHAR', 'as': 'VARCHAR', 'cry': 'VARCHAR'}})" if tab == "p" else
                       f"CREATE TABLE {tab} AS SELECT * FROM read_csv_auto('{f}', sample_size=-1)")
            have.add(tab)
    q = lambda s: db.execute(s).fetchall()
    if "--sql" in a:
        cur = db.execute(opt("--sql"))
        print("  " + "  ".join(c[0] for c in cur.description))
        for row in cur.fetchall():
            print("  " + "  ".join(str(x) for x in row))
        return
    if "p" in have:
        primary(q)
    if "s" in have:
        secondary(q)
    if "t" in have:
        tertiary(q)


def primary(q):
    n = q("select count(*) from p")[0][0]
    print(f"PRIMARY: {n} actions, every one from the static position (later in a duel, full Valour, no Shield)\n")
    blow = "setting = 'ford' AND action = 'use' AND struck = 1 AND cry IS NULL AND mode = 'normal'"
    decks = [x[0] for x in q("select distinct foeDeck from p where foeDeck not like 'dummy%' order by 1")]
    foes = decks + ["dummy_spar"]
    m = {(x, y): v for x, y, v in q(f"select deck, foeDeck, avg(wound) from p where {blow} group by 1, 2")}
    print("1. Wounds per blow at the ford (row people striking the column people); last column the neutral dummy:")
    print("   " + " " * 9 + "".join(f"{x[:8]:>9}" for x in foes))
    for x in decks:
        print(f"   {x:9}" + "".join(f"{m.get((x, y), float('nan')):9.2f}" for y in foes))
    print("\n   The interaction: the matchup less the people's blow against the dummy:")
    print("   " + " " * 9 + "".join(f"{x[:8]:>9}" for x in decks))
    for x in decks:
        print(f"   {x:9}" + "".join(f"{m.get((x, y), 0) - m.get((x, 'dummy_spar'), 0):+9.2f}" for y in decks))
    steps = ["kin", "focus", "watch", "wheel", "weak", "atk", "ward", "block", "resist", "armour", "mound", "shield", "halved", "aura"]
    up = ("kin", "focus", "watch", "wheel", "weak", "atk")
    S = {(r[0], r[1]): dict(zip(steps, r[2:])) for r in q(f"select deck, foeDeck, {', '.join(f'avg({s})' for s in steps)} from p where {blow} group by 1, 2")}
    print("\n2. Where each interaction comes from (each step against this foe less against the dummy; + helps the striker):")
    for x in decks:
        for y in decks:
            if (x, y) not in S or (x, "dummy_spar") not in S:
                continue
            diff = {s: (S[(x, y)][s] - S[(x, "dummy_spar")][s]) * (1 if s in up else -1) for s in steps}
            big = sorted(((v, s) for s, v in diff.items() if abs(v) >= 0.15), key=lambda t: -abs(t[0]))
            if big:
                print(f"   {x:9} vs {y:9} {m[(x, y)] - m[(x, 'dummy_spar')]:+.2f}: " + ", ".join(f"{s} {v:+.2f}" for v, s in big))
    print("\n3. Every kind of action at the ford (every fighter; each foe people weighted alike): its worth, and its parts")
    kind = """case when action = 'card' then 'card: ' || case when card like 'g\\_%' escape '\\' then 'geis' when card like 'v\\_%' escape '\\' then 'oath'
                   when card like 'o\\_%' escape '\\' then 'omen' when card like 'a\\_%' escape '\\' then 'attendant' else 'other' end
              when action = 'use' and cry = 'cry' then 'the cry' when mode = 'break' then action || ', breaking' when action = 'use' and struck = 1 then 'use: a blow'
              when action = 'use' then 'use: no blow' else action end"""
    print(f"   {'people':9} {'action':16} {'n':>7} {'worth':>7} {'own V':>7} {'foe V':>7} {'own Sh':>7} {'foe Sh':>7} {'cards':>6}  any effect")
    # each foe people counts once (the Slúagh's hundred host pairings would outweigh the rest)
    for r in q(f"""with x as (select deck, {kind} k, foeDeck, count(*) n, avg({worth()}) w, avg(dSelf) a, avg(dFoe) b, avg(dSelfShield) c, avg(dFoeShield) d, avg(spent) e,
                   avg((dSelf <> 0 or dFoe <> 0 or dSelfShield <> 0 or dFoeShield <> 0 or spent <> 0)::int) f
                   from p where setting = 'ford' and foeDeck <> 'dummy_spar' group by 1, 2, 3)
                   select deck, k, sum(n), avg(w), avg(a), avg(b), avg(c), avg(d), avg(e), avg(f) from x group by 1, 2 order by 1, 2"""):
        print(f"   {r[0]:9} {r[1]:16} {r[2]:7} {r[3]:+7.2f} {r[4]:+7.2f} {r[5]:+7.2f} {r[6]:+7.2f} {r[7]:+7.2f} {r[8]:6.2f}  {100 * r[9]:4.0f}%")
    sets = [x[0] for x in q("select distinct setting from p order by 1")]
    W = {(x, s): v for x, s, v in q(f"select deck, setting, avg(wound) from p where {blow.replace(chr(39) + 'ford' + chr(39), 'setting')} and foeDeck <> 'dummy_spar' group by 1, 2")}
    print("\n4. Wounds per blow at each setting, less the ford (every foe):")
    print("   " + " " * 9 + "".join(f"{s[:8]:>9}" for s in sets if s != "ford"))
    for x in decks:
        print(f"   {x:9}" + "".join(f"{W.get((x, s), 0) - W.get((x, 'ford'), 0):+9.2f}" for s in sets if s != "ford"))
    print("\n5. The supports: each one's worth at the ford for its people (every fighter of theirs, every foe), best and worst five:")
    for x in decks:
        rows = q(f"""select card, avg({worth()}) w, avg(wound) filter (where struck = 1) from p where deck = '{x}' and setting = 'ford' and action = 'use'
                     and mode = 'normal' and cry is null and foeDeck <> 'dummy_spar' group by 1 order by 2 desc""")
        fmt = lambda r: f"{r[0]} {r[1]:+.1f}"
        print(f"   {x:9} best: {', '.join(fmt(r) for r in rows[:5])}")
        print(f"   {'':9} worst: {', '.join(fmt(r) for r in rows[-5:])}")


def secondary(q):
    tot = q("select sum(compared), sum(changed) from sc")[0]
    print(f"\nSECONDARY: {tot[0]} next actions compared after a prior; {tot[1]} changed ({100 * tot[1] / tot[0]:.1f}%)\n")
    print("6. Which priors change the next choice (share of next actions whose outcome or availability changed):")
    print(f"   {'prior':8} {'prior action':13} {'next action':12} {'compared':>10} {'changed':>8}")
    for r in q("select kind, priorAction, action, sum(compared), sum(changed) from sc group by 1, 2, 3 order by 1, 2, 3"):
        print(f"   {r[0]:8} {r[1]:13} {r[2]:12} {r[3]:10} {100 * r[4] / r[3]:7.1f}%")
    print("\n   By people (the side choosing next): changed after its own prior / after the foe's")
    for r in q("""select deck, 100.0 * sum(changed) filter (where kind = 'own') / sum(compared) filter (where kind = 'own'),
                  100.0 * sum(changed) filter (where kind = 'foe') / sum(compared) filter (where kind = 'foe'),
                  100.0 * sum(changed) filter (where kind = 'beside') / sum(compared) filter (where kind = 'beside') from sc group by 1 order by 1"""):
        print(f"   {r[0]:9} own {r[1]:5.1f}%   foe's {r[2]:5.1f}%   a card beside {r[3] or 0:5.1f}%")
    w0, w1 = worth(x="0", fell=False), worth(fell=False)
    fell = "(\"end\" in (2, 3))::int - (end0 in (2, 3))::int"
    print("\n7. The priors that change the next action most: the mean change in its worth in Valour (a duel won apart),")
    print("   the change in how often it fells the foe, over the next actions open before and after (the dummy apart),")
    print("   and how many next actions the prior closes or opens. Own priors set up the next action; the foe's must be answered.")
    for kind in ("own", "foe"):
        rows = q(f"""with x as (select deck, prior, avg(({w1}) - ({w0})) filter (where avail = 'both') dw, avg({fell}) filter (where avail = 'both') df,
                     count(*) filter (where avail = 'lost') lost, count(*) filter (where avail = 'gained') gained, count(*) filter (where avail = 'both') n
                     from s where kind = '{kind}' and foeDeck <> 'dummy_spar' group by 1, 2)
                     select deck, prior, dw, df, n, lost, gained from x where dw is not null and n >= 200 order by abs(dw) desc limit 25""")
        print(f"\n   {kind}:")
        for r in rows:
            print(f"   {r[0]:9} {r[1][:38]:38} worth {r[2]:+6.2f}  fells {100 * r[3]:+5.1f}%  (n {r[4]:6})  closes {r[5]:6}  opens {r[6]:6}")
    print("\n   What the foe's rest changes (by the people striking next): next worth, and the wound")
    for r in q(f"""select deck, avg(({w1}) - ({w0})), avg(wound - wound0) filter (where struck = 1 and struck0 = 1) from s
                  where kind = 'foe' and prior like 'rest:%normal%' and avail = 'both' and foeDeck <> 'dummy_spar' group by 1 order by 1"""):
        print(f"   {r[0]:9} {r[1]:+.2f} worth, {r[2] or 0:+.2f} wound")


def tertiary(q):
    c = q("select sum(compared), sum(interacting) from tc")[0]
    print(f"\nTERTIARY: {c[0]} next actions after an own action and the foe's reply; {c[1]} where the two interact ({100 * c[1] / c[0]:.2f}%):")
    print("   the rest are exactly the sum of what each prior changes alone (the secondary cube).")
    for r in q("select deck, 100.0 * sum(interacting) / sum(compared) from tc group by 1 order by 1"):
        print(f"   {r[0]:9} {r[1]:5.2f}% interact")
    iw = worth(p="i_", fell=False)
    print("\n8. The pairs (own action, the foe's reply) whose interaction moves the next action most (in Valour, a duel won")
    print("   apart; the dummy apart), with how often the interaction is a duel won or saved:")
    for r in q(f"""select deck, own, reply, count(*), avg({iw}), avg((i_end <> 0)::int) from t where foeDeck <> 'dummy_spar'
                   group by 1, 2, 3 having count(*) >= 20 order by abs(avg({iw})) desc limit 30"""):
        print(f"   {r[0]:9} {r[1][:30]:30} then {r[2][:30]:30} x{r[3]:5}  {r[4]:+.2f}  ended {100 * r[5]:3.0f}%")
    print("\n   Which steps interact (mean |interaction| per field, over the interacting rows):")
    fs = ["dSelf", "dFoe", "dSelfShield", "dFoeShield", "spent", "wound", "struck", "end", "broke"]
    r = q("select " + ", ".join(f"avg(abs(\"i_{f}\"))" for f in fs) + " from t")[0]
    print("   " + ", ".join(f"{f} {v:.2f}" for f, v in zip(fs, r)))


if __name__ == "__main__":
    main()
