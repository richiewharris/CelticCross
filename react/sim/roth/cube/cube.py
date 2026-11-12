#!/usr/bin/env python3
"""The Roth Catha balance cube: every simulated match, sliceable at once.

Each balance run (sim/roth/balance.ts) writes one row per match to sim/roth/cube/data. This tool loads a run (with
the untouched matches of its base runs filled in) into DuckDB as four tables, and answers questions about it:

  matches  one row per match: run, a, b (the pairing), i, p1, p2 (decks by seat), setting, winner (0/1/-1), decided_by
  sides    one row per match and seat: deck, foe, seat (1/2), chose (did this seat choose the setting), score (1, ½, 0),
           felled_for (enemy heroes it felled), felled_against (its own heroes felled), turns
  ledger   one row per match, seat and ledger entry: kind (deal / save / heal / deny / cost / shield / ...), source, value
  present  one row per match, seat and card that was on the board or used: card, how (draft / supplant / used / geis / oath)

Commands (run from react/):
  python3 sim/roth/cube/cube.py runs                      list the runs in the cube
  python3 sim/roth/cube/cube.py table <run>               the score matrix, the field and the seats
  python3 sim/roth/cube/cube.py seats <run>               each deck as first and as second player, by setting
  python3 sim/roth/cube/cube.py worth <run> [deck]        each deck's worth per match by source (the PER view)
  python3 sim/roth/cube/cube.py sql <run> "<query>"       any query over the four tables
  python3 sim/roth/cube/cube.py compare <run> <run>       the field and the seats, side by side

<run> may be a run id, a unique prefix of one, or "latest".
"""
import gzip
import json
import os
import sys

import duckdb

