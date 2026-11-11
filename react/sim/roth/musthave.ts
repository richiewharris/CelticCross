// Which cards does each deck lean on? PER-style worth from a balance.ts --dump file (or any file in that form).
//   npx tsx sim/roth/musthave.ts recs.jsonl
// For each deck: its worth per match (Valour points: dealt + prevented + healed + denied − paid), how much of it each
// card carries (its share), the card's worth per match it was out (PER), how often it was out, and the deck's score
// with and without it when it was sometimes missing. A card carrying a large share of its deck is a must-have.
import { readFileSync } from "node:fs";
import { ALL_DEFS } from "../../src/games/roth/engine/cards";

type L = Record<string, [number, number]>;
interface R { a: string; b: string; aSide: 0 | 1; w: number; ledger: L; placed: { side: number; id: string }[]; used: { side: number; id: string }[] }
const recs: R[] = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => JSON.parse(l));
const CATS = ["deal", "save", "heal", "deny", "cost"];

/** One side's worth per source in one match (Shield shared out to the cards that raised it by how much soaked). */
function worth(r: R, side: 0 | 1): Map<string, number> {
  const L = r.ledger ?? {}, W = new Map<string, number>();
  const add = (id0: string, v: number) => { if (!v) return; const id = /^(hero|ward):[a-z_]+:/.test(id0) ? "people:host" : id0; W.set(id, (W.get(id) ?? 0) + v); };
  let raised = 0;
  for (const [k, v] of Object.entries(L)) if (k.startsWith("shield:")) raised += v[side];
  const soaked = L["save:shield"]?.[side] ?? 0;
  for (const [k, v] of Object.entries(L)) {
    const i = k.indexOf(":"), kind = k.slice(0, i), id = k.slice(i + 1), x = v[side];
    if (!x) continue;
    if (kind === "shield") add(id, raised ? (x * soaked) / raised : 0);
    else if (k === "save:shield") { if (!raised) add("shield", x); }
    else if (CATS.includes(kind)) add(id, kind === "cost" ? -x : x);
  }
  return W;
}
const isCard = (id: string) => !!ALL_DEFS[id] && ALL_DEFS[id].type === "support";

interface D { n: number; win: number; total: number; cards: Map<string, { v: number; present: number; winP: number }>; other: number }
const decks = new Map<string, D>();
for (const r of recs) {
  if (r.a === r.b) continue;
  for (const side of [0, 1] as const) {
    const d = side === r.aSide ? r.a : r.b;
    const D = decks.get(d) ?? { n: 0, win: 0, total: 0, cards: new Map(), other: 0 };
    const s = r.w === -1 ? 0.5 : r.w === side ? 1 : 0;
    D.n++; D.win += s;
    const W = worth(r, side);
    const here = new Set([...r.placed.filter((p) => p.side === side).map((p) => p.id), ...r.used.filter((u) => u.side === side).map((u) => u.id)]);
    for (const [id, v] of W) { D.total += v; if (!isCard(id)) D.other += v; else here.add(id); }
    for (const id of here) {
      if (!isCard(id)) continue;
      const c = D.cards.get(id) ?? { v: 0, present: 0, winP: 0 };
      c.present++; c.winP += s; c.v += W.get(id) ?? 0;
      D.cards.set(id, c);
    }
    decks.set(d, D);
  }
}
const f1 = (x: number) => x.toFixed(1);
for (const [d, D] of [...decks].sort()) {
  const rows = [...D.cards].map(([id, c]) => ({ id, ...c, share: c.v / D.total })).filter((c) => c.present / D.n >= 0.05).sort((a, b) => b.share - a.share);
  const top = rows.slice(0, 3).reduce((s, c) => s + c.share, 0);
  console.log(`\n${d}: score ${f1(100 * D.win / D.n)}%, worth ${f1(D.total / D.n)}/match (cards ${f1(100 * (D.total - D.other) / D.total)}%, powers & rests ${f1(100 * D.other / D.total)}%); top card ${f1(100 * (rows[0]?.share ?? 0))}%, top three ${f1(100 * top)}%`);
  console.log(`  ${"card".padEnd(34)} share   PER  out%  score out / missing`);
  for (const c of rows) {
    const absent = D.n - c.present, winA = D.win - c.winP;
    const miss = absent / D.n >= 0.05 ? `${f1(100 * c.winP / c.present)}% / ${f1(100 * winA / absent)}%` : `${f1(100 * c.winP / c.present)}% / (always out)`;
    console.log(`  ${(ALL_DEFS[c.id]?.name ?? c.id).padEnd(34)} ${f1(100 * c.share).padStart(5)}% ${f1(c.v / c.present).padStart(5)} ${f1(100 * c.present / D.n).padStart(5)}  ${miss}`);
  }
}