DATA = os.environ.get("ROTH_CUBE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def metas():
    out = []
    if not os.path.isdir(DATA):
        return out
    for f in os.listdir(DATA):
        if f.endswith(".meta.json"):
            with open(os.path.join(DATA, f)) as fh:
                out.append(json.load(fh))
    return sorted(out, key=lambda m: m["created"])


def resolve(run):
    ms = metas()
    if not ms:
        sys.exit("the cube is empty: run sim/roth/balance.ts first")
    if run == "latest":
        return ms[-1]
    hits = [m for m in ms if m["id"].startswith(run)]
    if len(hits) != 1:
        sys.exit(f"{'no' if not hits else 'more than one'} run matches {run!r}")
    return hits[0]


def reached(touch, row):
    """Does a change with this touch reach this match? (the same test balance.ts applies before playing it)"""
    if not touch:
        return True
    if any(d in (row["a"], row["b"]) for d in touch.get("deck") or []):
        return True
    return row.get("setting") in (touch.get("setting") or [])


def rows_of(meta):
    """The run's rows, with the matches it didn't play taken from its base (and that base's base...)."""
    with gzip.open(os.path.join(DATA, meta["id"] + ".jsonl.gz"), "rt") as fh:
        own = [json.loads(l) for l in fh if l.strip()]
    for r in own:
        r["run"] = meta["id"]
    if not meta.get("base"):
        return own
    base = [r for r in rows_of(resolve(meta["base"])) if not reached(meta.get("touch"), r)]
    return base + own


def load(run):
    meta = resolve(run)
    rows = rows_of(meta)
    db = duckdb.connect()
    m, s, l, p = [], [], [], []
    for r in rows:
        key = (r["run"], r["a"], r["b"], r["i"])
        m.append((*key, r["p1"], r["p2"], r.get("setting"), r["w"], r["by"]))
        for seat in (0, 1):
            deck, foe = (r["p1"], r["p2"]) if seat == 0 else (r["p2"], r["p1"])
            score = 0.5 if r["w"] == -1 else (1.0 if r["w"] == seat else 0.0)
            s.append((*key, seat + 1, deck, foe, seat == 1, score, r["felled"][1 - seat], r["felled"][seat], sum(r.get("exchanges") or [])))
            for k, v in (r.get("ledger") or {}).items():
                kind, _, src = k.partition(":")
                if v[seat]:
                    l.append((*key, seat + 1, kind, src, float(v[seat])))
        for x in r.get("placed") or []:
            p.append((*key, x["side"] + 1, x["id"], x.get("how", "draft")))
        for x in r.get("used") or []:
            p.append((*key, x["side"] + 1, x["id"], "used"))
        for x in r.get("bound") or []:
            p.append((*key, x["side"] + 1, x["id"], "geis"))
        for x in r.get("sworn") or []:
            p.append((*key, x["side"] + 1, x["id"], "oath"))
    K = "run VARCHAR, a VARCHAR, b VARCHAR, i INTEGER"
    db.execute(f"CREATE TABLE matches ({K}, p1 VARCHAR, p2 VARCHAR, setting VARCHAR, winner INTEGER, decided_by VARCHAR)")
    db.execute(f"CREATE TABLE sides ({K}, seat INTEGER, deck VARCHAR, foe VARCHAR, chose BOOLEAN, score DOUBLE, felled_for INTEGER, felled_against INTEGER, turns INTEGER)")
    db.execute(f"CREATE TABLE ledger ({K}, seat INTEGER, kind VARCHAR, source VARCHAR, value DOUBLE)")
    db.execute(f"CREATE TABLE present ({K}, seat INTEGER, card VARCHAR, how VARCHAR)")
    # bulk load: hand each table to DuckDB as a CSV in one go (row-by-row inserts take minutes)
    import csv, tempfile
    with tempfile.TemporaryDirectory() as tmp:
        for name, data in (("matches", m), ("sides", s), ("ledger", l), ("present", p)):
            if not data:
                continue
            f = os.path.join(tmp, name + ".csv")
            with open(f, "w", newline="") as fh:
                csv.writer(fh).writerows(data)
            db.execute(f"INSERT INTO {name} SELECT * FROM read_csv('{f}', header = false, nullstr = '')")
    return meta, db


def show(db, q, params=None):
    cur = db.execute(q, params or [])
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    fmt = lambda v: f"{v:.1f}" if isinstance(v, float) else ("" if v is None else str(v))
    cells = [cols] + [[fmt(v) for v in r] for r in rows]
    w = [max(len(c[j]) for c in cells) for j in range(len(cols))]
    for k, r in enumerate(cells):
        print("  " + "  ".join(c.ljust(w[j]) if j == 0 else c.rjust(w[j]) for j, c in enumerate(r)))
        if k == 0:
            print("  " + "  ".join("-" * x for x in w))


def field(db):
    """Each deck against the field: the mean of its scores against each other deck (mirrors left out)."""
    return db.execute("""
        WITH vs AS (SELECT deck, foe, avg(score) s FROM sides WHERE deck <> foe GROUP BY deck, foe)
        SELECT deck, 100 * avg(s) FROM vs GROUP BY deck ORDER BY deck""").fetchall()


def cmd_table(run):
    meta, db = load(run)
    decks = [r[0] for r in db.execute("SELECT DISTINCT deck FROM sides ORDER BY deck").fetchall()]
    n = db.execute("SELECT count(*) FROM matches").fetchone()[0]
    print(f"run {meta['id']}  ({n} matches; rules {json.dumps(meta['rules'])}; engine {meta['engine']}{'; on top of ' + meta['base'] if meta.get('base') else ''})")
    cols = ", ".join(f"round(100 * avg(score) FILTER (WHERE foe = '{d}'), 1) AS {d}" for d in decks)
    print("\nScore of the row deck against the column deck (seats swapped evenly; mirrors: the second player's score):")
    show(db, f"SELECT deck, {cols} FROM sides WHERE deck <> foe OR seat = 2 GROUP BY deck ORDER BY deck")
    print("\nAgainst the field:")
    for d, v in field(db):
        print(f"  {d:9} {v:5.1f}%")
    p1 = db.execute("SELECT 100 * avg(score) FROM sides WHERE seat = 1").fetchone()[0]
    print(f"\nFirst player {p1:.1f}%")


def cmd_seats(run):
    _, db = load(run)
    print("Each deck as first and as second player (the second chooses the setting):")
    show(db, """SELECT deck, round(100 * avg(score) FILTER (WHERE seat = 1), 1) AS first, round(100 * avg(score) FILTER (WHERE seat = 2), 1) AS second
                FROM sides WHERE deck <> foe GROUP BY deck ORDER BY deck""")
    print("\nThe settings chosen, and how the chooser did:")
    show(db, """SELECT s.deck AS chooser, m.setting, count(*) AS matches, round(100 * avg(s.score), 1) AS score
                FROM sides s JOIN matches m USING (run, a, b, i) WHERE s.seat = 2 AND s.deck <> s.foe
                GROUP BY s.deck, m.setting ORDER BY s.deck, matches DESC""")


def cmd_worth(run, deck=None):
    _, db = load(run)
    where = "WHERE s.deck <> s.foe" + (f" AND s.deck = '{deck}'" if deck else "")
    print("Worth per match against the field, by kind (deal + save + heal + deny − cost = net):")
    show(db, f"""
        WITH per AS (SELECT s.deck, s.run, s.a, s.b, s.i, s.seat,
                       sum(CASE WHEN l.kind = 'deal' THEN l.value ELSE 0 END) d, sum(CASE WHEN l.kind = 'save' THEN l.value ELSE 0 END) sv,
                       sum(CASE WHEN l.kind = 'heal' THEN l.value ELSE 0 END) h, sum(CASE WHEN l.kind = 'deny' THEN l.value ELSE 0 END) dn,
                       sum(CASE WHEN l.kind = 'cost' THEN l.value ELSE 0 END) c
                     FROM sides s LEFT JOIN ledger l USING (run, a, b, i, seat) {where} GROUP BY ALL)
        SELECT deck, avg(d) dealt, avg(sv) prevented, avg(h) healed, avg(dn) denied, avg(c) paid, avg(d + sv + h + dn - c) net FROM per GROUP BY deck ORDER BY deck""")
    print("\nTop sources per match (shield raised counts as raised, not as soaked):")
    show(db, f"""
        WITH n AS (SELECT deck, count(*) n FROM sides s {where} GROUP BY deck)
        SELECT s.deck, l.source, round(sum(CASE WHEN l.kind = 'cost' THEN -l.value ELSE l.value END) / any_value(n.n), 2) AS per_match
        FROM sides s JOIN ledger l USING (run, a, b, i, seat) JOIN n USING (deck) {where} AND l.kind IN ('deal', 'save', 'heal', 'deny', 'cost')
        GROUP BY s.deck, l.source QUALIFY row_number() OVER (PARTITION BY s.deck ORDER BY per_match DESC) <= 8 ORDER BY s.deck, per_match DESC""")


def cmd_sql(run, q):
    _, db = load(run)
    show(db, q)


def cmd_compare(r1, r2):
    out = {}
    for r in (r1, r2):
        meta, db = load(r)
        out[meta["id"]] = (dict(field(db)), db.execute("SELECT 100 * avg(score) FROM sides WHERE seat = 1").fetchone()[0])
    (i1, (f1, p1)), (i2, (f2, p2)) = out.items()
    print(f"  {'deck':9} {i1:>22} {i2:>22}  change")
    for d in sorted(f1):
        print(f"  {d:9} {f1[d]:21.1f}% {f2.get(d, float('nan')):21.1f}%  {f2.get(d, 0) - f1[d]:+.1f}")
    print(f"  {'first':9} {p1:21.1f}% {p2:21.1f}%  {p2 - p1:+.1f}")


def cmd_runs():
    for m in metas():
        print(f"{m['id']}  {m['matches']:5} matches  engine {m['engine']}  rules {json.dumps(m['rules'])}" + (f"  base {m['base']} touch {json.dumps(m['touch'])}" if m.get("base") else ""))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
    elif a[0] == "runs":
        cmd_runs()
    elif a[0] == "table":
        cmd_table(a[1] if len(a) > 1 else "latest")
    elif a[0] == "seats":
        cmd_seats(a[1] if len(a) > 1 else "latest")
    elif a[0] == "worth":
        cmd_worth(a[1] if len(a) > 1 else "latest", a[2] if len(a) > 2 else None)
    elif a[0] == "sql":
        cmd_sql(a[1], a[2])
    elif a[0] == "compare":
        cmd_compare(a[1], a[2])
    else:
        sys.exit(__doc__)
